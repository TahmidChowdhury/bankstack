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
    plannedPayments: [],
    startingCash: 0,
    projectedBalance: [],
    projectedBalanceBase: [],
    projectedBalanceWithSavings: [],
  };

  lineData: ChartData<'line'> = {
    labels: [],
    datasets: [{ data: [] }],
  };

  lineOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: { display: true, position: 'top', labels: { boxWidth: 12, padding: 16 } },
      tooltip: {
        enabled: true,
        callbacks: {
          label: (ctx) => {
            const value = ctx.parsed.y ?? 0;
            const formatted = new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: 'USD',
            }).format(value);
            return ` ${ctx.dataset.label}: ${formatted}`;
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: false,
        ticks: {
          callback: (value) =>
            new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(value) ?? 0),
        },
      },
    },
    elements: {
      point: { radius: 0, hoverRadius: 5 },
      line: { tension: 0.35 },
    },
  };

  ngOnChanges(): void {
    const labels = this.forecast.projectedBalance.map((point) =>
      new Date(point.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    );
    this.lineData = {
      labels,
      datasets: [
        {
          label: 'With strategy',
          data: this.forecast.projectedBalance.map((point) => point.balance),
          borderColor: '#1570ef',
          backgroundColor: 'rgba(21, 112, 239, 0.1)',
          fill: true,
          order: 2,
        },
        {
          label: 'Minimums only',
          data: (this.forecast.projectedBalanceBase ?? []).map((point) => point.balance),
          borderColor: '#17b26a',
          backgroundColor: 'rgba(23, 178, 106, 0.08)',
          borderDash: [5, 4],
          fill: true,
          order: 1,
        },
        {
          label: 'Strategy + $100 savings',
          data: (this.forecast.projectedBalanceWithSavings ?? []).map((point) => point.balance),
          borderColor: '#f79009',
          backgroundColor: 'rgba(247, 144, 9, 0.07)',
          borderDash: [3, 3],
          fill: true,
          order: 3,
        },
      ],
    };
  }
}
