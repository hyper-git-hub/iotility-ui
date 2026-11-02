import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from './fleet-dashboard-api.service';

const POI_API = `${environment.fleetBaseUrl}/api/poi`;

/** fms-fleet's only POI type (hypernym-fms-fe offers "Marker" alone). */
export const POI_MARKER_TYPE = 1;

/** GET fms-fleet/api/poi row (the fields hypernym-fms-fe's Manage POI page reads). */
export interface PoiApiRecord {
  id: number;
  name: string | null;
  type: number | string | null;
  type_name?: string | null;
  poi_type_name?: string | null;
  radius: number | string | null;
  /** 1 active, 2 inactive. */
  status: number | string | null;
  /** The marker position: {"lat", "lng"}, sent and sometimes returned as a JSON string. */
  territory: string | { lat: number; lng: number } | null;
  assigned_trucks_count?: number | null;
  /** Linked geozone id, when the POI belongs to one. */
  geo_zone?: number | null;
  created_at?: string | null;
}

export interface CreatePoiPayload {
  name: string;
  type: number;
  radius: number;
  territory: string;
}

/** fms-fleet POI endpoints, same flow as hypernym-fms-fe's manage-poi page. */
@Injectable({ providedIn: 'root' })
export class PoisApiService {
  private readonly http = inject(HttpClient);

  /** Bumped after a create/delete so the page reloads. */
  readonly version = signal(0);

  changed(): void {
    this.version.update((value) => value + 1);
  }

  /** Every POI in one call; the page filters and counts them client-side. */
  list(limit = 1000): Observable<PoiApiRecord[]> {
    return this.http
      .get<ApiResponse<{ count: number; data: PoiApiRecord[] }>>(POI_API, {
        params: new HttpParams().set('limit', limit).set('offset', 0),
      })
      .pipe(map((response) => response.data?.data ?? []));
  }

  create(payload: CreatePoiPayload): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(POI_API, payload);
  }

  delete(id: number): Observable<ApiResponse<unknown>> {
    return this.http.delete<ApiResponse<unknown>>(POI_API, { params: new HttpParams().set('id', id) });
  }
}
