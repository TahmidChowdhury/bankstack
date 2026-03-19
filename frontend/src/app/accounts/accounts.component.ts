import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, Account } from '../services/api.service';

type EditForm = {
  name: string;
  currentBalance: number;
  availableBalance: number | null;
  apr: number | null;
  minimumPayment: number | null;
  dueDayOfMonth: number | null;
};

@Component({
  selector: 'app-accounts',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './accounts.component.html',
  styleUrl: './accounts.component.scss',
})
export class AccountsComponent implements OnInit {
  accounts: Account[] = [];
  loading = true;
  error: string | null = null;

  editingId: string | null = null;
  editForm: EditForm = { name: '', currentBalance: 0, availableBalance: null, apr: null, minimumPayment: null, dueDayOfMonth: null };
  saving = false;
  saveError: string | null = null;

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

  openEdit(account: Account): void {
    this.editingId = account.id;
    this.editForm = {
      name: account.name,
      currentBalance: account.currentBalance,
      availableBalance: account.availableBalance,
      apr: account.apr,
      minimumPayment: account.minimumPayment,
      dueDayOfMonth: account.dueDayOfMonth,
    };
    this.saveError = null;
  }

  cancelEdit(): void {
    this.editingId = null;
    this.saveError = null;
  }

  saveEdit(account: Account): void {
    this.saving = true;
    this.saveError = null;
    const payload: Parameters<ApiService['updateAccount']>[1] = {
      name: this.editForm.name || undefined,
      currentBalance: this.editForm.currentBalance,
      availableBalance: this.editForm.availableBalance,
      apr: this.editForm.apr,
      minimumPayment: this.editForm.minimumPayment,
      dueDayOfMonth: this.editForm.dueDayOfMonth,
    };
    this.api.updateAccount(account.id, payload).subscribe({
      next: (updated) => {
        const idx = this.accounts.findIndex((a) => a.id === account.id);
        if (idx !== -1) this.accounts[idx] = updated;
        this.saving = false;
        this.editingId = null;
      },
      error: () => {
        this.saveError = 'Failed to save changes. Please try again.';
        this.saving = false;
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
