import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type PlannerResponse = {
  nextPaycheckAmount: number;
  paycheckDate: string | null;
  requiredPayments: {
    recurringBills: number;
    creditCardMinimums: number;
    totalRequired: number;
    minimumPaymentCards: Array<{
      accountName: string;
      amount: number;
      dueDayOfMonth: number;
    }>;
  };
  suggestedAllocation: {
    recurringBills: number;
    creditCardMinimums: number;
    livingExpenses: number;
    extraDebtPayment: number;
    remainingBuffer: number;
  };
  recommendedCard: {
    accountId: string;
    accountName: string;
    apr: number;
    currentBalance: number;
  } | null;
};

@Injectable()
export class PaycheckService {
  constructor(private readonly prisma: PrismaService) {}

  async getPlanner(): Promise<PlannerResponse> {
    const [incomeSources, recurringExpenses, creditAccounts] = await Promise.all([
      this.prisma.incomeSource.findMany(),
      this.prisma.recurringExpense.findMany(),
      this.prisma.account.findMany({
        where: {
          type: 'credit',
          currentBalance: { gt: 0 },
        },
      }),
    ]);

    const today = this.startOfDay(new Date());
    const nextPaycheck = this.nextPaycheck(incomeSources, today);

    const recurringBills = this.sumRecurringBillsDueBefore(
      recurringExpenses,
      today,
      nextPaycheck?.date ?? this.addDays(today, 30),
    );
    const minimumPaymentCards = this.minimumPaymentsDueBeforePaycheck(
      creditAccounts,
      today,
      nextPaycheck?.date ?? this.addDays(today, 30),
    );
    const creditCardMinimums = minimumPaymentCards.reduce((sum, card) => sum + card.amount, 0);
    const totalRequired = recurringBills + creditCardMinimums;

    const paycheckAmount = nextPaycheck?.amount ?? 0;
    const livingPercent = this.readBoundedPercent(
      process.env.PAYCHECK_LIVING_EXPENSE_PERCENT,
      0.25,
      0.2,
      0.3,
    );
    const discretionaryBufferPercent = this.readBoundedPercent(
      process.env.PAYCHECK_BUFFER_PERCENT,
      0.1,
      0,
      0.5,
    );

    const livingExpenses = Math.max(paycheckAmount * livingPercent, 0);
    const discretionary = paycheckAmount - totalRequired - livingExpenses;
    const remainingBuffer = discretionary > 0 ? discretionary * discretionaryBufferPercent : 0;
    const extraDebtPayment = Math.max(discretionary - remainingBuffer, 0);

    const sortedByApr = [...creditAccounts].sort((a, b) => (b.apr ?? 0) - (a.apr ?? 0));
    const recommendedCard = sortedByApr[0]
      ? {
          accountId: sortedByApr[0].id,
          accountName: sortedByApr[0].name,
          apr: sortedByApr[0].apr ?? 0,
          currentBalance: sortedByApr[0].currentBalance,
        }
      : null;

    return {
      nextPaycheckAmount: Number(paycheckAmount.toFixed(2)),
      paycheckDate: nextPaycheck?.date.toISOString().slice(0, 10) ?? null,
      requiredPayments: {
        recurringBills: Number(recurringBills.toFixed(2)),
        creditCardMinimums: Number(creditCardMinimums.toFixed(2)),
        totalRequired: Number(totalRequired.toFixed(2)),
        minimumPaymentCards,
      },
      suggestedAllocation: {
        recurringBills: Number(recurringBills.toFixed(2)),
        creditCardMinimums: Number(creditCardMinimums.toFixed(2)),
        livingExpenses: Number(livingExpenses.toFixed(2)),
        extraDebtPayment: Number(extraDebtPayment.toFixed(2)),
        remainingBuffer: Number(Math.max(remainingBuffer, 0).toFixed(2)),
      },
      recommendedCard,
    };
  }

  private nextPaycheck(
    sources: Array<{ perPaycheckAmount: number; payDays: number[] }>,
    today: Date,
  ): { date: Date; amount: number } | null {
    const payoutsByDate = new Map<string, number>();

    for (const source of sources) {
      const days = this.normalizeDays(source.payDays);
      for (const day of days) {
        const date = this.nextDateForDay(today, day);
        const key = date.toISOString().slice(0, 10);
        payoutsByDate.set(key, (payoutsByDate.get(key) ?? 0) + source.perPaycheckAmount);
      }
    }

    if (payoutsByDate.size === 0) {
      return null;
    }

    const [date, amount] = Array.from(payoutsByDate.entries()).sort((a, b) =>
      a[0].localeCompare(b[0]),
    )[0];
    return { date: new Date(`${date}T00:00:00.000Z`), amount };
  }

  private sumRecurringBillsDueBefore(
    expenses: Array<{ amount: number; dayOfMonth: number }>,
    start: Date,
    end: Date,
  ): number {
    let total = 0;
    for (const expense of expenses) {
      const dueDates = this.datesForDayOfMonthInRange(start, end, expense.dayOfMonth);
      total += dueDates.length * expense.amount;
    }
    return total;
  }

  private minimumPaymentsDueBeforePaycheck(
    creditAccounts: Array<{
      name: string;
      minimumPayment: number | null;
      dueDayOfMonth: number | null;
      type: string;
    }>,
    today: Date,
    nextPaycheckDate: Date,
  ): Array<{ accountName: string; amount: number; dueDayOfMonth: number }> {
    return creditAccounts
      .filter((account) => account.type === 'credit')
      .filter((account) => (account.minimumPayment ?? 0) > 0)
      .filter((account) => account.dueDayOfMonth != null)
      .filter((account) => {
        const dueDate = this.nextDateForDay(today, account.dueDayOfMonth ?? 1);
        return dueDate <= nextPaycheckDate;
      })
      .map((account) => ({
        accountName: account.name,
        amount: Number((account.minimumPayment ?? 0).toFixed(2)),
        dueDayOfMonth: account.dueDayOfMonth ?? 1,
      }))
      .sort((a, b) => a.dueDayOfMonth - b.dueDayOfMonth);
  }

  private datesForDayOfMonthInRange(start: Date, end: Date, dayOfMonth: number): Date[] {
    const result: Date[] = [];
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    const monthEnd = new Date(end.getFullYear(), end.getMonth(), 1);

    while (cursor <= monthEnd) {
      const year = cursor.getFullYear();
      const month = cursor.getMonth();
      const candidate = this.clampedDate(year, month, dayOfMonth);
      if (candidate >= start && candidate <= end) {
        result.push(candidate);
      }
      cursor.setMonth(cursor.getMonth() + 1);
    }

    return result;
  }

  private nextDateForDay(baseDate: Date, dayOfMonth: number): Date {
    const currentMonthDate = this.clampedDate(
      baseDate.getFullYear(),
      baseDate.getMonth(),
      dayOfMonth,
    );

    if (currentMonthDate >= baseDate) {
      return currentMonthDate;
    }

    const nextMonth = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 1);
    return this.clampedDate(nextMonth.getFullYear(), nextMonth.getMonth(), dayOfMonth);
  }

  private clampedDate(year: number, month: number, requestedDay: number): Date {
    const lastDay = new Date(year, month + 1, 0).getDate();
    const day = Math.min(Math.max(requestedDay, 1), lastDay);
    return new Date(year, month, day);
  }

  private normalizeDays(days: number[]): number[] {
    return Array.from(new Set(days.map((day) => Math.floor(day))))
      .filter((day) => day >= 1 && day <= 31)
      .sort((a, b) => a - b);
  }

  private readBoundedPercent(
    value: string | undefined,
    fallback: number,
    min: number,
    max: number,
  ): number {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return Math.min(max, Math.max(min, parsed));
    }
    return fallback;
  }

  private startOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private addDays(date: Date, days: number): Date {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return this.startOfDay(next);
  }
}
