import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Account {
  id: string;
  plaidAccountId: string;
  name: string;
  type: string;
  subtype: string | null;
  institution: string;
  currentBalance: number;
  availableBalance: number | null;
  apr: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: string;
  accountId: string;
  amount: number;
  date: string;
  merchantName: string | null;
  category: string | null;
  description: string | null;
  account: Account;
}

export interface DebtSummary {
  totalDebt: number;
  totalCash: number;
  netWorth: number;
}

export interface AvalancheItem {
  accountId: string;
  name: string;
  balance: number;
  apr: number;
  monthsToPayoff: number;
  interestPaid: number;
}

export interface PayoffStrategy {
  totalDebt: number;
  totalCash: number;
  netWorth: number;
  highestAprDebt: {
    accountId: string;
    name: string;
    balance: number;
    apr: number;
  } | null;
  avalancheOrder: AvalancheItem[];
  payoffDate: string | null;
  totalInterestSaved: number;
  monthlyPayment: number;
}

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private readonly baseUrl = 'http://localhost:3000';

  constructor(private http: HttpClient) {}

  getAccounts(): Observable<Account[]> {
    return this.http.get<Account[]>(`${this.baseUrl}/accounts`);
  }

  getTransactions(accountId?: string): Observable<Transaction[]> {
    const url = accountId
      ? `${this.baseUrl}/transactions?accountId=${accountId}`
      : `${this.baseUrl}/transactions`;
    return this.http.get<Transaction[]>(url);
  }

  getDebtSummary(): Observable<DebtSummary> {
    return this.http.get<DebtSummary>(`${this.baseUrl}/debt/summary`);
  }

  calculatePayoffStrategy(monthlyPayment: number): Observable<PayoffStrategy> {
    return this.http.post<PayoffStrategy>(`${this.baseUrl}/debt/payoff-strategy`, {
      monthlyPayment,
    });
  }

  createLinkToken(userId: string): Observable<{ link_token: string }> {
    return this.http.post<{ link_token: string }>(`${this.baseUrl}/plaid/link-token`, { userId });
  }

  exchangeToken(publicToken: string, institutionName: string): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(`${this.baseUrl}/plaid/exchange-token`, {
      public_token: publicToken,
      institution_name: institutionName,
    });
  }
}
