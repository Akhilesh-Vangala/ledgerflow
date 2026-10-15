import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { InvoiceStatus, PaymentRunStatus } from '../core/models';

const STATUS_CLASS: Record<InvoiceStatus | PaymentRunStatus, string> = {
  Draft: 'text-bg-light border',
  Submitted: 'text-bg-warning',
  Approved: 'text-bg-info',
  Rejected: 'text-bg-danger',
  Scheduled: 'text-bg-primary',
  Paid: 'text-bg-success',
  Released: 'text-bg-success',
  Cancelled: 'text-bg-secondary',
};

@Component({
  selector: 'lf-status',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="badge badge-status {{ css() }}">{{ status() }}</span>
    @if (overdue()) {
      <span class="badge badge-status text-bg-danger ms-1"><i class="bi bi-alarm"></i> Overdue</span>
    }
  `,
})
export class StatusBadgeComponent {
  readonly status = input.required<InvoiceStatus | PaymentRunStatus>();
  readonly overdue = input(false);
  readonly css = computed(() => STATUS_CLASS[this.status()] ?? 'text-bg-light');
}

@Component({
  selector: 'lf-pager',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (total() > 0) {
      <div class="d-flex flex-wrap gap-2 justify-content-between align-items-center px-3 py-2 border-top small text-muted-2">
        <span>{{ from() }}-{{ to() }} of {{ total() }}</span>
        <div class="btn-group btn-group-sm">
          <button class="btn btn-outline-secondary" [disabled]="page() <= 1" (click)="pageChange.emit(page() - 1)">
            <i class="bi bi-chevron-left"></i> Prev
          </button>
          <button class="btn btn-outline-secondary" [disabled]="page() >= pages()" (click)="pageChange.emit(page() + 1)">
            Next <i class="bi bi-chevron-right"></i>
          </button>
        </div>
      </div>
    }
  `,
})
export class PagerComponent {
  readonly page = input.required<number>();
  readonly pageSize = input.required<number>();
  readonly total = input.required<number>();
  readonly pageChange = output<number>();
  readonly pages = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize())));
  readonly from = computed(() => (this.page() - 1) * this.pageSize() + 1);
  readonly to = computed(() => Math.min(this.total(), this.page() * this.pageSize()));
}

@Component({
  selector: 'lf-loading',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="d-flex align-items-center justify-content-center gap-2 py-5 text-muted-2">
      <span class="spinner-border spinner-border-sm"></span> Loading...
    </div>
  `,
})
export class LoadingComponent {}

/** ISO yyyy-MM-dd for <input type="date"> and API DateOnly fields, in local time. */
export function isoDate(date: Date): string {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}
