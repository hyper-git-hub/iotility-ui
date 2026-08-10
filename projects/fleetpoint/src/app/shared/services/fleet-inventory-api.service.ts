import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResponse } from './fleet-dashboard-api.service';
import { InventoryOption } from './vehicle-inventory-api.service';
import { environment } from '../../../environments/environment';

const FLEET_API = `${environment.fleetBaseUrl}/api/fleet`;

export interface FleetInventoryRecord {
  id: number;
  name: string;
  total_vehicles: number;
  modified_by_user: string | null;
  updated_at: string | null;
  created_at: string | null;
  customer_name: string | null;
  status: number;
  assigned_vehicles?: Array<{ id?: number; name?: string; registration?: string }>;
}

export interface FleetVehicleOption {
  id: number;
  registration?: string;
  name?: string;
  status?: number | string;
}

@Injectable({ providedIn: 'root' })
export class FleetInventoryApiService {
  constructor(private readonly http: HttpClient) {}

  getFleets(filters: {
    limit: number;
    offset: number;
    id: string;
    search: string;
  }): Observable<ApiResponse<{ count: number; data: FleetInventoryRecord[] }>> {
    let params = new HttpParams()
      .set('limit', filters.limit)
      .set('offset', filters.offset)
      .set('order', '')
      .set('order_by', '')
      .set('id', filters.id)
      .set('search', filters.search)
      .set('time_zone', Intl.DateTimeFormat().resolvedOptions().timeZone);
    return this.http.get<ApiResponse<{ count: number; data: FleetInventoryRecord[] }>>(FLEET_API, {
      params,
    });
  }

  getFleetOptions(): Observable<ApiResponse<{ count: number; data: InventoryOption[] }>> {
    return this.http.get<ApiResponse<{ count: number; data: InventoryOption[] }>>(FLEET_API, {
      params: { assigned_vehicles: 'false' },
    });
  }

  getVehicleOptions(): Observable<ApiResponse<{ count: number; data: FleetVehicleOption[] }>> {
    return this.http.get<ApiResponse<{ count: number; data: FleetVehicleOption[] }>>(
      `${FLEET_API}/get_vehicles`,
    );
  }

  createFleet(payload: { name: string; vehicle: number[] }): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(FLEET_API, payload);
  }

  updateFleet(
    id: number,
    payload: { name: string; vehicle: number[] },
  ): Observable<ApiResponse<unknown>> {
    return this.http.patch<ApiResponse<unknown>>(FLEET_API, payload, { params: { id } });
  }
}
