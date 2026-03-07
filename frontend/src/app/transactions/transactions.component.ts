import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, Transaction, Account } from '../services/api.service';

@Component({
  selector: 'app-transactions',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './transactions.component.html',
  styleUrl: './transactions.component.scss',
})
export class TransactionsComponent implements OnInit {
  transactions: Transaction[] = [];
  accounts: Account[] = [];
  selectedAccountId: string = '';
  loading = true;
  error: string | null = null;

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.api.getAccounts().subscribe({
      next: (accounts) => {
        this.accounts = accounts;
      },
    });
    this.loadTransactions();
  }

  loadTransactions(): void {
    this.loading = true;
    this.api.getTransactions(this.selectedAccountId || undefined).subscribe({
      next: (transactions) => {
        this.transactions = transactions;
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Failed to load transactions.';
        this.loading = false;
        console.error(err);
      },
    });
  }

  onAccountFilterChange(): void {
    this.loadTransactions();
  }

  getCategoryIcon(category: string | null): string {
    const icons: Record<string, string> = {
      Food: '🍔',
      'Food and Drink': '🍔',
      Shopping: '🛒',
      Travel: '✈️',
      Entertainment: '🎬',
      Healthcare: '🏥',
      Utilities: '💡',
      Transfer: '🔄',
      Income: '💵',
    };
    return icons[category ?? ''] || '💳';
  }
}
