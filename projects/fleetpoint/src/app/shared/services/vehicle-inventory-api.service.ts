import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResponse } from './fleet-dashboard-api.service';
import { environment } from '../../../environments/environment';

const FLEET_API = `${environment.fleetBaseUrl}/api/fleet`;

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
  owner?: string | null;
  expiry_date?: string | null;
  image: string | null;
  engine_number: string;
  chassis_number: string;
  color: string;
  engine_capacity: string | number;
  wheels: string | number;
  fuel_tank_capacity: string | number;
  purchase_type: string | number;
  engine_type?: string | number;
  type: string | number;
  device: string | number;
  camera_device?: string | number | null;
  camera_device_id?: string | number | null;
  camera_device_type?: string | null;
  fleet: string | number | null;
  fleet_category: string | number | null;
  speed_threshold: string | number;
  harsh_acceleration: boolean;
  harsh_braking: boolean;
  sharp_turning: boolean;
  geo_zone?: boolean;
  fuel_sensor?: boolean;
  speed?: number | null;
  latitude?: string | null;
  longitude?: string | null;
  online_status?: boolean;
  ignition_status?: boolean;
  location?: string | null;
  vehicle_driver_name?: string | null;
  total_violations?: number | null;
  last_volume?: number | string | null;
  mileage?: string | null;
  km_per_day?: number | null;
  updated_time?: string | null;
  next_maintenance?: string | null;
}

export interface InventoryOption {
  id: number;
  name?: string;
  registration?: string;
  status?: number;
}
export interface DeviceOption {
  id: number;
  device_id: string;
  type?: string;
}
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

  getVehicles(
    filters: VehicleInventoryFilters,
  ): Observable<ApiResponse<{ count: number; data: VehicleInventoryRecord[] }>> {
    const user = this.currentUser();
    const groupName = user?.customer?.groups?.[0]?.name;
    const customerType = user?.customer?.customer_type ?? user?.customer?.device_support ?? '';
    const params = new HttpParams()
      .set('limit', filters.limit)
      .set('offset', filters.offset)
      .set('order', '')
      .set('order_by', '')
      .set('search', filters.search)
      .set('export', '')
      .set('fleet_id', filters.fleetId)
      .set('vehicle_type_id', filters.vehicleTypeId)
      .set('category_id', filters.categoryId)
      .set('driver_id', '')
      .set('group', groupName === 'UK' ? '1' : '0')
      .set('dashcam_switch', '1')
      .set('customer_type', String(customerType))
      .set('time_zone', Intl.DateTimeFormat().resolvedOptions().timeZone);
    return this.http.get<ApiResponse<{ count: number; data: VehicleInventoryRecord[] }>>(
      `${FLEET_API}/vehicle`,
      { params },
    );
  }

  getVehicleOptions(): Observable<ApiResponse<{ count: number; data: InventoryOption[] }>> {
    return this.http.get<ApiResponse<{ count: number; data: InventoryOption[] }>>(
      `${FLEET_API}/vehicle-listing`,
    );
  }

  getFleetOptions(): Observable<ApiResponse<{ count: number; data: InventoryOption[] }>> {
    return this.http.get<ApiResponse<{ count: number; data: InventoryOption[] }>>(FLEET_API, {
      params: { assigned_vehicles: 'false' },
    });
  }

  getCategoryOptions(
    fleetId = '',
  ): Observable<ApiResponse<{ count: number; data: InventoryOption[] }>> {
    const params = fleetId ? new HttpParams().set('fleet_id', fleetId) : undefined;
    return this.http.get<ApiResponse<{ count: number; data: InventoryOption[] }>>(
      `${FLEET_API}/category`,
      { params },
    );
  }

  getVehicleTypeOptions(): Observable<ApiResponse<{ count: number; data: InventoryOption[] }>> {
    return this.http.get<ApiResponse<{ count: number; data: InventoryOption[] }>>(
      `${FLEET_API}/vehicle-type`,
    );
  }

  getAvailableDevices(): Observable<ApiResponse<{ count: number; data: DeviceOption[] }>> {
    return this.http.get<ApiResponse<{ count: number; data: DeviceOption[] }>>(
      `${FLEET_API}/available-devices`,
    );
  }

  createVehicle(payload: FormData): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${FLEET_API}/vehicle`, payload, {
      params: { time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone },
    });
  }

  updateVehicle(id: string | number, payload: FormData): Observable<ApiResponse<unknown>> {
    return this.http.patch<ApiResponse<unknown>>(`${FLEET_API}/vehicle`, payload, {
      params: {
        id: String(id),
        time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    });
  }

  deleteVehicle(id: string | number): Observable<ApiResponse<unknown>> {
    return this.http.delete<ApiResponse<unknown>>(`${FLEET_API}/vehicle`, {
      params: { id: String(id) },
    });
  }

  private currentUser(): {
    customer?: {
      groups?: Array<{ name?: string }>;
      customer_type?: string | number;
      device_support?: string | number;
    };
  } | null {
    try {
      return JSON.parse(localStorage.getItem('user') ?? 'null');
    } catch {
      return null;
    }
  }
}
