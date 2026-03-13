import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type CategorySpend = {
  category: string;
  amount: number;
  share: number;
};

@Injectable()
export class InsightsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSpendingInsights() {
    const today = this.startOfDay(new Date());
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const nextMonthStart = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    const [incomeSources, recurringExpenses, creditAccounts, plannedPayments, transactions] =
      await Promise.all([
        this.prisma.incomeSource.findMany({
          select: { monthlyIncome: true },
        }),
        this.prisma.recurringExpense.findMany({
          select: { amount: true },
        }),
        this.prisma.account.findMany({
          where: { type: 'credit' },
          select: { minimumPayment: true, currentBalance: true },
        }),
        this.prisma.plannedPayment.findMany({
          where: {
            date: {
              gte: monthStart,
              lt: nextMonthStart,
            },
            status: {
              in: ['PLANNED', 'planned'],
            },
          },
          select: { amount: true },
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
            category: true,
          },
        }),
      ] as const);

    const incomePlanned = incomeSources.reduce((sum, source) => sum + source.monthlyIncome, 0);
    const recurringTotal = recurringExpenses.reduce((sum, expense) => sum + expense.amount, 0);

    const minimumPayments = creditAccounts.reduce((sum, account) => {
      if ((account.minimumPayment ?? 0) > 0) {
        return sum + (account.minimumPayment ?? 0);
      }
      return sum + Math.max(account.currentBalance * 0.03, 0);
    }, 0);

    const plannedPaymentTotal = plannedPayments.reduce((sum, payment) => sum + payment.amount, 0);
    const fixedObligations = recurringTotal + minimumPayments + plannedPaymentTotal;

    const spentToDate = transactions.reduce((sum, txn) => sum + txn.amount, 0);
    const remainingToSpend = incomePlanned - fixedObligations - spentToDate;
    const daysRemaining = Math.max(monthEnd.getDate() - today.getDate() + 1, 1);
    const safePerDay = remainingToSpend / daysRemaining;

    const categoryMap = new Map<string, number>();
    for (const txn of transactions) {
      const category = txn.category?.trim() || 'Uncategorized';
      categoryMap.set(category, (categoryMap.get(category) ?? 0) + txn.amount);
    }

    const categoryBreakdown: CategorySpend[] = Array.from(categoryMap.entries())
      .map(([category, amount]) => ({
        category,
        amount: Number(amount.toFixed(2)),
        share: spentToDate > 0 ? Number(((amount / spentToDate) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 6);

    return {
      month: `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}`,
      asOfDate: this.formatDate(today),
      incomePlanned: Number(incomePlanned.toFixed(2)),
      fixedObligations: Number(fixedObligations.toFixed(2)),
      spentToDate: Number(spentToDate.toFixed(2)),
      remainingToSpend: Number(remainingToSpend.toFixed(2)),
      safePerDay: Number(safePerDay.toFixed(2)),
      daysRemaining,
      categoryBreakdown,
    };
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
}
