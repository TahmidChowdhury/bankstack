import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type FinancialPlanTarget = {
  accountId: string;
  accountName: string;
  balance: number;
  apr: number;
  minimumPayment: number;
  dueDate: string | null;
  daysUntilDue: number | null;
  priority: number;
  reason: string;
};

type FinancialPlan = {
  totalCash: number;
  totalDebt: number;
  netWorth: number;
  deployableNow: number;
  reserveFloor: number;
  reserveTarget: number;
  reserveCautious: number;
  reserveMonthsCovered: number;
  nextPaycheckDate: string | null;
  nextPaycheckAmount: number;
  monthlyObligations: number;
  monthlyInterestEstimate: number;
  debtUtilization: number;
  plannedPaymentsNext30Days: number;
  topMetrics: {
    availableToDeploy: number;
    totalDebt: number;
    totalCash: number;
    nextPaycheck: number;
  };
  secondaryMetrics: {
    netWorth: number;
    debtUtilization: number;
    monthlyInterest: number;
    plannedPayments: number;
  };
  spending: {
    remainingToSpend: number;
    dailyBudget: number;
    daysRemaining: number;
    fixedObligations: number;
    spentToDate: number;
    monthLabel: string;
  };
  payoffTargets: FinancialPlanTarget[];
  warnings: string[];
};

const MIN_PAYMENT_FLOOR = 25;
const MIN_PAYMENT_PERCENT = 0.03;
const MIN_RESERVE_FLOOR = 3500;
const RECOMMENDED_RESERVE_MULTIPLIER = 1.25;
const CAUTIOUS_RESERVE_MULTIPLIER = 1.5;
const MIN_RECOMMENDED_RESERVE = 4000;
const MIN_CAUTIOUS_RESERVE = 6000;

@Injectable()
export class FinancialPlanService {
  constructor(private readonly prisma: PrismaService) {}

  async getFinancialPlan(reserveOverride?: number): Promise<FinancialPlan> {
    const today = this.startOfDay(new Date());
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const nextMonthStart = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const next30DaysEnd = this.addDays(today, 29);

    const [accounts, incomeSources, recurringExpenses, plannedPayments, transactions] =
      await Promise.all([
        this.prisma.account.findMany({
          select: {
            id: true,
            name: true,
            type: true,
            subtype: true,
            currentBalance: true,
            availableBalance: true,
            minimumPayment: true,
            dueDayOfMonth: true,
            apr: true,
          },
        }),
        this.prisma.incomeSource.findMany({
          select: {
            monthlyIncome: true,
            perPaycheckAmount: true,
            payDays: true,
          },
        }),
        this.prisma.recurringExpense.findMany({
          select: {
            amount: true,
            dayOfMonth: true,
          },
        }),
        this.prisma.plannedPayment.findMany({
          where: {
            status: {
              in: ['PLANNED', 'planned'],
            },
          },
          select: {
            amount: true,
            date: true,
          },
        }),
        this.prisma.transaction.findMany({
          where: {
            date: {
              gte: monthStart,
              lte: today,
            },
            amount: {
              gt: 0,
            },
          },
          select: {
            amount: true,
          },
        }),
      ] as const);

    const depositoryAccounts = accounts.filter((account) => account.type === 'depository');
    const creditAccounts = accounts.filter(
      (account) => account.type === 'credit' || account.subtype === 'credit card',
    );

    const totalCash = this.roundMoney(
      depositoryAccounts.reduce((sum, account) => sum + Math.max(account.currentBalance, 0), 0),
    );
    const totalDebt = this.roundMoney(
      creditAccounts.reduce((sum, account) => sum + Math.max(account.currentBalance, 0), 0),
    );
    const netWorth = this.roundMoney(totalCash - totalDebt);

    const monthlyIncome = incomeSources.reduce((sum, source) => sum + source.monthlyIncome, 0);
    const monthlyRecurring = recurringExpenses.reduce((sum, expense) => sum + expense.amount, 0);
    const monthlyMinimums = creditAccounts.reduce(
      (sum, account) => sum + this.calculateMinimumPayment(account.minimumPayment, account.currentBalance),
      0,
    );
    const monthlyObligations = this.roundMoney(monthlyRecurring + monthlyMinimums);

    const plannedPaymentsCurrentMonth = this.roundMoney(
      plannedPayments
        .filter((payment) => payment.date >= monthStart && payment.date < nextMonthStart)
        .reduce((sum, payment) => sum + payment.amount, 0),
    );
    const plannedPaymentsNext30Days = this.roundMoney(
      plannedPayments
        .filter((payment) => payment.date >= today && payment.date <= next30DaysEnd)
        .reduce((sum, payment) => sum + payment.amount, 0),
    );

    const spentToDate = this.roundMoney(
      transactions.reduce((sum, transaction) => sum + transaction.amount, 0),
    );
    const fixedObligations = this.roundMoney(monthlyObligations + plannedPaymentsCurrentMonth);
    const remainingToSpend = this.roundMoney(monthlyIncome - fixedObligations - spentToDate);
    const daysRemaining = Math.max(monthEnd.getDate() - today.getDate() + 1, 1);
    const dailyBudget = this.roundMoney(remainingToSpend / daysRemaining);

    const reserveFloor = this.roundMoney(Math.max(monthlyObligations, MIN_RESERVE_FLOOR));
    const recommendedReserve = this.roundMoney(
      Math.max(monthlyObligations * RECOMMENDED_RESERVE_MULTIPLIER, MIN_RECOMMENDED_RESERVE),
    );
    const cautiousReserve = this.roundMoney(
      Math.max(monthlyObligations * CAUTIOUS_RESERVE_MULTIPLIER, MIN_CAUTIOUS_RESERVE),
    );
    const reserveTarget = this.clampReserve(
      reserveOverride,
      reserveFloor,
      recommendedReserve,
      totalCash,
    );
    const reserveMonthsCovered =
      monthlyObligations > 0 ? this.roundMoney(reserveTarget / monthlyObligations) : 0;
    const deployableNow = this.roundMoney(Math.max(totalCash - reserveTarget, 0));

    const nextPaycheck = this.nextPaycheck(incomeSources, today);
    const nextPaycheckDate = nextPaycheck ? this.formatDate(nextPaycheck.date) : null;
    const nextPaycheckAmount = this.roundMoney(nextPaycheck?.amount ?? 0);

    const monthlyInterestEstimate = this.roundMoney(
      creditAccounts.reduce((sum, account) => {
        if (!account.apr || account.currentBalance <= 0) {
          return sum;
        }
        return sum + account.currentBalance * (account.apr / 100 / 12);
      }, 0),
    );

    const debtUtilization = this.roundMoney(
      this.calculateDebtUtilization(
        creditAccounts.map((account) => ({
          currentBalance: account.currentBalance,
          availableBalance: account.availableBalance,
        })),
      ),
    );

    const payoffTargets = creditAccounts
      .filter((account) => account.currentBalance > 0)
      .map((account) => {
        const dueDate =
          account.dueDayOfMonth != null
            ? this.nextOccurrence(today, account.dueDayOfMonth)
            : null;
        const daysUntilDue =
          dueDate != null
            ? Math.round((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
            : null;
        const score = this.priorityScore(account.currentBalance, account.apr ?? 0, daysUntilDue);

        return {
          accountId: account.id,
          accountName: account.name,
          balance: this.roundMoney(account.currentBalance),
          apr: this.roundMoney(account.apr ?? 0),
          minimumPayment: this.roundMoney(
            this.calculateMinimumPayment(account.minimumPayment, account.currentBalance),
          ),
          dueDate: dueDate ? this.formatDate(dueDate) : null,
          daysUntilDue,
          score,
        };
      })
      .sort((a, b) => {
        if (a.score !== b.score) {
          return b.score - a.score;
        }
        if (a.balance !== b.balance) {
          return a.balance - b.balance;
        }
        return b.apr - a.apr;
      })
      .map((target, index) => ({
        accountId: target.accountId,
        accountName: target.accountName,
        balance: target.balance,
        apr: target.apr,
        minimumPayment: target.minimumPayment,
        dueDate: target.dueDate,
        daysUntilDue: target.daysUntilDue,
        priority: index + 1,
        reason: this.buildReason(target.balance, target.apr, target.daysUntilDue),
      }));

    const warnings: string[] = [];

    if (totalCash > recommendedReserve * 1.2) {
      warnings.push(
        'Checking is elevated versus a normal month. Treat the excess as windfall cash until you decide how much reserve to keep.',
      );
    }

    if (remainingToSpend < 0) {
      warnings.push('This month is already over budget after fixed obligations and spending to date.');
    }

    if (plannedPaymentsNext30Days <= 0) {
      warnings.push('No planned debt payments are scheduled in the next 30 days yet.');
    }

    if (nextPaycheckDate) {
      warnings.push(`Next paycheck expected on ${nextPaycheckDate}.`);
    }

    return {
      totalCash,
      totalDebt,
      netWorth,
      deployableNow,
      reserveFloor,
      reserveTarget,
      reserveCautious: cautiousReserve,
      reserveMonthsCovered,
      nextPaycheckDate,
      nextPaycheckAmount,
      monthlyObligations,
      monthlyInterestEstimate,
      debtUtilization,
      plannedPaymentsNext30Days,
      topMetrics: {
        availableToDeploy: deployableNow,
        totalDebt,
        totalCash,
        nextPaycheck: nextPaycheckAmount,
      },
      secondaryMetrics: {
        netWorth,
        debtUtilization,
        monthlyInterest: monthlyInterestEstimate,
        plannedPayments: plannedPaymentsNext30Days,
      },
      spending: {
        remainingToSpend,
        dailyBudget,
        daysRemaining,
        fixedObligations,
        spentToDate,
        monthLabel: `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}`,
      },
      payoffTargets,
      warnings,
    };
  }

  private calculateMinimumPayment(stored: number | null, balance: number): number {
    if (stored != null && stored > 0) {
      return stored;
    }
    return Math.max(MIN_PAYMENT_FLOOR, balance * MIN_PAYMENT_PERCENT);
  }

  private calculateDebtUtilization(
    accounts: Array<{ currentBalance: number; availableBalance: number | null }>,
  ): number {
    const totalUsed = accounts.reduce((sum, account) => sum + Math.max(account.currentBalance, 0), 0);
    const totalLimit = accounts.reduce(
      (sum, account) =>
        sum + Math.max(account.currentBalance, 0) + Math.max(account.availableBalance ?? 0, 0),
      0,
    );

    if (totalLimit <= 0) {
      return 0;
    }

    return (totalUsed / totalLimit) * 100;
  }

  private priorityScore(balance: number, apr: number, daysUntilDue: number | null): number {
    let score = apr;

    if (balance <= 75) {
      score += 24;
    } else if (balance <= 500) {
      score += 14;
    } else if (balance <= 1500) {
      score += 8;
    }

    if (daysUntilDue != null && daysUntilDue <= 3) {
      score += 16;
    } else if (daysUntilDue != null && daysUntilDue <= 7) {
      score += 8;
    }

    return score;
  }

  private buildReason(balance: number, apr: number, daysUntilDue: number | null): string {
    if (balance <= 75) {
      return 'Tiny high-interest balance. Clear it immediately and move on.';
    }
    if (balance <= 500) {
      return 'Small balance quick win without sacrificing debt efficiency.';
    }
    if (daysUntilDue != null && daysUntilDue <= 3 && apr >= 20) {
      return 'High APR and due soon. This is the most urgent toxic balance.';
    }
    if (apr >= 24) {
      return 'Highest APR balance. Every month you wait is expensive.';
    }
    if (apr >= 20) {
      return 'Still expensive debt. This should be in the first payoff wave.';
    }
    if (daysUntilDue != null && daysUntilDue <= 7) {
      return 'Due soon. Keep it current, but prioritize worse APR debt first.';
    }
    return 'Lower-cost balance. Keep it lower in the payoff stack for now.';
  }

  private clampReserve(
    reserveOverride: number | undefined,
    reserveFloor: number,
    recommendedReserve: number,
    totalCash: number,
  ): number {
    if (!Number.isFinite(reserveOverride)) {
      return Math.min(recommendedReserve, totalCash);
    }

    const normalized = Math.max(0, reserveOverride ?? recommendedReserve);
    return Math.min(Math.max(normalized, reserveFloor), totalCash);
  }

  private nextPaycheck(
    sources: Array<{ perPaycheckAmount: number; payDays: number[] }>,
    today: Date,
  ): { date: Date; amount: number } | null {
    const payoutsByDate = new Map<string, number>();

    for (const source of sources) {
      const payDays = Array.from(new Set(source.payDays.map((day) => Math.floor(day))))
        .filter((day) => day >= 1 && day <= 31)
        .sort((a, b) => a - b);

      for (const payDay of payDays) {
        const date = this.nextOccurrence(today, payDay);
        const key = this.formatDate(date);
        payoutsByDate.set(key, (payoutsByDate.get(key) ?? 0) + source.perPaycheckAmount);
      }
    }

    if (payoutsByDate.size === 0) {
      return null;
    }

    const [date, amount] = Array.from(payoutsByDate.entries()).sort((a, b) =>
      a[0].localeCompare(b[0]),
    )[0];

    return { date: new Date(`${date}T00:00:00`), amount };
  }

  private nextOccurrence(from: Date, dayOfMonth: number): Date {
    const lastDay = new Date(from.getFullYear(), from.getMonth() + 1, 0).getDate();
    const clampedDay = Math.min(Math.max(Math.floor(dayOfMonth), 1), lastDay);
    const candidate = new Date(from.getFullYear(), from.getMonth(), clampedDay);

    if (candidate >= from) {
      return candidate;
    }

    const nextMonth = new Date(from.getFullYear(), from.getMonth() + 1, 1);
    const nextMonthLastDay = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate();
    return new Date(
      nextMonth.getFullYear(),
      nextMonth.getMonth(),
      Math.min(clampedDay, nextMonthLastDay),
    );
  }

  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return this.startOfDay(result);
  }

  private startOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private roundMoney(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
