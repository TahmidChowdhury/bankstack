import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ApiService, Account, DebtSummary } from '../services/api.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  summary: DebtSummary = { totalDebt: 0, totalCash: 0, netWorth: 0 };
  accounts: Account[] = [];
  loading = true;
  error: string | null = null;

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading = true;
    this.error = null;

    this.api.getDebtSummary().subscribe({
      next: (summary) => {
        this.summary = summary;
      },
      error: (err) => {
        this.error = 'Failed to load debt summary. Is the backend running?';
        console.error(err);
      },
    });

    this.api.getAccounts().subscribe({
      next: (accounts) => {
        this.accounts = accounts;
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Failed to load accounts.';
        this.loading = false;
        console.error(err);
      },
    });
  }

  get creditAccounts(): Account[] {
    return this.accounts.filter((a) => a.type === 'credit');
  }

  get depositoryAccounts(): Account[] {
    return this.accounts.filter((a) => a.type === 'depository');
  }
}
