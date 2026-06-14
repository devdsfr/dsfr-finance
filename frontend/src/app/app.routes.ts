import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },

  // Auth
  {
    path: 'auth',
    children: [
      {
        path: 'login',
        loadComponent: () => import('./modules/auth/login/login.component').then(m => m.LoginComponent)
      },
      {
        path: 'register',
        loadComponent: () => import('./modules/auth/register/register.component').then(m => m.RegisterComponent)
      }
    ]
  },

  // Protected
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./shell/shell.component').then(m => m.ShellComponent),
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./modules/dashboard/dashboard.component').then(m => m.DashboardComponent)
      },
      {
        path: 'transactions',
        loadComponent: () => import('./modules/transactions/list/transaction-list.component').then(m => m.TransactionListComponent)
      },
      {
        path: 'transactions/new',
        loadComponent: () => import('./modules/transactions/form/transaction-form.component').then(m => m.TransactionFormComponent)
      },
      {
        path: 'transactions/:id/edit',
        loadComponent: () => import('./modules/transactions/form/transaction-form.component').then(m => m.TransactionFormComponent)
      },
      {
        path: 'reports/flow',
        loadComponent: () => import('./modules/reports/flow/flow-report.component').then(m => m.FlowReportComponent)
      },
      {
        path: 'reports/patrimony',
        loadComponent: () => import('./modules/reports/patrimony/patrimony-report.component').then(m => m.PatrimonyReportComponent)
      },
      {
        path: 'reports/accounts',
        loadComponent: () => import('./modules/reports/accounts/accounts-report.component').then(m => m.AccountsReportComponent)
      },
      {
        path: 'reports/categories',
        loadComponent: () => import('./modules/reports/categories/categories-report.component').then(m => m.CategoriesReportComponent)
      },
      {
        path: 'reports/tags',
        loadComponent: () => import('./modules/reports/tags/tags-report.component').then(m => m.TagsReportComponent)
      },
      {
        path: 'reports/installments',
        loadComponent: () => import('./modules/reports/installments/installments-report.component').then(m => m.InstallmentsReportComponent)
      },
      {
        path: 'reports/card-invoices',
        loadComponent: () => import('./modules/reports/card-invoices/card-invoices.component').then(m => m.CardInvoicesComponent)
      },
      {
        path: 'spending-limits',
        loadComponent: () => import('./modules/spending-limits/list/spending-limits.component').then(m => m.SpendingLimitsComponent)
      },
      {
        path: 'categories',
        loadComponent: () => import('./modules/categories/list/categories.component').then(m => m.CategoriesComponent)
      },
      {
        path: 'banking',
        loadComponent: () => import('./modules/banking/banking.component').then(m => m.BankingComponent)
      },
      {
        path: 'notifications',
        loadComponent: () => import('./modules/notifications/list/notifications-list.component').then(m => m.NotificationsListComponent)
      },
      {
        path: 'alert-config',
        loadComponent: () => import('./modules/notifications/alert-config/alert-config.component').then(m => m.AlertConfigComponent)
      },
      {
        path: 'account',
        loadComponent: () => import('./modules/account/profile/account-profile.component').then(m => m.AccountProfileComponent)
      },
      {
        path: 'activity',
        loadComponent: () => import('./modules/account/activity/activity-log.component').then(m => m.ActivityLogComponent)
      }
    ]
  },

  { path: '**', redirectTo: 'dashboard' }
];
