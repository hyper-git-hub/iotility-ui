import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, signal } from '@angular/core';
import { BlockingLoader, TableColumn, TableRow } from '@iotility/shared-ui';
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
import { FeedbackDialogBridgeService } from '../../../shared/services/feedback-dialog-bridge.service';

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
  protected readonly displayedCards = computed(() => {
    const order = ['QFU', 'QHB', 'QLC', 'QIT', 'QPT'];
    return this.cards()
      .filter((card) => card.code !== 'VIO')
      .sort((first, second) => {
        const firstIndex = order.indexOf(first.code);
        const secondIndex = order.indexOf(second.code);
        return (firstIndex < 0 ? order.length : firstIndex) - (secondIndex < 0 ? order.length : secondIndex);
      });
  });
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

  constructor(
    private readonly api: FleetDashboardApiService,
    private readonly feedback: FeedbackDialogBridgeService,
  ) {}

  ngOnInit(): void { this.loadDashboard(); }

  protected loadDashboard(): void {
    this.loading.set(true);
    this.error.set('');
    this.loadFleetData();
    forkJoin({
      cards: this.api.getCards(),
      graphs: this.api.getGraphs(),
      // fleets are loaded independently so they cannot block the dashboard loader
      // dashcams: this.api.getDashcams(),
    }).pipe(finalize(() => this.loading.set(false))).subscribe({
      next: ({ cards, graphs }) => {
        this.cards.set(cards.data ?? []);
        this.graphs.set(graphs.data ?? []);
        this.dashcams.set([]);
      },
      error: (response: HttpErrorResponse) => {
        const message = response.error?.message || 'Dashboard data could not be loaded. Please try again.';
        this.error.set(message);
        void this.feedback.open({ type: 'error', title: 'Unable to load dashboard', message, confirmText: 'Close', showCancel: false });
      },
    });
  }

  private loadFleetData(): void {
    this.api.getFleets().subscribe({
      next: (fleets) => this.fleets.set(fleets.data?.data ?? []),
      error: () => this.fleets.set([]),
    });
  }

  protected cardTone(code: string): StatCardTone {
    if (['DVC', 'MOD', 'QHB'].includes(code)) return 'danger';
    if (['MD', 'VIM', 'QIT'].includes(code)) return 'warning';
    if (['VIO', 'TD', 'QFU'].includes(code)) return 'success';
    if (code === 'QPT') return 'brand';
    return 'info';
  }

  protected cardValue(card: DashboardCard): number | string { return card.data ?? 0; }

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
      QFU: 'var(--color-success)',
      QHB: 'var(--color-danger)',
      QIT: 'var(--color-warning)',
      QLC: 'var(--color-info)',
      QPT: 'var(--color-brand-500)',
    };
    return accents[code] ?? 'var(--color-brand-500)';
  }

  protected vehicleInitial(vehicle: Vehicle): string { return (vehicle.name || '?').charAt(0).toUpperCase(); }
}
