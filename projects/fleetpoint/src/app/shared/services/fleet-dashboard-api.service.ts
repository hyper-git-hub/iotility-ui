import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

const FLEET_API = `${environment.fleetBaseUrl}/api`;
const DASHBOARD_ID = 'MD';

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
  filter_by?: string;
}

export interface DashboardAnalytics {
  graphs: DashboardGraph[];
  cards: DashboardCard<number | string | DashboardGraphData | null>[];
}

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

  getGraphs(): Observable<ApiResponse<DashboardAnalytics>> {
    return this.http.get<ApiResponse<DashboardAnalytics>>(`${FLEET_API}/dashboard/graphs-cards`, {
      params: new HttpParams().set('dashboard_id', DASHBOARD_ID),
    });
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
