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
  /** 1 high, 2 normal, 3 low. */
  priority?: JobPriorityCode | number | null;
  notes?: string | null;
  vehicle_name?: string | null;
  /** Minutes between start_date and end_date. */
  estimated_duration?: number | null;
  /** Always null for now (no data source yet). */
  estimated_distance?: number | null;
  created_by_name?: string | null;
}

/** Job priority: 1 high, 2 normal, 3 low. */
export type JobPriorityCode = 1 | 2 | 3;

/** Server-side filters and paging for GET fms-driver/jobs/ (they all combine). */
export interface JobListQuery {
  limit: number;
  offset: number;
  /** Job name or driver name. */
  search?: string;
  status?: JobStatusCode[];
  type?: JobTypeCode[];
  priority?: JobPriorityCode[];
  driverId?: string;
  /** "YYYY-MM-DD": jobs whose window overlaps this range. */
  startDate?: string;
  endDate?: string;
}

/** GET fms-driver/jobs/summary: jobs whose window overlaps today (route jobs excluded). */
export interface JobsSummary {
  total: number;
  pending: number;
  in_progress: number;
  completed: number;
  aborted: number;
  delayed: number;
  high_priority: number;
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
  /** 1 high, 2 normal, 3 low. */
  priority: JobPriorityCode;
  notes?: string;
  /** Fleet vehicle id; without it the driver's allocated vehicle is saved on the job. */
  vehicle?: number;
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

  /**
   * One page of jobs, filtered and paged on the server. `count` is every matching job.
   * (fms-driver's envelope: status 2 is success.)
   */
  list(query: JobListQuery): Observable<{ count: number; records: JobApiRecord[] }> {
    return this.http
      .get<ListResponse<JobApiRecord>>(`${JOBS_API}/`, { params: this.listParams(query) })
      .pipe(map((response) => ({ count: response.data?.count ?? 0, records: response.data?.data ?? [] })));
  }

  /** Today's counts by status, plus delayed and high priority, in the viewer's time zone. */
  summary(): Observable<JobsSummary | null> {
    return this.http
      .get<ApiResponse<JobsSummary>>(`${JOBS_API}/summary`, { params: new HttpParams().set('time_zone', this.timeZone) })
      .pipe(map((response) => response.data ?? null));
  }

  /** The filtered job list as a file: `export=xls|pdf` on the list endpoint, as the FMS web app does. */
  export(format: ExportFormat, query: Omit<JobListQuery, 'limit' | 'offset'>, limit = 1000): Observable<Blob> {
    const params = this.listParams({ ...query, limit, offset: 0 }).set('export', format);
    return this.http.get(`${JOBS_API}/`, { params, responseType: 'blob' });
  }

  private listParams(query: JobListQuery): HttpParams {
    let params = new HttpParams()
      .set('time_zone', this.timeZone)
      .set('limit', query.limit)
      .set('offset', query.offset);
    const set = (key: string, value: string | undefined) => {
      if (value) params = params.set(key, value);
    };
    set('search_text', query.search?.trim());
    set('job_status', query.status?.join(','));
    set('job_type', query.type?.join(','));
    set('priority', query.priority?.join(','));
    set('driver_id', query.driverId);
    set('start_date', query.startDate);
    set('end_date', query.endDate);
    return params;
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
