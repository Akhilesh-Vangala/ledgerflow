import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subject, debounceTime } from 'rxjs';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { InvoiceQuery, InvoiceStatus, InvoiceSummary, Paged } from '../core/models';
import { LoadingComponent, PagerComponent, StatusBadgeComponent } from '../shared/ui';

@Component({
  selector: 'lf-invoices',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, FormsModule, RouterLink, StatusBadgeComponent, PagerComponent, LoadingComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-head">
      <h1 class="page-title">Invoices</h1>
      @if (auth.canEnterInvoices()) {
        <a class="btn btn-primary" routerLink="/invoices/new"><i class="bi bi-plus-lg me-1"></i>New invoice</a>
      }
    </div>

    <div class="card">
      <div class="card-body border-bottom">
        <div class="row g-2 align-items-center">
          <div class="col-md-4">
            <div class="input-group">
              <span class="input-group-text bg-white"><i class="bi bi-search"></i></span>
              <input class="form-control" placeholder="Invoice # or vendor" [ngModel]="query().search" (ngModelChange)="search$.next($event)" />
            </div>
          </div>
          <div class="col-6 col-md-3">
            <select class="form-select" [ngModel]="query().status" (ngModelChange)="apply({ status: $event })">
              <option value="">All statuses</option>
              @for (s of statuses; track s) { <option [value]="s">{{ s }}</option> }
            </select>
          </div>
          <div class="col-6 col-md-3">
            <select class="form-select" [ngModel]="query().sort" (ngModelChange)="apply({ sort: $event })">
              <option value="">Newest first</option>
              <option value="dueDate">Due soonest</option>
              <option value="-total">Largest amount</option>
              <option value="vendor">Vendor A-Z</option>
            </select>
          </div>
          <div class="col-md-2">
            <div class="form-check form-switch">
              <input class="form-check-input" type="checkbox" id="overdueOnly" [ngModel]="query().overdue === true" (ngModelChange)="apply({ overdue: $event ? true : null })" />
              <label class="form-check-label small" for="overdueOnly">Overdue only</label>
            </div>
          </div>
        </div>
        @if (query().vendorId) {
          <div class="mt-2"><span class="badge text-bg-light border">Filtered to one vendor
            <button class="btn btn-link btn-sm p-0 ms-1" (click)="apply({ vendorId: null })">clear</button></span></div>
        }
      </div>

      @if (result(); as r) {
        <div class="table-responsive">
          <table class="table table-hover table-clickable align-middle">
            <thead><tr><th>Invoice</th><th>Vendor</th><th>Invoice date</th><th>Due</th><th>Status</th><th class="num">Total</th><th class="num">Outstanding</th></tr></thead>
            <tbody>
              @for (i of r.items; track i.id) {
                <tr [routerLink]="['/invoices', i.id]">
                  <td class="fw-semibold text-nowrap">{{ i.invoiceNumber }}</td>
                  <td>{{ i.vendorName }}</td>
                  <td class="text-nowrap">{{ i.invoiceDate | date: 'MMM d, y' }}</td>
                  <td class="text-nowrap" [class.text-danger]="i.isOverdue">{{ i.dueDate | date: 'MMM d, y' }}</td>
                  <td class="text-nowrap"><lf-status [status]="i.status" [overdue]="i.isOverdue" /></td>
                  <td class="num">{{ i.total | currency: 'USD' }}</td>
                  <td class="num fw-semibold">{{ i.outstanding | currency: 'USD' }}</td>
                </tr>
              } @empty {
                <tr><td colspan="7" class="empty">No invoices match these filters.</td></tr>
              }
            </tbody>
          </table>
        </div>
        <lf-pager [page]="r.page" [pageSize]="r.pageSize" [total]="r.totalCount" (pageChange)="apply({ page: $event }, false)" />
      } @else {
        <lf-loading />
      }
    </div>
  `,
})
export class InvoicesComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly auth = inject(AuthService);

  readonly statuses: InvoiceStatus[] = ['Draft', 'Submitted', 'Approved', 'Rejected', 'Scheduled', 'Paid'];
  readonly query = signal<InvoiceQuery>({ page: 1, pageSize: 20, status: '', sort: '', search: '' });
  readonly result = signal<Paged<InvoiceSummary> | null>(null);
  readonly search$ = new Subject<string>();

  ngOnInit(): void {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(p => {
      this.query.set({
        page: Number(p.get('page') ?? 1),
        pageSize: 20,
        status: (p.get('status') as InvoiceStatus) ?? '',
        sort: p.get('sort') ?? '',
        search: p.get('search') ?? '',
        overdue: p.get('overdue') === 'true' ? true : null,
        vendorId: p.get('vendorId') ? Number(p.get('vendorId')) : null,
      });
      this.result.set(null);
      this.api.invoices(this.query()).subscribe(r => this.result.set(r));
    });
    this.search$.pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef)).subscribe(search => this.apply({ search }));
  }

  /** Filters live in the URL so views are shareable and the back button works. */
  apply(change: Partial<InvoiceQuery>, resetPage = true): void {
    const next = { ...this.query(), ...change, ...(resetPage ? { page: 1 } : {}) };
    void this.router.navigate([], {
      queryParams: {
        status: next.status || null,
        sort: next.sort || null,
        search: next.search || null,
        overdue: next.overdue ? true : null,
        vendorId: next.vendorId ?? null,
        page: next.page && next.page > 1 ? next.page : null,
      },
    });
  }
}
