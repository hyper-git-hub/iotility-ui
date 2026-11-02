import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from './fleet-dashboard-api.service';

const GEOZONE_API = `${environment.fleetBaseUrl}/api/geo-zone`;

export interface GeozonePoint {
  lat: number;
  lng: number;
}

/** A circle zone's territory; radius is in kilometres. */
export interface GeozoneCircleTerritory extends GeozonePoint {
  radius: number;
}

/** GET fms-fleet/api/geo-zone row (the fields hypernym-fms-fe's Manage Geo Zones page reads). */
export interface GeozoneApiRecord {
  id: number;
  name: string | null;
  description: string | null;
  /** "1" circle, "2" polygon. */
  zone_type: string | number | null;
  /** "1" allowed, "2" not allowed. */
  access_type: string | number | null;
  /** 1 active, 2 inactive. */
  status: number | null;
  is_poi: boolean | null;
  total_vehicles: number | null;
  assigned_vehicles: { id: number; name: string | null; fleet_name?: string | null }[] | null;
  /** Polygon points, or a circle as {lat, lng, radius}; sometimes sent as a JSON string. */
  territory: GeozonePoint[] | GeozoneCircleTerritory | string | null;
  created_at: string | null;
}

/** POST fms-fleet/api/geo-zone/ body (hypernym-fms-fe's postGeozone). */
export interface CreateGeozonePayload {
  name: string;
  description: string;
  access_type: 1 | 2;
  is_poi: boolean;
  status: 1;
  vehicle: number[];
  zone_type: 1 | 2;
  /** JSON: [{lat, lng}, ...] for a polygon, {lat, lng, radius (km)} for a circle. */
  territory: string;
}

/** fms-fleet geo-zone endpoints; zones are loaded once and shared by the header and every Geozones tab. */
@Injectable({ providedIn: 'root' })
export class GeozonesApiService {
  private readonly http = inject(HttpClient);

  readonly zones = signal<GeozoneApiRecord[]>([]);
  /** False until the first load finishes. */
  readonly loaded = signal(false);

  refresh(): void {
    this.http
      .get<ApiResponse<{ count: number; data: GeozoneApiRecord[] }>>(GEOZONE_API, {
        params: new HttpParams().set('limit', 1000).set('offset', 0),
      })
      .pipe(
        map((response) => response.data?.data ?? []),
        catchError(() => of([])),
      )
      .subscribe((zones) => {
        this.zones.set(zones);
        this.loaded.set(true);
      });
  }

  create(payload: CreateGeozonePayload): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${GEOZONE_API}/`, payload);
  }

  delete(id: number): Observable<ApiResponse<unknown>> {
    return this.http.delete<ApiResponse<unknown>>(GEOZONE_API, { params: new HttpParams().set('id', id) });
  }
}
