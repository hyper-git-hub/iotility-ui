import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResponse } from './fleet-dashboard-api.service';
import { environment } from '../../../../../iotility/src/environments/environment';

const DRIVER_API = 'https://staging.gateway.iot.vodafone.com.qa/fmsdrivers/driver';

export interface DriverRecord {
  id: number;
  name: string;
  employee_id: string;
  phone: string;
  email: string;
  salary: string;
  dob: string;
  marital_status: string;
  gender: string;
  poi: boolean;
  image: string | null;
  licence_number: string;
  licence_expiry_date: string;
  status: string;
  driver_shift_status: boolean;
  data_joined: string;
  shift_allocated: unknown | null;
  group: string;
}

export interface DriverGroup {
  id: number;
  name: string;
  status: string;
  drivers_list: number[];
  drivers: DriverRecord[];
  driver_count: number;
  created_at?: string;
  updated_at?: string;
}

export interface DriverManager {
  id: number;
  name: string;
  employee_id: string;
  rfid_tag: string | null;
  modified_by: string | null;
  updated_at: string;
  created_at: string;
  date_of_birth: string;
  date_joined: string;
  salary: string;
  marital_status: string;
  gender: string;
  phone: string;
  image: string | null;
  status: string;
}

export interface DriverFilters {
  limit: number;
  offset: number;
  searchText: string;
  cardType: string;
}

export interface DriverVehicleAllocation {
  id: number;
  vehicle_id: string | number;
  vehicle: string;
  vehicle_name: string;
  driver: number[];
  driver_name: string[] | string;
  start_date: string;
  end_date: string;
  status: string;
  current_driver_id?: string | number;
  created_at?: string;
  updated_at?: string;
  user?: string;
}

export interface UnallocatedVehicle {
  id?: number;
  registration: string;
  type: string;
  location: string;
}
export interface UnallocatedDriver {
  id?: number;
  name: string;
  rfid_tag: string | null;
  date_joined: string;
}
export interface AllocationVehicle {
  id: number;
  vehicle_id: string;
  registration: string;
}

@Injectable({ providedIn: 'root' })
export class DriverApiService {
  constructor(private readonly http: HttpClient) {}

  getDrivers(
    filters: DriverFilters,
  ): Observable<ApiResponse<{ count: number; data: DriverRecord[] }>> {
    let params = new HttpParams().set('limit', filters.limit).set('offset', filters.offset);
    if (filters.searchText) params = params.set('search_text', filters.searchText);
    if (filters.cardType) params = params.set('card_type', filters.cardType);
    return this.http.get<ApiResponse<{ count: number; data: DriverRecord[] }>>(`${DRIVER_API}/`, {
      params,
    });
  }

  getGroups(): Observable<ApiResponse<{ count: number; data: DriverGroup[] }>> {
    return this.http.get<ApiResponse<{ count: number; data: DriverGroup[] }>>(
      `${DRIVER_API}/groups`,
    );
  }

  getDriverGroups(
    limit: number,
    offset: number,
    searchText: string,
  ): Observable<ApiResponse<{ count: number; data: DriverGroup[] }>> {
    let params = new HttpParams().set('limit', limit).set('offset', offset);
    if (searchText) params = params.set('search_text', searchText);
    return this.http.get<ApiResponse<{ count: number; data: DriverGroup[] }>>(
      `${DRIVER_API}/groups`,
      { params },
    );
  }

  getManagers(
    limit: number,
    offset: number,
    searchText: string,
  ): Observable<ApiResponse<{ count: number; data: DriverManager[] }>> {
    let params = new HttpParams().set('limit', limit).set('offset', offset);
    if (searchText) params = params.set('search_text', searchText);
    return this.http.get<ApiResponse<{ count: number; data: DriverManager[] }>>(
      `${DRIVER_API}/manager`,
      { params },
    );
  }

  getActiveDrivers(): Observable<ApiResponse<{ count: number; data: DriverRecord[] }>> {
    return this.http.get<ApiResponse<{ count: number; data: DriverRecord[] }>>(`${DRIVER_API}/`);
  }

  createDriverGroup(payload: {
    name: string;
    drivers_list: number[];
  }): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${DRIVER_API}/groups`, payload);
  }

  updateDriverGroup(
    id: string | number,
    payload: { name: string; drivers_list: number[] },
  ): Observable<ApiResponse<unknown>> {
    return this.http.patch<ApiResponse<unknown>>(`${DRIVER_API}/groups`, payload, {
      params: { group_id: String(id) },
    });
  }

  deleteDriverGroup(id: string | number): Observable<ApiResponse<unknown>> {
    return this.http.delete<ApiResponse<unknown>>(`${DRIVER_API}/groups`, {
      params: { group_id: String(id) },
    });
  }

  createManager(payload: FormData): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${DRIVER_API}/manager`, payload);
  }
  updateManager(id: string | number, payload: FormData): Observable<ApiResponse<unknown>> {
    return this.http.patch<ApiResponse<unknown>>(`${DRIVER_API}/manager`, payload, {
      params: { id: String(id) },
    });
  }
  deleteManager(id: string | number): Observable<ApiResponse<unknown>> {
    return this.http.delete<ApiResponse<unknown>>(`${DRIVER_API}/manager`, {
      params: { id: String(id) },
    });
  }

  createDriver(payload: FormData): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${DRIVER_API}/`, payload);
  }

  updateDriver(id: string | number, payload: FormData): Observable<ApiResponse<unknown>> {
    return this.http.patch<ApiResponse<unknown>>(`${DRIVER_API}/`, payload, {
      params: { driver_id: String(id) },
    });
  }

  deleteDriver(id: string | number): Observable<ApiResponse<unknown>> {
    return this.http.delete<ApiResponse<unknown>>(`${DRIVER_API}/`, {
      params: { driver_id: String(id) },
    });
  }

  getDriverVehicleAllocations(
    limit: number,
    offset: number,
    searchText = '',
  ): Observable<ApiResponse<{ count: number; data: DriverVehicleAllocation[] }>> {
    let params = new HttpParams().set('limit', limit).set('offset', offset);
    if (searchText) params = params.set('search_text', searchText);
    return this.http.get<ApiResponse<{ count: number; data: DriverVehicleAllocation[] }>>(
      `${DRIVER_API}/driver-vehicle-allocation`,
      { params },
    );
  }

  getAllocationVehicles(): Observable<ApiResponse<AllocationVehicle[]>> {
    return this.http.get<ApiResponse<AllocationVehicle[]>>(`${DRIVER_API}/vehicles`);
  }

  createDriverVehicleAllocation(payload: {
    vehicle: number;
    driver: number[];
    start_date: string;
    end_date: string;
  }): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${DRIVER_API}/driver-vehicle-allocation`, payload);
  }

  updateDriverVehicleAllocation(
    id: number,
    previousVehicleId: string | number,
    vehicleChanged: boolean,
    payload: { vehicle: number; driver: number[]; start_date: string; end_date: string },
  ): Observable<ApiResponse<unknown>> {
    const params = vehicleChanged
      ? new HttpParams().set('removed_vehicle', previousVehicleId)
      : new HttpParams().set('allocation_id', id);
    return this.http.patch<ApiResponse<unknown>>(
      `${DRIVER_API}/driver-vehicle-allocation`,
      payload,
      { params },
    );
  }

  deleteDriverVehicleAllocation(vehicleId: string | number): Observable<ApiResponse<unknown>> {
    return this.http.delete<ApiResponse<unknown>>(`${DRIVER_API}/driver-vehicle-allocation`, {
      params: { allocation_id: String(vehicleId) },
    });
  }

  getUnallocatedVehicles(
    limit: number,
    offset: number,
    searchText = '',
  ): Observable<ApiResponse<{ count: number; data: UnallocatedVehicle[] }>> {
    let params = new HttpParams().set('limit', limit).set('offset', offset);
    if (searchText) params = params.set('search_text', searchText);
    return this.http.get<ApiResponse<{ count: number; data: UnallocatedVehicle[] }>>(
      `${environment.fleetBaseUrl}/api/common/unallocated-vehicle`,
      { params },
    );
  }

  getUnallocatedDrivers(
    limit: number,
    offset: number,
    searchText = '',
  ): Observable<ApiResponse<{ count: number; data: UnallocatedDriver[] }>> {
    let params = new HttpParams().set('limit', limit).set('offset', offset);
    if (searchText) params = params.set('search_text', searchText);
    return this.http.get<ApiResponse<{ count: number; data: UnallocatedDriver[] }>>(
      `${environment.fleetBaseUrl}/api/common/unallocated-driver`,
      { params },
    );
  }
}
