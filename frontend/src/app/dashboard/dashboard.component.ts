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
  RecurringExpenseDay,
  Transaction,
} from '../services/api.service';
import { PlannedPayment, PlannedPaymentsService } from '../services/planned-payments.service';
import { PlaidLinkService } from '../services/plaid-link.service';
import { DashboardSummaryComponent } from '../components/dashboard-summary/dashboard-summary.component';
import { DebtChartComponent } from '../components/debt-chart/debt-chart.component';
import { PayoffChartComponent } from '../components/payoff-chart/payoff-chart.component';
import { AccountsTableComponent } from '../components/accounts-table/accounts-table.component';
import { TransactionsTableComponent } from '../components/transactions-table/transactions-table.component';
import { IncomeSummaryComponent } from '../components/income-summary/income-summary.component';
import { CashflowForecastComponent } from '../components/cashflow-forecast/cashflow-forecast.component';
import { PaycheckPlannerComponent } from '../components/paycheck-planner/paycheck-planner.component';

type CalendarBill = {
  name: string;
  amount: number;
  dueDate: string;
  kind: 'card_due' | 'recurring_expense' | 'payday' | 'planned_payment';
  isEstimated?: boolean;
};

type CalendarCell = {
  date: Date | null;
  dayOfMonth: number | null;
  isToday: boolean;
  bills: CalendarBill[];
};

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
  readonly weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
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
    plannedPayments: [],
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
  recurringExpenses: RecurringExpenseDay[] = [];
  plannedPayments: PlannedPayment[] = [];
  loading = true;
  preparingPlaid = false;
  connectingBank = false;
  activeTab: 'overview' | 'calendar' = 'overview';
  error: string | null = null;

  constructor(
    private api: ApiService,
    private plannedPaymentsService: PlannedPaymentsService,
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
      recurringExpenses: this.api.getRecurringExpenses(),
      plannedPayments: this.plannedPaymentsService.list(),
    }).subscribe({
      next: ({
        summary,
        accounts,
        transactions,
        income,
        cashflowForecast,
        paycheckPlanner,
        recurringExpenses,
        plannedPayments,
      }) => {
        this.summary = summary;
        this.accounts = accounts;
        this.transactions = transactions.slice(0, 10);
        this.income = income;
        this.cashflowForecast = cashflowForecast;
        this.paycheckPlanner = paycheckPlanner;
        this.recurringExpenses = recurringExpenses;
        this.plannedPayments = plannedPayments;
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

  get currentMonthLabel(): string {
    const monthStart = this.currentMonthStart();
    return monthStart.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }

  get monthlyDueTotal(): number {
    return this.currentMonthBills
      .filter((bill) => bill.kind !== 'payday')
      .reduce((sum, bill) => sum + bill.amount, 0);
  }

  get plannedPaymentsNext30Days(): number {
    const today = this.startOfDay(new Date());
    const end = new Date(today);
    end.setDate(end.getDate() + 29);

    return this.plannedPayments
      .filter((payment) => {
        const date = this.parseLocalDate(payment.date);
        return date >= today && date <= end && this.isPlannedStatus(payment.status);
      })
      .reduce((sum, payment) => sum + payment.amount, 0);
  }

  get plannedPaymentsCount(): number {
    return this.plannedPayments.filter((payment) => this.isPlannedStatus(payment.status)).length;
  }

  onPlannedPaymentsChanged(): void {
    this.loadData();
  }

  get calendarCells(): CalendarCell[] {
    const monthStart = this.currentMonthStart();
    const year = monthStart.getFullYear();
    const month = monthStart.getMonth();
    const firstWeekday = monthStart.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = this.startOfDay(new Date());

    const billsByDay = new Map<number, CalendarBill[]>();
    for (const bill of this.currentMonthBills) {
      const day = this.parseLocalDate(bill.dueDate).getDate();
      const existing = billsByDay.get(day) ?? [];
      existing.push(bill);
      billsByDay.set(day, existing);
    }

    const cells: CalendarCell[] = [];

    for (let i = 0; i < firstWeekday; i++) {
      cells.push({ date: null, dayOfMonth: null, isToday: false, bills: [] });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      cells.push({
        date,
        dayOfMonth: day,
        isToday: date.getTime() === today.getTime(),
        bills: billsByDay.get(day) ?? [],
      });
    }

    while (cells.length % 7 !== 0) {
      cells.push({ date: null, dayOfMonth: null, isToday: false, bills: [] });
    }

    return cells;
  }

  setActiveTab(tab: 'overview' | 'calendar'): void {
    this.activeTab = tab;
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

  private get currentMonthBills(): CalendarBill[] {
    const monthStart = this.currentMonthStart();
    const year = monthStart.getFullYear();
    const month = monthStart.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const accountDueBills: CalendarBill[] = this.accounts
      .filter((account) => account.type === 'credit' && account.dueDayOfMonth != null)
      .map((account) => {
        const day = Math.min(Math.max(account.dueDayOfMonth ?? 1, 1), daysInMonth);
        const dueDate = this.formatLocalDate(new Date(year, month, day));
        const hasSeededMinimum = (account.minimumPayment ?? 0) > 0;
        const fallbackMinimum = Math.max(account.currentBalance * 0.03, 0);
        return {
          name: `${account.name} payment due`,
          amount: hasSeededMinimum
            ? Math.max(account.minimumPayment ?? 0, 0)
            : Number(fallbackMinimum.toFixed(2)),
          dueDate,
          kind: 'card_due',
          isEstimated: !hasSeededMinimum,
        };
      });

    const recurringBills: CalendarBill[] = this.recurringExpenses.map((expense) => {
      const day = Math.min(Math.max(expense.dayOfMonth, 1), daysInMonth);
      const dueDate = this.formatLocalDate(new Date(year, month, day));
      return {
        name: expense.name,
        amount: Math.max(expense.amount, 0),
        dueDate,
        kind: 'recurring_expense',
      };
    });

    const paydayItems: CalendarBill[] = this.income.sources.flatMap((source) =>
      source.payDays.map((payDay) => {
        const day = Math.min(Math.max(Math.floor(payDay), 1), daysInMonth);
        const dueDate = this.formatLocalDate(new Date(year, month, day));
        return {
          name: `${source.source} payday`,
          amount: Math.max(source.perPaycheckAmount, 0),
          dueDate,
          kind: 'payday' as const,
        };
      }),
    );

    const plannedPaymentItems: CalendarBill[] = this.plannedPayments
      .filter((payment) => this.isPlannedStatus(payment.status))
      .map((payment) => ({
        name: `Planned: ${payment.accountName}`,
        amount: Math.max(payment.amount, 0),
        dueDate: payment.date,
        kind: 'planned_payment' as const,
      }));

    return [...accountDueBills, ...recurringBills, ...paydayItems, ...plannedPaymentItems].sort(
      (a, b) => {
        if (a.dueDate !== b.dueDate) {
          return a.dueDate.localeCompare(b.dueDate);
        }
        if (a.kind !== b.kind) {
          return a.kind.localeCompare(b.kind);
        }
        return a.name.localeCompare(b.name);
      },
    );
  }

  private currentMonthStart(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }

  private parseLocalDate(value: string): Date {
    const [year, month, day] = value.split('-').map((part) => Number(part));
    return new Date(year, (month || 1) - 1, day || 1);
  }

  private isPlannedStatus(status: string): boolean {
    return status.toUpperCase() === 'PLANNED';
  }

  private formatLocalDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private startOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }
}
