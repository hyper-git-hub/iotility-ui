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
  brng?: string | number;
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
  private connectingKey = '';
  private connectionGeneration = 0;

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
    if (this.connecting && this.connectingKey === key) return this.connecting;

    const generation = ++this.connectionGeneration;
    this.connectingKey = key;
    this.connecting = this.start(key, generation)
      .catch(() => {
        // The REST vehicle snapshot remains usable when negotiation or the hub is unavailable.
      })
      .finally(() => {
        if (generation === this.connectionGeneration) {
          this.connecting = undefined;
          this.connectingKey = '';
        }
      });
    return this.connecting;
  }

  async disconnect(): Promise<void> {
    ++this.connectionGeneration;
    const connection = this.connection;
    this.connection = undefined;
    this.connectionKey = '';
    this.connectingKey = '';
    if (connection && connection.state !== HubConnectionState.Disconnected) {
      await connection.stop();
    }
  }

  private async start(key: string, generation: number): Promise<void> {
    const previous = this.connection;
    this.connection = undefined;
    this.connectionKey = '';
    if (previous && previous.state !== HubConnectionState.Disconnected) await previous.stop();
    if (generation !== this.connectionGeneration) return;

    const suffix = key ? `/${encodeURIComponent(key)}` : '';
    const details = await firstValueFrom(
      this.http.get<SignalRConnectionDetails>(`${environment.signalRUrl}/api/SignalR${suffix}`),
    );
    if (generation !== this.connectionGeneration) return;
    if (!details?.url || !details?.accessToken) {
      throw new Error('Invalid SignalR negotiation response.');
    }
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
    try {
      await connection.start();
      if (generation !== this.connectionGeneration) await connection.stop();
    } catch (error) {
      if (this.connection === connection) {
        this.connection = undefined;
        this.connectionKey = '';
      }
      throw error;
    }
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
