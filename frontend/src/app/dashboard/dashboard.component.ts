import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { forkJoin, firstValueFrom, timeout } from 'rxjs';
import {
  Account,
  ApiService,
  CashflowForecast,
  DebtSummary,
  IncomeSummary,
  PaycheckPlanner,
  Transaction,
} from '../services/api.service';
import { PlaidLinkService } from '../services/plaid-link.service';
import { DashboardSummaryComponent } from '../components/dashboard-summary/dashboard-summary.component';
import { DebtChartComponent } from '../components/debt-chart/debt-chart.component';
import { PayoffChartComponent } from '../components/payoff-chart/payoff-chart.component';
import { AccountsTableComponent } from '../components/accounts-table/accounts-table.component';
import { TransactionsTableComponent } from '../components/transactions-table/transactions-table.component';
import { IncomeSummaryComponent } from '../components/income-summary/income-summary.component';
import { CashflowForecastComponent } from '../components/cashflow-forecast/cashflow-forecast.component';
import { PaycheckPlannerComponent } from '../components/paycheck-planner/paycheck-planner.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    DashboardSummaryComponent,
    DebtChartComponent,
    PayoffChartComponent,
    AccountsTableComponent,
    TransactionsTableComponent,
    IncomeSummaryComponent,
    CashflowForecastComponent,
    PaycheckPlannerComponent,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  summary: DebtSummary = { totalDebt: 0, totalCash: 0, netWorth: 0 };
  income: IncomeSummary = {
    totalMonthlyIncome: 0,
    nextPaycheckDate: null,
    nextPaycheckAmount: 0,
    sources: [],
  };
  cashflowForecast: CashflowForecast = {
    incomeNext30Days: 0,
    expensesNext30Days: 0,
    netCashflow: 0,
    upcomingBills: [],
    nextPaycheck: null,
    startingCash: 0,
    projectedBalance: [],
  };
  paycheckPlanner: PaycheckPlanner = {
    nextPaycheckAmount: 0,
    paycheckDate: null,
    requiredPayments: {
      recurringBills: 0,
      creditCardMinimums: 0,
      totalRequired: 0,
      minimumPaymentCards: [],
    },
    suggestedAllocation: {
      recurringBills: 0,
      creditCardMinimums: 0,
      livingExpenses: 0,
      extraDebtPayment: 0,
      remainingBuffer: 0,
    },
    recommendedCard: null,
  };
  accounts: Account[] = [];
  transactions: Transaction[] = [];
  loading = true;
  preparingPlaid = false;
  connectingBank = false;
  error: string | null = null;

  constructor(
    private api: ApiService,
    private plaidLinkService: PlaidLinkService,
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading = true;
    this.error = null;

    forkJoin({
      summary: this.api.getDebtSummary(),
      accounts: this.api.getAccounts(),
      transactions: this.api.getTransactions(),
      income: this.api.getIncome(),
      cashflowForecast: this.api.getCashflowForecast(),
      paycheckPlanner: this.api.getPaycheckPlanner(),
    }).subscribe({
      next: ({ summary, accounts, transactions, income, cashflowForecast, paycheckPlanner }) => {
        this.summary = summary;
        this.accounts = accounts;
        this.transactions = transactions.slice(0, 10);
        this.income = income;
        this.cashflowForecast = cashflowForecast;
        this.paycheckPlanner = paycheckPlanner;
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Failed to load dashboard data. Check backend health and retry.';
        this.loading = false;
        console.error(err);
      },
    });
  }

  get creditAccounts(): Account[] {
    return this.accounts.filter((account) => account.type === 'credit');
  }

  get totalAssets(): number {
    return this.accounts
      .filter((account) => account.type !== 'credit')
      .reduce((sum, account) => sum + Math.max(account.currentBalance, 0), 0);
  }

  get totalMonthlyInterest(): number {
    return this.creditAccounts.reduce((sum, account) => {
      if (!account.apr || account.currentBalance <= 0) {
        return sum;
      }
      return sum + account.currentBalance * (account.apr / 100 / 12);
    }, 0);
  }

  get debtUtilization(): number {
    const creditWithLimits = this.creditAccounts.filter(
      (account) => account.availableBalance != null,
    );

    const totalUsed = creditWithLimits.reduce(
      (sum, account) => sum + Math.max(account.currentBalance, 0),
      0,
    );
    const totalLimit = creditWithLimits.reduce(
      (sum, account) =>
        sum + Math.max(account.currentBalance, 0) + Math.max(account.availableBalance ?? 0, 0),
      0,
    );

    if (totalLimit <= 0) {
      return 0;
    }

    return (totalUsed / totalLimit) * 100;
  }

  async connectBank(): Promise<void> {
    if (this.connectingBank || this.preparingPlaid) {
      return;
    }

    this.error = null;
    this.preparingPlaid = true;

    try {
      const { link_token } = await firstValueFrom(
        this.api.createLinkToken('local-user').pipe(timeout(10000)),
      );

      const handler = await this.plaidLinkService.createHandler({
        linkToken: link_token,
        onSuccess: (result) => {
          void this.handlePlaidSuccess(result.publicToken, result.institutionName);
        },
        onExit: (err) => {
          this.connectingBank = false;
          if (err) {
            this.error = 'Plaid connection was interrupted.';
            console.error(err);
          }
        },
      });

      this.preparingPlaid = false;
      this.connectingBank = true;
      handler.open();
    } catch (err) {
      this.error = 'Failed to initialize Plaid Link.';
      console.error(err);
      this.preparingPlaid = false;
    }
  }

  private async handlePlaidSuccess(
    publicToken: string,
    institutionName: string,
  ): Promise<void> {
    try {
      await firstValueFrom(this.api.exchangeToken(publicToken, institutionName));
      this.loadData();
    } catch (err) {
      this.error = 'Failed to finalize Plaid account connection.';
      console.error(err);
    } finally {
      this.connectingBank = false;
    }
  }
}
