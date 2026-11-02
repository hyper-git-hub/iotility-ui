import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, forkJoin, map, of, shareReplay } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from './fleet-dashboard-api.service';

const ROUTE_API = `${environment.fleetBaseUrl}/api/route`;
const FLEET_API = `${environment.fleetBaseUrl}/api/fleet`;

type RouteListResponse<T> = ApiResponse<{ count: number; resp_data: T[] }>;

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

/** One leg between consecutive points; durations in minutes, distance in metres. */
export interface RouteSubroute {
  polyline?: string;
  distance: number | null;
  travel_duration: number | null;
  estimated_arrival: number | null;
  stay_time: number | null;
}

/** A vehicle's run of a route, as nested in a route and listed by /api/route/allocation. */
export interface RouteAllocationRecord {
  id: number;
  route?: number | null;
  route_name?: string | null;
  vehicle?: number | string | null;
  vehicle_name?: string | null;
  driver_name?: string | null;
  origin_name?: string | null;
  destination_name?: string | null;
  no_of_stops?: number | null;
  /** "Scheduled" | "En-route" | "Completed". */
  job_status_display?: string | null;
  start_date?: string | null;
  end_date?: string | null;
}

/** GET fms-fleet/api/route/ row. */
export interface RouteApiRecord {
  id: number;
  name: string | null;
  origin: GeoPoint | null;
  origin_name: string | null;
  destination: GeoPoint | null;
  destination_name: string | null;
  no_of_stops: number | null;
  stops: GeoPoint[] | null;
  stop_names: { stop_name: string | null }[] | null;
  subroutes: RouteSubroute[] | null;
  /** Metres. */
  distance: number | null;
  /** Minutes. */
  travel_duration: number | null;
  estimated_arrival: number | null;
  /** Encoded polyline (precision 5). */
  polyline: string | null;
  route_allocations: RouteAllocationRecord[] | null;
  created_at: string | null;
}

/** POST fms-fleet/api/route body (hypernym-fms-fe's postFleetRoute). */
export interface SaveRoutePayload {
  name: string;
  origin: GeoPoint;
  destination: GeoPoint;
  no_of_stops: number;
  stops: GeoPoint[];
  travel_mode: 'DRIVE';
  routing_preference: 'TRAFFIC_AWARE';
  distance: number;
  polyline: string;
  travel_duration: number;
  estimated_arrival: number;
  subroutes: (RouteSubroute & { origin: GeoPoint; destination: GeoPoint })[];
  origin_name: string;
  destination_name: string;
  stop_names: { stop_name: string }[];
}

/** POST fms-fleet/api/route/allocation body; start_dates in UTC "yyyy-MM-dd HH:mm:ss". */
export interface DispatchPayload {
  route_id: number;
  vehicle_id: number;
  description: string | null;
  start_dates: string[];
}

export interface FleetWithVehicles {
  id: number;
  name: string;
  vehicles: { id: number; name: string }[];
}

/**
 * fms-fleet route endpoints (hypernym-fms-fe's manage-routes, route-jobs and dispatch).
 * Routes and their runs are loaded once and shared by the header and every Routes tab.
 */
@Injectable({ providedIn: 'root' })
export class RoutesApiService {
  private readonly http = inject(HttpClient);
  private readonly timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  private fleets$?: Observable<FleetWithVehicles[]>;

  readonly routes = signal<RouteApiRecord[]>([]);
  readonly allocations = signal<RouteAllocationRecord[]>([]);
  /** False until the first load finishes. */
  readonly loaded = signal(false);

  /** Reloads routes and runs (after a route is created or dispatched). */
  refresh(): void {
    forkJoin({
      routes: this.http
        .get<RouteListResponse<RouteApiRecord>>(`${ROUTE_API}/`, { params: new HttpParams().set('limit', 1000).set('offset', 0) })
        .pipe(
          map((response) => response.data?.resp_data ?? []),
          catchError(() => of([])),
        ),
      // An empty list comes back as status 1001 "Record Not Found!".
      allocations: this.http
        .get<RouteListResponse<RouteAllocationRecord>>(`${ROUTE_API}/allocation`, {
          params: new HttpParams().set('limit', 1000).set('offset', 0).set('time_zone', this.timeZone),
        })
        .pipe(
          map((response) => response.data?.resp_data ?? []),
          catchError(() => of([])),
        ),
    }).subscribe(({ routes, allocations }) => {
      this.routes.set(routes);
      this.allocations.set(allocations);
      this.loaded.set(true);
    });
  }

  saveRoute(payload: SaveRoutePayload): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(ROUTE_API, payload);
  }

  dispatch(payload: DispatchPayload): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${ROUTE_API}/allocation`, payload);
  }

  /** Fleets with their assigned vehicles (dispatch vehicle list and the library's fleet filter). */
  fleets(): Observable<FleetWithVehicles[]> {
    return (this.fleets$ ??= this.http
      .get<ApiResponse<{ data: { id: number; name: string; assigned_vehicles?: { id: number; name: string }[] | null }[] }>>(FLEET_API)
      .pipe(
        map((response) =>
          (response.data?.data ?? []).map((fleet) => ({
            id: fleet.id,
            name: fleet.name,
            vehicles: (fleet.assigned_vehicles ?? []).map(({ id, name }) => ({ id, name })),
          })),
        ),
        catchError(() => of([])),
        shareReplay(1),
      ));
  }

  /** Short English place name for a point ("Metro Bus Terminal Faizabad, skyways"), or null. */
  placeName(point: GeoPoint): Observable<string | null> {
    return this.http
      .get<{ display_name?: string }>(`${environment.nominatimBaseUrl}/reverse`, {
        params: new HttpParams()
          .set('format', 'json')
          .set('lat', point.latitude)
          .set('lon', point.longitude)
          .set('accept-language', 'en'),
      })
      .pipe(
        map((response) => response.display_name?.split(',').slice(0, 2).map((part) => part.trim()).join(', ') || null),
        catchError(() => of(null)),
      );
  }
}
