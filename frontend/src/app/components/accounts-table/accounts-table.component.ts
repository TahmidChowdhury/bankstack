import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { Account } from '../../services/api.service';

@Component({
  selector: 'app-accounts-table',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './accounts-table.component.html',
  styleUrl: './accounts-table.component.scss',
})
export class AccountsTableComponent {
  @Input({ required: true }) accounts: Account[] = [];

  creditLimit(account: Account): number | null {
    if (account.type !== 'credit') {
      return null;
    }

    if (account.availableBalance == null) {
      return null;
    }

    return Math.max(account.currentBalance, 0) + Math.max(account.availableBalance, 0);
  }

  utilization(account: Account): number | null {
    const limit = this.creditLimit(account);
    if (!limit || limit <= 0) {
      return null;
    }

    return Math.min(100, (Math.max(account.currentBalance, 0) / limit) * 100);
  }
}
