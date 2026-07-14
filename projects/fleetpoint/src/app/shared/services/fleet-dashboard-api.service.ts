import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

const FLEET_API = 'https://prodgateway.hypernymbiz.com/fms-fleet/api';

export interface ApiResponse<T> {
  status: number;
  message: string;
  data: T;
}

export interface DashboardCard {
  code: string;
  analytics_type: string;
  name: string;
  data: number | null;
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
  data: { categories?: string[]; values?: number[]; series?: GraphSeries[]; fleets?: DriverAllocationFleet[] } | Array<{ fleet_name: string; vehicle_count: number }>;
  chart_type: string | null;
}

export interface Vehicle {
  id: number;
  name: string;
  registration: string;
  make: string;
  model: string;
  online_status: boolean;
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
  constructor(private readonly http: HttpClient) {}

  getCards(): Observable<ApiResponse<DashboardCard[]>> {
    return this.http.get<ApiResponse<DashboardCard[]>>(`${FLEET_API}/dashboard/cards`, {
      params: new HttpParams().set('dashboard_id', 'MD').set('date', 'all'),
    });
  }

  getGraphs(): Observable<ApiResponse<DashboardGraph[]>> {
    return this.http.get<ApiResponse<DashboardGraph[]>>(`${FLEET_API}/dashboard/graphs`, {
      params: new HttpParams().set('dashboard_id', 'MD'),
    });
  }

  getFleets(): Observable<ApiResponse<{ count: number; data: Fleet[] }>> {
    return this.http.get<ApiResponse<{ count: number; data: Fleet[] }>>(`${FLEET_API}/fleet`, {
      params: new HttpParams().set('time_zone', 'Asia/Karachi'),
    });
  }

  getDashcams(): Observable<ApiResponse<{ count: number; data: DashcamDevice[] }>> {
    return this.http.get<ApiResponse<{ count: number; data: DashcamDevice[] }>>(
      `${FLEET_API}/fleet/available_dashcam_devices`,
      { params: new HttpParams().set('time_zone', 'Asia/Karachi') },
    );
  }
}
