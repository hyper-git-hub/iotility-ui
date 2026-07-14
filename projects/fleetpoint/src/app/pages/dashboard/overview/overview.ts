import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, signal } from '@angular/core';
import { BlockingLoader, DataTable, TableColumn, TableRow } from '@iotility/shared-ui';
import { finalize, forkJoin } from 'rxjs';
import { DashboardGraphComponent } from '../../../shared/charts/dashboard-graph/dashboard-graph';
import { StatCard, StatCardTone } from '../../../shared/stat-card/stat-card';
import {
  DashboardCard,
  DashboardGraph,
  DashcamDevice,
  Fleet,
  FleetDashboardApiService,
  Vehicle,
} from '../../../shared/services/fleet-dashboard-api.service';

@Component({
  selector: 'app-dashboard-overview',
  imports: [BlockingLoader, DashboardGraphComponent, StatCard],
  templateUrl: './overview.html',
  styleUrl: '../dashboard-page.css',
})
export class Overview implements OnInit {
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly cards = signal<DashboardCard[]>([]);
  protected readonly displayedCards = computed(() => this.cards().filter((card) => card.code !== 'VIO'));
  protected readonly graphs = signal<DashboardGraph[]>([]);
  protected readonly fleets = signal<Fleet[]>([]);
  protected readonly dashcams = signal<DashcamDevice[]>([]);
  protected readonly vehicles = computed(() => this.fleets().flatMap((fleet) => fleet.assigned_vehicles ?? []));
  protected readonly visibleVehicles = computed(() => this.vehicles());
  protected readonly onlineVehicles = computed(() => this.vehicles().filter((vehicle) => vehicle.online_status).length);
  protected readonly fleetColumns: TableColumn[] = [
    { key: 'vehicle', label: 'Vehicle', type: 'vehicle', secondaryKey: 'details' },
    { key: 'location', label: 'Location' },
    { key: 'speed', label: 'Speed' },
    { key: 'connection', label: 'Status', type: 'status' },
  ];
  protected readonly dashcamColumns: TableColumn[] = [
    { key: 'camera', label: 'Dashcam', type: 'user', secondaryKey: 'deviceType' },
    { key: 'deviceId', label: 'Device ID' },
    { key: 'alerts', label: 'Alerts', type: 'status' },
  ];
  protected readonly fleetRows = computed<TableRow[]>(() => this.vehicles().map((vehicle) => ({
    vehicle: vehicle.name,
    details: `${vehicle.make} ${vehicle.model} · ${vehicle.vehicle_driver_name || 'No driver assigned'}`,
    location: vehicle.location || 'Location unavailable',
    speed: `${vehicle.speed || 0} km/h`,
    connection: vehicle.online_status ? 'Active' : 'Inactive',
  })));
  protected readonly dashcamRows = computed<TableRow[]>(() => this.dashcams().map((camera) => ({
    camera: camera.name,
    deviceType: camera.device_type,
    deviceId: camera.device_id,
    alerts: camera.notifications ? `${camera.notifications} alerts` : 'Active',
  })));

  constructor(private readonly api: FleetDashboardApiService) {}

  ngOnInit(): void { this.loadDashboard(); }

  protected loadDashboard(): void {
    this.loading.set(true);
    this.error.set('');
    forkJoin({
      cards: this.api.getCards(),
      graphs: this.api.getGraphs(),
      fleets: this.api.getFleets(),
      dashcams: this.api.getDashcams(),
    }).pipe(finalize(() => this.loading.set(false))).subscribe({
      next: ({ cards, graphs, fleets, dashcams }) => {
        this.cards.set(cards.data ?? []);
        this.graphs.set(graphs.data ?? []);
        this.fleets.set(fleets.data?.data ?? []);
        this.dashcams.set(dashcams.data?.data ?? []);
      },
      error: (response: HttpErrorResponse) => {
        this.error.set(response.error?.message || 'Dashboard data could not be loaded. Please try again.');
      },
    });
  }

  protected cardTone(code: string): StatCardTone {
    if (['DVC', 'MOD'].includes(code)) return 'danger';
    if (['MD', 'VIM'].includes(code)) return 'warning';
    if (['VIO', 'TD'].includes(code)) return 'success';
    return 'info';
  }

  protected cardValue(card: DashboardCard): number { return card.data ?? 0; }

  protected cardAccent(code: string): string {
    const accents: Record<string, string> = {
      DVC: 'var(--color-danger)',
      J: 'var(--color-info)',
      MD: 'var(--color-warning)',
      MOD: 'color-mix(in srgb, var(--color-danger) 72%, var(--color-warning))',
      TD: 'var(--color-success)',
      TDC: 'var(--color-brand-500)',
      TF: 'color-mix(in srgb, var(--color-brand-500) 68%, var(--color-info))',
      VIM: 'color-mix(in srgb, var(--color-warning) 72%, var(--color-danger))',
      VIO: 'color-mix(in srgb, var(--color-success) 72%, var(--color-info))',
    };
    return accents[code] ?? 'var(--color-brand-500)';
  }

  protected vehicleInitial(vehicle: Vehicle): string { return (vehicle.name || '?').charAt(0).toUpperCase(); }
}
