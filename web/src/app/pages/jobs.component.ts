import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ApiService } from '../core/api.service';
import { describeError } from '../core/http';
import { RecurringJob } from '../core/models';
import { ToastService } from '../core/toast.service';
import { LoadingComponent } from '../shared/ui';

@Component({
  selector: 'lf-jobs',
  standalone: true,
  imports: [DatePipe, LoadingComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-head">
      <div>
        <h1 class="page-title">Background jobs</h1>
        <div class="text-muted-2 small">Recurring Hangfire jobs, persisted in SQL Server. Schedules are UTC.</div>
      </div>
      <a class="btn btn-outline-primary" href="/hangfire" target="_blank" rel="noopener"><i class="bi bi-box-arrow-up-right me-1"></i>Open Hangfire dashboard</a>
    </div>
    <div class="card">
      @if (jobs(); as list) {
        <div class="table-responsive">
          <table class="table align-middle">
            <thead><tr><th>Job</th><th>Schedule</th><th>Last run</th><th>Next run</th><th></th></tr></thead>
            <tbody>
              @for (j of list; track j.id) {
                <tr>
                  <td>
                    <div class="fw-semibold"><code>{{ j.id }}</code></div>
                    <div class="small text-muted-2">{{ j.description }}</div>
                  </td>
                  <td class="text-nowrap"><code>{{ j.cron }}</code></td>
                  <td class="small">
                    @if (j.lastExecution) {
                      {{ j.lastExecution | date: 'MMM d, h:mm a' }}
                      <span class="badge ms-1" [class.text-bg-success]="j.lastJobState === 'Succeeded'" [class.text-bg-warning]="j.lastJobState !== 'Succeeded'">{{ j.lastJobState }}</span>
                    } @else { <span class="text-muted-2">Never</span> }
                  </td>
                  <td class="small">{{ j.nextExecution | date: 'MMM d, h:mm a' }}</td>
                  <td class="text-end text-nowrap">
                    <button class="btn btn-sm btn-outline-secondary" [disabled]="busy() === j.id" (click)="trigger(j)">
                      <i class="bi bi-play-fill"></i> Run now
                    </button>
                  </td>
                </tr>
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
export class JobsComponent {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  readonly jobs = signal<RecurringJob[] | null>(null);
  readonly busy = signal<string | null>(null);

  constructor() {
    this.load();
  }

  trigger(job: RecurringJob): void {
    this.busy.set(job.id);
    this.api.triggerJob(job.id).subscribe({
      next: r => {
        this.toast.success(`Queued ${job.id} as background job #${r.backgroundJobId}.`);
        setTimeout(() => {
          this.busy.set(null);
          this.load();
        }, 2500);
      },
      error: err => {
        this.busy.set(null);
        this.toast.error(describeError(err));
      },
    });
  }

  private load(): void {
    this.api.jobs().subscribe(j => this.jobs.set(j));
  }
}
