import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { forkJoin } from 'rxjs';
import { ApiService, DebtPlanResponse } from '../services/api.service';
import { PlannedPaymentsService } from '../services/planned-payments.service';

type StrategyTab = 'avalanche' | 'snowball';

@Component({
  selector: 'app-debt-plan',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './debt-plan.component.html',
  styleUrl: './debt-plan.component.scss',
})
export class DebtPlanComponent implements OnInit {
  readonly months = 12;
  activeStrategy: StrategyTab = 'avalanche';
  loading = true;
  applying = false;
  error: string | null = null;
  applyMessage: string | null = null;

  plans: Record<StrategyTab, DebtPlanResponse | null> = {
    avalanche: null,
    snowball: null,
  };

  constructor(
    private readonly api: ApiService,
    private readonly plannedPaymentsService: PlannedPaymentsService,
  ) {}

  ngOnInit(): void {
    this.loadPlans();
  }

  setStrategy(strategy: StrategyTab): void {
    this.activeStrategy = strategy;
    this.applyMessage = null;
  }

  applyPlan(): void {
    const nextMonthPlan = this.getNextMonthPlan();
    if (!nextMonthPlan?.payments.length) {
      this.applyMessage = 'No payments available to apply for the next month.';
      return;
    }

    if (this.applying) return;
    this.applyMessage = null;
    this.applying = true;

    const requests = nextMonthPlan.payments.map((payment) =>
      this.plannedPaymentsService.create({
        accountId: payment.accountId,
        amount: payment.amount,
        date: payment.paymentDate,
        type: 'EXTRA',
        source: 'auto-plan',
        strategy: this.activeStrategy,
      }),
    );

    forkJoin(requests).subscribe({
      next: () => {
        this.applying = false;
        this.applyMessage = `Applied ${requests.length} payment(s) for ${nextMonthPlan.month}.`;
      },
      error: (err) => {
        console.error(err);
        this.applying = false;
        this.applyMessage = 'Failed to apply plan.';
      },
    });
  }

  get activePlan(): DebtPlanResponse | null {
    return this.plans[this.activeStrategy];
  }

  get activePlanRows(): Array<{
    month: string;
    accountName: string;
    amount: number;
    minimumPayment: number;
    paymentDate: string;
    dueDate: string | null;
    remainingBalance: number;
  }> {
    const rows: Array<{
      month: string;
      accountName: string;
      amount: number;
      minimumPayment: number;
      paymentDate: string;
      dueDate: string | null;
      remainingBalance: number;
    }> = [];

    for (const month of this.activePlan?.monthlyPlan ?? []) {
      for (const payment of month.payments) {
        rows.push({
          month: month.month,
          accountName: payment.accountName,
          amount: payment.amount,
          minimumPayment: payment.minimumPayment,
          paymentDate: payment.paymentDate,
          dueDate: payment.dueDate,
          remainingBalance: payment.remainingBalance,
        });
      }
    }

    return rows;
  }

  private loadPlans(): void {
    this.loading = true;
    this.error = null;

    forkJoin({
      avalanche: this.api.getDebtPlan('avalanche', this.months),
      snowball: this.api.getDebtPlan('snowball', this.months),
    }).subscribe({
      next: (plans) => {
        this.plans = plans;
        this.loading = false;
      },
      error: (err) => {
        console.error(err);
        this.loading = false;
        this.error = 'Failed to load debt plans.';
      },
    });
  }

  private getNextMonthPlan(): DebtPlanResponse['monthlyPlan'][number] | null {
    const plans = this.activePlan?.monthlyPlan ?? [];
    if (!plans.length) {
      return null;
    }

    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return plans.find((item) => item.month > currentMonthKey) ?? plans[0];
  }
}
