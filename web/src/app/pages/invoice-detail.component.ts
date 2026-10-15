import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { describeError } from '../core/http';
import { InvoiceDetail } from '../core/models';
import { ToastService } from '../core/toast.service';
import { LoadingComponent, StatusBadgeComponent } from '../shared/ui';

const EVENT_ICON: Record<string, string> = {
  Created: 'bi-plus-circle',
  Updated: 'bi-pencil',
  Submitted: 'bi-send',
  Approved: 'bi-check-circle-fill text-success',
  Rejected: 'bi-x-circle-fill text-danger',
  Scheduled: 'bi-calendar-check text-primary',
  Unscheduled: 'bi-calendar-x',
  Paid: 'bi-cash-coin text-success',
  FlaggedOverdue: 'bi-alarm text-danger',
};

@Component({
  selector: 'lf-invoice-detail',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, FormsModule, RouterLink, StatusBadgeComponent, LoadingComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './invoice-detail.component.html',
  styles: `
    .timeline { list-style: none; padding: 0; margin: 0; }
    .timeline li { display: flex; gap: .75rem; padding: .6rem 0; border-bottom: 1px dashed var(--lf-line); }
    .timeline li:last-child { border-bottom: 0; }
    .timeline i { font-size: 1.05rem; margin-top: .1rem; }
    dl { display: grid; grid-template-columns: auto 1fr; gap: .4rem 1rem; margin: 0; }
    dt { color: var(--lf-muted); font-weight: 500; font-size: .85rem; }
    dd { margin: 0; overflow-wrap: anywhere; }
  `,
})
export class InvoiceDetailComponent implements OnInit {
  readonly id = input.required<string>();

  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  readonly invoice = signal<InvoiceDetail | null>(null);
  readonly busy = signal(false);
  readonly decision = signal<'approve' | 'reject' | null>(null);
  comment = '';

  ngOnInit(): void {
    this.api.invoice(Number(this.id())).subscribe(i => this.invoice.set(i));
  }

  icon(type: string): string {
    return EVENT_ICON[type] ?? 'bi-dot';
  }

  can(action: string): boolean {
    return this.invoice()?.allowedActions.includes(action) ?? false;
  }

  openDecision(kind: 'approve' | 'reject'): void {
    this.comment = '';
    this.decision.set(kind);
  }

  run(action: 'submit' | 'approve' | 'reject'): void {
    const current = this.invoice();
    if (!current) {
      return;
    }
    this.busy.set(true);
    this.api.invoiceAction(current.summary.id, action, this.comment.trim() || undefined).subscribe({
      next: updated => {
        this.invoice.set(updated);
        this.busy.set(false);
        this.decision.set(null);
        const verb = { submit: 'submitted for approval', approve: 'approved', reject: 'rejected' }[action];
        this.toast.success(`Invoice ${updated.summary.invoiceNumber} ${verb}.`);
      },
      error: err => {
        this.busy.set(false);
        this.toast.error(describeError(err));
      },
    });
  }
}
