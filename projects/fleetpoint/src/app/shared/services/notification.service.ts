import { HttpClient } from '@angular/common/http';
import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { initializeApp, getApps } from 'firebase/app';
import { getDatabase, onValue, ref } from 'firebase/database';
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
  private firebaseRefreshTimer?: ReturnType<typeof setTimeout>;
  private receivedInitialFirebaseValue = false;

  readonly notifications = signal<FleetNotification[]>([]);
  readonly unreadCount = signal(0);
  readonly loading = signal(false);
  readonly error = signal(false);

  constructor() {
    this.load();
    this.listenForFirebaseUpdates();
    this.destroyRef.onDestroy(() => {
      this.firebaseUnsubscribe?.();
      clearTimeout(this.firebaseRefreshTimer);
    });
  }

  load(markViewed = false): void {
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
    this.http.patch(environment.notificationsUrl, {}).subscribe({
      next: () => {
        this.unreadCount.set(0);
        this.notifications.update((items) => items.map((item) => ({ ...item, is_viewed: true })));
      },
    });
  }

  private listenForFirebaseUpdates(): void {
    const guid = this.userGuid();
    if (!guid) return;
    try {
      const app = getApps()[0] ?? initializeApp(environment.firebase);
      this.firebaseUnsubscribe = onValue(ref(getDatabase(app), `Notification/${guid}`), () => {
        if (this.receivedInitialFirebaseValue) {
          // Firebase is the immediate alert channel. The REST record can become
          // available a moment later, so show the badge now and reconcile after.
          this.unreadCount.update((count) => count + 1);
          clearTimeout(this.firebaseRefreshTimer);
          this.firebaseRefreshTimer = setTimeout(() => this.load(), 1200);
        }
        this.receivedInitialFirebaseValue = true;
      });
    } catch {
      // The REST list remains available if Firebase is blocked or unavailable.
    }
  }

  private userGuid(): string {
    try {
      return String(JSON.parse(localStorage.getItem('user') || '{}')?.guid ?? '');
    } catch {
      return '';
    }
  }
}
