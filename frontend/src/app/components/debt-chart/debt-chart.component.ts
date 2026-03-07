import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges } from '@angular/core';
import { BaseChartDirective } from 'ng2-charts';
import { ChartData, ChartOptions } from 'chart.js';
import { Account } from '../../services/api.service';

@Component({
  selector: 'app-debt-chart',
  standalone: true,
  imports: [CommonModule, BaseChartDirective],
  templateUrl: './debt-chart.component.html',
  styleUrl: './debt-chart.component.scss',
})
export class DebtChartComponent implements OnChanges {
  @Input({ required: true }) creditAccounts: Account[] = [];

  doughnutData: ChartData<'doughnut'> = {
    labels: [],
    datasets: [{ data: [] }],
  };

  doughnutOptions: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
      },
    },
  };

  ngOnChanges(): void {
    const accounts = this.creditAccounts.filter((account) => account.currentBalance > 0);

    this.doughnutData = {
      labels: accounts.map((account) => account.name),
      datasets: [
        {
          data: accounts.map((account) => Number(account.currentBalance.toFixed(2))),
          backgroundColor: ['#7f56d9', '#d444f1', '#1570ef', '#17b26a', '#f79009', '#f04438'],
          borderWidth: 0,
        },
      ],
    };
  }
}
