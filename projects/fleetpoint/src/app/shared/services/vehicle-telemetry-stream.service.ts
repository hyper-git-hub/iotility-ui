import { Injectable, NgZone } from '@angular/core';
import { secureStorage } from '@iotility/shared-ui';
import { Subject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { VehicleRealtimeUpdate } from './vehicle-realtime.service';

/**
 * Live telemetry from hn-iot-realtime-stream over authenticated SSE.
 *
 * `connect(deviceId)` streams one device (vehicle detail); `connect()` with no
 * id opens the customer's whole-fleet stream (`/v1/fleet/stream`, live
 * tracking), whose frames are each tagged with their device id — the same
 * split as VehicleRealtimeService's keyed connection vs. SignalR firehose.
 */
@Injectable({ providedIn: 'root' })
export class VehicleTelemetryStreamService {
  private readonly updatesSubject = new Subject<VehicleRealtimeUpdate>();
  readonly updates$ = this.updatesSubject.asObservable();

  private controller?: AbortController;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  /** Stream path below the base URL; empty while disconnected. */
  private streamPath = '';
  private generation = 0;
  private retryMs = 1_000;

  constructor(private readonly zone: NgZone) {}

  connect(deviceId?: string | number | null): Promise<void> {
    const key = String(deviceId ?? '').trim();
    const path = key ? `/v1/devices/${encodeURIComponent(key)}/stream` : '/v1/fleet/stream';
    if (path === this.streamPath && this.controller && !this.controller.signal.aborted) {
      return Promise.resolve();
    }
    this.stopCurrent();
    this.streamPath = path;
    this.retryMs = 1_000;
    const generation = ++this.generation;
    void this.open(generation);
    return Promise.resolve();
  }

  disconnect(): Promise<void> {
    ++this.generation;
    this.streamPath = '';
    this.stopCurrent();
    return Promise.resolve();
  }

  private async open(generation: number): Promise<void> {
    if (!this.streamPath || generation !== this.generation) return;
    const controller = new AbortController();
    this.controller = controller;
    const baseUrl = environment.iotRealtimeStreamUrl.replace(/\/$/, '');
    const url = `${baseUrl}${this.streamPath}`;
    // Same precedence as hypernym-fms-fe: the platform token, then the MS one.
    const token = secureStorage.get('token') || secureStorage.get('userMS-token') || '';

    // Raw fetch bypasses the Angular HTTP interceptor, so auth is attached by
    // hand. Only `Accept` and `Authorization` may be sent: the gateway's CORS
    // preflight allows no custom headers (User-Platform / OS / use-case get a
    // 400 and the stream never opens). The stream service reads a `Bearer`
    // token, as in hypernym-fms-fe's telemetry-stream.service.
    const headers: Record<string, string> = { Accept: 'text/event-stream' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });
      if (!response.ok || !response.body) throw new Error(`Telemetry stream HTTP ${response.status}`);
      this.retryMs = 1_000;
      await this.read(response.body.getReader(), generation);
    } catch (error) {
      if (!controller.signal.aborted && generation === this.generation) {
        console.error('[telemetry] stream error', error);
      }
    } finally {
      if (this.controller === controller) this.controller = undefined;
      if (!controller.signal.aborted && generation === this.generation) this.scheduleReconnect(generation);
    }
  }

  private async read(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    generation: number,
  ): Promise<void> {
    const decoder = new TextDecoder();
    let buffer = '';
    while (generation === this.generation) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done }).replace(/\r\n/g, '\n');
      let separator: number;
      while ((separator = buffer.indexOf('\n\n')) >= 0) {
        this.dispatch(buffer.slice(0, separator));
        buffer = buffer.slice(separator + 2);
      }
      if (done) break;
    }
  }

  private dispatch(frame: string): void {
    let event = 'message';
    const dataLines: string[] = [];
    for (const line of frame.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
    }
    if (event === 'heartbeat' || event === 'error' || !dataLines.length) return;
    try {
      const envelope = JSON.parse(dataLines.join('\n')) as unknown;
      const update = this.normalize(envelope);
      if (update) this.zone.run(() => this.updatesSubject.next(update));
    } catch {
      // Ignore malformed frames without interrupting the stream.
    }
  }

  private normalize(payload: unknown): VehicleRealtimeUpdate | null {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
    const envelope = payload as Record<string, unknown>;
    const body = envelope['data'];
    if (!body || typeof body !== 'object' || Array.isArray(body)) return envelope as VehicleRealtimeUpdate;
    // Fleet-stream frames tag the device on the envelope; keep it so the
    // consumer can match the packet even when the body omits its own id.
    const update = body as VehicleRealtimeUpdate;
    return update.device_id === undefined && envelope['device_id'] !== undefined
      ? { ...update, device_id: envelope['device_id'] as string | number }
      : update;
  }

  private scheduleReconnect(generation: number): void {
    if (!this.streamPath || generation !== this.generation || this.reconnectTimer) return;
    const delay = this.retryMs;
    this.retryMs = Math.min(this.retryMs * 2, 15_000);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      void this.open(generation);
    }, delay);
  }

  private stopCurrent(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = undefined;
    this.controller?.abort();
    this.controller = undefined;
  }
}
