import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { PaymentRunSummary, ReportArchive, ReportCapabilities, ReportDefinition } from '../core/models';
import { LoadingComponent, isoDate } from '../shared/ui';
import { ReportViewerComponent } from './report-viewer.component';

/**
 * Report center. With Telerik enabled on the server, reports render interactively in the Telerik viewer
 * (paging, export to PDF/Excel/Word, print). Without it, the same datasets download as CSV.
 */
@Component({
  selector: 'lf-reports',
  standalone: true,
  imports: [DatePipe, DecimalPipe, FormsModule, LoadingComponent, ReportViewerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reports.component.html',
})
export class ReportsComponent {
  private readonly api = inject(ApiService);

  readonly caps = signal<ReportCapabilities | null>(null);
  readonly archive = signal<ReportArchive[] | null>(null);
  readonly runs = signal<PaymentRunSummary[]>([]);
  readonly active = signal<ReportDefinition | null>(null);
  readonly viewerSource = computed(() => {
    const report = this.active();
    return report ? { report: `${report.name}.trdx`, parameters: this.parameterValues(report) } : null;
  });

  from = isoDate(new Date(new Date().getFullYear(), 0, 1));
  to = isoDate(new Date());
  paymentRunId: number | null = null;

  constructor() {
    this.api.reportCapabilities().subscribe(c => {
      if (c.interactiveViewer) {
        loadViewerStyles();
      }
      this.caps.set(c);
      this.active.set(c.reports[0] ?? null);
    });
    this.api.reportArchive().subscribe(a => this.archive.set(a));
    this.api.paymentRuns().subscribe(r => {
      const released = r.filter(x => x.status === 'Released');
      this.runs.set(released);
      this.paymentRunId = released[0]?.id ?? null;
    });
  }

  select(report: ReportDefinition): void {
    this.active.set(null);
    queueMicrotask(() => this.active.set(report));
  }

  downloadUrl(report: ReportDefinition, format: 'csv' | 'pdf'): string {
    return this.api.reportUrl(report.name, format, this.parameterValues(report));
  }

  archiveUrl(item: ReportArchive): string {
    return this.api.archiveUrl(item.id);
  }

  missingParameter(report: ReportDefinition): boolean {
    return report.parameters.includes('paymentRunId') && !this.paymentRunId;
  }

  private parameterValues(report: ReportDefinition): Record<string, string | number | null> {
    const values: Record<string, string | number | null> = {};
    if (report.parameters.includes('from')) {
      values['from'] = this.from;
      values['to'] = this.to;
    }
    if (report.parameters.includes('paymentRunId')) {
      values['paymentRunId'] = this.paymentRunId;
    }
    return values;
  }
}

/** The viewer's DOM is built by jQuery, outside Angular's style scoping, so its CSS ships as a global bundle loaded on demand. */
function loadViewerStyles(): void {
  if (!document.getElementById('telerik-viewer-css')) {
    const link = document.createElement('link');
    link.id = 'telerik-viewer-css';
    link.rel = 'stylesheet';
    link.href = 'telerik-viewer.css';
    document.head.appendChild(link);
  }
}
