import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, computed, signal } from '@angular/core';
import { Observable, OperatorFunction, map } from 'rxjs';
import { environment } from '../../../environments/environment';

const FLEET_API = `${environment.fleetBaseUrl}/api`;
const DASHBOARD_ID = 'MD';
/** The Safety tab widget that shows the AGDF graph (it keeps its ADF code for layout and settings). */
export const AGGRESSIVE_FLEETS_WIDGET = 'ADF';

export interface ApiResponse<T> {
  status: number;
  message: string;
  data: T;
}

export interface DashboardCard<TData = number | string | null> {
  code: string;
  analytics_type: string;
  name: string;
  data: TData;
  chart_type: string | null;
  filter_by?: string;
}

/**
 * `/dashboard/cards` returns a fixed list of slots with `null` for each card it has no value for.
 * Drops those, so pages can read `card.code` safely (a null there throws and stops the page rendering).
 */
export function withoutEmptyCards<T>(): OperatorFunction<ApiResponse<(T | null)[]>, ApiResponse<T[]>> {
  return map((response) => ({
    ...response,
    data: (Array.isArray(response?.data) ? response.data : []).filter((card): card is T => card != null),
  }));
}

/**
 * The LFS payload, whether `data` is the card itself or a list of cards holding it.
 * Null when there is nothing usable, so the card shows dashes.
 */
function liveFleetStatusFrom(data: unknown): LiveFleetStatus | null {
  const asStatus = (value: unknown): LiveFleetStatus | null => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const candidate = value as Partial<LiveFleetStatus> & { data?: unknown };
    if (Array.isArray(candidate.categories) && Array.isArray(candidate.values)) return candidate as LiveFleetStatus;
    return candidate.data !== undefined ? asStatus(candidate.data) : null;
  };
  if (Array.isArray(data)) {
    const card = data.find((item) => item?.code === 'LFS') ?? data[0];
    return asStatus(card);
  }
  return asStatus(data);
}

export interface GraphSeries { name: string; data: number[]; }
export interface DashboardGraphData {
  categories?: string[];
  values?: Array<number | string>;
  series?: GraphSeries[] | number[];
  fleets?: DriverAllocationFleet[];
  driver_name?: string;
  role?: string;
  location?: string | null;
  initials?: string;
  score?: number;
  score_delta?: number;
  trips?: number;
  distance_km?: number;
}
export interface DashboardGraphRow {
  [key: string]: string | number | null;
}
export interface DriverAllocationFleet {
  name: string;
  data: Array<{ vehicle: string; driver: string }>;
}

export interface DashboardGraph {
  code: string;
  analytics_type?: string;
  name: string;
  data: DashboardGraphData | DashboardGraphRow[] | null;
  chart_type: string | null;
  /** Value sent back as `filter_by` when this graph's filter changes. */
  filter_by?: string;
}

export interface DashboardAnalytics {
  graphs: DashboardGraph[];
  cards: DashboardCard<number | string | DashboardGraphData | null>[];
}

/**
 * Live Fleet Status (LFS). `categories` is ["Total Vehicles", "Moving", "Idling", "Stopped",
 * "Alert", "Offline"] with `values` in the same order. Moving + Idling + Stopped + Offline make
 * up `total`; Alert overlaps them (a moving vehicle with an unread violation is in both).
 */
export interface LiveFleetStatus {
  categories: string[];
  values: Array<number | string | null>;
  total?: number | null;
}

const timeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

export interface Vehicle {
  id: number;
  name: string;
  registration: string;
  make: string;
  model: string;
  online_status: boolean;
  ignition_status?: boolean;
  total_violations?: number;
  speed: number;
  location: string | null;
  vehicle_driver_name: string | null;
  vehicle_type_image: string | null;
  camera_device_id: string | null;
}

export interface Fleet {
  id: number;
  name: string;
  total_vehicles: number;
  assigned_vehicles: Vehicle[];
}

export interface DashcamDevice {
  vehicle_id: number;
  notifications: number;
  device_id: string;
  name: string;
  device_type: string;
}

@Injectable({ providedIn: 'root' })
export class FleetDashboardApiService {
  private readonly graphCache = signal<DashboardGraph[]>(this.readGraphCache());
  readonly cachedGraphs = this.graphCache.asReadonly();
  /**
   * Filtered results keyed by graph code. Held in memory only — a reload must
   * restore the unfiltered graphs rather than a stale scoped selection.
   */
  private readonly graphFilterOverrides = signal<Record<string, DashboardGraphData | DashboardGraphRow[]>>({});
  /** Graph codes with an in-flight filter request, so cards can show a loader. */
  private readonly graphFilterLoading = signal<Record<string, boolean>>({});
  readonly graphs = computed(() => this.withFilters(this.graphCache()));

  /** Puts each graph's filtered data in place (also used for placeholder graphs before a load). */
  withFilters(graphs: DashboardGraph[]): DashboardGraph[] {
    const overrides = this.graphFilterOverrides();
    return graphs.map((graph) => {
      if (overrides[graph.code] !== undefined) return { ...graph, data: overrides[graph.code] };
      // This widget only ever shows the AGDF data, never the older per-fleet totals.
      return graph.code === AGGRESSIVE_FLEETS_WIDGET ? { ...graph, data: null } : graph;
    });
  }
  readonly filteringGraphs = this.graphFilterLoading.asReadonly();

  constructor(private readonly http: HttpClient) {}

  cacheGraphs(graphs: DashboardGraph[]): void {
    this.graphCache.set(graphs);
    sessionStorage.setItem('fleetpointDashboardGraphs', JSON.stringify(graphs));
  }

  private readGraphCache(): DashboardGraph[] {
    try {
      const graphs = JSON.parse(sessionStorage.getItem('fleetpointDashboardGraphs') ?? '[]');
      return Array.isArray(graphs) ? graphs : [];
    } catch {
      return [];
    }
  }

  // getCards(): Observable<ApiResponse<DashboardCard[]>> {
  //   return this.http.get<ApiResponse<DashboardCard[]>>(`${FLEET_API}/dashboard/graph-cards`, {
  //     params: new HttpParams().set('dashboard_id', DASHBOARD_ID).set('date', 'all'),
  //   });
  // }

  getFilteredCards(date: string): Observable<ApiResponse<DashboardAnalytics>> {
    return this.http.get<ApiResponse<DashboardAnalytics>>(`${FLEET_API}/dashboard/graphs-cards`, {
      params: new HttpParams().set('dashboard_id', DASHBOARD_ID).set('date', date),
    });
  }

  /** Today's Live Fleet Status card, in the user's time zone. */
  getLiveFleetStatus(): Observable<LiveFleetStatus | null> {
    return this.http
      .get<ApiResponse<unknown>>(`${FLEET_API}/dashboard/cards`, {
        params: new HttpParams()
          .set('dashboard_id', DASHBOARD_ID)
          .set('analytics_id', 'LFS')
          .set('filter', 'today')
          .set('time_zone', timeZone()),
      })
      .pipe(map((response) => (response?.status === 1000 ? liveFleetStatusFrom(response.data) : null)));
  }

  getGraphs(): Observable<ApiResponse<DashboardAnalytics>> {
    return this.http.get<ApiResponse<DashboardAnalytics>>(`${FLEET_API}/dashboard/graphs-cards`, {
      params: new HttpParams().set('dashboard_id', DASHBOARD_ID),
    });
  }

  /**
   * Re-fetches a single graph through its filter, mirroring the reference
   * app's dashboard contract: `analytics_id` selects the graph and `filter_by`
   * carries the chosen filter value (e.g. DSS + `Week`).
   */
  getGraphByFilter(code: string, filterBy: string): Observable<ApiResponse<DashboardAnalytics>> {
    return this.http.get<ApiResponse<DashboardAnalytics>>(`${FLEET_API}/dashboard/graphs-cards`, {
      params: new HttpParams()
        .set('dashboard_id', DASHBOARD_ID)
        .set('analytics_id', code)
        .set('filter_by', filterBy),
    });
  }

  /**
   * Applies a filter value to a graph and keeps the scoped data as an in-memory
   * override. Passing `null` clears the override so the graph falls back to its
   * unfiltered data.
   */
  applyGraphFilter(code: string, filterBy: string | null): void {
    this.graphFilterLoading.update((state) => ({ ...state, [code]: true }));
    if (code === AGGRESSIVE_FLEETS_WIDGET) {
      this.loadAggressiveFleets(filterBy || 'today');
      return;
    }
    if (!filterBy) {
      this.patchFilter(code, null);
      return;
    }
    this.getGraphByFilter(code, filterBy).subscribe({
      next: (response) => {
        const graphs = response?.data?.graphs;
        const graph = Array.isArray(graphs) ? graphs.find((item) => item.code === code) : undefined;
        const data = graph?.data ?? graphs?.[0]?.data ?? null;
        this.patchFilter(code, data);
      },
      error: () => this.patchFilter(code, null),
    });
  }

  /**
   * The Aggressively Driven Fleets widget shows the AGDF graph: time points along the x-axis and
   * one line per fleet. Only this data is shown; when it is missing or fails the widget shows its
   * empty state instead of the older per-fleet ADF totals.
   */
  private loadAggressiveFleets(filterBy: string): void {
    const empty: DashboardGraphData = { categories: [], series: [] };
    this.http
      .get<ApiResponse<DashboardGraph[] | DashboardAnalytics>>(`${FLEET_API}/dashboard/graphs`, {
        params: new HttpParams()
          .set('dashboard_id', DASHBOARD_ID)
          .set('analytics_id', 'AGDF')
          .set('filter_by', filterBy)
          .set('time_zone', timeZone()),
      })
      .subscribe({
        next: (response) => {
          const payload = response?.data;
          const graphs = Array.isArray(payload) ? payload : (payload?.graphs ?? []);
          const graph = graphs.find((item) => item?.code === 'AGDF') ?? graphs[0];
          const data = graph?.data && !Array.isArray(graph.data) ? graph.data : empty;
          this.patchFilter(AGGRESSIVE_FLEETS_WIDGET, data);
        },
        error: () => this.patchFilter(AGGRESSIVE_FLEETS_WIDGET, empty),
      });
  }

  private patchFilter(code: string, data: DashboardGraphData | DashboardGraphRow[] | null): void {
    this.graphFilterOverrides.update((state) => {
      if (data === null) {
        const { [code]: _removed, ...rest } = state;
        return rest;
      }
      return { ...state, [code]: data };
    });
    this.graphFilterLoading.update((state) => ({ ...state, [code]: false }));
  }

  getFleets(): Observable<ApiResponse<{ count: number; data: Fleet[] }>> {
    return this.http.get<ApiResponse<{ count: number; data: Fleet[] }>>(`${FLEET_API}/fleet`, {
      params: new HttpParams().set('time_zone', Intl.DateTimeFormat().resolvedOptions().timeZone),
    });
  }

  getDashcams(): Observable<ApiResponse<{ count: number; data: DashcamDevice[] }>> {
    return this.http.get<ApiResponse<{ count: number; data: DashcamDevice[] }>>(
      `${FLEET_API}/fleet/available_dashcam_devices`,
      { params: new HttpParams().set('time_zone', Intl.DateTimeFormat().resolvedOptions().timeZone) },
    );
  }

  getTodayViolationCount(): Observable<ApiResponse<{ count: number }>> {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const pad = (n: number) => String(n).padStart(2, '0');
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    return this.http.get<ApiResponse<{ count: number }>>(
      `${FLEET_API}/common/violation`,
      {
        params: new HttpParams()
          .set('offset', '0')
          .set('limit', '0')
          .set('order_by', '')
          .set('order', '')
          .set('start_datetime', fmt(start))
          .set('end_datetime', fmt(now))
          .set('time_zone', Intl.DateTimeFormat().resolvedOptions().timeZone)
          .set('group', '0'),
      },
    );
  }
}
