import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, map, shareReplay } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from './fleet-dashboard-api.service';
import { ProfileApiService } from './profile-api.service';

const MAINTENANCE_API = `${environment.maintenanceBaseUrl}/api`;
const FLEET_API = `${environment.fleetBaseUrl}/api/fleet`;

type ListResponse<T> = ApiResponse<{ count: number; data: T[] }>;

/** GET fms-maintenance/api/maintenance row (shape verified against the dev gateway). */
export interface MaintenanceRecord {
  id: number;
  name: string | null;
  description: string | null;
  vehicle: number | null;
  vehicle_name: string | null;
  vehicle_type_name?: string | null;
  fleet: number | null;
  service_type: number | null;
  service_type_name: string | null;
  other_service_type?: string | null;
  workshop: number | null;
  workshop_name: string | null;
  workshop_owner?: string | null;
  /** Workshop workflow: 4 approved, 5 rejected, 6 pending, 7 completed, 8 in progress. */
  maintenance_status: number | null;
  maintenance_status_name: string | null;
  /** Admin approval: 1 approved, 2 rejected, 3 pending. */
  admin_status: number | null;
  estimated_cost: number | null;
  actual_cost: number | null;
  next_maintenance_date: string | null;
  maintenance_start_date: string | null;
  maintenance_end_date: string | null;
  created_at: string | null;
  updated_at: string | null;
  invoice_pdf: string | null;
  driver_name?: string | null;
  technician_name?: string | null;
}

export interface MaintenanceListFilters {
  offset: number;
  limit: number;
  search_text?: string;
  service_type_id?: string;
  maintenance_status?: string;
  date_filter?: string;
}

export interface ServiceType {
  id: number;
  name: string;
}

export interface WorkshopRecord {
  id: number;
  workshop_name: string;
  location: string | null;
  /** The API returns the owner's first name here (the request body sends their guid). */
  workshop_owner: string | null;
  created_at?: string;
}

export interface WorkshopOwner {
  guid: string;
  first_name: string;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
}

export interface MaintenanceCard {
  name: string;
  count: number;
}

export interface MaintenanceSummary {
  total: number;
  completed: number;
  inProgress: number;
  /** Not completed yet (total − completed). */
  active: number;
}

export interface PredictedMonth {
  month: string;
  predicted: number;
  previous: number;
}

export interface FleetVehicleOption {
  id: number;
  name: string;
  fleetId: number;
}

export interface CreateMaintenanceBody {
  service_type: number;
  name: string;
  fleet: number;
  vehicle: number;
  workshop?: number;
  description?: string;
  maintenance_status: number;
  estimated_cost?: number;
  next_maintenance_date?: string;
  created_by?: string;
}

export interface CreateWorkshopBody {
  workshop_name: string;
  location: string;
  workshop_owner: string;
}

/** fms-maintenance endpoints used by the Maintenance page (same gateway and flow as hypernym-fms-fe). */
@Injectable({ providedIn: 'root' })
export class MaintenanceApiService {
  private readonly http = inject(HttpClient);
  private readonly profileApi = inject(ProfileApiService);
  private readonly timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  /** Bumped after a create/delete so open tabs and the header cards reload. */
  readonly version = signal(0);
  /** Customer currency from the user profile (e.g. "PKR"); empty until it loads. */
  readonly currency = signal('');
  /** The signed-in user's guid, sent as created_by. */
  private userGuid = '';

  private serviceTypes$?: Observable<ServiceType[]>;
  private owners$?: Observable<WorkshopOwner[]>;
  private vehicles$?: Observable<FleetVehicleOption[]>;

  constructor() {
    this.profileApi.getUserProfile().subscribe({
      next: (response) => {
        const profile = response.data as (typeof response.data & { customer?: { currency?: string } }) | undefined;
        this.currency.set(profile?.customer?.currency ?? '');
        this.userGuid = profile?.guid ?? '';
      },
      error: () => undefined,
    });
  }

  changed(): void {
    this.version.update((value) => value + 1);
  }

  list(filters: MaintenanceListFilters): Observable<ListResponse<MaintenanceRecord>> {
    return this.http.get<ListResponse<MaintenanceRecord>>(`${MAINTENANCE_API}/maintenance`, {
      params: this.params({ ...filters, time_zone: this.timeZone }),
    });
  }

  log(filters: MaintenanceListFilters): Observable<ListResponse<MaintenanceRecord>> {
    return this.http.get<ListResponse<MaintenanceRecord>>(`${MAINTENANCE_API}/maintenance/maintenance-log`, {
      params: this.params({ ...filters, time_zone: this.timeZone }),
    });
  }

  cards(): Observable<MaintenanceCard[]> {
    return this.http
      .get<ApiResponse<MaintenanceCard[]>>(`${MAINTENANCE_API}/analytics/maintenance-cards`, {
        params: new HttpParams().set('date', 'all').set('user_type', 1),
      })
      .pipe(map((response) => (Array.isArray(response.data) ? response.data : [])));
  }

  /** Header counts from the analytics cards ("Total Maintenances", "Completed", "Work in progress"). */
  summary(): Observable<MaintenanceSummary> {
    return this.cards().pipe(
      map((cards) => {
        const count = (name: string) => Number(cards.find((card) => card.name.toLowerCase().startsWith(name))?.count) || 0;
        const total = count('total');
        const completed = count('completed');
        return { total, completed, inProgress: count('work in progress'), active: Math.max(0, total - completed) };
      }),
    );
  }

  predictedByMonth(): Observable<PredictedMonth[]> {
    return this.http
      .get<ApiResponse<PredictedMonth[]>>(`${MAINTENANCE_API}/analytics/predictive-maintenances-graph`)
      .pipe(map((response) => (Array.isArray(response.data) ? response.data : [])));
  }

  serviceTypes(): Observable<ServiceType[]> {
    return (this.serviceTypes$ ??= this.http
      .get<ListResponse<ServiceType>>(`${MAINTENANCE_API}/maintenance/service-types`)
      .pipe(map((response) => response.data?.data ?? []), shareReplay(1)));
  }

  workshops(offset = 0, limit = 100): Observable<ListResponse<WorkshopRecord>> {
    return this.http.get<ListResponse<WorkshopRecord>>(`${MAINTENANCE_API}/maintenance/workshop`, {
      params: this.params({ offset, limit }),
    });
  }

  workshopOwners(): Observable<WorkshopOwner[]> {
    return (this.owners$ ??= this.http
      .get<ListResponse<WorkshopOwner>>(`${FLEET_API}/user-maintenance/`)
      .pipe(map((response) => response.data?.data ?? []), shareReplay(1)));
  }

  /** Vehicles with their fleet (a work order needs both), from each fleet's assigned vehicles. */
  vehicles(): Observable<FleetVehicleOption[]> {
    return (this.vehicles$ ??= this.http
      .get<ListResponse<{ id: number; assigned_vehicles?: { id: number; name: string }[] }>>(FLEET_API)
      .pipe(
        map((response) =>
          (response.data?.data ?? []).flatMap((fleet) =>
            (fleet.assigned_vehicles ?? []).map((vehicle) => ({ id: vehicle.id, name: vehicle.name, fleetId: fleet.id })),
          ),
        ),
        shareReplay(1),
      ));
  }

  create(body: Omit<CreateMaintenanceBody, 'created_by'>): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(
      `${MAINTENANCE_API}/maintenance`,
      this.compact({ ...body, created_by: this.userGuid }),
      { params: new HttpParams().set('time_zone', this.timeZone) },
    );
  }

  delete(id: number): Observable<ApiResponse<unknown>> {
    return this.http.delete<ApiResponse<unknown>>(`${MAINTENANCE_API}/maintenance`, {
      params: new HttpParams().set('id', id),
    });
  }

  createWorkshop(body: CreateWorkshopBody): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${MAINTENANCE_API}/maintenance/workshop`, body);
  }

  deleteWorkshop(id: number): Observable<ApiResponse<unknown>> {
    return this.http.delete<ApiResponse<unknown>>(`${MAINTENANCE_API}/maintenance/workshop`, {
      params: new HttpParams().set('id', id),
    });
  }

  /** Only truthy values are sent, as in hypernym-fms-fe. */
  private params(values: Record<string, string | number | undefined>): HttpParams {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(values)) {
      if (value !== undefined && value !== '') params = params.set(key, value);
    }
    return params;
  }

  private compact<T extends object>(body: T): Partial<T> {
    return Object.fromEntries(
      Object.entries(body).filter(([, value]) => value !== undefined && value !== null && value !== ''),
    ) as Partial<T>;
  }
}
