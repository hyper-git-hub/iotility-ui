import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from './fleet-dashboard-api.service';

const DOCUMENT_API = `${environment.fleetBaseUrl}/api/document`;
const FLEET_API = `${environment.fleetBaseUrl}/api/fleet`;
const DRIVER_API = `${environment.driverBaseUrl}/driver`;

type ListResponse<T> = ApiResponse<{ count: number; data: T[] }>;

/** `type` on a document record: D = driver, F = fleet (vehicle). */
export type DocumentEntityType = 'D' | 'F';

/** GET fms-fleet/api/document row (fields used by hypernym-fms-fe's audit-document page). */
export interface DocumentRecord {
  id: number;
  type: DocumentEntityType | string | null;
  entity_name: string | null;
  entity_group_id: number | string | null;
  driver: number | null;
  vehicle: number | null;
  document_type: number | string | null;
  document_type_name: string | null;
  uploaded_documents_count: number | null;
  /** Full URLs of the uploaded files. */
  document_files: string[] | null;
  updated_at: string | null;
  uploaded_by_user: string | null;
}

export interface NamedOption {
  id: number;
  name: string;
}

export interface FleetVehicle extends NamedOption {
  fleetId: number;
}

export interface DriverGroup extends NamedOption {
  drivers?: NamedOption[];
}

/** Document types per entity, as defined by hypernym-fms-fe (the API has no lookup for them). */
export const DOCUMENT_TYPES: Record<DocumentEntityType, NamedOption[]> = {
  D: [
    { id: 4, name: 'Passport' },
    { id: 5, name: 'Driving License' },
    { id: 6, name: 'National Identity' },
  ],
  F: [
    { id: 1, name: 'Ownership' },
    { id: 2, name: 'Insurance' },
    { id: 3, name: 'Miscellaneous' },
  ],
};

/** fms-fleet document endpoints plus the lookups the upload form needs (same flow as hypernym-fms-fe). */
@Injectable({ providedIn: 'root' })
export class DocumentsApiService {
  private readonly http = inject(HttpClient);

  /** Bumped after an upload/delete so the page reloads. */
  readonly version = signal(0);

  changed(): void {
    this.version.update((value) => value + 1);
  }

  /** The customer's documents in one call; the page filters, searches and counts them client-side. */
  list(limit = 1000): Observable<DocumentRecord[]> {
    return this.http
      .get<ListResponse<DocumentRecord>>(DOCUMENT_API, { params: new HttpParams().set('limit', limit).set('offset', 0) })
      .pipe(map((response) => response.data?.data ?? []));
  }

  /** Multipart body: files[], type, entity_group_id, driver|vehicle, entity_name, document_type. */
  create(body: FormData): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(DOCUMENT_API, body);
  }

  delete(id: number): Observable<ApiResponse<unknown>> {
    return this.http.delete<ApiResponse<unknown>>(DOCUMENT_API, { params: new HttpParams().set('id', id) });
  }

  /** Driver groups with their drivers; a driver document's entity_group_id is its group. */
  driverGroups(): Observable<DriverGroup[]> {
    return this.http
      .get<ListResponse<DriverGroup>>(`${DRIVER_API}/groups`)
      .pipe(map((response) => response.data?.data ?? []));
  }

  /** Active vehicles with their fleet; a vehicle document's entity_group_id is its fleet. */
  fleetVehicles(): Observable<FleetVehicle[]> {
    return this.http
      .get<ListResponse<NamedOption & { assigned_vehicles?: (NamedOption & { status?: number | string })[] | null }>>(FLEET_API)
      .pipe(
        map((response) =>
          (response.data?.data ?? []).flatMap((fleet) =>
            (fleet.assigned_vehicles ?? [])
              .filter((vehicle) => vehicle.status === undefined || Number(vehicle.status) === 1)
              .map(({ id, name }) => ({ id, name, fleetId: fleet.id })),
          ),
        ),
      );
  }
}
