import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from './fleet-dashboard-api.service';

export interface VehicleDetailRecord {
  [key: string]: unknown;
  id: number; name: string; registration: string; make: string; model: string; year: string;
  image: string | null; vehicle_type_image: string | null; status: number; online_status: boolean;
  speed: number | null; latitude: string | number | null; longitude: string | number | null;
  location: string | null; updated_time: string | null; updated_at: string | null;
  heavy_equipment: Record<string, unknown> | null;
  fleet_name: string | null; device_id: string | null; ignition_status: boolean; last_volume: unknown;
  km_per_day: number | null; vehicle_driver_name: string | null; total_distance_traveled: number | null;
  total_violations: number | null; next_maintenance: unknown;
}

export interface VehicleMetric { code: string; data: string | number | null; name: string; }

@Injectable({ providedIn: 'root' })
export class VehicleDetailApiService {
  private readonly fleetApi = `${environment.fleetBaseUrl}/api`;
  private readonly gateway = environment.apiBaseUrl;

  constructor(private readonly http: HttpClient) {}

  getVehicle(id: string): Observable<ApiResponse<{ count: number; data: VehicleDetailRecord[] }>> {
    const params = new HttpParams().set('limit', 10).set('offset', 0).set('id', id).set('page_category', 'vehicle_detail_page');
    return this.http.get<ApiResponse<{ count: number; data: VehicleDetailRecord[] }>>(`${this.fleetApi}/fleet/vehicle`, { params });
  }

  getMetrics(id: string): Observable<ApiResponse<VehicleMetric[]>> {
    const params = new HttpParams().set('dashboard_id', 'VD').set('date', 'all').set('vehicle_id', id);
    return this.http.get<ApiResponse<VehicleMetric[]>>(`${this.fleetApi}/dashboard/cards`, { params });
  }

  getViolations(id: string): Observable<ApiResponse<unknown>> {
    const params = new HttpParams().set('offset', 0).set('limit', 10).set('days', 1000).set('vehicle_id', id);
    return this.http.get<ApiResponse<unknown>>(`${this.fleetApi}/common/violation`, { params });
  }

  getMaintenance(id: string): Observable<ApiResponse<unknown>> {
    const end = new Date(); const start = new Date(end); start.setDate(start.getDate() - 14);
    const format = (date: Date) => date.toISOString().slice(0, 19).replace('T', ' ');
    const params = new HttpParams().set('limit', 10).set('offset', 0).set('vehicle_id', id).set('start_date', format(start)).set('end_date', format(end));
    return this.http.get<ApiResponse<unknown>>(`${this.gateway}/fmsmaintenance/api/maintenance`, { params });
  }

  getLastJob(id: string): Observable<ApiResponse<unknown>> {
    return this.http.get<ApiResponse<unknown>>(`${this.gateway}/fmsdrivers/jobs/last-job-summary`, { params: { vehicle_id: id } });
  }
}
