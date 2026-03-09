import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type Strategy = 'avalanche' | 'snowball' | 'hybrid';

type AccountState = {
  accountId: string;
  accountName: string;
  balance: number;
  apr: number;
  minimumPayment: number;
  dueDayOfMonth: number | null;
};

type MonthlyPlanPayment = {
  accountId: string;
  accountName: string;
  amount: number;
  minimumPayment: number;
  paymentDate: string;
  dueDate: string | null;
  remainingBalance: number;
};

type MonthlyPlanEntry = {
  month: string;
  payments: MonthlyPlanPayment[];
};

type GeneratedPlan = {
  payoffDate: string | null;
  totalInterest: number;
  monthsRemaining: number | null;
  interestSavedVsMinimumOnly: number;
  monthlyPlan: MonthlyPlanEntry[];
};

type PlannedCommitment = {
  accountId: string;
  amount: number;
  date: Date;
  status: string;
};

type SimulationResult = {
  totalInterest: number;
  monthsToPayoff: number | null;
  monthlyPlan: MonthlyPlanEntry[];
};

const DEFAULT_APR = 20;
const MIN_PAYMENT_FLOOR = 25;
const MIN_PAYMENT_PERCENT = 0.02;
const MAX_SIM_MONTHS = 600;

@Injectable()
export class DebtPlanService {
  constructor(private readonly prisma: PrismaService) {}

  async generateDebtPlan(strategy: string, months: number): Promise<GeneratedPlan> {
    const normalizedStrategy = this.normalizeStrategy(strategy);
    const horizonMonths = this.normalizeMonthCount(months);

    const [accounts, incomeSources, recurringExpenses, plannedPayments] = await Promise.all([
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
      this.prisma.incomeSource.findMany({
        select: {
          monthlyIncome: true,
        },
      }),
      this.prisma.recurringExpense.findMany({
        select: {
          amount: true,
        },
      }),
      this.prisma.plannedPayment.findMany({
        select: {
          accountId: true,
          amount: true,
          date: true,
          status: true,
        },
      }),
    ]);

    const debtAccounts: AccountState[] = accounts
      .filter((account) => account.currentBalance > 0)
      .map((account) => ({
        accountId: account.id,
        accountName: account.name,
        balance: account.currentBalance,
        apr: account.apr ?? DEFAULT_APR,
        minimumPayment:
          account.minimumPayment && account.minimumPayment > 0
            ? account.minimumPayment
            : Math.max(MIN_PAYMENT_FLOOR, account.currentBalance * MIN_PAYMENT_PERCENT),
        dueDayOfMonth: account.dueDayOfMonth ?? null,
      }));

    const monthlyIncome = incomeSources.reduce((sum, source) => sum + source.monthlyIncome, 0);
    const monthlyRecurring = recurringExpenses.reduce((sum, expense) => sum + expense.amount, 0);
    const commitments: PlannedCommitment[] = plannedPayments.map((item) => ({
      accountId: item.accountId,
      amount: item.amount,
      date: item.date,
      status: item.status,
    }));

    const startMonth = this.startOfMonth(new Date());

    const strategyResult = this.simulate({
      accounts: debtAccounts,
      monthlyIncome,
      monthlyRecurring,
      strategy: normalizedStrategy,
      maxMonths: horizonMonths,
      includeExtraPayments: true,
      plannedCommitments: commitments,
      startMonth,
    });

    const minimumOnlyResult = this.simulate({
      accounts: debtAccounts,
      monthlyIncome,
      monthlyRecurring,
      strategy: 'avalanche',
      maxMonths: MAX_SIM_MONTHS,
      includeExtraPayments: false,
      plannedCommitments: [],
      startMonth,
    });

    const strategyFullRun = this.simulate({
      accounts: debtAccounts,
      monthlyIncome,
      monthlyRecurring,
      strategy: normalizedStrategy,
      maxMonths: MAX_SIM_MONTHS,
      includeExtraPayments: true,
      plannedCommitments: commitments,
      startMonth,
    });

    let payoffDate: string | null = null;
    if (strategyFullRun.monthsToPayoff != null) {
      const payoffMonthOffset = Math.max(strategyFullRun.monthsToPayoff - 1, 0);
      payoffDate = this.formatDate(this.addMonths(startMonth, payoffMonthOffset));
    }

    return {
      payoffDate,
      totalInterest: Number(strategyFullRun.totalInterest.toFixed(2)),
      monthsRemaining: strategyFullRun.monthsToPayoff,
      interestSavedVsMinimumOnly: Number(
        Math.max(minimumOnlyResult.totalInterest - strategyFullRun.totalInterest, 0).toFixed(2),
      ),
      monthlyPlan: strategyResult.monthlyPlan,
    };
  }

  private simulate(params: {
    accounts: AccountState[];
    monthlyIncome: number;
    monthlyRecurring: number;
    strategy: Strategy;
    maxMonths: number;
    includeExtraPayments: boolean;
    plannedCommitments: PlannedCommitment[];
    startMonth: Date;
  }): SimulationResult {
    const state = params.accounts.map((account) => ({ ...account }));
    let totalInterest = 0;
    let monthsToPayoff: number | null = null;
    const monthlyPlan: MonthlyPlanEntry[] = [];

    for (let monthIndex = 0; monthIndex < params.maxMonths; monthIndex += 1) {
      if (!state.some((account) => account.balance > 0.01)) {
        monthsToPayoff = monthIndex;
        break;
      }

      const monthDate = this.addMonths(params.startMonth, monthIndex);
      const monthKey = this.formatMonth(monthDate);
      const paymentMap = new Map<string, { total: number; minimum: number }>();

      const minimumTotal = state
        .filter((account) => account.balance > 0.01)
        .reduce((sum, account) => sum + account.minimumPayment, 0);

      const monthlyPlanned = params.plannedCommitments
        .filter((item) => this.sameYearMonth(item.date, monthDate))
        .filter((item) => item.status.toUpperCase() === 'PLANNED');

      const plannedCommitmentTotal = monthlyPlanned.reduce((sum, item) => sum + item.amount, 0);
      let available =
        params.monthlyIncome - params.monthlyRecurring - minimumTotal - plannedCommitmentTotal;

      let spentPlanned = 0;
      for (const commitment of monthlyPlanned) {
        const account = state.find((item) => item.accountId === commitment.accountId);
        if (!account || account.balance <= 0.01) {
          continue;
        }
        const amountPaid = Math.min(account.balance, commitment.amount);
        account.balance -= amountPaid;
        spentPlanned += amountPaid;
        const existing = paymentMap.get(account.accountId) ?? { total: 0, minimum: 0 };
        paymentMap.set(account.accountId, {
          total: existing.total + amountPaid,
          minimum: existing.minimum,
        });
      }
      available += plannedCommitmentTotal - spentPlanned;

      let spentMinimum = 0;
      for (const account of state) {
        if (account.balance <= 0.01) {
          continue;
        }
        const amountPaid = Math.min(account.balance, account.minimumPayment);
        account.balance -= amountPaid;
        spentMinimum += amountPaid;
        const existing = paymentMap.get(account.accountId) ?? { total: 0, minimum: 0 };
        paymentMap.set(account.accountId, {
          total: existing.total + amountPaid,
          minimum: existing.minimum + amountPaid,
        });
      }
      available += minimumTotal - spentMinimum;

      if (params.includeExtraPayments) {
        while (available > 0.01) {
          const candidates = state.filter((account) => account.balance > 0.01);
          if (!candidates.length) {
            break;
          }
          const target = this.pickTargetAccount(candidates, params.strategy);
          const amountPaid = Math.min(available, target.balance);
          target.balance -= amountPaid;
          available -= amountPaid;
          const existing = paymentMap.get(target.accountId) ?? { total: 0, minimum: 0 };
          paymentMap.set(target.accountId, {
            total: existing.total + amountPaid,
            minimum: existing.minimum,
          });
        }
      }

      for (const account of state) {
        if (account.balance <= 0.01) {
          account.balance = 0;
          continue;
        }
        const interest = account.balance * (account.apr / 100 / 12);
        account.balance += interest;
        totalInterest += interest;
      }

      const payments: MonthlyPlanPayment[] = Array.from(paymentMap.entries())
        .filter(([, amounts]) => amounts.total > 0)
        .map(([accountId, amounts]) => {
          const account = state.find((item) => item.accountId === accountId);
          const dueDate =
            account?.dueDayOfMonth != null
              ? this.formatDate(this.dateForDayInMonth(monthDate, account.dueDayOfMonth))
              : null;
          const paymentDate = dueDate ?? this.formatDate(this.dateForDayInMonth(monthDate, 1));
          return {
            accountId,
            accountName: account?.accountName ?? 'Unknown',
            amount: Number(amounts.total.toFixed(2)),
            minimumPayment: Number(amounts.minimum.toFixed(2)),
            paymentDate,
            dueDate,
            remainingBalance: Number((account?.balance ?? 0).toFixed(2)),
          };
        })
        .sort((a, b) => b.amount - a.amount);

      monthlyPlan.push({
        month: monthKey,
        payments,
      });
    }

    if (monthsToPayoff == null && !state.some((account) => account.balance > 0.01)) {
      monthsToPayoff = monthlyPlan.length;
    }

    return {
      totalInterest,
      monthsToPayoff,
      monthlyPlan,
    };
  }

  private pickTargetAccount(accounts: AccountState[], strategy: Strategy): AccountState {
    if (strategy === 'snowball') {
      return [...accounts].sort((a, b) => {
        if (a.balance !== b.balance) {
          return a.balance - b.balance;
        }
        return b.apr - a.apr;
      })[0];
    }

    if (strategy === 'hybrid') {
      return [...accounts].sort((a, b) => {
        const scoreA = a.apr * 0.7 + (1 / Math.max(a.balance, 1)) * 1000 * 0.3;
        const scoreB = b.apr * 0.7 + (1 / Math.max(b.balance, 1)) * 1000 * 0.3;
        return scoreB - scoreA;
      })[0];
    }

    return [...accounts].sort((a, b) => {
      if (a.apr !== b.apr) {
        return b.apr - a.apr;
      }
      return a.balance - b.balance;
    })[0];
  }

  private normalizeStrategy(strategy: string): Strategy {
    const value = (strategy || 'avalanche').toLowerCase();
    if (value === 'snowball') {
      return 'snowball';
    }
    if (value === 'hybrid') {
      return 'hybrid';
    }
    return 'avalanche';
  }

  private normalizeMonthCount(months: number): number {
    if (!Number.isFinite(months)) {
      return 12;
    }
    return Math.max(1, Math.min(60, Math.floor(months)));
  }

  private startOfMonth(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  private addMonths(date: Date, months: number): Date {
    return new Date(date.getFullYear(), date.getMonth() + months, 1);
  }

  private sameYearMonth(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
  }

  private formatMonth(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private dateForDayInMonth(monthDate: Date, dayOfMonth: number): Date {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const lastDay = new Date(year, month + 1, 0).getDate();
    const day = Math.min(Math.max(Math.floor(dayOfMonth), 1), lastDay);
    return new Date(year, month, day);
  }
}
