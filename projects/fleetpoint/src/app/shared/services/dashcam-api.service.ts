import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { catchError, forkJoin, map, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from './fleet-dashboard-api.service';

type ListResponse<T> = ApiResponse<{ count: number; data: T[] }>;

/** The AI camera violation types hypernym-fms-fe's DashCam playback and AI report list. */
export const DASHCAM_VIOLATION_TYPES = '70,71,72,73,74,75,76,77,79,80,81,82';

/** Where hypernym-fms-fe loads an event's evidence clip or snapshot from. */
export const DASHCAM_MEDIA_URL = 'https://sahnproduk.blob.core.windows.net/dashcam/tailgating/';

/** GET fms-fleet/api/fleet/available_dashcam_devices row. */
export interface DashcamDeviceRecord {
  vehicle_id: number;
  /** Vehicle registration. */
  name: string | null;
  device_id: string | null;
  device_type: string | null;
  notifications?: number | null;
}

/** GET fms-fleet/api/common/violation row (the fields the FMS DashCam pages read). */
export interface DashcamViolationRecord {
  id: number;
  vehicle: number | null;
  vehicle_name: string | null;
  driver_name: string | null;
  violation_type: string | null;
  violation_name: string | null;
  device_id: string | null;
  speed: string | number | null;
  location: string | null;
  description: string | null;
  /** UTC ISO time. */
  event_generation_time: string | null;
  file_name: string | null;
}

/**
 * fms-fleet DashCam endpoints, same flow as hypernym-fms-fe's dashcam livestream, playback and AI report.
 * Devices and events are loaded once and shared by the header and every DashCam tab.
 */
@Injectable({ providedIn: 'root' })
export class DashcamApiService {
  private readonly http = inject(HttpClient);
  private readonly timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  readonly devices = signal<DashcamDeviceRecord[]>([]);
  readonly events = signal<DashcamViolationRecord[]>([]);
  /** False until the first load finishes. */
  readonly loaded = signal(false);

  refresh(): void {
    forkJoin({
      devices: this.http
        .get<ListResponse<DashcamDeviceRecord>>(`${environment.fleetBaseUrl}/api/fleet/available_dashcam_devices`, {
          params: new HttpParams().set('time_zone', this.timeZone),
        })
        .pipe(
          map((response) => response.data?.data ?? []),
          catchError(() => of([])),
        ),
      events: this.http
        .get<ListResponse<DashcamViolationRecord>>(`${environment.fleetBaseUrl}/api/common/violation`, {
          params: new HttpParams()
            .set('time_zone', this.timeZone)
            .set('violation_type', DASHCAM_VIOLATION_TYPES)
            .set('limit', 1000)
            .set('offset', 0),
        })
        .pipe(
          map((response) => response.data?.data ?? []),
          catchError(() => of([])),
        ),
    }).subscribe(({ devices, events }) => {
      this.devices.set(devices);
      this.events.set(events);
      this.loaded.set(true);
    });
  }
}
