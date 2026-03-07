import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, PayoffStrategy } from '../services/api.service';

@Component({
  selector: 'app-payoff-calculator',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './payoff-calculator.component.html',
  styleUrl: './payoff-calculator.component.scss',
})
export class PayoffCalculatorComponent {
  monthlyPayment: number = 500;
  strategy: PayoffStrategy | null = null;
  loading = false;
  error: string | null = null;

  constructor(private api: ApiService) {}

  calculate(): void {
    if (!this.monthlyPayment || this.monthlyPayment <= 0) {
      this.error = 'Please enter a valid monthly payment amount.';
      return;
    }

    this.loading = true;
    this.error = null;

    this.api.calculatePayoffStrategy(this.monthlyPayment).subscribe({
      next: (strategy) => {
        this.strategy = strategy;
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Failed to calculate payoff strategy.';
        this.loading = false;
        console.error(err);
      },
    });
  }

  formatMonths(months: number): string {
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    if (years === 0) return `${months} months`;
    if (remainingMonths === 0) return `${years} year${years > 1 ? 's' : ''}`;
    return `${years} year${years > 1 ? 's' : ''}, ${remainingMonths} month${remainingMonths > 1 ? 's' : ''}`;
  }
}
