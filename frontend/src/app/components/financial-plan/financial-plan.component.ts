import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { FinancialPlan, FinancialPlanTarget } from '../../services/api.service';

type ReserveOption = {
  key: 'lean' | 'recommended' | 'cautious';
  label: string;
  amount: number;
  description: string;
};

type PlannedAction = {
  target: FinancialPlanTarget;
  amount: number;
};

@Component({
  selector: 'app-financial-plan',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './financial-plan.component.html',
  styleUrl: './financial-plan.component.scss',
})
export class FinancialPlanComponent implements OnChanges {
  @Input({ required: true }) plan: FinancialPlan = {
    totalCash: 0,
    totalDebt: 0,
    netWorth: 0,
    deployableNow: 0,
    reserveFloor: 0,
    reserveTarget: 0,
    reserveCautious: 0,
    reserveMonthsCovered: 0,
    nextPaycheckDate: null,
    nextPaycheckAmount: 0,
    monthlyObligations: 0,
    monthlyInterestEstimate: 0,
    debtUtilization: 0,
    plannedPaymentsNext30Days: 0,
    topMetrics: {
      availableToDeploy: 0,
      totalDebt: 0,
      totalCash: 0,
      nextPaycheck: 0,
    },
    secondaryMetrics: {
      netWorth: 0,
      debtUtilization: 0,
      monthlyInterest: 0,
      plannedPayments: 0,
    },
    spending: {
      remainingToSpend: 0,
      dailyBudget: 0,
      daysRemaining: 0,
      fixedObligations: 0,
      spentToDate: 0,
      monthLabel: '',
    },
    payoffTargets: [],
    warnings: [],
  };

  selectedReserve = 0;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['plan']) {
      this.selectedReserve = this.plan.reserveTarget;
    }
  }

  get reserveOptions(): ReserveOption[] {
    const options: ReserveOption[] = [
      {
        key: 'lean',
        label: 'Lean',
        amount: this.plan.reserveFloor,
        description: 'Hold one month of obligations.',
      },
      {
        key: 'recommended',
        label: 'Recommended',
        amount: this.plan.reserveTarget,
        description: 'Best default when cash is temporarily elevated.',
      },
      {
        key: 'cautious',
        label: 'Cautious',
        amount: this.plan.reserveCautious,
        description: 'Keep a wider cash cushion.',
      },
    ];

    return options.filter(
      (option, index, all) => all.findIndex((candidate) => candidate.amount === option.amount) === index,
    );
  }

  get selectedReserveMonths(): number {
    if (this.plan.monthlyObligations <= 0) {
      return 0;
    }
    return this.selectedReserve / this.plan.monthlyObligations;
  }

  get currentDeployableAmount(): number {
    return Math.max(this.plan.totalCash - this.selectedReserve, 0);
  }

  get allocatedActions(): PlannedAction[] {
    const actions: PlannedAction[] = [];
    let remaining = this.currentDeployableAmount;

    for (const target of this.plan.payoffTargets) {
      if (remaining <= 0.01) {
        break;
      }

      const amount = Math.min(remaining, target.balance);
      actions.push({ target, amount });
      remaining -= amount;
    }

    return actions;
  }

  get primaryAction(): PlannedAction | null {
    return this.allocatedActions[0] ?? null;
  }

  get followUpAction(): PlannedAction | null {
    return this.allocatedActions[1] ?? null;
  }

  get isWindfallMode(): boolean {
    return this.plan.totalCash > this.plan.reserveTarget * 1.2;
  }

  setReserve(amount: number): void {
    this.selectedReserve = amount;
  }
}
