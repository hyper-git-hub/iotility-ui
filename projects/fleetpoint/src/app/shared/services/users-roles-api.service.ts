import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../../iotility/src/environments/environment';

export interface ManagementApiResponse<T = unknown> {
  status?: number;
  error?: boolean;
  message?: string;
  data?: T;
}

export interface PagedResult<T> {
  count: number;
  data: T[];
}

export interface ManagedUser {
  guid: string;
  email: string;
  first_name: string;
  last_name: string;
  username?: string | null;
  is_active?: boolean;
  phone?: string | null;
  department?: string | null;
  designation?: string | null;
  user_type?: number;
  status?: number;
  image?: string | null;
  user_image?: string | null;
  permissions?: { code: string }[];
  date_joined?: string;
  write?: boolean;
  work_location?: string | null;
  internal_role?: string | null;
  group?: string | null;
}

export interface RoleGroupUser {
  guid: string;
  email?: string;
  first_name?: string;
  last_name?: string;
}

export interface RoleGroup {
  id: number;
  name: string;
  description: string;
  status?: number;
  user_count?: number;
  group_features: number[];
  group_vehicles: number[];
  group_user: RoleGroupUser[];
  created_at?: string;
  updated_at?: string;
}

export interface VehicleOptionRecord {
  id: number;
  registration?: string;
  name?: string;
}

export interface PackageFeature {
  id: string;
  name: string;
  usecase_id: string;
  packages: {
    id: string;
    name: string;
    is_selected: boolean;
  }[];
}

export interface PackageFeaturesData {
  data: {
    features: PackageFeature[];
  };
}

export interface ListingQuery {
  limit: number;
  offset: number;
  search: string;
  status?: string;
  order?: string;
  orderBy?: string;
}

export interface UserPayload {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  department: string;
  designation: string;
  work_location: string;
  internal_role: string;
  write: boolean;
  status?: number;
  image?: File | null;
}

export interface RolePayload {
  name: string;
  description: string;
  features: number[];
  vehicles: number[];
  id?: number;
}

@Injectable({ providedIn: 'root' })
export class UsersRolesApiService {
  private readonly usersUrl = `${environment.userMsBaseUrl}/users`;
  private readonly roleUrl = `${environment.fleetBaseUrl}/api/role-access`;

  constructor(private readonly http: HttpClient) {}

  getUsers(query: ListingQuery): Observable<ManagementApiResponse<PagedResult<ManagedUser>>> {
    return this.http.get<ManagementApiResponse<PagedResult<ManagedUser>>>(
      `${this.usersUrl}/user-listing`,
      { params: this.listingParams(query).set('usecase_id', environment.useCaseId) },
    );
  }

  createUser(payload: UserPayload): Observable<ManagementApiResponse> {
    const formData = this.userFormData({ ...payload, status: undefined });
    formData.set('user_type', '2');
    formData.set('usecase_id', String(environment.useCaseId));
    return this.http.post<ManagementApiResponse>(`${this.usersUrl}/user-listing`, formData);
  }

  updateUser(payload: UserPayload): Observable<ManagementApiResponse> {
    const formData = this.userFormData(payload);
    formData.set('usecase_id', String(environment.useCaseId));
    return this.http.patch<ManagementApiResponse>(`${this.usersUrl}/user-profile/info`, formData);
  }

  deleteUser(email: string): Observable<ManagementApiResponse> {
    return this.http.delete<ManagementApiResponse>(`${this.usersUrl}/user-listing`, {
      params: { email, usecase: environment.useCaseId },
    });
  }

  getRoles(query: ListingQuery): Observable<ManagementApiResponse<PagedResult<RoleGroup>>> {
    return this.http.get<ManagementApiResponse<PagedResult<RoleGroup>>>(`${this.roleUrl}/`, {
      params: this.listingParams(query),
    });
  }

  createRole(payload: RolePayload): Observable<ManagementApiResponse<RoleGroup>> {
    return this.http.post<ManagementApiResponse<RoleGroup>>(`${this.roleUrl}/`, payload);
  }

  updateRole(payload: RolePayload): Observable<ManagementApiResponse<RoleGroup>> {
    return this.http.patch<ManagementApiResponse<RoleGroup>>(`${this.roleUrl}/`, payload, {
      params: { id: payload.id! },
    });
  }

  deleteRole(id: number): Observable<ManagementApiResponse> {
    return this.http.delete<ManagementApiResponse>(`${this.roleUrl}/`, { params: { id } });
  }

  getUnassignedUsers(): Observable<ManagementApiResponse<ManagedUser[]>> {
    return this.http.get<ManagementApiResponse<ManagedUser[]>>(
      `${this.roleUrl}/un-assigned-user`,
    );
  }

  assignUsers(groupId: number, users: string[]): Observable<ManagementApiResponse> {
    return this.http.post<ManagementApiResponse>(`${this.roleUrl}/assign`, {
      users,
      group_id: groupId,
    });
  }

  unassignUsers(groupId: number, users: string[]): Observable<ManagementApiResponse> {
    return this.http.patch<ManagementApiResponse>(`${this.roleUrl}/unassign`, {
      users,
      group_id: groupId,
    });
  }

  getVehicles(): Observable<ManagementApiResponse<PagedResult<VehicleOptionRecord>>> {
    return this.http.get<ManagementApiResponse<PagedResult<VehicleOptionRecord>>>(
      `${environment.fleetBaseUrl}/api/fleet/vehicle-listing`,
    );
  }

  getPackageFeatures(
    customerId: number,
  ): Observable<ManagementApiResponse<PackageFeaturesData>> {
    return this.http.get<ManagementApiResponse<PackageFeaturesData>>(
      `${environment.cobPackagesBaseUrl}/packages/get-usecase-modules-package-features`,
      {
        params: {
          usecase_id: environment.useCaseId,
          customer_id: customerId,
        },
      },
    );
  }

  private listingParams(query: ListingQuery): HttpParams {
    return new HttpParams()
      .set('limit', query.limit)
      .set('offset', query.offset)
      .set('order', query.order ?? '')
      .set('order_by', query.orderBy ?? '')
      .set('search', query.search)
      .set('status', query.status ?? '');
  }

  private userFormData(payload: UserPayload): FormData {
    const formData = new FormData();
    formData.set('first_name', payload.first_name.trim());
    formData.set('last_name', payload.last_name.trim());
    formData.set('email', payload.email.trim().toLowerCase());
    formData.set('phone', payload.phone.trim());
    formData.set('department', payload.department.trim());
    formData.set('designation', payload.designation.trim());
    formData.set('work_location', payload.work_location.trim());
    formData.set('internal_role', payload.internal_role.trim());
    formData.set('write', String(payload.write));
    if (payload.status) formData.set('status', String(payload.status));
    if (payload.image) formData.set('image', payload.image);
    return formData;
  }
}
