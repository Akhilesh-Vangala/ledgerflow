import { Routes } from '@angular/router';
import { authGuard, roleGuard } from './core/http';
import { ShellComponent } from './layout/shell.component';
import { LoginComponent } from './pages/login.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent, title: 'Sign in · LedgerFlow' },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', title: 'Dashboard · LedgerFlow', loadComponent: () => import('./pages/dashboard.component').then(m => m.DashboardComponent) },
      { path: 'invoices', title: 'Invoices · LedgerFlow', loadComponent: () => import('./pages/invoices.component').then(m => m.InvoicesComponent) },
      {
        path: 'invoices/new',
        title: 'New invoice · LedgerFlow',
        canActivate: [roleGuard('Clerk', 'Controller')],
        loadComponent: () => import('./pages/invoice-form.component').then(m => m.InvoiceFormComponent),
      },
      {
        path: 'invoices/:id/edit',
        title: 'Edit invoice · LedgerFlow',
        canActivate: [roleGuard('Clerk', 'Controller')],
        loadComponent: () => import('./pages/invoice-form.component').then(m => m.InvoiceFormComponent),
      },
      { path: 'invoices/:id', title: 'Invoice · LedgerFlow', loadComponent: () => import('./pages/invoice-detail.component').then(m => m.InvoiceDetailComponent) },
      {
        path: 'approvals',
        title: 'Approvals · LedgerFlow',
        canActivate: [roleGuard('Approver', 'Controller')],
        loadComponent: () => import('./pages/approvals.component').then(m => m.ApprovalsComponent),
      },
      { path: 'payment-runs', title: 'Payment runs · LedgerFlow', loadComponent: () => import('./pages/payment-runs.component').then(m => m.PaymentRunsComponent) },
      {
        path: 'payment-runs/new',
        title: 'New payment run · LedgerFlow',
        canActivate: [roleGuard('Clerk', 'Controller')],
        loadComponent: () => import('./pages/payment-runs.component').then(m => m.PaymentRunNewComponent),
      },
      { path: 'payment-runs/:id', title: 'Payment run · LedgerFlow', loadComponent: () => import('./pages/payment-runs.component').then(m => m.PaymentRunDetailComponent) },
      { path: 'vendors', title: 'Vendors · LedgerFlow', loadComponent: () => import('./pages/vendors.component').then(m => m.VendorsComponent) },
      { path: 'reports', title: 'Reports · LedgerFlow', loadComponent: () => import('./pages/reports.component').then(m => m.ReportsComponent) },
      {
        path: 'jobs',
        title: 'Background jobs · LedgerFlow',
        canActivate: [roleGuard('Controller')],
        loadComponent: () => import('./pages/jobs.component').then(m => m.JobsComponent),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
