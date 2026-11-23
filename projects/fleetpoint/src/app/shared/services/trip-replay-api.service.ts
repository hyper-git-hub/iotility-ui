import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ExportFormat } from '@iotility/shared-ui';
import { ApiResponse } from './fleet-dashboard-api.service';
import { RealtimeVehicleRecord } from './live-tracking-api.service';
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
/** playback/trip-summary: distance in km, speeds in km/h, times in seconds; stops of 60 s or more. */
export interface TripSummary {
  vehicle_id: number;
  distance_km: number | null;
  duration_seconds: number | null;
  idle_seconds: number | null;
  stop_count: number | null;
  max_speed: number | null;
  avg_speed: number | null;
  fuel_consumed: number | null;
}
/** Backend error codes (HTTP 400 with one of these as `status`); the message text isn't reliable. */
export const PLAYBACK_ERROR = { vehicleNotYours: 954 } as const;
/** playback/map-trail: the GPS points, plus a few totals for the range. */
export interface PlaybackTrail {
  map_trail: PlaybackTrailRecord[];
  distance?: number | null;
  fuel_consumed?: number | null;
  fuel_filled?: number | null;
  jobs_completed?: number | null;
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
      // { params: { status: '1', page_category: 'vehicle_real_time_tracking' } },
    );
  }
  /** Distance, duration, idle time, stops, speeds and fuel for the range, worked out on the server. */
  getTripSummary(range: PlaybackRange): Observable<ApiResponse<TripSummary>> {
    return this.http.get<ApiResponse<TripSummary>>(`${FLEET_API}/playback/trip-summary`, {
      params: this.params(range),
    });
  }
  getMapTrail(range: PlaybackRange): Observable<ApiResponse<PlaybackTrail>> {
    return this.http.get<ApiResponse<PlaybackTrail>>(
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
        // Every stop in the range (all=1, capped at 5000 server side), oldest first.
        params: this.params(range)
          .set('duration', '4')
          .set('order', 'asc')
          .set('order_by', '')
          .set('all', '1')
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
        // Every violation in the range, not just the first 20 (all=1, capped at 5000).
        params: new HttpParams()
          .set('all', '1')
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
  /**
   * The trip's travel history as a file, as the FMS web app's playback export does: the reports service,
   * `export=excel|pdf`, and the time zone sent as `timezone`.
   */
  exportTravelHistory(range: PlaybackRange, format: ExportFormat): Observable<Blob> {
    const params = this.params(range)
      .set('order', '')
      .set('order_by', '')
      .set('search_key', '')
      .set('export', format === 'pdf' ? 'pdf' : 'excel')
      .set('timezone', Intl.DateTimeFormat().resolvedOptions().timeZone);
    return this.http.get(`${environment.reportsBaseUrl}/reports/travel-history`, { params, responseType: 'blob' });
  }

  private params(range: PlaybackRange): HttpParams {
    return new HttpParams()
      .set('vehicle_id', range.vehicleId)
      .set('start_datetime', range.start)
      .set('end_datetime', range.end);
  }
}
