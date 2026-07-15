import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResponse } from './fleet-dashboard-api.service';

const REPORT_API = 'https://staging.gateway.iot.vodafone.com.qa/fmsfleet/api/report';

export type QpmcReportType =
  'qpmc_yard_utilization_report' | 'qpmc_loading_activity_report' | 'qpmc_engine_health_report';

export type ReportRecord = Record<string, string | number | boolean | null>;

export interface ReportQuery {
  limit: number;
  offset: number;
  reportType: QpmcReportType;
  startDate: string;
  endDate: string;
}

@Injectable({ providedIn: 'root' })
export class ReportsApiService {
  constructor(private readonly http: HttpClient) {}

  getReport(
    query: ReportQuery,
  ): Observable<ApiResponse<{ count: number; data: ReportRecord[] } | ReportRecord[]>> {
    const params = new HttpParams()
      .set('limit', query.limit)
      .set('offset', query.offset)
      .set('order_by', '')
      .set('order', '')
      .set('report_class', 'fleet')
      .set('report_type', query.reportType)
      .set('report_id', '')
      .set('start_date', query.startDate)
      .set('end_date', query.endDate)
      .set('device_id', '')
      .set('vehicle_id', '')
      .set('speed_threshold', '');
    return this.http.get<ApiResponse<{ count: number; data: ReportRecord[] } | ReportRecord[]>>(
      REPORT_API,
      { params },
    );
  }
}
