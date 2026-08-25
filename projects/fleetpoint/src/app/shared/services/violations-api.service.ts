import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, shareReplay } from 'rxjs';
import { ApiResponse } from './fleet-dashboard-api.service';
import { environment } from '../../../environments/environment';

const FLEET_API = `${environment.fleetBaseUrl}/api`;
const DRIVER_API = `${environment.driverBaseUrl}/driver`;

export interface ViolationRecord {
  id?: string | number;
  vehicle_name: string;
  vehicle: string | number;
  vehicle_status: number;
  vehicle_allocation_status: boolean;
  violation_type: string;
  speed: number | string;
  speed_threshold?: number | string;
  threshold?: number | string;
  event_generation_time: string;
  latitude: number | string;
  longitude: number | string;
  lat?: number | string;
  long?: number | string;
  lng?: number | string;
  location: string;
  description: string;
  name?: string | null;
  driver_name?: string | null;
}

export interface DriverOption {
  id: number;
  name: string;
  status: number;
}

export interface ViolationFilters {
  offset: number;
  limit: number;
  order_by: string;
  order: string;
  search_text: string;
  violation_type: string;
  driver_id: string;
  start_datetime: string;
  end_datetime: string;
  time_zone: string;
  group: string;
}

@Injectable({ providedIn: 'root' })
export class ViolationsApiService {
  private readonly violationRequests = new Map<
    string,
    Observable<ApiResponse<{ count: number; data: ViolationRecord[] }>>
  >();

  constructor(private readonly http: HttpClient) {}

  getViolations(filters: ViolationFilters): Observable<ApiResponse<{ count: number; data: ViolationRecord[] }>> {
    let params = new HttpParams()
      .set('offset', filters.offset)
      .set('limit', filters.limit)
      .set('order_by', filters.order_by)
      .set('order', filters.order)
      .set('search_text', filters.search_text)
      .set('violation_type', filters.violation_type)
      .set('driver_id', filters.driver_id)
      .set('start_datetime', filters.start_datetime)
      .set('end_datetime', filters.end_datetime)
      .set('time_zone', filters.time_zone)
      .set('group', filters.group);
    const key = params.toString();
    const cached = this.violationRequests.get(key);
    if (cached) return cached;
    const request = this.http.get<ApiResponse<{ count: number; data: ViolationRecord[] }>>(
      `${FLEET_API}/common/violation`,
      { params },
    ).pipe(shareReplay({ bufferSize: 1, refCount: false }));
    this.violationRequests.set(key, request);
    return request;
  }

  exportXls(filters: ViolationFilters): Observable<Blob> {
    const params = this.buildExportParams(filters, 'xls');
    return this.http.get(`${FLEET_API}/common/violation`, {
      params,
      responseType: 'blob',
    });
  }

  exportPdf(filters: ViolationFilters): Observable<Blob> {
    const params = this.buildExportParams(filters, 'pdf');
    return this.http.get(`${FLEET_API}/common/violation`, {
      params,
      responseType: 'blob',
    });
  }

  getDrivers(): Observable<ApiResponse<{ count: number; data: DriverOption[] }>> {
    return this.http.get<ApiResponse<{ count: number; data: DriverOption[] }>>(
      `${DRIVER_API}/`,
      {
        params: new HttpParams().set('time_zone', Intl.DateTimeFormat().resolvedOptions().timeZone),
      },
    );
  }

  private buildExportParams(filters: ViolationFilters, format: string): HttpParams {
    return new HttpParams()
      .set('offset', filters.offset)
      .set('limit', filters.limit)
      .set('order_by', filters.order_by)
      .set('order', filters.order)
      .set('search_text', filters.search_text)
      .set('violation_type', filters.violation_type)
      .set('driver_id', filters.driver_id)
      .set('start_datetime', filters.start_datetime)
      .set('end_datetime', filters.end_datetime)
      .set('time_zone', filters.time_zone)
      .set('group', filters.group)
      .set('export', format);
  }
}
