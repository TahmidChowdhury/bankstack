import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService, Account } from '../services/api.service';

@Component({
  selector: 'app-accounts',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './accounts.component.html',
  styleUrl: './accounts.component.scss',
})
export class AccountsComponent implements OnInit {
  accounts: Account[] = [];
  loading = true;
  error: string | null = null;

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.loadAccounts();
  }

  loadAccounts(): void {
    this.loading = true;
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

  get investmentAccounts(): Account[] {
    return this.accounts.filter((a) => a.type === 'investment');
  }

  getAccountTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      depository: 'Bank Account',
      credit: 'Credit Card',
      investment: 'Investment',
      loan: 'Loan',
    };
    return labels[type] || type;
  }
}
