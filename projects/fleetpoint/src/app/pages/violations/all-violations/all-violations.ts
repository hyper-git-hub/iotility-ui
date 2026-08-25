import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import {
  DataTable,
  DataTableBottomPanel,
  DataTableCellTemplate,
  Dropdown,
  DropdownOption,
  TableColumn,
  TableRow,
} from '@iotility/shared-ui';
import {
  ViolationsApiService,
  ViolationRecord as ApiViolation,
  ViolationFilters,
} from '../../../shared/services/violations-api.service';
import { ViolationMap } from './violation-map';

const CATEGORY_ICON: Record<string, string> = {
  Speeding: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
  Behaviour: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>',
  Safety: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
  Compliance: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>',
  Geozone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>',
};

const SOURCE_ICON: Record<string, string> = {
  Telematics: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M15 2v2"/><path d="M15 20v2"/><path d="M2 15h2"/><path d="M2 9h2"/><path d="M20 15h2"/><path d="M20 9h2"/><path d="M9 2v2"/><path d="M9 20v2"/></svg>',
  DashCam: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>',
  Manual: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
};

export interface ViolationDisplay {
  id: string;
  type: string;
  category: string;
  severity: string;
  source: string;
  driver: string;
  vehicle: string;
  fleet: string;
  location: string;
  timestamp: string;
  speed: string;
  speedKph: number;
  thresholdKph: number;
  speedDisplay: string;
  review: string;
  fine: number;
  fineDisplay: string;
  fineStatus: string;
  scoreImpact: number;
  description: string;
  latitude: number;
  longitude: number;
}

const VIOLATION_TYPE_MAP: Record<string, { category: string; severity: string }> = {
  Speed: { category: 'Speeding', severity: 'Critical' },
  'Harsh Braking': { category: 'Behaviour', severity: 'Medium' },
  'Harsh Acceleration': { category: 'Behaviour', severity: 'Medium' },
  'Sharp Turning': { category: 'Behaviour', severity: 'Medium' },
  Geozone: { category: 'Geozone', severity: 'High' },
  'In Zone': { category: 'Geozone', severity: 'High' },
  'Out of Zone': { category: 'Geozone', severity: 'High' },
};

const CATEGORY_OPTIONS: DropdownOption[] = [
  { id: 'all', label: 'All Categories' },
  ...['Speeding', 'Behaviour', 'Safety', 'Compliance', 'Geozone'].map((label) => ({
    id: label,
    label,
  })),
];
const SEVERITY_OPTIONS: DropdownOption[] = [
  { id: 'all', label: 'All Severity' },
  ...['Critical', 'High', 'Medium', 'Low'].map((label) => ({ id: label, label })),
];
const SOURCE_OPTIONS: DropdownOption[] = [
  { id: 'all', label: 'All Sources' },
  ...['Telematics', 'DashCam', 'Manual'].map((label) => ({ id: label, label })),
];

@Component({
  selector: 'app-all-violations',
  imports: [DataTable, DataTableBottomPanel, DataTableCellTemplate, Dropdown, ViolationMap],
  templateUrl: './all-violations.html',
  styleUrl: './all-violations.css',
})
export class AllViolations implements OnInit, OnDestroy {
  protected readonly violations = signal<ViolationDisplay[]>([]);
  protected readonly totalCount = signal(0);
  protected readonly loading = signal(true);
  protected readonly selected = signal<ViolationDisplay | null>(null);
  protected readonly search = signal('');
  protected readonly category = signal('all');
  protected readonly severity = signal('all');
  protected readonly source = signal('all');
  protected readonly categoryOptions = CATEGORY_OPTIONS;
  protected readonly severityOptions = SEVERITY_OPTIONS;
  protected readonly sourceOptions = SOURCE_OPTIONS;
  protected readonly columns: TableColumn[] = [
    { key: 'type', label: 'Violation', type: 'user', secondaryKey: 'id' },
    { key: 'driver', label: 'Driver' },
    { key: 'vehicle', label: 'Vehicle', clickable: true },
    { key: 'category', label: 'Category', type: 'status' },
    { key: 'severity', label: 'Severity', type: 'priority' },
    { key: 'source', label: 'Source', type: 'status' },
    { key: 'speedDisplay', label: 'Speed' },
    { key: 'location', label: 'Location' },
    { key: 'timestamp', label: 'Date & Time' },
    { key: 'fineDisplay', label: 'Fine', type: 'status' },
    { key: 'review', label: 'Review', type: 'status' },
  ];
  protected readonly filtered = computed(() => {
    const query = this.search().toLowerCase();
    return this.violations().filter(
      (item) =>
        (this.category() === 'all' || item.category === this.category()) &&
        (this.severity() === 'all' || item.severity === this.severity()) &&
        (this.source() === 'all' || item.source === this.source()) &&
        (!query ||
          `${item.type} ${item.driver} ${item.vehicle} ${item.location}`
            .toLowerCase()
            .includes(query)),
    );
  });
  protected readonly rows = computed<TableRow[]>(() =>
    this.filtered().map((item) => ({ ...item })),
  );

  private readonly filters: ViolationFilters = {
    offset: 0,
    limit: 200,
    order_by: '',
    order: '',
    search_text: '',
    violation_type: '',
    driver_id: '',
    start_datetime: '',
    end_datetime: '',
    time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    group: '0',
  };

  constructor(private readonly api: ViolationsApiService, private readonly sanitizer: DomSanitizer) {}

  ngOnInit(): void {
    this.loadViolations();
  }

  ngOnDestroy(): void {}

  protected selectFilter(control: 'category' | 'severity' | 'source', option: DropdownOption): void {
    ({ category: this.category, severity: this.severity, source: this.source })[control].set(
      option.id,
    );
  }

  protected label(options: DropdownOption[], value: string): string {
    return options.find((option) => option.id === value)?.label ?? 'All';
  }

  protected selectRow(row: TableRow): void {
    this.selected.set(
      this.violations().find((item) => item.id === String(row['id'])) ?? null,
    );
  }

  protected selectViolation(item: ViolationDisplay): void {
    this.selected.set(item);
  }

  protected categoryIcon(category: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(CATEGORY_ICON[category] ?? '');
  }

  protected categoryIconColor(category: string): string {
    const colors: Record<string, string> = {
      Speeding: '#dc2626',
      Behaviour: '#d97706',
      Safety: '#ea580c',
      Compliance: '#7c3aed',
      Geozone: '#2563eb',
    };
    return colors[category] ?? '#64748b';
  }

  protected sourceIcon(source: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(SOURCE_ICON[source] ?? '');
  }

  protected sourceIconColor(source: string): string {
    const colors: Record<string, string> = {
      Telematics: '#8b5cf6',
      DashCam: '#2563eb',
      Manual: '#6b7280',
    };
    return colors[source] ?? '#6b7280';
  }

  protected isSpeedExceeded(row: TableRow): boolean {
    const speed = Number(row['speedKph']);
    const threshold = Number(row['thresholdKph']);
    return threshold > 0 && speed > threshold;
  }

  private loadViolations(): void {
    this.loading.set(true);
    this.api.getViolations(this.filters).subscribe({
      next: (response: { data?: { count: number; data: ApiViolation[] } }) => {
        const data = response.data?.data ?? [];
        this.totalCount.set(response.data?.count ?? data.length);
        this.violations.set(data.map((record: ApiViolation, index: number) => this.mapRecord(record, index)));
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  private mapRecord(record: ApiViolation, index: number): ViolationDisplay {
    const mapping = VIOLATION_TYPE_MAP[record.violation_type] ?? {
      category: 'Behaviour',
      severity: 'Medium',
    };
    const isSpeed = record.violation_type === 'Speed';
    const isCritical = isSpeed && record.speed > record.speed_threshold * 1.25 && record.speed_threshold > 0;
    const severity = isCritical ? 'Critical' : mapping.severity;
    const date = record.event_generation_time
      ? this.formatDate(record.event_generation_time)
      : '—';
    const speedKph = record.speed ?? 0;
    const thresholdKph = record.speed_threshold ?? 0;
    const speed = isSpeed ? `${record.speed} / ${record.speed_threshold} km/h` : `${record.speed} km/h`;
    const isExceeded = thresholdKph > 0 && speedKph > thresholdKph;
    const speedDisplay = isExceeded
      ? `${speedKph} km/h ⚠`
      : speed;
    return {
      id: `VIO-${String(index + 1).padStart(4, '0')}`,
      type: record.violation_type,
      category: mapping.category,
      severity,
      source: 'Telematics',
      driver: record.name || 'Unassigned',
      vehicle: record.vehicle_name || String(record.vehicle),
      fleet: '',
      location: record.location || '—',
      timestamp: date,
      speed,
      speedKph,
      thresholdKph,
      speedDisplay,
      review: 'Pending',
      fine: 0,
      fineDisplay: '—',
      fineStatus: 'No Fine',
      scoreImpact: isCritical ? -12 : severity === 'High' ? -8 : severity === 'Medium' ? -4 : -2,
      description: record.description || `${record.violation_type} violation detected.`,
      latitude: record.latitude,
      longitude: record.longitude,
    };
  }

  private formatDate(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    const day = date.getDate();
    const month = date.toLocaleString('en', { month: 'short' });
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day} ${month} ${year} · ${hours}:${minutes}`;
  }
}
