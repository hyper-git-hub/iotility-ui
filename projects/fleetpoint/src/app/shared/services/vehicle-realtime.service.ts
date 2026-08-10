import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
} from '@microsoft/signalr';
import { Subject, firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

interface SignalRConnectionDetails {
  url: string;
  accessToken: string;
}

export interface VehicleRealtimeUpdate {
  id?: string | number;
  vehicle_id?: string | number;
  device_id?: string | number;
  registration?: string;
  rtp?: string | number;
  lat?: string | number;
  latitude?: string | number;
  lon?: string | number;
  lng?: string | number;
  longitude?: string | number;
  spd?: string | number;
  speed?: string | number;
  ign?: string | number | boolean;
  ignition_status?: string | number | boolean;
  sbStatus?: string | number;
  t?: string | number;
  updated_time?: string | number;
  location?: string;
  vol?: string | number;
  [key: string]: unknown;
}

@Injectable({ providedIn: 'root' })
export class VehicleRealtimeService {
  private readonly updatesSubject = new Subject<VehicleRealtimeUpdate>();
  readonly updates$ = this.updatesSubject.asObservable();

  private connection?: HubConnection;
  private connectionKey = '';
  private connecting?: Promise<void>;

  constructor(private readonly http: HttpClient) {}

  connect(deviceId?: string | number | null): Promise<void> {
    const key = String(deviceId ?? '').trim();
    if (
      this.connectionKey === key &&
      (this.connection?.state === HubConnectionState.Connected ||
        this.connection?.state === HubConnectionState.Connecting)
    ) {
      return this.connecting ?? Promise.resolve();
    }
    if (this.connecting && this.connectionKey === key) return this.connecting;

    this.connecting = this.start(key).finally(() => {
      this.connecting = undefined;
    });
    return this.connecting;
  }

  async disconnect(): Promise<void> {
    const connection = this.connection;
    this.connection = undefined;
    this.connectionKey = '';
    if (connection && connection.state !== HubConnectionState.Disconnected) {
      await connection.stop();
    }
  }

  private async start(key: string): Promise<void> {
    await this.disconnect();
    const suffix = key ? `/${encodeURIComponent(key)}` : '';
    const details = await firstValueFrom(
      this.http.get<SignalRConnectionDetails>(`${environment.signalRUrl}/api/SignalR${suffix}`),
    );
    const connection = new HubConnectionBuilder()
      .withUrl(details.url, { accessTokenFactory: () => details.accessToken })
      .withAutomaticReconnect([0, 2_000, 5_000, 10_000, 30_000])
      .configureLogging(LogLevel.Warning)
      .build();

    connection.serverTimeoutInMilliseconds = 300_000;
    connection.keepAliveIntervalInMilliseconds = 300_000;
    connection.on('notify', (payload: unknown) => {
      const update = this.normalize(payload);
      if (update) this.updatesSubject.next(update);
    });

    this.connection = connection;
    this.connectionKey = key;
    await connection.start();
  }

  private normalize(payload: unknown): VehicleRealtimeUpdate | null {
    if (typeof payload === 'string') {
      try {
        return this.normalize(JSON.parse(payload));
      } catch {
        return null;
      }
    }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
    const record = payload as Record<string, unknown>;
    const nested = record['data'];
    return nested && typeof nested === 'object' && !Array.isArray(nested)
      ? (nested as VehicleRealtimeUpdate)
      : (record as VehicleRealtimeUpdate);
  }
}
