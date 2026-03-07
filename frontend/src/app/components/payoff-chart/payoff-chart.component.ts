import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges } from '@angular/core';
import { BaseChartDirective } from 'ng2-charts';
import { ChartData, ChartOptions } from 'chart.js';
import { Account } from '../../services/api.service';

@Component({
  selector: 'app-payoff-chart',
  standalone: true,
  imports: [CommonModule, BaseChartDirective],
  templateUrl: './payoff-chart.component.html',
  styleUrl: './payoff-chart.component.scss',
})
export class PayoffChartComponent implements OnChanges {
  @Input({ required: true }) creditAccounts: Account[] = [];

  barData: ChartData<'bar'> = {
    labels: [],
    datasets: [{ data: [] }],
  };

  barOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  };

  ngOnChanges(): void {
    const sorted = [...this.creditAccounts]
      .filter((account) => account.currentBalance > 0)
      .sort((a, b) => b.currentBalance - a.currentBalance)
      .slice(0, 8);

    this.barData = {
      labels: sorted.map((account) => account.name),
      datasets: [
        {
          data: sorted.map((account) => Number(account.currentBalance.toFixed(2))),
          backgroundColor: '#1570ef',
          borderRadius: 8,
        },
      ],
    };
  }
}
