import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import {
  BlockingLoader,
  DataTable,
  DataTableSkeleton,
  Skeleton,
  TableRow,
} from '@iotility/shared-ui';
import { finalize } from 'rxjs';
import { ProgressBar } from '../../../shared/progress-bar/progress-bar';
import { FeedbackDialogBridgeService } from '../../../shared/services/feedback-dialog-bridge.service';
import {
  ReportDateFilter,
  ReportExportFormat,
  ReportQuery,
  ReportRecord,
  ReportsApiService,
  ReportType,
} from '../../../shared/services/reports-api.service';
import { REPORT_DEFINITIONS } from './report-definitions';

const JOB_STATUS: Record<string, string> = {
  '1': 'Pending',
  '2': 'In Progress',
  '3': 'Completed',
  '4': 'Aborted by driver',
  '5': 'Delayed',
  '6': 'On Time',
  '7': 'Aborted by admin',
};

@Component({
  selector: 'app-dashboard-reports',
  imports: [BlockingLoader, DataTable, DataTableSkeleton, ProgressBar, Skeleton],
  templateUrl: './reports.html',
  styleUrl: './reports.css',
})
export class Reports implements OnInit, OnDestroy {
  protected readonly reports = REPORT_DEFINITIONS;
  protected readonly reportSearch = signal('');
  protected readonly filteredReports = computed(() => {
    const query = this.reportSearch().trim().toLowerCase();
    return query
      ? this.reports.filter((report) =>
          [report.name, report.description, report.type].some((value) =>
            value.toLowerCase().includes(query),
          ),
        )
      : this.reports;
  });
  protected readonly selectedType = signal<ReportType>(this.reports[0].type);
  protected readonly selectedReport = computed(() =>
    this.reports.find((report) => report.type === this.selectedType())!,
  );
  protected readonly rows = signal<TableRow[]>([]);
  protected readonly total = signal(0);
  protected readonly offset = signal(0);
  protected readonly limit = 10;
  protected readonly loading = signal(true);
  protected readonly loadedType = signal<ReportType | null>(null);
  protected readonly initialLoading = computed(
    () => this.loading() && this.loadedType() !== this.selectedType(),
  );
  protected readonly refreshing = computed(
    () => this.loading() && this.loadedType() === this.selectedType(),
  );
  protected readonly exporting = signal<ReportExportFormat | null>(null);
  protected readonly error = signal('');
  protected readonly interval = signal<ReportDateFilter>('month');
  protected readonly tripSearch = signal('');
  protected readonly start = computed(() => (this.total() ? this.offset() + 1 : 0));
  protected readonly end = computed(() => Math.min(this.offset() + this.limit, this.total()));
  protected readonly columnLabels = computed(() =>
    this.selectedReport().columns.map((column) => column.label),
  );
  private searchTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private readonly api: ReportsApiService,
    private readonly feedback: FeedbackDialogBridgeService,
  ) {}

  ngOnInit(): void {
    this.load();
  }
  ngOnDestroy(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
  }

  protected selectReport(type: ReportType): void {
    if (type === this.selectedType()) return;
    this.selectedType.set(type);
    this.offset.set(0);
    this.load();
  }
  protected chooseInterval(value: ReportDateFilter): void {
    if (value === this.interval()) return;
    this.interval.set(value);
    this.offset.set(0);
    this.load();
  }
  protected updateTripSearch(value: string): void {
    this.tripSearch.set(value);
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.offset.set(0);
      this.load();
    }, 400);
  }
  protected previous(): void {
    this.offset.update((value) => Math.max(0, value - this.limit));
    this.load();
  }
  protected next(): void {
    if (this.offset() + this.limit < this.total()) {
      this.offset.update((value) => value + this.limit);
      this.load();
    }
  }
  protected retry(): void {
    this.load();
  }

  protected exportReport(format: ReportExportFormat): void {
    if (this.exporting()) return;
    this.exporting.set(format);
    this.api
      .exportReport(this.reportQuery(0), format)
      .pipe(finalize(() => this.exporting.set(null)))
      .subscribe({
        next: (blob) => void this.handleExportResponse(blob, format),
        error: (response: HttpErrorResponse) => void this.handleExportError(response),
      });
  }

  private load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api
      .getReport(this.reportQuery(this.offset()))
      .pipe(
        finalize(() => {
          this.loading.set(false);
          this.loadedType.set(this.selectedType());
        }),
      )
      .subscribe({
        next: (response) => {
          const payload = response.data;
          const records = Array.isArray(payload) ? payload : (payload?.data ?? []);
          this.rows.set(records.map((record) => this.toRow(record)));
          this.total.set(
            Array.isArray(payload) ? payload.length : (payload?.count ?? records.length),
          );
        },
        error: (response) => {
          this.rows.set([]);
          this.total.set(0);
          void this.feedback.open({
            type: 'error',
            title: 'Unable to load report',
            message: response.error?.message || 'The report could not be loaded.',
            confirmText: 'Close',
            showCancel: false,
          });
        },
      });
  }

  private reportQuery(offset: number): ReportQuery {
    return {
      limit: this.limit,
      offset,
      reportType: this.selectedType(),
      dateFilter: this.interval(),
      search: this.selectedType() === 'trip_report' ? this.tripSearch() : undefined,
      order: '',
      orderBy: '',
    };
  }
  private toRow(record: ReportRecord): TableRow {
    return Object.fromEntries(
      this.selectedReport().columns.map((column) => {
        let value = record[column.key];
        if (column.key === 'job_status' && value != null)
          value = JOB_STATUS[String(value)] ?? value;
        return [column.key, value ?? '—'];
      }),
    ) as TableRow;
  }
  private async handleExportResponse(blob: Blob, format: ReportExportFormat): Promise<void> {
    if (blob.type.includes('json')) {
      await this.showBlobError(blob);
      return;
    }
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `${this.fileName(this.selectedReport().name)}-report.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }
  private async handleExportError(response: HttpErrorResponse): Promise<void> {
    if (response.error instanceof Blob) {
      await this.showBlobError(response.error);
      return;
    }
    this.showExportError(
      response.error?.message || response.statusText || 'The report could not be exported.',
    );
  }
  private async showBlobError(blob: Blob): Promise<void> {
    try {
      this.showExportError(
        JSON.parse(await blob.text()).message || 'The report could not be exported.',
      );
    } catch {
      this.showExportError('The report could not be exported.');
    }
  }
  private showExportError(message: string): void {
    void this.feedback.open({
      type: 'error',
      title: 'Unable to export report',
      message,
      confirmText: 'Close',
      showCancel: false,
    });
  }
  private fileName(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-');
  }
}
