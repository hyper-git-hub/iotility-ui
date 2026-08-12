import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { HubConnection, HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr';
import { Observable, Subject, firstValueFrom } from 'rxjs';
import { environment } from '../../../../../iotility/src/environments/environment';

export interface VehicleRealtimeUpdate {
  id?: string | number;
  vehicle_id?: string | number;
  registration?: string;
  lat?: number;
  latitude?: number;
  lon?: number;
  lng?: number;
  longitude?: number;
  spd?: number;
  speed?: number;
  ign?: boolean | number;
  ignition_status?: boolean;
  t?: string | number;
  updated_time?: string;
  rtp?: string | number;
  vol?: string | number;
  sbStatus?: string | number;
  b?: string | number;
  receptionTime?: string;
  device_id?: string | number;
  location?: string;
}

const EVENTS = ['notify', 'newMessage', 'broadcastMessage', 'mxChipData', 'telemetry', 'vehicleUpdate'];

interface SignalRNegotiationResponse {
  url: string;
  accessToken: string;
}

@Injectable({ providedIn: 'root' })
export class VehicleRealtimeService {
  private readonly updatesSubject = new Subject<VehicleRealtimeUpdate>();
  readonly updates$: Observable<VehicleRealtimeUpdate> = this.updatesSubject.asObservable();
  private connection?: HubConnection;
  private connectionScope = '';

  constructor(private readonly http: HttpClient) {}

  async connect(deviceId?: string | number | null): Promise<void> {
    const scope = String(deviceId ?? '').trim();
    if (
      this.connectionScope === scope &&
      (this.connection?.state === HubConnectionState.Connected ||
        this.connection?.state === HubConnectionState.Connecting)
    ) return;
    if (this.connection) await this.disconnect();
    this.connectionScope = scope;
    const negotiationUrl = scope
      ? `${environment.signalRUrl}/api/SignalR/${encodeURIComponent(scope)}`
      : `${environment.signalRUrl}/api/SignalR`;
    try {
      const negotiation = await firstValueFrom(
        this.http.get<SignalRNegotiationResponse>(negotiationUrl),
      );
      if (!negotiation.url || !negotiation.accessToken) throw new Error('Invalid SignalR negotiation response.');
      this.connection = new HubConnectionBuilder()
        .withUrl(negotiation.url, {
          accessTokenFactory: () => negotiation.accessToken,
        })
        .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
        .configureLogging(LogLevel.Warning)
        .build();
      EVENTS.forEach((event) => this.connection?.on(event, (payload: unknown) => this.emit(payload)));
      await this.connection.start();
    } catch {
      this.connection = undefined;
      this.connectionScope = '';
      // REST snapshots remain available when negotiation or connection fails.
    }
  }

  async disconnect(): Promise<void> {
    if (!this.connection) return;
    await this.connection.stop();
    this.connection = undefined;
    this.connectionScope = '';
  }

  private emit(payload: unknown): void {
    try {
      const parsed = typeof payload === 'string' ? JSON.parse(payload) : payload;
      const update = (parsed as { data?: VehicleRealtimeUpdate; message?: VehicleRealtimeUpdate })?.data
        ?? (parsed as { message?: VehicleRealtimeUpdate })?.message
        ?? parsed as VehicleRealtimeUpdate;
      if (Array.isArray(update)) update.forEach((item) => this.emit(item));
      else if (update && typeof update === 'object') this.updatesSubject.next(update);
    } catch { /* Ignore malformed telemetry without interrupting the stream. */ }
  }
}
