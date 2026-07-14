import { Injectable } from '@angular/core';
import { HubConnection, HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr';
import { Observable, Subject } from 'rxjs';

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
}

const SIGNALR_URL = 'https://func-stag-all.azurewebsites.net/api';
const EVENTS = ['newMessage', 'broadcastMessage', 'mxChipData', 'telemetry', 'vehicleUpdate'];

@Injectable({ providedIn: 'root' })
export class VehicleRealtimeService {
  private readonly updatesSubject = new Subject<VehicleRealtimeUpdate>();
  readonly updates$: Observable<VehicleRealtimeUpdate> = this.updatesSubject.asObservable();
  private connection?: HubConnection;

  async connect(): Promise<void> {
    if (this.connection?.state === HubConnectionState.Connected || this.connection?.state === HubConnectionState.Connecting) return;
    this.connection = new HubConnectionBuilder()
      .withUrl(SIGNALR_URL)
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(LogLevel.Warning)
      .build();
    EVENTS.forEach((event) => this.connection?.on(event, (payload: unknown) => this.emit(payload)));
    try { await this.connection.start(); } catch { /* The REST snapshot remains available while realtime reconnects. */ }
  }

  async disconnect(): Promise<void> {
    if (!this.connection) return;
    await this.connection.stop();
    this.connection = undefined;
  }

  private emit(payload: unknown): void {
    try {
      const parsed = typeof payload === 'string' ? JSON.parse(payload) : payload;
      const update = (parsed as { data?: VehicleRealtimeUpdate })?.data ?? parsed as VehicleRealtimeUpdate;
      if (update && typeof update === 'object') this.updatesSubject.next(update);
    } catch { /* Ignore malformed telemetry without interrupting the stream. */ }
  }
}
