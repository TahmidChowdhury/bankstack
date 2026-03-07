import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type NextPaycheck = {
  date: string | null;
  amount: number;
};

@Injectable()
export class IncomeService {
  constructor(private readonly prisma: PrismaService) {}

  async getSources() {
    return this.prisma.incomeSource.findMany({
      orderBy: { source: 'asc' },
    });
  }

  async getSummary() {
    const sources = await this.getSources();
    const totalMonthlyIncome = sources.reduce((sum, source) => sum + source.monthlyIncome, 0);
    const nextPaycheck = this.getNextPaycheck(sources);

    return {
      totalMonthlyIncome,
      nextPaycheckDate: nextPaycheck.date,
      nextPaycheckAmount: nextPaycheck.amount,
      sources,
    };
  }

  private getNextPaycheck(
    sources: Array<{ perPaycheckAmount: number; payDays: number[] }>,
  ): NextPaycheck {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const payoutsByDate = new Map<string, number>();

    for (const source of sources) {
      const uniqueDays = Array.from(new Set(source.payDays))
        .map((day) => Math.floor(day))
        .filter((day) => day >= 1 && day <= 31)
        .sort((a, b) => a - b);

      if (uniqueDays.length === 0) {
        continue;
      }

      const nextDate = this.nextDateForDays(today, uniqueDays);
      const key = nextDate.toISOString().slice(0, 10);
      payoutsByDate.set(key, (payoutsByDate.get(key) ?? 0) + source.perPaycheckAmount);
    }

    if (payoutsByDate.size === 0) {
      return { date: null, amount: 0 };
    }

    const [date, amount] = Array.from(payoutsByDate.entries()).sort((a, b) =>
      a[0].localeCompare(b[0]),
    )[0];

    return { date, amount };
  }

  private nextDateForDays(baseDate: Date, days: number[]): Date {
    const year = baseDate.getFullYear();
    const month = baseDate.getMonth();

    for (const day of days) {
      const candidate = this.clampedDate(year, month, day);
      if (candidate >= baseDate) {
        return candidate;
      }
    }

    const nextMonthDate = new Date(year, month + 1, 1);
    return this.clampedDate(nextMonthDate.getFullYear(), nextMonthDate.getMonth(), days[0]);
  }

  private clampedDate(year: number, month: number, requestedDay: number): Date {
    const lastDay = new Date(year, month + 1, 0).getDate();
    const day = Math.min(requestedDay, lastDay);
    return new Date(year, month, day);
  }
}
