import { ExportFormat, ExportMenu, TabIndicator } from '@iotility/shared-ui';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Skeleton } from '@iotility/shared-ui';
import { StatCard } from '../../shared/stat-card/stat-card';
import { ManualViolationForm } from './manual-violation-form/manual-violation-form';
import { ViolationsApiService } from '../../shared/services/violations-api.service';
import { ExportRunnerService } from '../../shared/services/export-runner.service';

@Component({
  selector: 'app-violations-page',
  imports: [TabIndicator, ExportMenu, ManualViolationForm, RouterLink, RouterLinkActive, RouterOutlet, Skeleton, StatCard],
  templateUrl: './violations-page.html',
  styleUrl: './violations-page.css',
})
export class ViolationsPage {
  private readonly api = inject(ViolationsApiService);
  private readonly exporter = inject(ExportRunnerService);
  protected readonly summary = this.api.pageSummary;
  // True while the All Violations list re-fetches for a date-range/filter change;
  // only the card values become skeletons, all page text stays visible.
  protected readonly summaryLoading = this.api.pageSummaryLoading;
  protected readonly manualViolationOpen = signal(false);
  protected readonly exporting = signal<ExportFormat | null>(null);
  /** Only the All Violations list publishes filters; there must be something in range to export. */
  protected readonly canExport = computed(
    () => !!this.api.exportFilters() && !this.summaryLoading() && Number(this.summary().total) > 0,
  );

  protected export(format: ExportFormat): void {
    const filters = this.api.exportFilters();
    if (!filters) return;
    // Every record in the filtered range, not just the page on screen.
    const all = { ...filters, offset: 0, limit: Math.max(Number(this.summary().total) || 0, filters.limit) };
    const request = format === 'pdf' ? this.api.exportPdf(all) : this.api.exportXls(all);
    this.exporter.run(request, 'Violations', format, this.exporting);
  }
}
