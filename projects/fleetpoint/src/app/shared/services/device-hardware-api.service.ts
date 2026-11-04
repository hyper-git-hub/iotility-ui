import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { secureStorage } from '@iotility/shared-ui';
import { environment } from '../../../environments/environment';
import { ApiResponse } from './fleet-dashboard-api.service';

export interface CustomerHardwareRecord {
  id: number;
  device_type_name: string | null;
  device_id: string | null;
  status: string | null;
  sim_msisdn: string | null;
  customer_name: string | null;
  customer_id: number | null;
  inventory_id: number | null;
  frequency: string | number | null;
  device_type: number | null;
  customer_allocation: number | null;
  customer: number | null;
  inventory: number | null;
}

@Injectable({ providedIn: 'root' })
export class DeviceHardwareApiService {
  private readonly url = `${environment.apiBaseUrl}/cob-new-customer/customers/customer-hardware`;

  constructor(private readonly http: HttpClient) {}

  getHardware(limit: number, offset: number): Observable<ApiResponse<{ total: number; data: CustomerHardwareRecord[] }>> {
    let params = new HttpParams().set('limit', limit).set('offset', offset).set('usecase', '1');
    const customer = this.customerId();
    if (customer) params = params.set('customer', customer);
    return this.http.get<ApiResponse<{ total: number; data: CustomerHardwareRecord[] }>>(this.url, { params });
  }

  /** The signed-in user's customer. 'user' is encrypted, so it must be read through secureStorage. */
  private customerId(): string | null {
    try {
      const user = JSON.parse(secureStorage.get('user') ?? '{}') as {
        customer?: { customer_id?: number; id?: number };
      };
      const id = user.customer?.customer_id ?? user.customer?.id;
      return id == null ? null : String(id);
    } catch {
      return null;
    }
  }
}
