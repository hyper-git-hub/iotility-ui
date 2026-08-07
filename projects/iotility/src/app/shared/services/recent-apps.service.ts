import { Injectable, signal } from '@angular/core';

export interface RecentApp {
  id: string;
  label: string;
  initials: string;
  url: string;
  logoSrc: string;
  labelLogoSrc?: string;
}

export const FLEETPOINT_APP: RecentApp = {
  id: 'fleetpoint',
  label: 'FleetPoint',
  initials: 'FP',
  url: '/fleetpoint/dashboard',
  logoSrc: 'assets/fleetpoint.svg',
  labelLogoSrc: 'assets/iotility-light.svg',
};

@Injectable({ providedIn: 'root' })
export class RecentAppsService {
  private readonly storageKey = 'iotility-recent-apps';
  readonly apps = signal<RecentApp[]>([]);

  constructor() {
    this.load();
  }

  register(app: RecentApp): void {
    const next = [...this.apps().filter((item) => item.id !== app.id), app];
    this.apps.set(next);
    this.persist(next);
  }

  remove(id: string): void {
    const next = this.apps().filter((item) => item.id !== id);
    this.apps.set(next);
    this.persist(next);
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(this.storageKey);
      this.apps.set(raw ? (JSON.parse(raw) as RecentApp[]) : []);
    } catch {
      this.apps.set([]);
    }
  }

  private persist(apps: RecentApp[]): void {
    localStorage.setItem(this.storageKey, JSON.stringify(apps));
  }
}
