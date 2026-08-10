import { Component, OnInit, computed, signal } from '@angular/core';
import { Skeleton, StatCardSkeleton, TableColumn, TableRow } from '@iotility/shared-ui';
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

const EXPECTED_DASHBOARD_GRAPHS: DashboardGraph[] = [
  { code: 'ADF', name: 'Aggressively Driven Fleets', chart_type: 'line_area_chart', data: { categories: ['Fleet 01', 'Fleet 02', 'Fleet 03', 'Fleet 04'], series: [{ name: 'Harsh Acceleration', data: [12, 7, 16, 9] }, { name: 'Harsh Braking', data: [8, 14, 6, 11] }, { name: 'Sharp Turning', data: [5, 9, 12, 7] }] } },
  { code: 'DA', name: 'Driver Allocations', chart_type: null, data: { fleets: [{ name: 'Fleet 01', data: [{ vehicle: 'FLT-101', driver: 'Richard' }, { vehicle: 'FLT-102', driver: 'Rebecca' }] }, { name: 'Fleet 02', data: [{ vehicle: 'FLT-204', driver: 'Henry' }] }] } },
  { code: 'DSS', name: 'Driver Safety Scorecard', chart_type: 'piechart', data: { categories: ['Geozone Violation', 'Harsh Acceleration', 'Harsh Braking', 'Speed'], values: [18, 24, 13, 31] } },
  { code: 'DTS', name: 'Driver Tasks Status', chart_type: 'piechart', data: { categories: ['Completed', 'Pending', 'In Progress', 'Aborted'], values: [42, 18, 27, 6] } },
  { code: 'DVG', name: 'Driver Violations', chart_type: 'horizontal_bar_chart', data: { categories: ['Richard', 'Rebecca', 'Henry', 'John'], series: [{ name: 'Violations', data: [12, 8, 15, 6] }] } },
  { code: 'JJ', name: 'Jobs', chart_type: 'bar_chart', data: { categories: ['Islamabad', 'Rawalpindi', 'Lahore'], series: [{ name: 'Adhoc', data: [18, 11, 15] }, { name: 'Scheduled', data: [9, 14, 12] }] } },
  { code: 'JSJ', name: 'Statistics of Jobs', chart_type: 'piechart', data: { categories: ['Pending', 'Completed', 'Cancelled'], values: [14, 38, 5] } },
  { code: 'JSS', name: 'Staff Statistics', chart_type: 'horizontal_stackbar_chart', data: { categories: ['Staff'], series: [{ name: 'On job', data: [18] }, { name: 'On bench', data: [6] }, { name: 'Available', data: [11] }] } },
  { code: 'MS', name: 'Maintenance status', chart_type: 'piechart', data: { categories: ['Oil Change', 'Tire Rotation', 'Air Filter', 'Transmission'], values: [12, 8, 5, 3] } },
  { code: 'POVM', name: 'Probability of Vehicle Maintenance', chart_type: 'bar_chart', data: { categories: ['Fleet 01', 'Fleet 02', 'Fleet 03'], series: [{ name: 'Maintenance', data: [7, 11, 5] }, { name: 'Replace', data: [2, 4, 1] }, { name: 'No Maintenance', data: [18, 14, 21] }] } },
  { code: 'RS', name: 'Route Statistics', chart_type: 'bar_chart', data: { categories: ['ISB–RWP', 'I-9 ISB', 'Ring Road', 'M-2'], values: [22, 16, 13, 28] } },
  { code: 'VS', name: 'Vehicle Statistics', chart_type: 'bar_chart', data: [{ fleet_name: 'Fleet 01', vehicle_count: 18 }, { fleet_name: 'Fleet 02', vehicle_count: 13 }, { fleet_name: 'Fleet 03', vehicle_count: 21 }] },
];

@Component({
  selector: 'app-dashboard-overview',
  imports: [Skeleton, StatCardSkeleton, DashboardGraphComponent, StatCard],
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
    const order = ['DVC', 'J', 'MD', 'MOD', 'TD', 'TDC', 'TF', 'VIM'];
    return this.cards()
      .filter((card) => card.code !== 'VIO')
      .sort((first, second) => {
        const firstIndex = order.indexOf(first.code);
        const secondIndex = order.indexOf(second.code);
        return (firstIndex < 0 ? order.length : firstIndex) - (secondIndex < 0 ? order.length : secondIndex);
      })
      .slice(0, 8);
  });
  protected readonly graphs = signal<DashboardGraph[]>([]);
  protected readonly displayedGraphs = computed<DashboardGraph[]>(() => {
    const received = new Map(
      this.graphs()
        .filter((graph) => Boolean(graph?.code))
        .map((graph) => [graph.code, graph]),
    );
    return EXPECTED_DASHBOARD_GRAPHS.map((fallback) => {
      const graph = received.get(fallback.code);
      return graph && this.hasGraphData(graph) ? graph : fallback;
    }).filter((graph) =>
      !['ADF', 'DSS', 'DVG', 'MS', 'POVM', 'DTS', 'JJ', 'JSJ', 'JSS'].includes(graph.code),
    );
  });
  protected readonly fleets = signal<Fleet[]>([]);
  protected readonly dashcams = signal<DashcamDevice[]>([]);
  protected readonly vehicles = computed(() => this.fleets().flatMap((fleet) => fleet.assigned_vehicles ?? []));
  protected readonly visibleVehicles = computed(() => this.vehicles());
  protected readonly onlineVehicles = computed(() => this.vehicles().filter((vehicle) => vehicle.online_status).length);
  protected readonly fleetStatus = computed(() => {
    const status = { moving: 0, idling: 0, stopped: 0, alert: 0, offline: 0 };
    for (const vehicle of this.vehicles()) {
      if (!vehicle.online_status) status.offline++;
      else if (Number(vehicle.total_violations) > 0) status.alert++;
      else if (Number(vehicle.speed) > 0) status.moving++;
      else if (vehicle.ignition_status) status.idling++;
      else status.stopped++;
    }
    return status;
  });
  protected readonly fleetStatusItems = computed(() => {
    const status = this.fleetStatus();
    return [
      { key: 'moving', label: 'Moving', value: status.moving, tone: 'moving' },
      { key: 'idling', label: 'Idling', value: status.idling, tone: 'idling' },
      { key: 'stopped', label: 'Stopped', value: status.stopped, tone: 'stopped' },
      { key: 'alert', label: 'Alert', value: status.alert, tone: 'alert' },
      { key: 'offline', label: 'Offline', value: status.offline, tone: 'offline' },
    ];
  });
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
      next: (cards) => {
        if (cards.status !== 1000) {
          this.cardsError.set(cards.message || 'Fleet metrics could not be loaded.');
          this.cards.set([]);
          return;
        }
        this.cards.set(Array.isArray(cards.data) ? cards.data : []);
      },
      error: (response) => {
        this.cardsError.set(response.error?.message || 'Fleet metrics could not be loaded.');
      },
    });
  }

  protected loadGraphs(): void {
    this.graphsLoading.set(true);
    this.graphsError.set('');
    this.api.getGraphs().pipe(finalize(() => this.graphsLoading.set(false))).subscribe({
      next: (graphs) => {
        if (graphs.status !== 1000) {
          this.graphsError.set(graphs.message || 'Dashboard analytics could not be loaded.');
          this.graphs.set([]);
          return;
        }
        this.graphs.set(Array.isArray(graphs.data) ? graphs.data : []);
        const received = new Map(this.graphs().map((graph) => [graph.code, graph]));
        this.api.cacheGraphs(EXPECTED_DASHBOARD_GRAPHS.map((fallback) => {
          const graph = received.get(fallback.code);
          return graph && this.hasGraphData(graph) ? graph : fallback;
        }));
      },
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

  protected statusPercentage(value: number): number {
    return this.vehicles().length ? (value / this.vehicles().length) * 100 : 0;
  }

  private hasGraphData(graph: DashboardGraph): boolean {
    const data = graph?.data;
    if (!data) return false;
    if (Array.isArray(data)) {
      return data.some((row) => Number(row?.vehicle_count) > 0);
    }
    if (graph.code === 'DA') {
      return (data.fleets ?? []).some((fleet) => Array.isArray(fleet?.data) && fleet.data.length > 0);
    }
    const series = Array.isArray(data.series) ? data.series : [];
    const values = [
      ...(Array.isArray(data.values) ? data.values : []),
      ...series.flatMap((item) =>
        typeof item === 'number' ? [item] : Array.isArray(item?.data) ? item.data : [],
      ),
    ];
    return values.some((value) => Number(value) !== 0);
  }

}
