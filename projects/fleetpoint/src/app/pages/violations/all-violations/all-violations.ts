import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { finalize } from 'rxjs';
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

export const VIOLATION_ICON: Record<string, string> = {
  Speed: '<path d="m13 2-9 12h8l-1 8 9-12h-8l1-8Z"/>',
  HarshBraking: '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>',
  HarshAcceleration: '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>',
  SharpTurn: '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>',
  Idle: '<circle cx="12" cy="12" r="8"/><path d="M12 8v5h4"/>',
  TerritoryViolation: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1Z"/><path d="M4 22v-7"/>',
  Geozone: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1Z"/><path d="M4 22v-7"/>',
  InZone: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1Z"/><path d="M4 22v-7"/>',
  OutOfZone: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1Z"/><path d="M4 22v-7"/>',
  RoadDeparture: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/>',
  ForwardCollision: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/>',
  Default: '<path d="M12 3 4 6v6c0 4 3 7 8 9 5-2 8-5 8-9V6l-8-3Z"/><path d="M12 8v5m0 3h.01"/>',
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

const VIOLATION_TYPE_MAP: Record<string, { label: string; category: string; severity: string }> = {
  Speed: { label: 'Speed', category: 'Speeding', severity: 'Critical' },
  HarshBraking: { label: 'Harsh Braking', category: 'Behaviour', severity: 'Medium' },
  HarshAcceleration: { label: 'Harsh Acceleration', category: 'Behaviour', severity: 'Medium' },
  SharpTurn: { label: 'Sharp Turning', category: 'Behaviour', severity: 'Medium' },
  Idle: { label: 'Idle', category: 'Behaviour', severity: 'Low' },
  TerritoryViolation: { label: 'Territory Violation', category: 'Geozone', severity: 'High' },
  RoadDeparture: { label: 'Road Departure', category: 'Safety', severity: 'High' },
  ForwardCollision: { label: 'Forward Collision', category: 'Safety', severity: 'Critical' },
  Geozone: { label: 'Geozone', category: 'Geozone', severity: 'High' },
  InZone: { label: 'In Zone', category: 'Geozone', severity: 'High' },
  OutOfZone: { label: 'Out of Zone', category: 'Geozone', severity: 'High' },
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
  protected readonly loadingMore = signal(false);
  protected readonly selected = signal<ViolationDisplay | null>(null);
  protected readonly search = signal('');
  protected readonly dateRange = signal<'today' | 'week' | 'month'>('month');
  protected readonly filtersVisible = signal(false);
  protected readonly category = signal('all');
  protected readonly severity = signal('all');
  protected readonly source = signal('all');
  protected readonly categoryOptions = CATEGORY_OPTIONS;
  protected readonly severityOptions = SEVERITY_OPTIONS;
  protected readonly sourceOptions = SOURCE_OPTIONS;
  protected readonly columns: TableColumn[] = [
    { key: 'type', label: 'Violation' },
    { key: 'driver', label: 'Driver' },
    { key: 'source', label: 'Source' },
    { key: 'severity', label: 'Severity' },
    { key: 'speedDisplay', label: 'Speed' },
    { key: 'timestamp', label: 'Time' },
    { key: 'fineDisplay', label: 'Fine' },
    { key: 'review', label: 'Status' },
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
  protected readonly hasMore = computed(() => this.violations().length < this.totalCount());
  protected readonly rows = computed<TableRow[]>(() =>
    this.filtered().map((item) => ({ ...item })),
  );

  private readonly filters: ViolationFilters = {
    offset: 0,
    limit: 20,
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
  private searchTimer?: ReturnType<typeof setTimeout>;

  constructor(private readonly api: ViolationsApiService, private readonly sanitizer: DomSanitizer) {}

  ngOnInit(): void {
    this.selectDateRange('month');
  }

  ngOnDestroy(): void {
    clearTimeout(this.searchTimer);
  }

  protected selectFilter(control: 'category' | 'severity' | 'source', option: DropdownOption): void {
    ({ category: this.category, severity: this.severity, source: this.source })[control].set(
      option.id,
    );
    if (control === 'category') this.filters.violation_type = this.violationTypeFilter(option.id);
    this.reloadViolations();
  }

  protected label(options: DropdownOption[], value: string): string {
    return options.find((option) => option.id === value)?.label ?? 'All';
  }

  protected selectViolation(item: ViolationDisplay): void {
    this.selected.set(item);
  }

  protected toggleSelection(item: ViolationDisplay): void {
    this.selected.update((selected) => selected?.id === item.id ? null : item);
  }

  protected selectRow(row: TableRow): void {
    const item = this.violations().find((violation) => violation.id === String(row['id']));
    if (item) this.toggleSelection(item);
  }

  protected updateSearch(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.search.set(value);
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.filters.search_text = value.trim();
      this.reloadViolations();
    }, 350);
  }

  protected selectDateRange(range: 'today' | 'week' | 'month'): void {
    this.dateRange.set(range);
    const now = new Date();
    const start = new Date(now);
    if (range === 'today') start.setHours(0, 0, 0, 0);
    if (range === 'week') {
      const weekday = now.getDay();
      start.setDate(now.getDate() - (weekday === 0 ? 6 : weekday - 1));
      start.setHours(0, 0, 0, 0);
    }
    if (range === 'month') {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
    }
    this.filters.start_datetime = this.utcDateTime(start);
    this.filters.end_datetime = this.utcDateTime(now);
    this.reloadViolations();
  }

  protected toggleFilters(): void {
    this.filtersVisible.update((value) => !value);
  }

  protected clearFilters(): void {
    this.category.set('all');
    this.severity.set('all');
    this.source.set('all');
    this.search.set('');
    this.filters.search_text = '';
    this.filters.violation_type = '';
    this.reloadViolations();
  }

  protected initials(name: string): string {
    return name.split(/\s+/).filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || '–';
  }

  protected firstName(name: string): string {
    return name.trim().split(/\s+/)[0] || 'Unassigned';
  }

  protected timeOnly(value: string): string {
    const match = value.match(/(\d{2}:\d{2})$/);
    return match?.[1] ?? value;
  }

  protected onTableScroll(event: Event): void {
    const element = event.currentTarget as HTMLElement;
    if (element.scrollHeight - element.scrollTop - element.clientHeight <= 120) this.loadMore();
  }

  protected violationIcon(type: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(
      `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${VIOLATION_ICON[this.typeKey(type)] ?? VIOLATION_ICON['Default']}</svg>`,
    );
  }

  protected categoryIconColor(category: string): string {
    const colors: Record<string, string> = {
      Speeding: '#dc2626',
      Behaviour: '#e87500',
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

  protected loadMore(): void {
    if (!this.loadingMore() && this.hasMore()) this.loadViolations(true);
  }

  protected violationIconBackground(type: string): string {
    const key = this.typeKey(type);
    if (key === 'Speed' || key === 'ForwardCollision') return '#fff1f2';
    if (key === 'TerritoryViolation' || key === 'Geozone' || key === 'InZone' || key === 'OutOfZone') return '#eff6ff';
    return '#fff8e8';
  }

  protected violationIconColor(type: string): string {
    const key = this.typeKey(type);
    if (key === 'Speed' || key === 'ForwardCollision') return '#f43f5e';
    if (key === 'TerritoryViolation' || key === 'Geozone' || key === 'InZone' || key === 'OutOfZone') return '#3b82f6';
    return '#ea6f00';
  }

  private loadViolations(append = false): void {
    if (append) this.loadingMore.set(true);
    else this.loading.set(true);
    const filters = {
      ...this.filters,
      offset: append ? this.violations().length : 0,
    };
    this.api.getViolations(filters).pipe(
      finalize(() => {
        if (append) this.loadingMore.set(false);
        else this.loading.set(false);
      }),
    ).subscribe({
      next: (response: { data?: { count: number; data: ApiViolation[] } }) => {
        const data = response.data?.data ?? [];
        this.totalCount.set(response.data?.count ?? data.length);
        const mapped = data.map((record: ApiViolation, index: number) =>
          this.mapRecord(record, (append ? this.violations().length : 0) + index),
        );
        this.violations.update((current) => append ? [...current, ...mapped] : mapped);
      },
      error: () => undefined,
    });
  }

  private reloadViolations(): void {
    this.selected.set(null);
    this.loadViolations(false);
  }

  private violationTypeFilter(category: string): string {
    // IDs used by hypernym-fms-fe/development for /api/common/violation.
    return { Speeding: '1', Behaviour: '21,22,23', Geozone: '36' }[category] ?? '';
  }

  private utcDateTime(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  }

  private mapRecord(record: ApiViolation, index: number): ViolationDisplay {
    const typeKey = this.typeKey(record.violation_type);
    const mapping = VIOLATION_TYPE_MAP[typeKey] ?? {
      label: this.displayType(record.violation_type),
      category: 'Behaviour',
      severity: 'Medium',
    };
    const isSpeed = typeKey === 'Speed';
    const speedKph = Number(record.speed) || 0;
    const thresholdKph = Number(record.threshold ?? record.speed_threshold) || 0;
    const isCritical = isSpeed && thresholdKph > 0 && speedKph > thresholdKph * 1.25;
    const severity = isCritical ? 'Critical' : mapping.severity;
    const date = record.event_generation_time
      ? this.formatDate(record.event_generation_time)
      : '—';
    const speed = isSpeed ? `${speedKph} / ${thresholdKph} km/h` : `${speedKph} km/h`;
    const isExceeded = thresholdKph > 0 && speedKph > thresholdKph;
    const speedDisplay = isExceeded
      ? `${speedKph} km/h ⚠`
      : speed;
    return {
      id: record.id == null ? `VIO-${String(index + 1).padStart(4, '0')}` : String(record.id),
      type: mapping.label,
      category: mapping.category,
      severity,
      source: 'Telematics',
      driver: record.driver_name || record.name || 'Unassigned',
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
      description: record.description || `${mapping.label} violation detected.`,
      latitude: this.coordinate(record.latitude ?? record.lat),
      longitude: this.coordinate(record.longitude ?? record.long ?? record.lng),
    };
  }

  private typeKey(value: string): string {
    const compact = String(value ?? '').replace(/[\s_-]+/g, '').toLowerCase();
    const aliases: Record<string, string> = {
      speed: 'Speed', speeding: 'Speed', overspeed: 'Speed',
      harshbraking: 'HarshBraking', harshacceleration: 'HarshAcceleration',
      sharpturn: 'SharpTurn', sharpturning: 'SharpTurn',
      idle: 'Idle', idling: 'Idle', territoryviolation: 'TerritoryViolation',
      geozone: 'Geozone', geozoneviolation: 'Geozone', inzone: 'InZone', outofzone: 'OutOfZone',
      roaddeparture: 'RoadDeparture', roaddeparturewarning: 'RoadDeparture',
      forwardcollision: 'ForwardCollision', forwardcollisionwarning: 'ForwardCollision',
    };
    return aliases[compact] ?? String(value ?? '');
  }

  private displayType(value: string): string {
    return String(value || 'Violation')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replaceAll('_', ' ')
      .trim();
  }

  private coordinate(value: number | string | null | undefined): number {
    if (typeof value === 'string') value = value.trim();
    return value === '' || value == null ? Number.NaN : Number(value);
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
