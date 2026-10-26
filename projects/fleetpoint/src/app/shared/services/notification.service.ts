import { HttpClient } from '@angular/common/http';
import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { initializeApp, getApps } from 'firebase/app';
import { getDatabase, onValue, ref } from 'firebase/database';
import { interval } from 'rxjs';
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
  data?: { data?: FleetNotification[] } | FleetNotification[];
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

  constructor() {
    this.load();
    interval(30_000).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.load());
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
        this.notifications.set(items);
        this.unreadCount.set(items.filter((item) => item.is_viewed === false).length);
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
    this.http.patch(environment.notificationsUrl, {}).subscribe({
      next: () => {
        this.unreadCount.set(0);
        this.notifications.update((items) => items.map((item) => ({ ...item, is_viewed: true })));
      },
    });
  }

  /**
   * Realtime alerts (as hypernym-fms-fe): the backend writes the latest alert
   * to `Notification/<user guid>` in the Realtime Database. Every write after
   * the initial value is a new alert, shown in the badge and list at once with
   * no API call; the 30s poll reconciles the list with the server.
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
    const alert = value as { title?: string; body?: string; notification_type?: number | string };
    const now = new Date().toISOString();
    this.notifications.update((items) => [
      {
        notf_title: alert.title,
        notf_body: alert.body,
        notf_type: alert.notification_type ?? null,
        is_viewed: false,
        notf_created_at: now,
        event_generation_time: now,
      },
      ...items,
    ]);
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
