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
  minimumPayment: number | null;
  dueDayOfMonth: number | null;
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

export interface IncomeSource {
  id: string;
  source: string;
  monthlyIncome: number;
  perPaycheckAmount: number;
  payDays: number[];
  createdAt: string;
  updatedAt: string;
}

export interface IncomeSummary {
  totalMonthlyIncome: number;
  nextPaycheckDate: string | null;
  nextPaycheckAmount: number;
  sources: IncomeSource[];
}

export interface CashflowPoint {
  date: string;
  balance: number;
}

export interface CashflowForecast {
  incomeNext30Days: number;
  expensesNext30Days: number;
  netCashflow: number;
  upcomingBills: Array<{
    name: string;
    amount: number;
    dueDate: string;
  }>;
  nextPaycheck: {
    date: string;
    amount: number;
  } | null;
  startingCash: number;
  projectedBalance: CashflowPoint[];
}

export interface PaycheckPlanner {
  nextPaycheckAmount: number;
  paycheckDate: string | null;
  requiredPayments: {
    recurringBills: number;
    creditCardMinimums: number;
    totalRequired: number;
    minimumPaymentCards: Array<{
      accountName: string;
      amount: number;
      dueDayOfMonth: number;
    }>;
  };
  suggestedAllocation: {
    recurringBills: number;
    creditCardMinimums: number;
    livingExpenses: number;
    extraDebtPayment: number;
    remainingBuffer: number;
  };
  recommendedCard: {
    accountId: string;
    accountName: string;
    apr: number;
    currentBalance: number;
  } | null;
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

  getIncomeSummary(): Observable<IncomeSummary> {
    return this.http.get<IncomeSummary>(`${this.baseUrl}/income/summary`);
  }

  getIncome(): Observable<IncomeSummary> {
    return this.http.get<IncomeSummary>(`${this.baseUrl}/income`);
  }

  getCashflowForecast(): Observable<CashflowForecast> {
    return this.http.get<CashflowForecast>(`${this.baseUrl}/cashflow/forecast`);
  }

  getPaycheckPlanner(): Observable<PaycheckPlanner> {
    return this.http.get<PaycheckPlanner>(`${this.baseUrl}/paycheck/planner`);
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
