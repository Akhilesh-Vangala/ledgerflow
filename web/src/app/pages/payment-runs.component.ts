import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { describeError } from '../core/http';
import { InvoiceSummary, PaymentRunDetail, PaymentRunSummary } from '../core/models';
import { ToastService } from '../core/toast.service';
import { LoadingComponent, StatusBadgeComponent, isoDate } from '../shared/ui';

@Component({
  selector: 'lf-payment-runs',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, RouterLink, StatusBadgeComponent, LoadingComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-head">
      <div>
        <h1 class="page-title">Payment runs</h1>
        <div class="text-muted-2 small">Approved invoices are batched into runs. Only a controller can release a run, which marks its invoices paid.</div>
      </div>
      @if (auth.canEnterInvoices()) {
        <a class="btn btn-primary" routerLink="/payment-runs/new"><i class="bi bi-plus-lg me-1"></i>New payment run</a>
      }
    </div>
    <div class="card">
      @if (runs(); as list) {
        <div class="table-responsive">
          <table class="table table-hover table-clickable align-middle">
            <thead><tr><th>Run</th><th>Payment date</th><th>Status</th><th class="num">Payments</th><th class="num">Total</th><th>Released by</th></tr></thead>
            <tbody>
              @for (r of list; track r.id) {
                <tr [routerLink]="['/payment-runs', r.id]">
                  <td class="fw-semibold">{{ r.name }}</td>
                  <td>{{ r.paymentDate | date: 'EEE, MMM d, y' }}</td>
                  <td><lf-status [status]="r.status" /></td>
                  <td class="num">{{ r.paymentCount }}</td>
                  <td class="num fw-semibold">{{ r.total | currency: 'USD' }}</td>
                  <td class="small text-muted-2">{{ r.releasedBy ?? (r.status === 'Draft' ? 'Awaiting release' : '') }}</td>
                </tr>
              } @empty {
                <tr><td colspan="6" class="empty">No payment runs yet.</td></tr>
              }
            </tbody>
          </table>
        </div>
      } @else {
        <lf-loading />
      }
    </div>
  `,
})
export class PaymentRunsComponent {
  readonly auth = inject(AuthService);
  readonly runs = signal<PaymentRunSummary[] | null>(null);

  constructor() {
    inject(ApiService).paymentRuns().subscribe(r => this.runs.set(r));
  }
}

@Component({
  selector: 'lf-payment-run-new',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, FormsModule, RouterLink, LoadingComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-head">
      <div>
        <a class="small text-decoration-none" routerLink="/payment-runs"><i class="bi bi-arrow-left"></i> Payment runs</a>
        <h1 class="page-title">New payment run</h1>
      </div>
    </div>
    <div class="row g-3">
      <div class="col-lg-8">
        <div class="card">
          <div class="card-header d-flex justify-content-between align-items-center">
            <span>Approved invoices not yet scheduled</span>
            <button class="btn btn-sm btn-outline-secondary" (click)="selectDueWithin(10)">Select due within 10 days</button>
          </div>
          @if (eligible(); as list) {
            <div class="table-responsive">
              <table class="table align-middle">
                <thead><tr>
                  <th style="width:36px"><input class="form-check-input" type="checkbox" [checked]="allSelected()" (change)="toggleAll()" aria-label="Select all" /></th>
                  <th>Invoice</th><th>Vendor</th><th>Due</th><th class="num">Amount</th></tr></thead>
                <tbody>
                  @for (i of list; track i.id) {
                    <tr (click)="toggle(i.id)" style="cursor:pointer">
                      <td><input class="form-check-input" type="checkbox" [checked]="selected().has(i.id)" (click)="$event.stopPropagation()" (change)="toggle(i.id)" [attr.aria-label]="'Select ' + i.invoiceNumber" /></td>
                      <td class="fw-semibold">{{ i.invoiceNumber }}</td>
                      <td>{{ i.vendorName }}</td>
                      <td [class.text-danger]="i.isOverdue">{{ i.dueDate | date: 'MMM d, y' }}</td>
                      <td class="num">{{ i.outstanding | currency: 'USD' }}</td>
                    </tr>
                  } @empty {
                    <tr><td colspan="5" class="empty">No approved invoices are waiting for payment.</td></tr>
                  }
                </tbody>
              </table>
            </div>
          } @else {
            <lf-loading />
          }
        </div>
      </div>
      <div class="col-lg-4">
        <div class="card position-sticky" style="top:80px">
          <div class="card-body">
            <div class="mb-3">
              <label class="form-label" for="runName">Run name</label>
              <input id="runName" class="form-control" [(ngModel)]="name" />
            </div>
            <div class="mb-3">
              <label class="form-label" for="payDate">Payment date</label>
              <input id="payDate" type="date" class="form-control" [(ngModel)]="paymentDate" [min]="today" />
            </div>
            <div class="d-flex justify-content-between"><span class="text-muted-2">Invoices</span><span>{{ selected().size }}</span></div>
            <div class="d-flex justify-content-between fs-5 fw-bold"><span>Total</span><span class="num">{{ selectedTotal() | currency: 'USD' }}</span></div>
          </div>
          <div class="card-footer bg-white d-grid">
            <button class="btn btn-primary" [disabled]="busy() || selected().size === 0 || !name.trim()" (click)="create()">Create draft run</button>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class PaymentRunNewComponent {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly today = isoDate(new Date());
  readonly eligible = signal<InvoiceSummary[] | null>(null);
  readonly selected = signal(new Set<number>());
  readonly busy = signal(false);
  name = `Payment run ${this.today}`;
  paymentDate = isoDate(new Date(Date.now() + 2 * 86_400_000));

  readonly selectedTotal = computed(() =>
    (this.eligible() ?? []).filter(i => this.selected().has(i.id)).reduce((s, i) => s + i.outstanding, 0),
  );
  readonly allSelected = computed(() => {
    const list = this.eligible() ?? [];
    return list.length > 0 && list.every(i => this.selected().has(i.id));
  });

  constructor() {
    this.api.eligibleInvoices().subscribe(list => this.eligible.set(list));
  }

  toggle(id: number): void {
    const next = new Set(this.selected());
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    this.selected.set(next);
  }

  toggleAll(): void {
    this.selected.set(this.allSelected() ? new Set() : new Set((this.eligible() ?? []).map(i => i.id)));
  }

  selectDueWithin(days: number): void {
    const cutoff = isoDate(new Date(Date.now() + days * 86_400_000));
    this.selected.set(new Set((this.eligible() ?? []).filter(i => i.dueDate <= cutoff).map(i => i.id)));
  }

  create(): void {
    this.busy.set(true);
    this.api.createPaymentRun({ name: this.name.trim(), paymentDate: this.paymentDate, invoiceIds: [...this.selected()] }).subscribe({
      next: run => {
        this.toast.success(`Draft run created with ${run.payments.length} payments.`);
        void this.router.navigate(['/payment-runs', run.summary.id]);
      },
      error: err => {
        this.busy.set(false);
        this.toast.error(describeError(err));
      },
    });
  }
}

@Component({
  selector: 'lf-payment-run-detail',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, RouterLink, StatusBadgeComponent, LoadingComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (run(); as r) {
      <div class="page-head">
        <div>
          <a class="small text-decoration-none" routerLink="/payment-runs"><i class="bi bi-arrow-left"></i> Payment runs</a>
          <h1 class="page-title d-flex gap-2 align-items-center">{{ r.summary.name }} <lf-status [status]="r.summary.status" /></h1>
          <div class="text-muted-2 small">
            Paying {{ r.summary.paymentDate | date: 'EEEE, MMM d, y' }}
            @if (r.summary.releasedBy) { · released by {{ r.summary.releasedBy }} {{ r.summary.releasedAt | date: 'MMM d, h:mm a' }} }
          </div>
        </div>
        <div class="d-flex gap-2">
          @if (r.summary.status === 'Released') {
            <a class="btn btn-outline-secondary" [href]="remittanceCsv()" download><i class="bi bi-filetype-csv me-1"></i>Remittance CSV</a>
          }
          @if (r.summary.status === 'Draft' && auth.isController()) {
            <button class="btn btn-outline-danger" [disabled]="busy()" (click)="act('cancel')">Cancel run</button>
            <button class="btn btn-success" [disabled]="busy()" (click)="act('release')"><i class="bi bi-send-check me-1"></i>Release {{ r.summary.total | currency: 'USD' }}</button>
          }
        </div>
      </div>
      @if (r.summary.status === 'Draft' && !auth.isController()) {
        <div class="alert alert-light border small"><i class="bi bi-info-circle me-1"></i>A controller must review and release this run.</div>
      }
      <div class="card">
        <div class="table-responsive">
          <table class="table table-hover table-clickable align-middle">
            <thead><tr><th>Vendor</th><th>Invoice</th><th>Due</th><th>Reference</th><th class="num">Amount</th></tr></thead>
            <tbody>
              @for (p of r.payments; track p.id) {
                <tr [routerLink]="['/invoices', p.invoiceId]">
                  <td>{{ p.vendorName }}</td>
                  <td class="fw-semibold">{{ p.invoiceNumber }}</td>
                  <td>{{ p.dueDate | date: 'MMM d, y' }}</td>
                  <td><code>{{ p.reference ?? 'Assigned on release' }}</code></td>
                  <td class="num">{{ p.amount | currency: 'USD' }}</td>
                </tr>
              }
            </tbody>
            <tfoot><tr class="fw-bold"><td colspan="4" class="text-end">Total</td><td class="num">{{ r.summary.total | currency: 'USD' }}</td></tr></tfoot>
          </table>
        </div>
      </div>
    } @else {
      <lf-loading />
    }
  `,
})
export class PaymentRunDetailComponent implements OnInit {
  readonly id = input.required<string>();
  readonly auth = inject(AuthService);
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  readonly run = signal<PaymentRunDetail | null>(null);
  readonly busy = signal(false);

  ngOnInit(): void {
    this.api.paymentRun(Number(this.id())).subscribe(r => this.run.set(r));
  }

  remittanceCsv(): string {
    return this.api.reportUrl('PaymentRemittance', 'csv', { paymentRunId: this.id() });
  }

  act(action: 'release' | 'cancel'): void {
    const verb = action === 'release' ? 'Release this run and mark its invoices paid?' : 'Cancel this run and return its invoices to Approved?';
    if (!confirm(verb)) {
      return;
    }
    this.busy.set(true);
    this.api.paymentRunAction(Number(this.id()), action).subscribe({
      next: r => {
        this.run.set(r);
        this.busy.set(false);
        this.toast.success(action === 'release' ? `Released ${r.payments.length} payments.` : 'Payment run cancelled.');
      },
      error: err => {
        this.busy.set(false);
        this.toast.error(describeError(err));
      },
    });
  }
}
