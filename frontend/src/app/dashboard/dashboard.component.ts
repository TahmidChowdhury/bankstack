import { CommonModule } from '@angular/common';
import { Component, NgZone, OnInit } from '@angular/core';
import { forkJoin, firstValueFrom, timeout } from 'rxjs';
import {
  Account,
  ApiService,
  CashflowForecast,
  DebtPlanResponse,
  DebtSummary,
  IncomeSummary,
  PaycheckPlanner,
  PlaidItem,
  RecurringExpenseDay,
  SpendingInsights,
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
import { SpendingInsightsComponent } from '../components/spending-insights/spending-insights.component';

type CalendarBill = {
  name: string;
  amount: number;
  dueDate: string;
  kind: 'card_due' | 'recurring_expense' | 'payday' | 'planned_payment' | 'strategy_plan' | 'paid_summary';
  isEstimated?: boolean;
  plannedPaymentId?: string;
  strategy?: string;
  internalAccountId?: string;
  breakdown?: { label: string; amount: number }[];
  paidPaymentIds?: string[];
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
    SpendingInsightsComponent,
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
  spendingInsights: SpendingInsights = {
    month: '',
    asOfDate: '',
    incomePlanned: 0,
    fixedObligations: 0,
    spentToDate: 0,
    remainingToSpend: 0,
    safePerDay: 0,
    daysRemaining: 0,
    categoryBreakdown: [],
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
    projectedBalanceBase: [],
    projectedBalanceWithSavings: [],
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

  syncing = false;
  syncError: string | null = null;
  plaidItems: PlaidItem[] = [];

  activeStrategy: 'avalanche' | 'snowball' = 'avalanche';
  debtPlanData: DebtPlanResponse | null = null;
  quickAddDay: number | null = null;
  quickAddAccountId = '';
  quickAddAmount = '';
  quickAddSaving = false;
  quickAddError: string | null = null;

  constructor(
    private api: ApiService,
    private plannedPaymentsService: PlannedPaymentsService,
    private plaidLinkService: PlaidLinkService,
    private ngZone: NgZone,
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  loadData(silent = false): void {
    if (!silent) {
      this.loading = true;
    }
    this.error = null;

    forkJoin({
      summary: this.api.getDebtSummary(),
      accounts: this.api.getAccounts(),
      transactions: this.api.getTransactions(),
      income: this.api.getIncome(),
      spendingInsights: this.api.getSpendingInsights(),
      cashflowForecast: this.api.getCashflowForecast(this.activeStrategy),
      paycheckPlanner: this.api.getPaycheckPlanner(),
      recurringExpenses: this.api.getRecurringExpenses(),
      plannedPayments: this.plannedPaymentsService.list(),
      plaidItems: this.api.getPlaidItems(),
    }).subscribe({
      next: ({
        summary,
        accounts,
        transactions,
        income,
        spendingInsights,
        cashflowForecast,
        paycheckPlanner,
        recurringExpenses,
        plannedPayments,
        plaidItems,
      }) => {
        this.summary = summary;
        this.accounts = accounts;
        this.transactions = transactions.slice(0, 10);
        this.income = income;
        this.spendingInsights = spendingInsights;
        this.cashflowForecast = cashflowForecast;
        this.paycheckPlanner = paycheckPlanner;
        this.recurringExpenses = recurringExpenses;
        this.plannedPayments = plannedPayments;
        this.plaidItems = plaidItems;
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Failed to load dashboard data. Check backend health and retry.';
        this.loading = false;
        console.error(err);
      },
    });
  }

  syncNow(): void {
    if (this.syncing) return;
    this.syncing = true;
    this.syncError = null;

    this.api.syncPlaid().subscribe({
      next: (result) => {
        this.syncing = false;
        if (result.errors.length > 0) {
          this.syncError = result.errors.join('; ');
        }
        this.loadData();
      },
      error: () => {
        this.syncing = false;
        this.syncError = 'Sync failed. Check backend logs.';
      },
    });
  }

  get creditAccounts(): Account[] {
    return this.accounts.filter((account) => account.type === 'credit');
  }

  getMatchingStrategyBill(bills: CalendarBill[], cardDueBill: CalendarBill): CalendarBill | null {
    if (cardDueBill.kind !== 'card_due') return null;
    const cardName = cardDueBill.name.replace(/ payment due$/, '');
    return bills.find((b) => b.kind === 'strategy_plan' && b.name === cardName) ?? null;
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

  get lastSyncedAt(): Date | null {
    const dates = this.plaidItems
      .map((item) => (item.lastSyncedAt ? new Date(item.lastSyncedAt) : null))
      .filter((d): d is Date => d !== null);
    if (dates.length === 0) return null;
    return new Date(Math.max(...dates.map((d) => d.getTime())));
  }

  get hasLinkedItems(): boolean {
    return this.plaidItems.length > 0;
  }

  get monthlyDueTotal(): number {
    return this.currentMonthBills
      .filter((bill) => bill.kind !== 'payday' && bill.kind !== 'strategy_plan')
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
    this.loadData(true);
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
    if (tab === 'calendar' && !this.debtPlanData) {
      this.loadDebtPlan();
    }
  }

  setStrategy(strategy: 'avalanche' | 'snowball'): void {
    this.activeStrategy = strategy;
    this.debtPlanData = null;
    this.loadDebtPlan();
  }

  loadDebtPlan(): void {
    this.api.getDebtPlan(this.activeStrategy, 1).subscribe({
      next: (data) => { this.debtPlanData = data; },
      error: () => { this.debtPlanData = null; },
    });
  }

  deletePayment(id: string | undefined): void {
    if (!id) return;
    this.plannedPaymentsService.delete(id).subscribe({
      next: () => this.loadData(true),
    });
  }

  markCardPaid(bill: CalendarBill): void {
    if (!bill.internalAccountId) return;
    const cardName = bill.name.replace(/ payment due$/, '');
    const strategyExtra = this.getStrategyPaymentForCard(cardName, bill.dueDate);

    const existing = this.plannedPayments.find(
      (pp) =>
        this.isPlannedStatus(pp.status) &&
        pp.internalAccountId === bill.internalAccountId &&
        pp.date === bill.dueDate,
    );

    const creates: ReturnType<typeof this.plannedPaymentsService.create>[] = [];

    if (existing) {
      this.markPaymentPaid(existing.id);
    } else {
      creates.push(
        this.plannedPaymentsService.create({
          accountId: bill.internalAccountId,
          amount: bill.amount,
          date: bill.dueDate,
          type: 'MINIMUM',
          status: 'PAID',
        }),
      );
    }

    if (strategyExtra) {
      const alreadyRecorded = this.plannedPayments.some(
        (pp) =>
          pp.internalAccountId === bill.internalAccountId &&
          pp.date === bill.dueDate &&
          pp.type === 'EXTRA',
      );
      if (!alreadyRecorded) {
        creates.push(
          this.plannedPaymentsService.create({
            accountId: bill.internalAccountId,
            amount: strategyExtra.amount,
            date: bill.dueDate,
            type: 'EXTRA',
            status: 'PAID',
            strategy: this.activeStrategy,
          }),
        );
      }
    }

    if (creates.length > 0) {
      forkJoin(creates).subscribe({ next: () => this.loadData(true) });
    } else {
      this.loadData(true);
    }
  }

  private getStrategyPaymentForCard(cardName: string, dueDate: string): { amount: number } | null {
    if (!this.debtPlanData) return null;
    const monthStart = this.currentMonthStart();
    const year = monthStart.getFullYear();
    const month = monthStart.getMonth();
    const currentMonthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
    const strategyMonth = this.debtPlanData.monthlyPlan.find((m) => m.month === currentMonthKey);
    return (strategyMonth?.payments ?? []).find(
      (p) => p.accountName === cardName && p.paymentDate === dueDate,
    ) ?? null;
  }

  markPaymentPaid(id: string | undefined): void {
    if (!id) return;
    this.plannedPaymentsService.update(id, { status: 'PAID' }).subscribe({
      next: () => this.loadData(true),
    });
  }

  unmarkPaid(bill: CalendarBill): void {
    const ids = bill.paidPaymentIds;
    if (!ids || ids.length === 0) return;
    forkJoin(ids.map((id) => this.plannedPaymentsService.delete(id))).subscribe({
      next: () => this.loadData(true),
    });
  }

  openQuickAdd(day: number): void {
    this.quickAddDay = day;
    this.quickAddAccountId = this.creditAccounts[0]?.id ?? '';
    this.quickAddAmount = '';
    this.quickAddError = null;
  }

  closeQuickAdd(): void {
    this.quickAddDay = null;
    this.quickAddError = null;
  }

  submitQuickAdd(): void {
    const amount = parseFloat(this.quickAddAmount);
    if (!this.quickAddAccountId || isNaN(amount) || amount <= 0) {
      this.quickAddError = 'Choose an account and enter a valid amount.';
      return;
    }

    const monthStart = this.currentMonthStart();
    const year = monthStart.getFullYear();
    const month = monthStart.getMonth();
    const date = this.formatLocalDate(new Date(year, month, this.quickAddDay!));

    this.quickAddSaving = true;
    this.quickAddError = null;

    this.plannedPaymentsService
      .create({ accountId: this.quickAddAccountId, amount, date, type: 'EXTRA' })
      .subscribe({
        next: () => {
          this.quickAddSaving = false;
          this.quickAddDay = null;
          this.loadData(true);
        },
        error: () => {
          this.quickAddSaving = false;
          this.quickAddError = 'Failed to save payment.';
        },
      });
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
          console.info('[Plaid Link success]', {
            institutionName: result.institutionName,
          });
          void this.ngZone.run(async () => {
            await this.handlePlaidSuccess(result.publicToken, result.institutionName);
          });
        },
        onExit: ({ error, metadata }) => {
          this.ngZone.run(() => {
            this.connectingBank = false;
            if (error) {
              this.error = `Plaid connection failed: ${error.error_code ?? error.error_type ?? 'unknown_error'}`;
              console.error('[Plaid Link exit error]', {
                error,
                metadata,
              });
              return;
            }

            console.info('[Plaid Link exited]', { metadata });
          });
        },
        onEvent: ({ eventName, metadata }) => {
          console.debug('[Plaid Link event]', {
            eventName,
            metadata,
          });
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
      console.error('[Plaid exchange-token failed]', err);
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
      .filter((account) => {
        const day = Math.min(Math.max(account.dueDayOfMonth ?? 1, 1), daysInMonth);
        const dueDate = this.formatLocalDate(new Date(year, month, day));
        return !this.plannedPayments.some(
          (pp) =>
            pp.status.toUpperCase() === 'PAID' &&
            pp.internalAccountId === account.id &&
            pp.date === dueDate,
        );
      })
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
          kind: 'card_due' as const,
          isEstimated: !hasSeededMinimum,
          internalAccountId: account.id,
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
        plannedPaymentId: payment.id,
        strategy: payment.strategy ?? undefined,
      }));

    // Group PAID planned payments into per-account-per-day summary items
    const paidGroups = new Map<string, { accountName: string; date: string; items: { label: string; amount: number }[]; ids: string[] }>();
    const labelMap: Record<string, string> = { MINIMUM: 'Minimum', EXTRA: 'Extra', PAYCHECK_PLAN: 'Planned' };
    for (const pp of this.plannedPayments) {
      if (pp.status.toUpperCase() !== 'PAID') continue;
      const ppDate = this.parseLocalDate(pp.date);
      if (ppDate.getFullYear() !== year || ppDate.getMonth() !== month) continue;
      const key = `${pp.internalAccountId}-${pp.date}`;
      if (!paidGroups.has(key)) paidGroups.set(key, { accountName: pp.accountName, date: pp.date, items: [], ids: [] });
      const group = paidGroups.get(key)!;
      group.items.push({ label: labelMap[pp.type] ?? pp.type, amount: pp.amount });
      group.ids.push(pp.id);
    }
    const paidSummaryItems: CalendarBill[] = Array.from(paidGroups.values()).map(({ accountName, date, items, ids }) => ({
      name: accountName,
      amount: items.reduce((s, i) => s + i.amount, 0),
      dueDate: date,
      kind: 'paid_summary' as const,
      breakdown: items,
      paidPaymentIds: ids,
    }));

    const currentMonthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
    const strategyMonth = this.debtPlanData?.monthlyPlan.find((m) => m.month === currentMonthKey);
    const strategyItems: CalendarBill[] = (strategyMonth?.payments ?? [])
      .filter(
        (p) =>
          !this.plannedPayments.some(
            (pp) =>
              (this.isPlannedStatus(pp.status) || pp.status.toUpperCase() === 'PAID') &&
              pp.date === p.paymentDate &&
              pp.accountName === p.accountName,
          ),
      )
      .map((p) => ({
        name: `${p.accountName}`,
        amount: p.amount,
        dueDate: p.paymentDate,
        kind: 'strategy_plan' as const,
        strategy: this.activeStrategy,
      }));

    return [...accountDueBills, ...recurringBills, ...paydayItems, ...plannedPaymentItems, ...strategyItems, ...paidSummaryItems].sort(
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
