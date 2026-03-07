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

@Injectable()
export class CashflowService {
  constructor(private readonly prisma: PrismaService) {}

  async getForecast() {
    const today = this.startOfDay(new Date());
    const horizonDays = 30;
    const end = this.addDays(today, horizonDays - 1);

    const [incomeSources, recurringExpenses, accounts] = await Promise.all([
      this.prisma.incomeSource.findMany(),
      this.prisma.recurringExpense.findMany(),
      this.prisma.account.findMany({
        where: { type: 'depository' },
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

    const incomeNext30Days = paychecks.reduce((sum, item) => sum + item.amount, 0);
    const expensesNext30Days = upcomingBills.reduce((sum, bill) => sum + bill.amount, 0);
    const netCashflow = incomeNext30Days - expensesNext30Days;

    paychecks.sort((a, b) => a.date.localeCompare(b.date));
    upcomingBills.sort((a, b) => a.dueDate.localeCompare(b.dueDate));

    const nextPaycheck = paychecks[0] ?? null;

    const dailyDelta = new Map<string, number>();
    for (const paycheck of paychecks) {
      dailyDelta.set(paycheck.date, (dailyDelta.get(paycheck.date) ?? 0) + paycheck.amount);
    }
    for (const bill of upcomingBills) {
      dailyDelta.set(bill.dueDate, (dailyDelta.get(bill.dueDate) ?? 0) - bill.amount);
    }

    const projectedBalance = [];
    let runningBalance = startingCash;
    for (let i = 0; i < horizonDays; i++) {
      const day = this.addDays(today, i);
      const key = this.formatDate(day);
      runningBalance += dailyDelta.get(key) ?? 0;
      projectedBalance.push({
        date: key,
        balance: Number(runningBalance.toFixed(2)),
      });
    }

    return {
      incomeNext30Days: Number(incomeNext30Days.toFixed(2)),
      expensesNext30Days: Number(expensesNext30Days.toFixed(2)),
      netCashflow: Number(netCashflow.toFixed(2)),
      upcomingBills,
      nextPaycheck,
      startingCash: Number(startingCash.toFixed(2)),
      projectedBalance,
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
