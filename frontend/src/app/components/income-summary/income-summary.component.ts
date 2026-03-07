import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { IncomeSummary } from '../../services/api.service';

@Component({
  selector: 'app-income-summary',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './income-summary.component.html',
  styleUrl: './income-summary.component.scss',
})
export class IncomeSummaryComponent {
  @Input({ required: true }) income: IncomeSummary = {
    totalMonthlyIncome: 0,
    nextPaycheckDate: null,
    nextPaycheckAmount: 0,
    sources: [],
  };
}
