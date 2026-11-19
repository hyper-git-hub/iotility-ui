import { Injectable, signal } from '@angular/core';
import { AuthSessionService } from './auth-session.service';

export interface RecentApp {
  id: string;
  label: string;
  initials: string;
  url: string;
  logoSrc: string;
  labelLogoSrc?: string;
  /** When the app was last opened. Saved entries without it fall back to their stored position. */
  lastUsed?: number;
}

export const FLEETPOINT_APP: RecentApp = {
  id: 'fleetpoint',
  label: 'FleetPoint',
  initials: 'FP',
  url: '/fleetpoint/dashboard',
  logoSrc: 'assets/fleetpoint.svg',
  labelLogoSrc: 'assets/iotility-loader-light.svg',
};

export const TWINSCAPE_APP: RecentApp = {
  id: 'twinscape',
  label: 'Twinscape',
  initials: 'TS',
  url: '/twinscape/home',
  logoSrc: 'assets/twinscape.svg',
  labelLogoSrc: 'assets/iotility-loader-light.svg',
};

@Injectable({ providedIn: 'root' })
export class RecentAppsService {
  private readonly storageKeyBase = 'iotility-recent-apps';
  readonly apps = signal<RecentApp[]>([]);

  constructor(private readonly authSession: AuthSessionService) {
    this.load();
  }

  register(app: RecentApp): void {
    // Newest first: the icon the user just opened takes the top slot in the sidebar.
    const next = [
      { ...app, lastUsed: Date.now() },
      ...this.apps().filter((item) => item.id !== app.id),
    ];
    this.apps.set(next);
    this.persist(next);
  }

  remove(id: string): void {
    const next = this.apps().filter((item) => item.id !== id);
    this.apps.set(next);
    this.persist(next);
  }

  reload(): void {
    this.apps.set([]);
    this.load();
  }

  private get storageKey(): string {
    const email = this.authSession.email.trim().toLowerCase();
    return email ? `${this.storageKeyBase}-${email}` : this.storageKeyBase;
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(this.storageKey);
      const stored = raw ? (JSON.parse(raw) as RecentApp[]) : [];
      // Older saved lists run oldest → newest; their array position is the recency fallback.
      this.apps.set(
        stored
          .map((app, index) => ({ ...app, lastUsed: app.lastUsed ?? index }))
          .sort((a, b) => b.lastUsed - a.lastUsed),
      );
    } catch {
      this.apps.set([]);
    }
  }

  private persist(apps: RecentApp[]): void {
    localStorage.setItem(this.storageKey, JSON.stringify(apps));
  }
}
