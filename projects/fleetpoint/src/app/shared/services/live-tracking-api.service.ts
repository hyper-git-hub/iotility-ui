import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResponse } from './fleet-dashboard-api.service';

const FLEET_API = 'https://staging.gateway.iot.vodafone.com.qa/fmsfleet/api';

export interface RealtimeVehicleRecord {
  id: number;
  device_id?: string | number | null;
  poi: string | null;
  speed: number | string | null;
  latitude: string | null;
  location: string | null;
  poi_time: string | null;
  longitude: string | null;
  seat_belt: boolean;
  km_per_day: number;
  registration: string;
  updated_time: string | null;
  vehicle_type: string;
  online_status: boolean;
  ignition_status: boolean;
  vehicle_type_image: string | null;
  vehicle_driver_name: string | null;
}

export interface DetailReportRecord {
  vehicle: string;
  vehicle_id: number;
  vehicle_image: string | null;
  last_known_speed: number | null;
  last_updated_time: string | null;
  last_updated_location: string | null;
  last_swipe_driver_name: string | null;
}

@Injectable({ providedIn: 'root' })
export class LiveTrackingApiService {
  constructor(private readonly http: HttpClient) {}

  getVehicles(): Observable<ApiResponse<{ count: number; data: RealtimeVehicleRecord[] }>> {
    return this.http.get<ApiResponse<{ count: number; data: RealtimeVehicleRecord[] }>>(`${FLEET_API}/fleet/vehicle`, {
      params: new HttpParams().set('status', '1').set('page_category', 'vehicle_real_time_tracking'),
    });
  }

  getDetailReport(): Observable<ApiResponse<{ count: number; data: DetailReportRecord[] }>> {
    return this.http.get<ApiResponse<{ count: number; data: DetailReportRecord[] }>>(`${FLEET_API}/playback/detail-report`, {
      params: new HttpParams()
        .set('limit', '10').set('offset', '0').set('order_by', '').set('order', '')
        .set('search', '').set('start_datetime', '').set('end_datetime', '')
        .set('time_zone', 'Asia/Karachi'),
    });
  }
}
