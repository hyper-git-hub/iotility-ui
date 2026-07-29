import { Component, OnInit, computed, signal } from '@angular/core';
import { Skeleton, TableColumn, TableRow } from '@iotility/shared-ui';
import { finalize } from 'rxjs';
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
  imports: [Skeleton, DashboardGraphComponent, StatCard],
  templateUrl: './overview.html',
  styleUrls: ['../dashboard-page.css', './overview.css'],
})
export class Overview implements OnInit {
  protected readonly cardsLoading = signal(true);
  protected readonly graphsLoading = signal(true);
  protected readonly cardsError = signal('');
  protected readonly graphsError = signal('');
  protected readonly metricSkeletons = Array.from({ length: 8 });
  protected readonly graphSkeletons = [
    { type: 'vertical' },
    { type: 'horizontal' },
    { type: 'horizontal' },
    { type: 'doughnut' },
    { type: 'doughnut' },
    { type: 'line' },
  ] as const;
  protected readonly cards = signal<DashboardCard[]>([]);
  protected readonly displayedCards = computed(() => {
    const order = ['QFU', 'QHB', 'QIT', 'QLC', 'QPT', 'QRH', 'QSF', 'QUL'];
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

  constructor(private readonly api: FleetDashboardApiService) {}

  ngOnInit(): void { this.loadDashboard(); }

  protected loadDashboard(): void {
    this.loadFleetData();
    this.loadCards();
    this.loadGraphs();
    this.dashcams.set([]);
  }

  protected loadCards(): void {
    this.cardsLoading.set(true);
    this.cardsError.set('');
    this.api.getCards().pipe(finalize(() => this.cardsLoading.set(false))).subscribe({
      next: (cards) => this.cards.set(cards.data ?? []),
      error: (response) => {
        this.cardsError.set(response.error?.message || 'Fleet metrics could not be loaded.');
      },
    });
  }

  protected loadGraphs(): void {
    this.graphsLoading.set(true);
    this.graphsError.set('');
    this.api.getGraphs().pipe(finalize(() => this.graphsLoading.set(false))).subscribe({
      next: (graphs) => this.graphs.set(graphs.data ?? []),
      error: (response) => {
        this.graphsError.set(response.error?.message || 'Dashboard analytics could not be loaded.');
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
    if (['DVC', 'MOD', 'QHB', 'QSF'].includes(code)) return 'danger';
    if (['MD', 'VIM', 'QIT', 'QUL'].includes(code)) return 'warning';
    if (['VIO', 'TD', 'QFU', 'QRH'].includes(code)) return 'success';
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
      QRH: 'color-mix(in srgb, var(--color-success) 55%, var(--color-info))',
      QSF: 'color-mix(in srgb, var(--color-danger) 55%, var(--color-brand-500))',
      QUL: 'color-mix(in srgb, var(--color-warning) 58%, var(--color-danger))',
    };
    return accents[code] ?? 'var(--color-brand-500)';
  }

  protected vehicleInitial(vehicle: Vehicle): string { return (vehicle.name || '?').charAt(0).toUpperCase(); }
}
