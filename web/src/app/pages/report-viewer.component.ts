import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TelerikReportingModule } from '@progress/telerik-angular-report-viewer';

export interface ViewerSource {
  report: string;
  parameters: Record<string, string | number | null>;
}

/** Wraps the Telerik viewer so the reports page can @defer it; it pulls in jQuery and ~2 MB of viewer code. */
@Component({
  selector: 'lf-report-viewer',
  standalone: true,
  imports: [TelerikReportingModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tr-viewer
      [containerStyle]="{ position: 'relative', height: '760px', width: '100%' }"
      [serviceUrl]="'/api/telerik-reports/'"
      [reportSource]="source()"
      [viewMode]="'INTERACTIVE'"
      [scaleMode]="'FIT_PAGE_WIDTH'"
      [scale]="1.0"
      [parametersAreaVisible]="false" />
  `,
})
export class ReportViewerComponent {
  readonly source = input.required<ViewerSource>();
}
