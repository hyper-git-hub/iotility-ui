import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResponse } from './fleet-dashboard-api.service';

const FLEET_API = 'https://staging.gateway.iot.vodafone.com.qa/fmsfleet/api/fleet';

export interface VehicleInventoryRecord {
  id: number;
  device_id: string | null;
  odo_reading: string | number | null;
  fleet_name: string | null;
  name: string;
  registration: string;
  make: string;
  model: string;
  year: number | string;
  status: number;
  date_commissioned: string | null;
  expiry_date: string | null;
  owner: string | null;
  image: string | null;
}

export interface InventoryOption { id: number; name?: string; registration?: string; status?: number; }
export interface VehicleInventoryFilters {
  limit: number;
  offset: number;
  search: string;
  fleetId: string;
  vehicleId: string;
  status: string;
}

@Injectable({ providedIn: 'root' })
export class VehicleInventoryApiService {
  constructor(private readonly http: HttpClient) {}

  getVehicles(filters: VehicleInventoryFilters): Observable<ApiResponse<{ count: number; data: VehicleInventoryRecord[] }>> {
    let params = new HttpParams()
      .set('page_category', 'vehicle_inventory')
      .set('limit', filters.limit)
      .set('offset', filters.offset);
    if (filters.search) params = params.set('search', filters.search);
    if (filters.fleetId) params = params.set('fleet_id', filters.fleetId);
    if (filters.vehicleId) params = params.set('id', filters.vehicleId);
    if (filters.status) params = params.set('status', filters.status);
    return this.http.get<ApiResponse<{ count: number; data: VehicleInventoryRecord[] }>>(`${FLEET_API}/vehicle`, { params });
  }

  getVehicleOptions(): Observable<ApiResponse<{ count: number; data: InventoryOption[] }>> {
    return this.http.get<ApiResponse<{ count: number; data: InventoryOption[] }>>(`${FLEET_API}/vehicle-listing`);
  }

  getFleetOptions(): Observable<ApiResponse<{ count: number; data: InventoryOption[] }>> {
    return this.http.get<ApiResponse<{ count: number; data: InventoryOption[] }>>(`${FLEET_API}/fleet-listing`);
  }
}
