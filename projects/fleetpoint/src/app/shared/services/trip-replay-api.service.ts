import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResponse } from './fleet-dashboard-api.service';
import { DetailReportRecord, RealtimeVehicleRecord } from './live-tracking-api.service';
import { ViolationRecord } from './violations-api.service';
import { environment } from '../../../environments/environment';

const FLEET_API = `${environment.fleetBaseUrl}/api`;
export type PlaybackRecord = Record<string, unknown>;
export interface PlaybackTrailRecord {
  lat: number | string;
  long: number | string;
  timestamp: string;
  speed?: number | string | null;
  location?: string | null;
  driver_name?: string | null;
  seat_belt_notf?: boolean;
}
export interface PlaybackRange {
  vehicleId: number;
  start: string;
  end: string;
}

@Injectable({ providedIn: 'root' })
export class TripReplayApiService {
  constructor(private readonly http: HttpClient) {}
  getVehicles(): Observable<ApiResponse<{ count: number; data: RealtimeVehicleRecord[] }>> {
    return this.http.get<ApiResponse<{ count: number; data: RealtimeVehicleRecord[] }>>(
      `${FLEET_API}/fleet/vehicle`,
      { params: { status: '1', page_category: 'vehicle_real_time_tracking' } },
    );
  }
  getVehicleDetail(): Observable<
    ApiResponse<{ count: number; data: DetailReportRecord[] }>
  > {
    return this.http.get<ApiResponse<{ count: number; data: DetailReportRecord[] }>>(
      `${FLEET_API}/playback/detail-report`,
      { params: new HttpParams() },
    );
  }
  getDetailReport(
    range: PlaybackRange,
  ): Observable<ApiResponse<{ count: number; data: PlaybackRecord[] }>> {
    return this.http.get<ApiResponse<{ count: number; data: PlaybackRecord[] }>>(
      `${FLEET_API}/playback/detail-report`,
      {
        params: this.params(range)
          .set('stop_time', '4')
          .set('time_zone', Intl.DateTimeFormat().resolvedOptions().timeZone),
      },
    );
  }
  getMapTrail(range: PlaybackRange): Observable<ApiResponse<{ map_trail: PlaybackTrailRecord[] }>> {
    return this.http.get<ApiResponse<{ map_trail: PlaybackTrailRecord[] }>>(
      `${FLEET_API}/playback/map-trail`,
      { params: this.params(range) },
    );
  }
  getStops(
    range: PlaybackRange,
  ): Observable<ApiResponse<{ count: number; data: PlaybackRecord[] }>> {
    return this.http.get<ApiResponse<{ count: number; data: PlaybackRecord[] }>>(
      `${FLEET_API}/playback/stops`,
      {
        params: this.params(range)
          .set('duration', '4')
          .set('order', '')
          .set('order_by', '')
          .set('limit', '10')
          .set('offset', '0')
          .set('time_zone', Intl.DateTimeFormat().resolvedOptions().timeZone),
      },
    );
  }
  getViolations(
    range: PlaybackRange,
    searchText: string,
  ): Observable<ApiResponse<{ count: number; data: ViolationRecord[] }>> {
    return this.http.get<ApiResponse<{ count: number; data: ViolationRecord[] }>>(
      `${FLEET_API}/common/violation`,
      {
        params: new HttpParams()
          .set('offset', '0')
          .set('limit', '20')
          .set('order_by', '')
          .set('order', '')
          .set('search_text', searchText)
          .set('violation_type', '')
          .set('driver_id', '')
          .set('start_datetime', range.start)
          .set('end_datetime', range.end)
          .set('time_zone', Intl.DateTimeFormat().resolvedOptions().timeZone)
          .set('group', '0'),
      },
    );
  }
  getStatistics(
    range: PlaybackRange,
  ): Observable<ApiResponse<{ count?: number; data?: PlaybackRecord[] } | PlaybackRecord[]>> {
    return this.http.get<
      ApiResponse<{ count?: number; data?: PlaybackRecord[] } | PlaybackRecord[]>
    >(`${FLEET_API}/playback/statistics`, {
      params: this.params(range)
        .set('limit', '10')
        .set('offset', '0')
        .set('order', '')
        .set('order_by', '')
        .set('time_zone', Intl.DateTimeFormat().resolvedOptions().timeZone),
    });
  }
  private params(range: PlaybackRange): HttpParams {
    return new HttpParams()
      .set('vehicle_id', range.vehicleId)
      .set('start_datetime', range.start)
      .set('end_datetime', range.end);
  }
}
