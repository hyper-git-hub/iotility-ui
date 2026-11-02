import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, map, shareReplay } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ExportFormat } from '@iotility/shared-ui';
import { ApiResponse } from './fleet-dashboard-api.service';

const JOBS_API = `${environment.driverBaseUrl}/jobs`;

type ListResponse<T> = ApiResponse<{ count: number; data: T[] }>;

/** job_status / task_status: 1 pending, 2 in progress, 3 completed, 4 aborted. */
export type JobStatusCode = '1' | '2' | '3' | '4';
/** job_type: 1 ad-hoc, 2 scheduled. */
export type JobTypeCode = '1' | '2';

export interface JobTaskRecord {
  id: number;
  priority: number | null;
  pick_up: number | null;
  drop_off: number | null;
  pick_up__address: string | null;
  drop_off__address: string | null;
  start_date: string | null;
  end_date: string | null;
  task_status: JobStatusCode | string | null;
  abort_reason: string | null;
  abort_reason_description: string | null;
}

/** GET fms-driver/jobs/ row (the fields hypernym-fms-fe's Manage Jobs page reads). */
export interface JobApiRecord {
  id: number;
  job_name: string | null;
  driver: string | number | null;
  driver_name: string | null;
  vehicle: string | number | null;
  job_type: JobTypeCode | string | null;
  job_status: JobStatusCode | string | null;
  start_date: string | null;
  end_date: string | null;
  start_time_by_driver: string | null;
  end_time_by_driver: string | null;
  /** Kilometres travelled on the job. */
  travelled_distance: number | null;
  reason: string | null;
  reason_description: string | null;
  modified_by: string | null;
  created_at: string | null;
  tasks: JobTaskRecord[] | null;
}

/** A saved pickup/dropoff point (GET fms-driver/jobs/location). */
export interface JobLocation {
  id: number;
  address: string;
  description?: string | null;
}

export interface CreateJobPayload {
  job_name: string;
  driver: number;
  /** UTC, "yyyy-MM-dd HH:mm:ss". */
  start_date: string;
  end_date: string;
  job_type: number;
  tasks: { priority: number; pick_up: number; drop_off: number }[];
}

/** fms-driver jobs endpoints, same flow as hypernym-fms-fe's Manage Jobs (templateform). */
@Injectable({ providedIn: 'root' })
export class JobsApiService {
  private readonly http = inject(HttpClient);
  private readonly timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  private locations$?: Observable<JobLocation[]>;

  /** Bumped after a create so the page reloads. */
  readonly version = signal(0);

  changed(): void {
    this.version.update((value) => value + 1);
  }

  /** Every job in one call; the page filters, searches, counts and pages them client-side. */
  list(limit = 1000): Observable<JobApiRecord[]> {
    return this.http
      .get<ListResponse<JobApiRecord>>(`${JOBS_API}/`, {
        params: new HttpParams().set('time_zone', this.timeZone).set('limit', limit).set('offset', 0),
      })
      .pipe(map((response) => response.data?.data ?? []));
  }

  /** The same job list as a file: `export=xls|pdf` on the list endpoint, as the FMS web app does. */
  export(format: ExportFormat, limit = 1000): Observable<Blob> {
    const params = new HttpParams().set('export', format).set('time_zone', this.timeZone).set('limit', limit).set('offset', 0);
    return this.http.get(`${JOBS_API}/`, { params, responseType: 'blob' });
  }

  create(payload: CreateJobPayload): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${JOBS_API}/`, payload);
  }

  locations(): Observable<JobLocation[]> {
    return (this.locations$ ??= this.http
      .get<ListResponse<JobLocation>>(`${JOBS_API}/location`)
      .pipe(
        map((response) => response.data?.data ?? []),
        shareReplay(1),
      ));
  }
}
