import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
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
    const params = new HttpParams()
      .set('limit', limit)
      .set('offset', offset)
      .set('customer', this.customerId())
      .set('usecase', '1');
    return this.http.get<ApiResponse<{ total: number; data: CustomerHardwareRecord[] }>>(this.url, { params });
  }

  private customerId(): string {
    try {
      const user = JSON.parse(localStorage.getItem('user') ?? '{}') as {
        customer?: { customer_id?: number; id?: number };
      };
      return String(user.customer?.customer_id ?? user.customer?.id ?? 27);
    } catch {
      return '27';
    }
  }
}
