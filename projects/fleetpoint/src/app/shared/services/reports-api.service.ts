import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResponse } from './fleet-dashboard-api.service';

const REPORT_API = 'https://staging.gateway.iot.vodafone.com.qa/fmsfleet/api/report';

export type ReportType =
  | 'journey_report'
  | 'quick_overview_report'
  | 'geo_fence_report'
  | 'trip_report'
  | 'over_speeding_report'
  | 'vehicle_utilisation_extended_report'
  | 'events_report'
  | 'driver_score_card_report'
  | 'excessive_idling_report'
  | 'qpmc_yard_utilization_report'
  | 'qpmc_loading_activity_report'
  | 'qpmc_engine_health_report'
  | 'qpmc_device_health_report'
  | 'qpmc_network_coverage_report'
  | 'qpmc_eye_sensor_health_report'
  | 'qpmc_after_hours_usage_report'
  | 'qpmc_fleet_right_sizing_report';
export type ReportClass = 'fleet' | 'driver';

export type ReportRecord = Record<string, string | number | boolean | null>;

export interface ReportQuery {
  limit: number;
  offset: number;
  reportType: ReportType;
  reportClass: ReportClass;
  startDate: string;
  endDate: string;
}

export type ReportExportFormat = 'xls' | 'pdf';

@Injectable({ providedIn: 'root' })
export class ReportsApiService {
  constructor(private readonly http: HttpClient) {}

  getReport(
    query: ReportQuery,
  ): Observable<ApiResponse<{ count: number; data: ReportRecord[] } | ReportRecord[]>> {
    return this.http.get<ApiResponse<{ count: number; data: ReportRecord[] } | ReportRecord[]>>(
      REPORT_API,
      { params: this.reportParams(query) },
    );
  }

  exportReport(query: ReportQuery, format: ReportExportFormat): Observable<Blob> {
    return this.http.get(REPORT_API, {
      params: this.reportParams(query).set('export', format),
      responseType: 'blob',
    });
  }

  private reportParams(query: ReportQuery): HttpParams {
    return new HttpParams()
      .set('limit', query.limit)
      .set('offset', query.offset)
      .set('order_by', 'created_at')
      .set('order', 'desc')
      .set('report_class', query.reportClass)
      .set('report_type', query.reportType)
      .set('report_id', '')
      .set('start_date', query.startDate)
      .set('end_date', query.endDate)
      .set('device_id', '')
      .set('vehicle_id', '')
      .set('speed_threshold', '');
  }
}
