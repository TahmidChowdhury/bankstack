import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type DatedAmount = {
  date: string;
  amount: number;
};

type UpcomingBill = {
  name: string;
  amount: number;
  dueDate: string;
};

type RecurringExpenseDay = {
  name: string;
  category: string;
  amount: number;
  dayOfMonth: number;
};

type PlannedPaymentPoint = {
  id: string;
  accountName: string;
  amount: number;
  date: string;
  source: string | null;
  strategy: string | null;
  status: string;
};

@Injectable()
export class CashflowService {
  constructor(private readonly prisma: PrismaService) {}

  async getRecurringExpenses(): Promise<RecurringExpenseDay[]> {
    const expenses = await this.prisma.recurringExpense.findMany({
      select: {
        name: true,
        category: true,
        amount: true,
        dayOfMonth: true,
      },
      orderBy: [{ dayOfMonth: 'asc' }, { name: 'asc' }],
    });

    return expenses.map((expense) => ({
      name: expense.name,
      category: expense.category,
      amount: Number(expense.amount.toFixed(2)),
      dayOfMonth: expense.dayOfMonth,
    }));
  }

  async getForecast(strategy?: string) {
    const today = this.startOfDay(new Date());
    const horizonDays = 30;
    const end = this.addDays(today, horizonDays - 1);

    const [incomeSources, recurringExpenses, accounts, plannedPayments, creditAccounts] = await Promise.all([
      this.prisma.incomeSource.findMany(),
      this.prisma.recurringExpense.findMany(),
      this.prisma.account.findMany({
        where: { type: 'depository' },
      }),

      this.prisma.plannedPayment.findMany({
        where: {
          status: {
            in: ['PLANNED', 'planned'],
          },
          date: {
            gte: today,
            lte: end,
          },
        },
        include: {
          account: {
            select: {
              name: true,
            },
          },
        },
      }),
      this.prisma.account.findMany({
        where: { type: 'credit' },
        select: {
          id: true,
          name: true,
          currentBalance: true,
          apr: true,
          minimumPayment: true,
          dueDayOfMonth: true,
        },
      }),
    ]);

    const startingCash = accounts.reduce(
      (sum, account) => sum + Math.max(account.currentBalance, 0),
      0,
    );

    const paychecks: DatedAmount[] = [];
    for (const source of incomeSources) {
      const days = this.normalizeDays(source.payDays);
      for (const day of days) {
        const dates = this.datesForDayOfMonthInRange(today, end, day);
        for (const date of dates) {
          paychecks.push({ date: this.formatDate(date), amount: source.perPaycheckAmount });
        }
      }
    }

    const upcomingBills: UpcomingBill[] = [];
    for (const expense of recurringExpenses) {
      const dates = this.datesForDayOfMonthInRange(today, end, expense.dayOfMonth);
      for (const date of dates) {
        upcomingBills.push({
          name: expense.name,
          amount: expense.amount,
          dueDate: this.formatDate(date),
        });
      }
    }

    // --- Credit card minimum + strategy extra payments ---
    const normalizedStrategy =
      strategy === 'avalanche' ? 'avalanche' : strategy === 'snowball' ? 'snowball' : null;
    const activeCards = creditAccounts.filter(
      (c) => c.currentBalance > 0 && c.dueDayOfMonth != null,
    );
    const MIN_FLOOR = 25;
    const cardMin = new Map<string, number>();
    for (const card of activeCards) {
      const min =
        card.minimumPayment != null && card.minimumPayment > 0
          ? card.minimumPayment
          : Math.max(MIN_FLOOR, card.currentBalance * 0.02);
      cardMin.set(card.id, min);
    }
    const cardExtra = new Map<string, number>();
    if (normalizedStrategy) {
      const totalMonthlyIncome = incomeSources.reduce((s, i) => s + i.monthlyIncome, 0);
      const totalMonthlyRecurring = recurringExpenses.reduce((s, e) => s + e.amount, 0);
      const totalMinimums = [...cardMin.values()].reduce((s, v) => s + v, 0);
      let extraBudget = Math.max(0, totalMonthlyIncome - totalMonthlyRecurring - totalMinimums);
      const sorted = [...activeCards].sort((a, b) =>
        normalizedStrategy === 'avalanche'
          ? (b.apr ?? 0) - (a.apr ?? 0)
          : a.currentBalance - b.currentBalance,
      );
      for (const card of sorted) {
        if (extraBudget <= 0.01) break;
        const min = cardMin.get(card.id) ?? 0;
        const maxExtra = Math.max(0, card.currentBalance - min);
        const extra = Math.min(extraBudget, maxExtra);
        cardExtra.set(card.id, extra);
        extraBudget -= extra;
      }
    }
    // Keys of planned records so we don't double-count
    const plannedKeys = new Set(
      plannedPayments.map((pp) => `${pp.accountId}-${this.formatDate(pp.date)}`),
    );
    // card bills for the base (min-only) projection — not part of upcomingBills list
    type CardBill = { id: string; minAmount: number; strategyAmount: number; dueDate: string };
    const cardBills: CardBill[] = [];
    for (const card of activeCards) {
      const dueDates = this.datesForDayOfMonthInRange(today, end, card.dueDayOfMonth!);
      for (const date of dueDates) {
        const dateStr = this.formatDate(date);
        if (plannedKeys.has(`${card.id}-${dateStr}`)) continue;
        const minAmt = cardMin.get(card.id) ?? 0;
        const extraAmt = cardExtra.get(card.id) ?? 0;
        cardBills.push({ id: card.id, minAmount: minAmt, strategyAmount: minAmt + extraAmt, dueDate: dateStr });
        upcomingBills.push({ name: card.name, amount: Number((minAmt + extraAmt).toFixed(2)), dueDate: dateStr });
      }
    }
    // ---------------------------------------------------

    const incomeNext30Days = paychecks.reduce((sum, item) => sum + item.amount, 0);
    const plannedPaymentTotal = plannedPayments.reduce((sum, item) => sum + item.amount, 0);
    const expensesNext30Days =
      upcomingBills.reduce((sum, bill) => sum + bill.amount, 0) + plannedPaymentTotal;
    const netCashflow = incomeNext30Days - expensesNext30Days;

    paychecks.sort((a, b) => a.date.localeCompare(b.date));
    upcomingBills.sort((a, b) => a.dueDate.localeCompare(b.dueDate));

    const nextPaycheck = paychecks[0] ?? null;

    // Build per-day lookup maps for the sequential projection
    const add = (map: Map<string, number>, key: string, val: number) =>
      map.set(key, (map.get(key) ?? 0) + val);

    const incomeMap = new Map<string, number>();
    const recurringMap = new Map<string, number>();
    const cardMinMap = new Map<string, number>();
    const cardExtraMap = new Map<string, number>();
    const plannedMap = new Map<string, number>();

    for (const paycheck of paychecks) {
      add(incomeMap, paycheck.date, paycheck.amount);
    }
    for (const expense of recurringExpenses) {
      const dates = this.datesForDayOfMonthInRange(today, end, expense.dayOfMonth);
      for (const date of dates) {
        add(recurringMap, this.formatDate(date), expense.amount);
      }
    }
    for (const cb of cardBills) {
      add(cardMinMap, cb.dueDate, cb.minAmount);
      add(cardExtraMap, cb.dueDate, cb.strategyAmount - cb.minAmount);
    }
    for (const pp of plannedPayments) {
      add(plannedMap, this.formatDate(pp.date), pp.amount);
    }

    const projectionPlannedPayments: PlannedPaymentPoint[] = plannedPayments
      .map((item) => ({
        id: item.id,
        accountName: item.account.name,
        amount: Number(item.amount.toFixed(2)),
        date: this.formatDate(item.date),
        source: item.source,
        strategy: item.strategy,
        status: item.status,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Sequential day-by-day projection so extras are capped to actual available cash.
    // Before spending any strategy extra, look ahead and reserve enough cash to cover
    // all mandatory bills until the next paycheck arrives, plus a safety buffer.
    const SAFETY_BUFFER = 150;
    // Amount transferred to external savings (e.g. brokerage) on each paycheck.
    // This is projected as a separate "with savings" scenario.
    const SAVINGS_TRANSFER_PER_PAYCHECK = 100;
    const projectedBalance = [];
    const projectedBalanceBase = [];
    const projectedBalanceWithSavings = [];
    let runningStrategy = startingCash;
    let runningBase = startingCash;
    let runningWithSavings = startingCash;
    for (let i = 0; i < horizonDays; i++) {
      const key = this.formatDate(this.addDays(today, i));
      const income = incomeMap.get(key) ?? 0;
      const recurring = recurringMap.get(key) ?? 0;
      const cardMinAmt = cardMinMap.get(key) ?? 0;
      const cardEx = cardExtraMap.get(key) ?? 0;
      const planned = plannedMap.get(key) ?? 0;
      const isPayday = income > 0;

      // Base: income then mandatory outflows only (no strategy extras)
      runningBase += income;
      runningBase -= recurring + cardMinAmt + planned;

      // Strategy: income in, mandatory out, then look-ahead cap on extras
      runningStrategy += income;
      runningStrategy -= recurring + cardMinAmt + planned;

      if (cardEx > 0) {
        // Sum all mandatory obligations between tomorrow and the next paycheck
        let reserveNeeded = SAFETY_BUFFER;
        for (let j = i + 1; j < horizonDays; j++) {
          const futureKey = this.formatDate(this.addDays(today, j));
          if ((incomeMap.get(futureKey) ?? 0) > 0) break; // next paycheck found — stop reserving
          reserveNeeded +=
            (recurringMap.get(futureKey) ?? 0) +
            (cardMinMap.get(futureKey) ?? 0) +
            (plannedMap.get(futureKey) ?? 0);
        }
        const affordableExtra = Math.min(cardEx, Math.max(0, runningStrategy - reserveNeeded));
        runningStrategy -= affordableExtra;
      }

      // With savings: same as strategy but also deducts savings transfer on each paycheck
      runningWithSavings = runningStrategy - (isPayday ? SAVINGS_TRANSFER_PER_PAYCHECK : 0);

      projectedBalance.push({ date: key, balance: Number(runningStrategy.toFixed(2)) });
      projectedBalanceBase.push({ date: key, balance: Number(runningBase.toFixed(2)) });
      projectedBalanceWithSavings.push({ date: key, balance: Number(runningWithSavings.toFixed(2)) });
    }

    return {
      incomeNext30Days: Number(incomeNext30Days.toFixed(2)),
      expensesNext30Days: Number(expensesNext30Days.toFixed(2)),
      netCashflow: Number(netCashflow.toFixed(2)),
      upcomingBills,
      plannedPayments: projectionPlannedPayments,
      nextPaycheck,
      startingCash: Number(startingCash.toFixed(2)),
      projectedBalance,
      projectedBalanceBase,
      projectedBalanceWithSavings,
    };
  }

  private normalizeDays(days: number[]): number[] {
    return Array.from(new Set(days.map((day) => Math.floor(day))))
      .filter((day) => day >= 1 && day <= 31)
      .sort((a, b) => a - b);
  }

  private datesForDayOfMonthInRange(start: Date, end: Date, dayOfMonth: number): Date[] {
    const result: Date[] = [];
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    const monthEnd = new Date(end.getFullYear(), end.getMonth(), 1);

    while (cursor <= monthEnd) {
      const year = cursor.getFullYear();
      const month = cursor.getMonth();
      const lastDay = new Date(year, month + 1, 0).getDate();
      const day = Math.min(dayOfMonth, lastDay);
      const candidate = new Date(year, month, day);

      if (candidate >= start && candidate <= end) {
        result.push(candidate);
      }

      cursor.setMonth(cursor.getMonth() + 1);
    }

    return result;
  }

  private startOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private addDays(date: Date, days: number): Date {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return this.startOfDay(next);
  }

  private formatDate(date: Date): string {
    return date.toISOString().slice(0, 10);
  }
}
