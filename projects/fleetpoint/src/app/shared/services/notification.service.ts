import { HttpClient } from '@angular/common/http';
import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { initializeApp, getApps } from 'firebase/app';
import { getDatabase, onValue, ref } from 'firebase/database';
import { secureStorage } from '@iotility/shared-ui';
import { environment } from '../../../environments/environment';

export interface FleetNotification {
  id?: number | string;
  notf_title?: string;
  notf_body?: string;
  notf_type?: number | string | null;
  duration?: string;
  is_viewed?: boolean;
  updated_at?: string;
  description?: string;
  notf_created_at?: string;
  event_generation_time?: string;
  driver_name?: string | null;
  vehicle_name?: string | null;
  threshold_value?: string | number | null;
  location?: string | null;
  is_cleared?: boolean;
  vehicle?: number | string | null;
}

interface NotificationResponse {
  /** unread_count covers every unread notification matching the filters, not just this page. */
  data?: { count?: number; unread_count?: number; data?: FleetNotification[] } | FleetNotification[];
}

/**
 * What the backend writes to `Notification/<user guid>`. Numbers keep their type here (only
 * the mobile push stringifies them); a missing text value is '' and a missing number is absent.
 */
interface RealtimeAlert {
  id?: number | string;
  title?: string;
  body?: string;
  notification_type?: number | string;
  vehicle?: number | string;
  vehicle_name?: string;
  driver_name?: string;
  location?: string;
  threshold_value?: number | string;
  /** "YYYY-MM-DD HH:MM:SS" in UTC. */
  notf_created_at?: string;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  private firebaseUnsubscribe?: () => void;
  private receivedInitialFirebaseValue = false;

  readonly notifications = signal<FleetNotification[]>([]);
  readonly unreadCount = signal(0);
  readonly loading = signal(false);
  readonly error = signal(false);
  /**
   * Bumped each time notifications are marked read. The backend also marks the related
   * violations read then, which resets every Alert count, so pages showing one reload it.
   */
  readonly alertsCleared = signal(0);

  constructor() {
    // One load for the history; new alerts then arrive over Firebase, so there
    // is no polling. Opening the panel reloads (and marks viewed) as before.
    this.load();
    this.listenForFirebaseUpdates();
    this.destroyRef.onDestroy(() => this.firebaseUnsubscribe?.());
  }

  load(markViewed = false): void {
    // Stop hitting the API once the session is gone (e.g. the same account was
    // signed in elsewhere and the 401 interceptor cleared the token).
    if (!this.hasSession()) return;
    this.loading.set(true);
    this.error.set(false);
    const url = `${environment.notificationsUrl}?limit=100&offset=0`;
    this.http.get<NotificationResponse>(url).subscribe({
      next: (response) => {
        const payload = response?.data;
        const items = Array.isArray(payload) ? payload : (payload?.data ?? []);
        const unread = Array.isArray(payload) ? undefined : payload?.unread_count;
        this.notifications.set(items);
        // The page only holds the latest 100; unread_count is the true total.
        this.unreadCount.set(
          typeof unread === 'number' && Number.isFinite(unread)
            ? unread
            : items.filter((item) => item.is_viewed === false).length,
        );
        this.loading.set(false);
        if (markViewed && this.unreadCount() > 0) this.markAllViewed();
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      },
    });
  }

  private markAllViewed(): void {
    if (!this.hasSession()) return;
    // PATCH /notification/ (trailing slash, as the backend documents it).
    this.http.patch(`${environment.notificationsUrl}/`, {}).subscribe({
      next: () => {
        this.unreadCount.set(0);
        this.notifications.update((items) => items.map((item) => ({ ...item, is_viewed: true })));
        this.alertsCleared.update((count) => count + 1);
      },
    });
  }

  /**
   * Realtime alerts (as hypernym-fms-fe): the backend writes the latest alert
   * to `Notification/<user guid>` in the Realtime Database. Every write after
   * the initial value is a new alert, shown in the badge and list at once with
   * no API call; opening the panel reconciles the list with the server.
   */
  private listenForFirebaseUpdates(): void {
    const guid = this.userGuid();
    if (!guid) return;
    try {
      // firebase/app is bundled in this remote (see federation.config.mjs), so
      // this registry is fleetpoint's own: initialise it here on first use.
      const app = getApps()[0] ?? initializeApp(environment.firebase);
      this.firebaseUnsubscribe = onValue(
        ref(getDatabase(app), `Notification/${guid}`),
        (snapshot) => {
          // The first value is whatever alert was already stored, not a new one.
          if (this.receivedInitialFirebaseValue) this.pushRealtimeAlert(snapshot.val());
          this.receivedInitialFirebaseValue = true;
        },
        (error) => console.error('[notifications] realtime listener failed', error),
      );
    } catch (error) {
      // The REST list remains available if Firebase is blocked or unavailable.
      console.error('[notifications] realtime listener unavailable', error);
    }
  }

  private pushRealtimeAlert(value: unknown): void {
    this.unreadCount.update((count) => count + 1);
    if (!value || typeof value !== 'object') return;
    const alert = value as RealtimeAlert;
    const createdAt = this.utcToLocal(alert.notf_created_at) ?? this.localTimestamp(new Date());
    const vehicle = this.numberOrText(alert.vehicle);
    const notification: FleetNotification = {
      id: this.numberOrText(alert.id) ?? undefined,
      notf_title: alert.title || undefined,
      notf_body: alert.body || undefined,
      notf_type: alert.notification_type ?? null,
      vehicle,
      vehicle_name: alert.vehicle_name || null,
      driver_name: alert.driver_name || null,
      location: alert.location || null,
      threshold_value: this.numberOrText(alert.threshold_value),
      is_viewed: false,
      notf_created_at: createdAt,
      event_generation_time: createdAt,
    };
    this.notifications.update((items) => [
      notification,
      // The same alert may already be listed if the panel was reloaded meanwhile.
      ...items.filter((item) => notification.id == null || item.id !== notification.id),
    ]);
  }

  /** A number when the value is numeric, the text otherwise, null when absent or empty. */
  private numberOrText(value: unknown): number | string | null {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : String(value);
  }

  /** "YYYY-MM-DD HH:MM:SS" in UTC → the same format in the viewer's time zone. */
  private utcToLocal(value: string | undefined): string | null {
    const match = value?.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
    if (!match) return null;
    const [, year, month, day, hour, minute, second = '0'] = match;
    const date = new Date(Date.UTC(+year, +month - 1, +day, +hour, +minute, +second));
    return Number.isNaN(date.getTime()) ? null : this.localTimestamp(date);
  }

  private localTimestamp(date: Date): string {
    const pad = (part: number) => String(part).padStart(2, '0');
    return (
      `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
      `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
    );
  }

  private userGuid(): string {
    try {
      return String(JSON.parse(secureStorage.get('user') || '{}')?.guid ?? '');
    } catch {
      return '';
    }
  }

  private hasSession(): boolean {
    return Boolean(secureStorage.get('userMS-token') || secureStorage.get('token'));
  }
}
