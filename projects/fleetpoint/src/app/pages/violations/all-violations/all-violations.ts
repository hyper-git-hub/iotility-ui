import { Component, OnDestroy, OnInit, computed, effect, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { finalize, Subscription } from 'rxjs';
import { ProgressBar } from '../../../shared/progress-bar/progress-bar';
import {
  DataTable,
  DataTableBottomPanel,
  DataTableCellTemplate,
  DropdownOption,
  FilterBar,
  FilterChangeEvent,
  FilterDropdown,
  Skeleton,
  Tooltip,
  TableColumn,
  TableRow,
} from '@iotility/shared-ui';
import {
  ViolationsApiService,
  ViolationDateRange,
  ViolationRecord as ApiViolation,
  ViolationFilters,
  violationDateRange,
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

/** Placeholder for values the violations API doesn't provide (the app-wide convention). */
export const NOT_AVAILABLE = '—';

export interface ViolationDisplay {
  id: string;
  type: string;
  /** Alert title from the API, e.g. "Speed Violation Alert". */
  title: string;
  category: string;
  /** Derived from type and speed (the API has no severity). */
  severity: string;
  /** DashCam when the event carries footage, otherwise Telematics (derived; no API field). */
  source: string;
  driver: string;
  vehicle: string;
  device: string;
  location: string;
  geozone: string;
  timestamp: string;
  /** 0 when the API sent no speed. */
  speedKph: number;
  /** Speed limit; only set for Speed violations (the API repeats it on every type). */
  thresholdKph: number;
  speedDisplay: string;
  /** Not in the API yet. */
  review: string;
  /** Not in the API yet: null renders as '—'. */
  fine: number | null;
  fineDisplay: string;
  playbackUrl: string | null;
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

/** One page of the list per request. */
const PAGE_SIZE = 25;
/** The map loads its own, larger set in the background: batches of 250, one request at a time. */
const MAP_BATCH_SIZE = 250;
/** The user picks how many the map holds (remembered per browser); more fills slower, never laggier. */
const MAP_LIMIT_OPTIONS = [2000, 5000];
const MAP_LIMIT_STORAGE_KEY = 'fleetpoint:violation-map-limit';
function storedMapLimit(): number {
  try {
    const stored = Number(localStorage.getItem(MAP_LIMIT_STORAGE_KEY));
    return MAP_LIMIT_OPTIONS.includes(stored) ? stored : MAP_LIMIT_OPTIONS[0];
  } catch {
    return MAP_LIMIT_OPTIONS[0];
  }
}
/** Recently visited pages are kept briefly so paging back is instant, without keeping stale data around. */
const PAGE_CACHE_SIZE = 8;
const PAGE_CACHE_TTL_MS = 60_000;
interface CachedPage {
  count: number;
  rows: ViolationDisplay[];
  at: number;
}

@Component({
  selector: 'app-all-violations',
  imports: [DataTable, DataTableBottomPanel, DataTableCellTemplate, FilterBar, ProgressBar, Skeleton, Tooltip, ViolationMap],
  templateUrl: './all-violations.html',
  styleUrl: './all-violations.css',
})
export class AllViolations implements OnInit, OnDestroy {
  protected readonly violations = signal<ViolationDisplay[]>([]);
  protected readonly totalCount = signal(0);
  protected readonly loading = signal(true);
  protected readonly page = signal(1);
  protected readonly pageSize = PAGE_SIZE;
  protected readonly selected = signal<ViolationDisplay | null>(null);
  protected readonly search = signal('');
  protected readonly dateRange = signal<ViolationDateRange>('today');
  protected readonly category = signal('all');
  protected readonly severity = signal('all');
  protected readonly source = signal('all');
  protected readonly categoryOptions = CATEGORY_OPTIONS;
  protected readonly severityOptions = SEVERITY_OPTIONS;
  protected readonly sourceOptions = SOURCE_OPTIONS;
  protected readonly filterDropdowns = computed<FilterDropdown[]>(() => [
    { id: 'category', ariaLabel: 'Filter by category', options: this.categoryOptions, selected: this.category(), placeholder: 'All Categories' },
    { id: 'severity', ariaLabel: 'Filter by severity', options: this.severityOptions, selected: this.severity(), placeholder: 'All Severity' },
    { id: 'source', ariaLabel: 'Filter by source', options: this.sourceOptions, selected: this.source(), placeholder: 'All Sources' },
  ]);
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
  /** The same filter for the list page and the map set. */
  private readonly matchesFilters = computed(() => {
    const query = this.search().toLowerCase();
    const category = this.category();
    const severity = this.severity();
    const source = this.source();
    return (item: ViolationDisplay) =>
      (category === 'all' || item.category === category) &&
      (severity === 'all' || item.severity === severity) &&
      (source === 'all' || item.source === source) &&
      (!query || `${item.type} ${item.driver} ${item.vehicle} ${item.location}`.toLowerCase().includes(query));
  });
  protected readonly filtered = computed(() => this.violations().filter(this.matchesFilters()));
  /** Background-loaded violations for the map (independent of the list page). */
  private readonly mapPoints = signal<ViolationDisplay[]>([]);
  protected readonly mapLoading = signal(false);
  protected readonly mapLimitOptions = MAP_LIMIT_OPTIONS;
  protected readonly mapLimit = signal(storedMapLimit());
  /** How many the map aims to show: everything matching, up to the chosen limit. */
  protected readonly mapTarget = computed(() => Math.min(this.totalCount(), this.mapLimit()));
  /** Map set + the current list page, so a selected row is always on the map. */
  protected readonly mapViolations = computed(() => {
    const matches = this.matchesFilters();
    const points = this.mapPoints();
    const ids = new Set(points.map((point) => point.id));
    const extra = this.violations().filter((row) => !ids.has(row.id));
    return (extra.length ? [...points, ...extra] : points).filter(matches);
  });
  protected readonly notAvailable = NOT_AVAILABLE;
  protected readonly paginationConfig = computed(() => ({
    totalItems: this.totalCount(),
    pageSize: PAGE_SIZE,
    page: this.page(),
    loading: this.loading(),
  }));
  // Same objects as filtered(): no per-update copies, so the table keeps unchanged rows in place.
  protected readonly rows = computed(() => this.filtered() as unknown as TableRow[]);

  private readonly filters: ViolationFilters = {
    offset: 0,
    limit: PAGE_SIZE,
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
  /** Trusted icon markup, built once per key: a fresh SafeHtml each check made Angular rewrite every row's innerHTML. */
  private readonly iconCache = new Map<string, SafeHtml>();
  private searchTimer?: ReturnType<typeof setTimeout>;
  private requestSequence = 0;
  private requestSubscription?: Subscription;
  private readonly pageCache = new Map<string, CachedPage>();
  private mapSubscription?: Subscription;
  private mapSequence = 0;

  constructor(
    private readonly api: ViolationsApiService,
    private readonly sanitizer: DomSanitizer,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
  ) {
    // Cards describe the whole filtered range. The API only returns the total for it; counting the
    // other figures from the 25 loaded rows would contradict that total, so they show '—' until the
    // backend provides range-wide numbers.
    effect(() => {
      this.api.setPageSummary({
        total: this.totalCount(),
        critical: NOT_AVAILABLE,
        pending: NOT_AVAILABLE,
        finesPending: NOT_AVAILABLE,
        totalFines: NOT_AVAILABLE,
        scoreImpact: NOT_AVAILABLE,
      });
    });
  }

  ngOnInit(): void {
    // Page and filters live in the URL, so refresh, back/forward and shared links land on the same view.
    const params = this.route.snapshot.queryParamMap;
    const requested = params.get('range');
    const range: ViolationDateRange =
      requested === 'week' || requested === 'month' ? requested : 'today';
    // Vehicle deep link (e.g. "View all alerts" from live tracking) is applied as the API search term.
    const search = (params.get('q') ?? params.get('vehicle') ?? '').trim();
    if (search) {
      this.search.set(search);
      this.filters.search_text = search;
    }
    const optionIds = (options: DropdownOption[]) => options.map((option) => option.id);
    const category = params.get('category') ?? 'all';
    if (optionIds(CATEGORY_OPTIONS).includes(category)) {
      this.category.set(category);
      this.filters.violation_type = this.violationTypeFilter(category);
    }
    const severity = params.get('severity') ?? 'all';
    if (optionIds(SEVERITY_OPTIONS).includes(severity)) this.severity.set(severity);
    const source = params.get('source') ?? 'all';
    if (optionIds(SOURCE_OPTIONS).includes(source)) this.source.set(source);
    this.selectDateRange(range, Math.max(1, Number(params.get('page')) || 1));
  }

  ngOnDestroy(): void {
    clearTimeout(this.searchTimer);
    this.requestSequence++;
    this.requestSubscription?.unsubscribe();
    this.mapSequence++;
    this.mapSubscription?.unsubscribe();
    this.api.pageSummaryLoading.set(false);
  }

  protected selectFilter(event: FilterChangeEvent): void {
    const control = event.id as 'category' | 'severity' | 'source';
    ({ category: this.category, severity: this.severity, source: this.source })[control].set(
      event.option.id,
    );
    // Only category is an API filter; severity/source narrow the loaded page, so no request needed.
    if (control === 'category') {
      this.filters.violation_type = this.violationTypeFilter(event.option.id);
      this.reloadViolations();
    } else {
      this.selected.set(null);
      this.syncUrl();
    }
  }

  protected changePage(page: number): void {
    if (page === this.page()) return;
    this.page.set(page);
    this.selected.set(null);
    this.loadViolations();
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

  protected updateSearch(value: string): void {
    this.search.set(value);
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.filters.search_text = value.trim();
      this.reloadViolations();
    }, 350);
  }

  protected selectDateRange(range: ViolationDateRange, page = 1): void {
    this.dateRange.set(range);
    const { start_datetime, end_datetime } = violationDateRange(range);
    this.filters.start_datetime = start_datetime;
    this.filters.end_datetime = end_datetime;
    this.reloadViolations(page);
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

  protected violationIcon(type: string): SafeHtml {
    const key = `type:${this.typeKey(type)}`;
    let icon = this.iconCache.get(key);
    if (!icon) {
      icon = this.sanitizer.bypassSecurityTrustHtml(
        `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${VIOLATION_ICON[this.typeKey(type)] ?? VIOLATION_ICON['Default']}</svg>`,
      );
      this.iconCache.set(key, icon);
    }
    return icon;
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
    const key = `source:${source}`;
    let icon = this.iconCache.get(key);
    if (!icon) {
      icon = this.sanitizer.bypassSecurityTrustHtml(SOURCE_ICON[source] ?? '');
      this.iconCache.set(key, icon);
    }
    return icon;
  }

  protected sourceIconColor(source: string): string {
    const colors: Record<string, string> = {
      Telematics: '#8b5cf6',
      DashCam: '#2563eb',
      Manual: '#6b7280',
    };
    return colors[source] ?? '#6b7280';
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

  /** Loads the current page (served from the short-lived page cache when it was just visited). */
  private loadViolations(): void {
    const requestSequence = ++this.requestSequence;
    this.requestSubscription?.unsubscribe();
    this.syncUrl();
    const filters: ViolationFilters = { ...this.filters, offset: (this.page() - 1) * PAGE_SIZE, limit: PAGE_SIZE };
    const key = JSON.stringify(filters);
    const cached = this.pageCache.get(key);
    if (cached && Date.now() - cached.at < PAGE_CACHE_TTL_MS) {
      this.applyPage(cached.count, cached.rows);
      this.loading.set(false);
      this.api.pageSummaryLoading.set(false);
      return;
    }
    this.loading.set(true);
    // Card values are filter-driven, so they show skeletons until the response lands.
    this.api.pageSummaryLoading.set(true);
    this.requestSubscription = this.api.getViolations(filters).pipe(
      finalize(() => {
        if (requestSequence !== this.requestSequence) return;
        this.loading.set(false);
        this.api.pageSummaryLoading.set(false);
      }),
    ).subscribe({
      next: (response: { data?: { count: number; data: ApiViolation[] } }) => {
        if (requestSequence !== this.requestSequence) return;
        const data = response.data?.data ?? [];
        const count = response.data?.count ?? data.length;
        const rows = data.map((record: ApiViolation, index: number) =>
          this.mapRecord(record, filters.offset + index),
        );
        this.pageCache.delete(key);
        this.pageCache.set(key, { count, rows, at: Date.now() });
        if (this.pageCache.size > PAGE_CACHE_SIZE) this.pageCache.delete(this.pageCache.keys().next().value!);
        this.applyPage(count, rows);
      },
      error: () => undefined,
    });
  }

  private applyPage(count: number, rows: ViolationDisplay[]): void {
    this.totalCount.set(count);
    this.violations.set(rows);
    // A page beyond the end (stale link, shrunken result set) falls back to the last real page.
    const lastPage = Math.max(1, Math.ceil(count / PAGE_SIZE));
    if (this.page() > lastPage) {
      this.page.set(lastPage);
      this.loadViolations();
    }
  }

  private reloadViolations(page = 1): void {
    this.selected.set(null);
    this.page.set(page);
    this.loadViolations();
    this.loadMapPoints();
  }

  /** User's choice of how many violations the map holds; raising it resumes, lowering it trims. */
  protected setMapLimit(limit: number): void {
    if (limit === this.mapLimit()) return;
    this.mapLimit.set(limit);
    try {
      localStorage.setItem(MAP_LIMIT_STORAGE_KEY, String(limit));
    } catch {
      /* storage unavailable: the choice just won't persist */
    }
    const loaded = this.mapPoints().length;
    if (loaded > limit) {
      this.mapSequence++;
      this.mapSubscription?.unsubscribe();
      this.mapLoading.set(false);
      this.mapPoints.update((points) => points.slice(0, limit));
    } else if (!this.mapLoading() && loaded < this.mapTarget()) {
      this.loadMapPoints(loaded);
    }
  }

  /**
   * Fills the map with the latest violations for the current API filters, independent of the list
   * page: batches of MAP_BATCH_SIZE, one request at a time, appended as they land, stopping at the
   * chosen map limit or the end of the data. A filter change (or leaving the page) cancels it.
   * `from` > 0 continues an existing set (the limit was raised) instead of starting over.
   */
  private loadMapPoints(from = 0): void {
    const sequence = ++this.mapSequence;
    this.mapSubscription?.unsubscribe();
    if (from === 0) this.mapPoints.set([]);
    this.mapLoading.set(true);
    const base: ViolationFilters = { ...this.filters, limit: MAP_BATCH_SIZE };
    const next = (offset: number) => {
      this.mapSubscription = this.api.getViolations({ ...base, offset }).subscribe({
        next: (response: { data?: { count: number; data: ApiViolation[] } }) => {
          if (sequence !== this.mapSequence) return;
          const data = response.data?.data ?? [];
          const total = Math.min(response.data?.count ?? 0, this.mapLimit());
          const batch = data.map((record, index) => this.mapRecord(record, offset + index));
          this.mapPoints.update((points) => [...points, ...batch]);
          const loaded = offset + data.length;
          if (data.length === MAP_BATCH_SIZE && loaded < total) next(loaded);
          else this.mapLoading.set(false);
        },
        error: () => {
          if (sequence === this.mapSequence) this.mapLoading.set(false);
        },
      });
    };
    next(from);
  }

  /** Mirrors page + filters into the URL (replaceUrl: no history entry per change). */
  private syncUrl(): void {
    const value = (current: string, fallback: string) => (current === fallback ? null : current);
    void this.router.navigate([], {
      relativeTo: this.route,
      replaceUrl: true,
      queryParams: {
        range: value(this.dateRange(), 'today'),
        q: this.filters.search_text || null,
        vehicle: null,
        category: value(this.category(), 'all'),
        severity: value(this.severity(), 'all'),
        source: value(this.source(), 'all'),
        page: this.page() > 1 ? this.page() : null,
      },
    });
  }

  private violationTypeFilter(category: string): string {
    // IDs used by hypernym-fms-fe/development for /api/common/violation.
    return { Speeding: '1', Behaviour: '21,22,23', Geozone: '36' }[category] ?? '';
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
    // The API sends threshold on every type, but it is a speed limit: only meaningful for Speed.
    const thresholdKph = isSpeed ? Number(record.threshold ?? record.speed_threshold) || 0 : 0;
    const isCritical = isSpeed && thresholdKph > 0 && speedKph > thresholdKph * 1.25;
    const severity = isCritical ? 'Critical' : mapping.severity;
    const isExceeded = thresholdKph > 0 && speedKph > thresholdKph;
    const speedDisplay = !speedKph
      ? NOT_AVAILABLE
      : isExceeded
        ? `${speedKph} km/h ⚠`
        : thresholdKph
          ? `${speedKph} / ${thresholdKph} km/h`
          : `${speedKph} km/h`;
    return {
      id: record.id == null ? `VIO-${String(index + 1).padStart(4, '0')}` : String(record.id),
      type: record.violation_name?.trim() || mapping.label,
      title: record.title?.trim() || `${mapping.label} Alert`,
      category: mapping.category,
      severity,
      source: record.playback_url ? 'DashCam' : 'Telematics',
      driver: record.driver_name || record.name || 'Unassigned',
      vehicle: record.vehicle_name || (record.vehicle != null ? String(record.vehicle) : NOT_AVAILABLE),
      device: record.device_name || record.device_id || NOT_AVAILABLE,
      location: record.location || NOT_AVAILABLE,
      geozone: record.geozone_name || NOT_AVAILABLE,
      timestamp: record.event_generation_time ? this.formatDate(record.event_generation_time) : NOT_AVAILABLE,
      speedKph,
      thresholdKph,
      speedDisplay,
      review: NOT_AVAILABLE,
      fine: null,
      fineDisplay: NOT_AVAILABLE,
      playbackUrl: record.playback_url || null,
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
