import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from './fleet-dashboard-api.service';

export type ReportType =
  | 'fuel'
  | 'immobilizer'
  | 'job_anomaly'
  | 'vehicle_usage'
  | 'job_report'
  | 'fleet_usage'
  | 'incident_report'
  | 'trip_report';
export type ReportDateFilter = 'week' | 'month' | 'year';
export type ReportExportFormat = 'xls' | 'pdf';
export type ReportRecord = Record<string, string | number | boolean | null>;

export interface ReportQuery {
  limit: number;
  offset: number;
  reportType: ReportType;
  dateFilter: ReportDateFilter;
  search?: string;
  order?: string;
  orderBy?: string;
}

interface ReportPayload {
  count?: number;
  data?: ReportRecord[];
  token?: string;
}

@Injectable({ providedIn: 'root' })
export class ReportsApiService {
  constructor(private readonly http: HttpClient) {}

  getReport(query: ReportQuery): Observable<ApiResponse<ReportPayload | ReportRecord[]>> {
    return this.http.get<ApiResponse<ReportPayload | ReportRecord[]>>(
      this.endpoint(query.reportType),
      {
        params: this.reportParams(query),
      },
    );
  }

  exportReport(query: ReportQuery, format: ReportExportFormat): Observable<Blob> {
    const params = this.reportParams(query).delete('limit').delete('offset').set('export', format);
    return this.http.get(this.endpoint(query.reportType), { params, responseType: 'blob' });
  }

  private endpoint(type: ReportType): string {
    return type === 'trip_report'
      ? `${environment.reportsBaseUrl}/reports/trip-history`
      : `${environment.fleetBaseUrl}/api/report`;
  }

  private reportParams(query: ReportQuery): HttpParams {
    const tripReport = query.reportType === 'trip_report';
    let params = new HttpParams()
      .set('limit', query.limit)
      .set('offset', query.offset)
      .set('report_type', query.reportType)
      .set('date_filter', query.dateFilter)
      .set('group', this.groupFlag())
      .set(tripReport ? 'timezone' : 'time_zone', Intl.DateTimeFormat().resolvedOptions().timeZone);
    if (query.order) params = params.set('order', query.order);
    if (query.orderBy) params = params.set('order_by', query.orderBy);
    if (tripReport && query.search?.trim()) params = params.set('s', query.search.trim());
    return params;
  }

  private groupFlag(): number {
    try {
      const user = JSON.parse(localStorage.getItem('user') ?? '{}');
      return user?.customer?.groups?.[0]?.name === 'UK' ? 1 : 0;
    } catch {
      return 0;
    }
  }
}
