import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { Transaction } from '../../services/api.service';

@Component({
  selector: 'app-transactions-table',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './transactions-table.component.html',
  styleUrl: './transactions-table.component.scss',
})
export class TransactionsTableComponent {
  @Input({ required: true }) transactions: Transaction[] = [];
}
