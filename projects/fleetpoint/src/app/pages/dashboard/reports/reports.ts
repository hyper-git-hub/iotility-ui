import { Component, OnInit, computed, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import {
  BlockingLoader,
  DataTable,
  DateTimePicker,
  TableColumn,
  TableRow,
} from '@iotility/shared-ui';
import { finalize } from 'rxjs';
import {
  QpmcReportType,
  ReportRecord,
  ReportExportFormat,
  ReportQuery,
  ReportsApiService,
} from '../../../shared/services/reports-api.service';

interface ReportDefinition {
  type: QpmcReportType;
  name: string;
  description: string;
  icon: string;
  columns: TableColumn[];
}

interface MonthOption {
  label: string;
  value: string;
  start: Date;
  end: Date;
}

@Component({
  selector: 'app-dashboard-reports',
  imports: [BlockingLoader, DataTable, DateTimePicker],
  templateUrl: './reports.html',
  styleUrl: './reports.css',
})
export class Reports implements OnInit {
  protected readonly reports: ReportDefinition[] = [
    {
      type: 'qpmc_yard_utilization_report',
      name: 'Yard Utilization',
      description: 'Vehicle productivity and efficiency',
      icon: 'YU',
      columns: [
        { key: 'vehicle_registration', label: 'Vehicle' },
        { key: 'report_date', label: 'Report Date', type: 'date' },
        { key: 'powered_on', label: 'Powered On' },
        { key: 'idle_time', label: 'Idle Time' },
        { key: 'traveling_time', label: 'Travelling Time' },
        { key: 'productive_time', label: 'Productive Time' },
        { key: 'loading_cycles', label: 'Loading Cycles' },
        { key: 'efficiency_ratio', label: 'Efficiency Ratio' },
        { key: 'distance_travelled', label: 'Distance Travelled' },
      ],
    },
    {
      type: 'qpmc_loading_activity_report',
      name: 'Loading Activity',
      description: 'Loading events and durations',
      icon: 'LA',
      columns: [
        { key: 'vehicle_registration', label: 'Vehicle' },
        { key: 'driver_name', label: 'Driver Name' },
        { key: 'location', label: 'Location' },
        { key: 'loading_duration', label: 'Loading Duration' },
        { key: 'start_time', label: 'Start Time' },
        { key: 'end_time', label: 'End Time' },
      ],
    },
    {
      type: 'qpmc_engine_health_report',
      name: 'Engine Health',
      description: 'Engine breaches and thresholds',
      icon: 'EH',
      columns: [
        { key: 'vehicle_registration', label: 'Vehicle' },
        { key: 'breach_type', label: 'Breach Type' },
        { key: 'value', label: 'Value' },
        { key: 'threshold', label: 'Threshold' },
        { key: 'location', label: 'Location' },
      ],
    },
  ];
  protected readonly selectedType = signal<QpmcReportType>('qpmc_yard_utilization_report');
  protected readonly selectedReport = computed(() =>
    this.reports.find((report) => report.type === this.selectedType())!,
  );
  protected readonly rows = signal<TableRow[]>([]);
  protected readonly total = signal(0);
  protected readonly offset = signal(0);
  protected readonly limit = 10;
  protected readonly loading = signal(true);
  protected readonly exporting = signal<ReportExportFormat | null>(null);
  protected readonly error = signal('');
  protected readonly interval = signal('today');
  protected readonly startDate = signal('');
  protected readonly endDate = signal('');
  protected readonly monthOptions: MonthOption[] = this.createMonthOptions();
  protected readonly start = computed(() => (this.total() ? this.offset() + 1 : 0));
  protected readonly end = computed(() => Math.min(this.offset() + this.limit, this.total()));

  constructor(private readonly api: ReportsApiService) {
    this.setPreset('today', false);
  }
  ngOnInit(): void {
    this.load();
  }
  protected selectReport(type: QpmcReportType): void {
    if (type === this.selectedType()) return;
    this.selectedType.set(type);
    this.offset.set(0);
    this.load();
  }
  protected chooseInterval(value: string): void {
    if (value === 'monthSelect' || value === 'custom') {
      this.interval.set(value);
      return;
    }
    this.setPreset(value, true);
  }
  protected selectMonth(event: Event): void {
    const option = this.monthOptions.find(
      (month) => month.value === (event.target as HTMLSelectElement).value,
    );
    if (!option) return;
    this.interval.set('monthSelect');
    this.startDate.set(this.toInputDate(option.start));
    this.endDate.set(this.toInputDate(option.end));
    this.offset.set(0);
    this.load();
  }
  protected updateStart(value: string): void {
    this.interval.set('custom');
    this.startDate.set(value);
  }
  protected updateEnd(value: string): void {
    this.interval.set('custom');
    this.endDate.set(value);
  }
  protected applyInterval(): void {
    const start = new Date(this.startDate());
    const end = new Date(this.endDate());
    const days = (end.getTime() - start.getTime()) / 86400000;
    if (!this.startDate() || !this.endDate() || days < 0) {
      this.error.set('Select a valid start and end time.');
      return;
    }
    if (days > 31) {
      this.error.set('The selected period must be 31 days or less.');
      return;
    }
    this.offset.set(0);
    this.load();
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
    this.error.set('');
    this.api
      .exportReport(this.reportQuery(0), format)
      .pipe(finalize(() => this.exporting.set(null)))
      .subscribe({
        next: (blob) => void this.handleExportResponse(blob, format),
        error: (response: HttpErrorResponse) => void this.handleExportError(response),
      });
  }

  private setPreset(value: string, reload: boolean): void {
    this.interval.set(value);
    const now = new Date();
    let start = new Date(now);
    let end = new Date(now);
    if (value === 'today') start.setHours(0, 0, 0, 0);
    if (value === 'week') {
      const day = now.getDay() || 7;
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day);
      end.setHours(23, 59, 59, 999);
      start = new Date(end);
      start.setDate(end.getDate() - 6);
      start.setHours(0, 0, 0, 0);
    }
    if (value === 'month') {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    }
    if (value === 'threeMonths') {
      start = new Date(now.getFullYear(), now.getMonth() - 3, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    }
    this.startDate.set(this.toInputDate(start));
    this.endDate.set(this.toInputDate(end));
    this.offset.set(0);
    if (reload) this.load();
  }
  private createMonthOptions(): MonthOption[] {
    const now = new Date();
    return Array.from({ length: 6 }, (_, index) => {
      const start = new Date(now.getFullYear(), now.getMonth() - index - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - index, 0, 23, 59, 59, 999);
      return {
        label: new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(start),
        value: `${start.getFullYear()}-${start.getMonth()}`,
        start,
        end,
      };
    });
  }
  private load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api
      .getReport(this.reportQuery(this.offset()))
      .pipe(finalize(() => this.loading.set(false)))
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
          this.error.set(response.error?.message || 'The report could not be loaded.');
        },
      });
  }

  private reportQuery(offset: number): ReportQuery {
    return {
      limit: this.limit,
      offset,
      reportType: this.selectedType(),
      startDate: this.toApiDate(this.startDate()),
      endDate: this.toApiDate(this.endDate()),
    };
  }

  private async handleExportResponse(blob: Blob, format: ReportExportFormat): Promise<void> {
    if (blob.type.includes('json')) {
      this.error.set(await this.messageFromBlob(blob));
      return;
    }

    const extension = format === 'pdf' ? 'pdf' : 'xlsx';
    const fileName = `${this.fileName(this.selectedReport().name)}-report.${extension}`;
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
  }

  private async handleExportError(response: HttpErrorResponse): Promise<void> {
    this.error.set(
      response.error instanceof Blob
        ? await this.messageFromBlob(response.error)
        : response.error?.message || response.statusText || 'The report could not be exported.',
    );
  }

  private async messageFromBlob(blob: Blob): Promise<string> {
    try {
      const payload = JSON.parse(await blob.text()) as { message?: string };
      return payload.message || 'The report could not be exported.';
    } catch {
      return 'The report could not be exported.';
    }
  }

  private fileName(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-');
  }
  private toRow(record: ReportRecord): TableRow {
    return Object.fromEntries(
      this.selectedReport().columns.map((column) => {
        const value = record[column.key];
        const durationColumns = [
          'powered_on',
          'idle_time',
          'traveling_time',
          'productive_time',
          'loading_duration',
        ];
        return [
          column.key,
          durationColumns.includes(column.key) ? this.formatDuration(value) : (value ?? '—'),
        ];
      }),
    ) as TableRow;
  }
  private formatDuration(value: unknown): string {
    if (typeof value !== 'string') return String(value ?? '—');

    const match = value
      .trim()
      .match(
        /^(\d+)\s*(?:hr|hrs|hour|hours)\s+(\d+)\s*(?:min|mins|minute|minutes)\s+(\d+)\s*(?:sec|secs|second|seconds)$/i,
      );
    if (!match) return value;

    const units = [
      { value: Number(match[1]), label: 'hr' },
      { value: Number(match[2]), label: 'min' },
      { value: Number(match[3]), label: 'sec' },
    ];
    const visibleUnits = units.filter((unit) => unit.value > 0);
    return (visibleUnits.length ? visibleUnits : [units[2]])
      .map((unit) => `${unit.value} ${unit.label}`)
      .join(' ');
  }
  private toInputDate(date: Date): string {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  }
  private toApiDate(value: string): string {
    return value ? `${value.replace('T', ' ')}:00` : '';
  }
}
