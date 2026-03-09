import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Account, PaycheckPlanner } from '../../services/api.service';
import { PlannedPaymentsService } from '../../services/planned-payments.service';

type SimulationResult = {
  baselineMonths: number;
  improvedMonths: number;
  monthsSaved: number;
  interestSaved: number;
};

@Component({
  selector: 'app-paycheck-planner',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './paycheck-planner.component.html',
  styleUrl: './paycheck-planner.component.scss',
})
export class PaycheckPlannerComponent {
  @Input({ required: true }) planner: PaycheckPlanner = {
    nextPaycheckAmount: 0,
    paycheckDate: null,
    requiredPayments: {
      recurringBills: 0,
      creditCardMinimums: 0,
      totalRequired: 0,
      minimumPaymentCards: [],
    },
    suggestedAllocation: {
      recurringBills: 0,
      creditCardMinimums: 0,
      livingExpenses: 0,
      extraDebtPayment: 0,
      remainingBuffer: 0,
    },
    recommendedCard: null,
  };

  @Input({ required: true }) accounts: Account[] = [];
  @Output() plannedPaymentsChanged = new EventEmitter<void>();

  simulation: SimulationResult | null = null;
  applyingSimulation = false;
  applyMessage: string | null = null;

  constructor(private plannedPaymentsService: PlannedPaymentsService) {}

  simulateExtraPayment(): void {
    const card = this.recommendedAccount;
    if (!card || card.currentBalance <= 0) {
      this.simulation = null;
      return;
    }

    const apr = card.apr ?? 0;
    const monthlyRate = apr / 100 / 12;
    const minimumPayment =
      card.minimumPayment && card.minimumPayment > 0
        ? card.minimumPayment
        : Math.max(25, card.currentBalance * 0.02);

    const baseline = this.simulate(card.currentBalance, monthlyRate, minimumPayment);
    const improvedStartingBalance = Math.max(
      card.currentBalance - this.planner.suggestedAllocation.extraDebtPayment,
      0,
    );
    const improved = this.simulate(improvedStartingBalance, monthlyRate, minimumPayment);

    this.simulation = {
      baselineMonths: baseline.months,
      improvedMonths: improved.months,
      monthsSaved: Math.max(baseline.months - improved.months, 0),
      interestSaved: Math.max(baseline.interest - improved.interest, 0),
    };
  }

  applyPaymentSimulation(): void {
    this.simulateExtraPayment();

    const card = this.recommendedAccount;
    const amount = this.planner.suggestedAllocation.extraDebtPayment;
    const date = this.planner.paycheckDate;

    if (!card || amount <= 0 || !date) {
      this.applyMessage = 'No eligible payment simulation to apply.';
      return;
    }

    this.applyingSimulation = true;
    this.applyMessage = null;

    this.plannedPaymentsService
      .create({
        accountId: card.plaidAccountId || card.id,
        amount: Number(amount.toFixed(2)),
        date,
        type: 'PAYCHECK_PLAN',
        source: 'paycheck',
        strategy: 'avalanche',
      })
      .subscribe({
        next: () => {
          this.applyingSimulation = false;
          this.applyMessage = 'Planned payment saved.';
          this.plannedPaymentsChanged.emit();
        },
        error: () => {
          this.applyingSimulation = false;
          this.applyMessage = 'Failed to save planned payment.';
        },
      });
  }

  get recommendedAccount(): Account | null {
    if (!this.planner.recommendedCard) {
      return null;
    }

    return (
      this.accounts.find((account) => account.id === this.planner.recommendedCard?.accountId) ??
      null
    );
  }

  get payoffAccelerationPercent(): number {
    if (!this.simulation || this.simulation.baselineMonths <= 0) {
      return 0;
    }

    return Math.max(
      0,
      Math.min(100, (this.simulation.monthsSaved / this.simulation.baselineMonths) * 100),
    );
  }

  private simulate(
    startingBalance: number,
    monthlyRate: number,
    payment: number,
  ): { months: number; interest: number } {
    let balance = startingBalance;
    let months = 0;
    let totalInterest = 0;
    const maxMonths = 600;

    while (balance > 0.01 && months < maxMonths) {
      const interest = balance * monthlyRate;
      balance += interest;
      totalInterest += interest;

      const amountPaid = Math.min(payment, balance);
      balance -= amountPaid;
      months += 1;

      if (amountPaid <= 0) {
        break;
      }
    }

    return { months, interest: totalInterest };
  }
}
