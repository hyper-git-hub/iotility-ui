import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../../iotility/src/environments/environment';
import { ApiResponse, DashboardCard } from './fleet-dashboard-api.service';
import { DriverRecord } from './driver-api.service';

export interface DriverViolationMetric { label: string; value: number; }
export interface DriverIdlePoint { date: string; value: number; }
export interface DriverDetailGraphs {
  violation_graph: DriverViolationMetric[];
  total_distance_travelled: number;
  idle_history: DriverIdlePoint[];
}
export interface DriverViolationRecord { [key: string]: unknown; id?: number; }

@Injectable({ providedIn: 'root' })
export class DriverDetailApiService {
  private readonly driverApi = `${environment.apiBaseUrl}/fmsdrivers/driver`;
  private readonly fleetApi = `${environment.fleetBaseUrl}/api`;

  constructor(private readonly http: HttpClient) {}

  getDriver(id: number): Observable<ApiResponse<{ count: number; data: DriverRecord[] }>> {
    return this.http.get<ApiResponse<{ count: number; data: DriverRecord[] }>>(`${this.driverApi}/`, {
      params: { id: String(id) },
    });
  }

  getCards(id: number, date = 'all'): Observable<ApiResponse<DashboardCard[]>> {
    const params = new HttpParams()
      .set('dashboard_id', 'DLD')
      .set('driver_id', id)
      .set('date', date);
    return this.http.get<ApiResponse<DashboardCard[]>>(`${this.fleetApi}/dashboard/cards`, {
      params,
    });
  }

  getGraphs(id: number, start: string, end: string): Observable<ApiResponse<DriverDetailGraphs>> {
    const params = new HttpParams().set('driver_id', id).set('start_datetime', start).set('end_datetime', end);
    return this.http.get<ApiResponse<DriverDetailGraphs>>(`${this.driverApi}/driver-details-graphs`, { params });
  }

  getViolations(id: number, start: string, end: string, limit: number, offset: number): Observable<ApiResponse<{ count: number; data: DriverViolationRecord[] }>> {
    const params = new HttpParams().set('limit', limit).set('offset', offset).set('start_datetime', start).set('end_datetime', end).set('driver_id', id);
    return this.http.get<ApiResponse<{ count: number; data: DriverViolationRecord[] }>>(`${this.fleetApi}/common/violation`, { params });
  }
}
