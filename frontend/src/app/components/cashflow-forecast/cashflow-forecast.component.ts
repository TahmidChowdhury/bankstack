import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges } from '@angular/core';
import { BaseChartDirective } from 'ng2-charts';
import { ChartData, ChartOptions } from 'chart.js';
import { CashflowForecast } from '../../services/api.service';

@Component({
  selector: 'app-cashflow-forecast',
  standalone: true,
  imports: [CommonModule, BaseChartDirective],
  templateUrl: './cashflow-forecast.component.html',
  styleUrl: './cashflow-forecast.component.scss',
})
export class CashflowForecastComponent implements OnChanges {
  @Input({ required: true }) forecast: CashflowForecast = {
    incomeNext30Days: 0,
    expensesNext30Days: 0,
    netCashflow: 0,
    upcomingBills: [],
    nextPaycheck: null,
    startingCash: 0,
    projectedBalance: [],
  };

  lineData: ChartData<'line'> = {
    labels: [],
    datasets: [{ data: [] }],
  };

  lineOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
    },
    scales: {
      y: { beginAtZero: false },
    },
    elements: {
      point: { radius: 0 },
      line: { tension: 0.35 },
    },
  };

  ngOnChanges(): void {
    this.lineData = {
      labels: this.forecast.projectedBalance.map((point) =>
        new Date(point.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      ),
      datasets: [
        {
          data: this.forecast.projectedBalance.map((point) => point.balance),
          borderColor: '#1570ef',
          backgroundColor: 'rgba(21, 112, 239, 0.15)',
          fill: true,
        },
      ],
    };
  }
}
