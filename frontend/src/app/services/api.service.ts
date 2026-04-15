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
  pending: boolean;
  account: Account;
}

export interface PlaidItem {
  id: string;
  plaidItemId: string;
  institution: string;
  status: string;
  lastSyncedAt: string | null;
  createdAt: string;
  _count: { accounts: number };
}

export interface SyncResult {
  itemsProcessed: number;
  transactionsAdded: number;
  transactionsModified: number;
  transactionsRemoved: number;
  accountsUpdated: number;
  errors: string[];
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

export interface DebtPlanPayment {
  accountId: string;
  accountName: string;
  amount: number;
  minimumPayment: number;
  paymentDate: string;
  dueDate: string | null;
  remainingBalance: number;
}

export interface DebtPlanMonth {
  month: string;
  payments: DebtPlanPayment[];
}

export interface DebtPlanResponse {
  payoffDate: string | null;
  totalInterest: number;
  monthsRemaining: number | null;
  interestSavedVsMinimumOnly: number;
  monthlyPlan: DebtPlanMonth[];
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

export interface SpendingInsights {
  month: string;
  asOfDate: string;
  incomePlanned: number;
  fixedObligations: number;
  spentToDate: number;
  remainingToSpend: number;
  safePerDay: number;
  daysRemaining: number;
  categoryBreakdown: Array<{
    category: string;
    amount: number;
    share: number;
  }>;
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
  plannedPayments: Array<{
    id: string;
    accountName: string;
    amount: number;
    date: string;
    source: string | null;
    strategy: string | null;
    status: string;
  }>;
  startingCash: number;
  projectedBalance: CashflowPoint[];
  projectedBalanceBase: CashflowPoint[];
  projectedBalanceWithSavings: CashflowPoint[];
}

export interface RecurringExpenseDay {
  name: string;
  category: string;
  amount: number;
  dayOfMonth: number;
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

export interface FinancialPlanTarget {
  accountId: string;
  accountName: string;
  balance: number;
  apr: number;
  minimumPayment: number;
  dueDate: string | null;
  daysUntilDue: number | null;
  priority: number;
  reason: string;
}

export interface FinancialPlan {
  totalCash: number;
  totalDebt: number;
  netWorth: number;
  deployableNow: number;
  reserveFloor: number;
  reserveTarget: number;
  reserveCautious: number;
  reserveMonthsCovered: number;
  nextPaycheckDate: string | null;
  nextPaycheckAmount: number;
  monthlyObligations: number;
  monthlyInterestEstimate: number;
  debtUtilization: number;
  plannedPaymentsNext30Days: number;
  topMetrics: {
    availableToDeploy: number;
    totalDebt: number;
    totalCash: number;
    nextPaycheck: number;
  };
  secondaryMetrics: {
    netWorth: number;
    debtUtilization: number;
    monthlyInterest: number;
    plannedPayments: number;
  };
  spending: {
    remainingToSpend: number;
    dailyBudget: number;
    daysRemaining: number;
    fixedObligations: number;
    spentToDate: number;
    monthLabel: string;
  };
  payoffTargets: FinancialPlanTarget[];
  warnings: string[];
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

  getSpendingInsights(): Observable<SpendingInsights> {
    return this.http.get<SpendingInsights>(`${this.baseUrl}/insights/spending`);
  }

  getCashflowForecast(strategy?: string): Observable<CashflowForecast> {
    if (strategy) {
      return this.http.get<CashflowForecast>(`${this.baseUrl}/cashflow/forecast`, {
        params: { strategy },
      });
    }
    return this.http.get<CashflowForecast>(`${this.baseUrl}/cashflow/forecast`);
  }

  getRecurringExpenses(): Observable<RecurringExpenseDay[]> {
    return this.http.get<RecurringExpenseDay[]>(`${this.baseUrl}/cashflow/recurring-expenses`);
  }

  getPaycheckPlanner(): Observable<PaycheckPlanner> {
    return this.http.get<PaycheckPlanner>(`${this.baseUrl}/paycheck/planner`);
  }

  getFinancialPlan(reserveOverride?: number): Observable<FinancialPlan> {
    if (reserveOverride != null) {
      return this.http.get<FinancialPlan>(`${this.baseUrl}/financial-plan`, {
        params: { reserveOverride },
      });
    }

    return this.http.get<FinancialPlan>(`${this.baseUrl}/financial-plan`);
  }

  calculatePayoffStrategy(monthlyPayment: number): Observable<PayoffStrategy> {
    return this.http.post<PayoffStrategy>(`${this.baseUrl}/debt/payoff-strategy`, {
      monthlyPayment,
    });
  }

  getDebtPlan(strategy: 'avalanche' | 'snowball', months: number): Observable<DebtPlanResponse> {
    return this.http.get<DebtPlanResponse>(
      `${this.baseUrl}/debt/plan?strategy=${strategy}&months=${months}`,
    );
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

  syncPlaid(): Observable<SyncResult> {
    return this.http.post<SyncResult>(`${this.baseUrl}/plaid/sync`, {});
  }

  getPlaidItems(): Observable<PlaidItem[]> {
    return this.http.get<PlaidItem[]>(`${this.baseUrl}/plaid/items`);
  }

  updateAccount(
    id: string,
    data: {
      name?: string;
      currentBalance?: number;
      availableBalance?: number | null;
      apr?: number | null;
      minimumPayment?: number | null;
      dueDayOfMonth?: number | null;
    },
  ): Observable<Account> {
    return this.http.patch<Account>(`${this.baseUrl}/accounts/${id}`, data);
  }
}
