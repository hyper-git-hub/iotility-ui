import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { Observable } from 'rxjs';

const FLEET_API = 'https://devgateway.hypernymbiz.com/fms-fleet/api';
const PROD_FLEET_API = 'https://devgateway.hypernymbiz.com/fms-fleet/api';
const DASHBOARD_ID = 'MD';

export interface ApiResponse<T> {
  status: number;
  message: string;
  data: T;
}

export interface DashboardCard {
  code: string;
  analytics_type: string;
  name: string;
  data: number | string | null;
  chart_type: string | null;
  filter_by?: string;
}

export interface GraphSeries { name: string; data: number[]; }
export interface DriverAllocationFleet {
  name: string;
  data: Array<{ vehicle: string; driver: string }>;
}
export interface DashboardGraph {
  code: string;
  name: string;
  data: { categories?: string[]; values?: number[]; series?: GraphSeries[] | number[]; fleets?: DriverAllocationFleet[] } | Array<{ fleet_name: string; vehicle_count: number }>;
  chart_type: string | null;
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

  getCards(): Observable<ApiResponse<DashboardCard[]>> {
    return this.http.get<ApiResponse<DashboardCard[]>>(`${FLEET_API}/dashboard/cards`, {
      params: new HttpParams().set('dashboard_id', DASHBOARD_ID).set('date', 'all'),
    });
  }

  getFilteredCards(date: string): Observable<ApiResponse<DashboardCard[]>> {
    return this.http.get<ApiResponse<DashboardCard[]>>(`${FLEET_API}/dashboard/cards`, {
      params: new HttpParams().set('dashboard_id', DASHBOARD_ID).set('date', date),
    });
  }

  getGraphs(): Observable<ApiResponse<DashboardGraph[]>> {
    return this.http.get<ApiResponse<DashboardGraph[]>>(`${FLEET_API}/dashboard/graphs`, {
      params: new HttpParams().set('dashboard_id', DASHBOARD_ID),
    });
  }

  getFleets(): Observable<ApiResponse<{ count: number; data: Fleet[] }>> {
    return this.http.get<ApiResponse<{ count: number; data: Fleet[] }>>(`${PROD_FLEET_API}/fleet`, {
      params: new HttpParams().set('time_zone', Intl.DateTimeFormat().resolvedOptions().timeZone),
    });
  }

  getDashcams(): Observable<ApiResponse<{ count: number; data: DashcamDevice[] }>> {
    return this.http.get<ApiResponse<{ count: number; data: DashcamDevice[] }>>(
      `${FLEET_API}/fleet/available_dashcam_devices`,
      { params: new HttpParams().set('time_zone', Intl.DateTimeFormat().resolvedOptions().timeZone) },
    );
  }
}
