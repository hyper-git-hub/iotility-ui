import { Injectable, signal } from '@angular/core';

export interface DashboardWidget {
  id: string;
  name: string;
  description: string;
  tab: 'overview' | 'safety' | 'maintenance' | 'jobs';
}

export const DASHBOARD_WIDGETS: DashboardWidget[] = [
  { id: 'fleet-status', name: 'Live Fleet Status', description: 'Real-time count of moving, idling, stopped, alert and offline vehicles', tab: 'overview' },
  { id: 'DA', name: 'Driver Allocations', description: 'Vehicles and their assigned drivers per fleet', tab: 'overview' },
  { id: 'RS', name: 'Route Statistics', description: 'Vehicle counts per route', tab: 'overview' },
  { id: 'VS', name: 'Vehicle Statistics', description: 'Vehicle distribution across fleets', tab: 'overview' },
  { id: 'ADF', name: 'Aggressively Driven Fleets', description: 'Aggressive driving events by fleet over time', tab: 'safety' },
  { id: 'DVG', name: 'Driver Violations', description: 'Violation events by driver', tab: 'safety' },
  { id: 'DSS', name: 'Driver Safety Scorecard', description: 'Safety scores per violation type', tab: 'safety' },
  { id: 'service-table', name: 'Vehicles Due for Service', description: 'Vehicles approaching or overdue for scheduled maintenance', tab: 'maintenance' },
  { id: 'MS', name: 'Maintenance status', description: 'Maintenance events by type', tab: 'maintenance' },
  { id: 'POVM', name: 'Probability of Vehicle Maintenance', description: 'Maintenance probability breakdown per fleet', tab: 'maintenance' },
  { id: 'DTS', name: 'Driver Tasks Status', description: 'Task completion status by fleet and driver', tab: 'jobs' },
  { id: 'JJ', name: 'Jobs', description: 'Ad-hoc vs scheduled jobs by city', tab: 'jobs' },
  { id: 'JSJ', name: 'Statistics of Jobs', description: 'Pending vs completed vs cancelled jobs', tab: 'jobs' },
  { id: 'JSS', name: 'Staff Statistics', description: 'Staff on job, on bench and available', tab: 'jobs' },
];

@Injectable({ providedIn: 'root' })
export class DashboardWidgetsService {
  private readonly storageKey = 'fleetpointHiddenDashboardWidgets';
  private readonly hiddenByTab = signal<Record<string, string[]>>(this.read());

  widgetsForTab(tab: string): DashboardWidget[] {
    return DASHBOARD_WIDGETS.filter((widget) => widget.tab === tab);
  }

  hiddenWidgetIds(tab: string): string[] {
    return this.hiddenByTab()[tab] ?? [];
  }

  isVisible(tab: string, id: string): boolean {
    return !this.hiddenWidgetIds(tab).includes(id);
  }

  setHiddenWidgetIds(tab: string, ids: string[]): void {
    this.hiddenByTab.update((state) => ({ ...state, [tab]: ids }));
    try {
      sessionStorage.setItem(this.storageKey, JSON.stringify(this.hiddenByTab()));
    } catch {
      // storage unavailable — keep in-memory state only
    }
  }

  private read(): Record<string, string[]> {
    try {
      const parsed: unknown = JSON.parse(sessionStorage.getItem(this.storageKey) ?? '{}');
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, string[]>)
        : {};
    } catch {
      return {};
    }
  }
}

