import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-dashboard-summary',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard-summary.component.html',
  styleUrl: './dashboard-summary.component.scss',
})
export class DashboardSummaryComponent {
  @Input({ required: true }) netWorth = 0;
  @Input({ required: true }) totalDebt = 0;
  @Input({ required: true }) monthlyIncome = 0;
  @Input({ required: true }) nextPaycheckAmount = 0;
  @Input() nextPaycheckDate: string | null = null;
}
