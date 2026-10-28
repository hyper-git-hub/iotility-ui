import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { Observable, finalize, shareReplay } from 'rxjs';
import { ApiResponse } from './fleet-dashboard-api.service';
import { environment } from '../../../environments/environment';

const FLEET_API = `${environment.fleetBaseUrl}/api`;
const DRIVER_API = `${environment.driverBaseUrl}/driver`;

/** GET /fms-fleet/api/common/violation row (shape verified against the dev gateway). */
export interface ViolationRecord {
  id?: string | number;
  vehicle_name: string;
  vehicle: string | number;
  vehicle_status: number;
  vehicle_allocation_status: boolean;
  violation_type: string;
  violation_name?: string | null;
  title?: string | null;
  speed: number | string | null;
  speed_threshold?: number | string;
  /** Speed limit; the API sends it for every type, but it only means something for Speed. */
  threshold?: number | string;
  event_generation_time: string;
  created_at?: string | null;
  latitude: number | string;
  longitude: number | string;
  lat?: number | string;
  long?: number | string;
  lng?: number | string;
  location: string;
  description: string;
  name?: string | null;
  driver?: number | null;
  driver_name?: string | null;
  device_id?: string | null;
  device_name?: string | null;
  geozone?: number | null;
  geozone_name?: string | null;
  in_zone?: boolean;
  out_zone?: boolean;
  /** DashCam evidence clip, when the event came with footage. */
  playback_url?: string | null;
  file_name?: string | null;
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

/** Header cards. Values the API doesn't provide for the whole filtered range are shown as '—'. */
export interface ViolationPageSummary {
  total: number | string;
  critical: number | string;
  pending: number | string;
  finesPending: number | string;
  totalFines: string;
  scoreImpact: number | string;
}

export type ViolationDateRange = 'today' | 'week' | 'month';

function formatViolationDateTime(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/**
 * Local-day window for the shared violation date-range control. Today starts at
 * midnight, week on Monday and month on the 1st; the API is called with the
 * resolved `time_zone` so these stay local wall-clock bounds.
 */
export function violationDateRange(range: ViolationDateRange): {
  start_datetime: string;
  end_datetime: string;
} {
  const now = new Date();
  const start = new Date(now);
  if (range === 'today') {
    start.setHours(0, 0, 0, 0);
  }
  if (range === 'week') {
    const weekday = now.getDay();
    start.setDate(now.getDate() - (weekday === 0 ? 6 : weekday - 1));
    start.setHours(0, 0, 0, 0);
  }
  if (range === 'month') {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  }
  return {
    start_datetime: formatViolationDateTime(start),
    end_datetime: formatViolationDateTime(now),
  };
}

@Injectable({ providedIn: 'root' })
export class ViolationsApiService {
  readonly pageSummary = signal<ViolationPageSummary>({
    total: 0,
    critical: 0,
    pending: 0,
    finesPending: 0,
    totalFines: '£0',
    scoreImpact: 0,
  });
  /** True while a filtered violations request is in flight, so cards can show skeletons. */
  readonly pageSummaryLoading = signal(false);
  private readonly violationRequests = new Map<
    string,
    Observable<ApiResponse<{ count: number; data: ViolationRecord[] }>>
  >();

  constructor(private readonly http: HttpClient) {}

  setPageSummary(summary: ViolationPageSummary): void {
    this.pageSummary.set(summary);
  }

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
    // Identical requests in flight at the same time (e.g. sidebar badge + violations page) share one
    // call. Entries are dropped when it settles: a permanent cache kept "today" and the badge stale.
    const key = params.toString();
    const inFlight = this.violationRequests.get(key);
    if (inFlight) return inFlight;
    const request = this.http.get<ApiResponse<{ count: number; data: ViolationRecord[] }>>(
      `${FLEET_API}/common/violation`,
      { params },
    ).pipe(
      finalize(() => this.violationRequests.delete(key)),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
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
