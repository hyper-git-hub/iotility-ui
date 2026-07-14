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
export interface DeviceOption { id: number; device_id: string; }
export interface VehicleInventoryFilters {
  limit: number;
  offset: number;
  search: string;
  fleetId: string;
  categoryId: string;
  vehicleTypeId: string;
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
    if (filters.categoryId) params = params.set('category_id', filters.categoryId);
    if (filters.vehicleTypeId) params = params.set('vehicle_type_id', filters.vehicleTypeId);
    return this.http.get<ApiResponse<{ count: number; data: VehicleInventoryRecord[] }>>(`${FLEET_API}/vehicle`, { params });
  }

  getVehicleOptions(): Observable<ApiResponse<{ count: number; data: InventoryOption[] }>> {
    return this.http.get<ApiResponse<{ count: number; data: InventoryOption[] }>>(`${FLEET_API}/vehicle-listing`);
  }

  getFleetOptions(): Observable<ApiResponse<{ count: number; data: InventoryOption[] }>> {
    return this.http.get<ApiResponse<{ count: number; data: InventoryOption[] }>>(`${FLEET_API}/fleet-listing`);
  }

  getCategoryOptions(fleetId = ''): Observable<ApiResponse<{ count: number; data: InventoryOption[] }>> {
    const params = fleetId ? new HttpParams().set('fleet_id', fleetId) : undefined;
    return this.http.get<ApiResponse<{ count: number; data: InventoryOption[] }>>(`${FLEET_API}/category`, { params });
  }

  getVehicleTypeOptions(): Observable<ApiResponse<{ count: number; data: InventoryOption[] }>> {
    return this.http.get<ApiResponse<{ count: number; data: InventoryOption[] }>>(`${FLEET_API}/vehicle-type`);
  }

  getAvailableDevices(): Observable<ApiResponse<{ count: number; data: DeviceOption[] }>> {
    return this.http.get<ApiResponse<{ count: number; data: DeviceOption[] }>>(`${FLEET_API}/available-devices`);
  }

  createVehicle(payload: FormData): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${FLEET_API}/vehicle`, payload);
  }

  deleteVehicle(id: string | number): Observable<ApiResponse<unknown>> {
    return this.http.delete<ApiResponse<unknown>>(`${FLEET_API}/vehicle`, { params: { id: String(id) } });
  }
}
