import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { SpendingInsights } from '../../services/api.service';

@Component({
  selector: 'app-spending-insights',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './spending-insights.component.html',
  styleUrl: './spending-insights.component.scss',
})
export class SpendingInsightsComponent {
  @Input({ required: true }) insights: SpendingInsights = {
    month: '',
    asOfDate: '',
    incomePlanned: 0,
    fixedObligations: 0,
    spentToDate: 0,
    remainingToSpend: 0,
    safePerDay: 0,
    daysRemaining: 0,
    categoryBreakdown: [],
  };

  get spentPercent(): number {
    if (this.insights.incomePlanned <= 0) {
      return 0;
    }
    return Math.max(
      0,
      Math.min(100, (this.insights.spentToDate / this.insights.incomePlanned) * 100),
    );
  }
}
