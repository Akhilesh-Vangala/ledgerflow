import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../core/auth.service';

const DEMO_PASSWORD = 'LedgerFlow!2026';

@Component({
  selector: 'lf-login',
  standalone: true,
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="login-wrap">
      <div class="login-card card">
        <div class="card-body p-4 p-md-5">
          <div class="d-flex align-items-center gap-2 mb-4">
            <span class="mark"><i class="bi bi-journal-check"></i></span>
            <span class="fs-4 fw-bold">LedgerFlow</span>
          </div>
          <h1 class="h5 fw-semibold mb-1">Sign in</h1>
          <p class="text-muted-2 small mb-4">Accounts payable approvals, payment runs and reporting.</p>

          @if (error()) {
            <div class="alert alert-danger small py-2">{{ error() }}</div>
          }

          <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
            <div class="mb-3">
              <label class="form-label" for="email">Email</label>
              <input id="email" type="email" class="form-control" formControlName="email" autocomplete="username" />
            </div>
            <div class="mb-4">
              <label class="form-label" for="password">Password</label>
              <input id="password" type="password" class="form-control" formControlName="password" autocomplete="current-password" />
            </div>
            <button class="btn btn-primary w-100" type="submit" [disabled]="busy() || form.invalid">
              @if (busy()) { <span class="spinner-border spinner-border-sm me-1"></span> }
              Sign in
            </button>
          </form>

          <div class="demo mt-4">
            <div class="small fw-semibold mb-2">Demo accounts</div>
            <div class="d-grid gap-2">
              @for (d of demos; track d.email) {
                <button class="btn btn-sm btn-outline-secondary text-start d-flex justify-content-between" (click)="useDemo(d.email)">
                  <span><i class="bi {{ d.icon }} me-2"></i>{{ d.role }}</span>
                  <span class="text-muted-2">{{ d.email }}</span>
                </button>
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: `
    .login-wrap { min-height: 100vh; display: grid; place-items: center; padding: 1rem;
      background: radial-gradient(1200px 600px at 10% -10%, #d6f5e8 0, transparent 60%), #f5f7f6; }
    .login-card { width: min(440px, 100%); box-shadow: 0 20px 50px rgba(12, 26, 21, .10); }
    .mark { display: grid; place-items: center; width: 36px; height: 36px; border-radius: 9px; background: #0c1a15; color: #34d399; }
    .demo { border-top: 1px solid var(--lf-line); padding-top: 1rem; }
  `,
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly demos = [
    { role: 'AP clerk', email: 'clerk@ledgerflow.dev', icon: 'bi-pencil-square' },
    { role: 'Approver', email: 'approver@ledgerflow.dev', icon: 'bi-check2-circle' },
    { role: 'Controller', email: 'controller@ledgerflow.dev', icon: 'bi-shield-check' },
  ];

  readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  useDemo(email: string): void {
    this.form.setValue({ email, password: DEMO_PASSWORD });
    this.submit();
  }

  submit(): void {
    if (this.form.invalid) {
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    const { email, password } = this.form.getRawValue();
    this.auth.login(email, password).subscribe({
      next: () => {
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
        void this.router.navigateByUrl(returnUrl && returnUrl.startsWith('/') ? returnUrl : '/dashboard');
      },
      error: err => {
        this.busy.set(false);
        this.error.set(err.status === 429 ? 'Too many attempts. Wait a minute and try again.' : 'Email or password is incorrect.');
      },
    });
  }
}
