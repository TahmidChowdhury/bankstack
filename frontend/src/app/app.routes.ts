import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/dashboard',
    pathMatch: 'full',
  },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./dashboard/dashboard.component').then((m) => m.DashboardComponent),
  },
  {
    path: 'accounts',
    loadComponent: () =>
      import('./accounts/accounts.component').then((m) => m.AccountsComponent),
  },
  {
    path: 'transactions',
    loadComponent: () =>
      import('./transactions/transactions.component').then((m) => m.TransactionsComponent),
  },
  {
    path: 'payoff-calculator',
    loadComponent: () =>
      import('./payoff-calculator/payoff-calculator.component').then(
        (m) => m.PayoffCalculatorComponent,
      ),
  },
];
