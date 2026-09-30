import { Component, OnInit, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { BlockingLoader, DataTable, DataTableSkeleton, Dropdown, DropdownOption, Skeleton, StatusBadge, TableAction, TableColumn, TableRow } from '@iotility/shared-ui';
import { finalize, forkJoin } from 'rxjs';
import { ProgressBar } from '../../shared/progress-bar/progress-bar';
import {
  InventoryOption,
  VehicleInventoryApiService,
  VehicleInventoryFilters,
  VehicleInventoryRecord,
} from '../../shared/services/vehicle-inventory-api.service';
import { FleetInventoryApiService, FleetInventoryRecord } from '../../shared/services/fleet-inventory-api.service';
import { FleetStatusService } from '../../shared/services/fleet-status.service';
import { VehicleForm, VehicleFormValue } from './vehicle-form/vehicle-form';
import { FeedbackDialogBridgeService } from '../../shared/services/feedback-dialog-bridge.service';

@Component({
  selector: 'app-vehicles-page',
  imports: [BlockingLoader, DataTable, DataTableSkeleton, Dropdown, ProgressBar, Skeleton, StatusBadge, VehicleForm],
  templateUrl: './vehicles-page.html',
  styleUrl: './vehicles-page.css',
})
export class VehiclesPage implements OnInit {
  private searchTimer?: ReturnType<typeof setTimeout>;
  protected readonly loading = signal(true);
  protected readonly hasLoaded = signal(false);
  protected readonly optionsLoading = signal(true);
  protected readonly initialLoading = computed(() => this.loading() && !this.hasLoaded());
  protected readonly refreshing = computed(() => this.loading() && this.hasLoaded());
  protected readonly actionLoading = signal(false);
  protected readonly error = signal('');
  protected readonly formOpen = signal(false);
  protected readonly selectedVehicle = signal<VehicleInventoryRecord | null>(null);
  protected readonly total = signal(0);
  protected readonly records = signal<VehicleInventoryRecord[]>([]);
  protected readonly fleetRecords = signal<FleetInventoryRecord[]>([]);
  protected readonly fleetChips = computed(() =>
    this.fleetRecords()
      .filter((fleet) => fleet.status === undefined || fleet.status === 1)
      .map((fleet) => ({
        id: String(fleet.id),
        name: fleet.name || `Fleet ${fleet.id}`,
        count: fleet.total_vehicles ?? fleet.assigned_vehicles?.length ?? 0,
      })),
  );
  protected readonly fleetOptions = signal<InventoryOption[]>([]);
  protected readonly categoryOptions = signal<InventoryOption[]>([]);
  protected readonly vehicleTypeOptions = signal<InventoryOption[]>([]);
  protected readonly fleetDropdownOptions = computed<DropdownOption[]>(() => [
    { id: '', label: 'All fleets' },
    ...this.fleetOptions().map((fleet) => ({ id: String(fleet.id), label: fleet.name || `Fleet ${fleet.id}` })),
  ]);
  protected readonly categoryDropdownOptions = computed<DropdownOption[]>(() => [{ id: '', label: 'All categories' }, ...this.categoryOptions().map((item) => ({ id: String(item.id), label: item.name || `Category ${item.id}` }))]);
  protected readonly vehicleTypeDropdownOptions = computed<DropdownOption[]>(() => [{ id: '', label: 'All vehicle types' }, ...this.vehicleTypeOptions().map((item) => ({ id: String(item.id), label: item.name || `Vehicle type ${item.id}` }))]);
  protected readonly search = signal('');
  protected readonly fleetId = signal('');
  protected readonly categoryId = signal('');
  protected readonly vehicleTypeId = signal('');
  protected readonly filtersOpen = signal(true);
  protected readonly offset = signal(0);
  protected readonly limit = 10;
  protected readonly tableActions: TableAction[] = ['map', 'history', 'edit', 'delete'];
  protected readonly columns: TableColumn[] = [
    { key: 'registration', label: 'Vehicle', type: 'vehicle', secondaryKey: 'makeModel', imageKey: 'image', clickable: true },
    { key: 'fleet', label: 'Fleet', type: 'fleet' },
    { key: 'status', label: 'Status', type: 'status' },
    { key: 'driver', label: 'Driver' },
    { key: 'location', label: 'Location' },
    { key: 'speed', label: 'Speed' },
    { key: 'fuel', label: 'Fuel', type: 'fuel' },
    { key: 'odometer', label: 'Mileage' },
    { key: 'mot', label: 'MOT', type: 'mot' },
    { key: 'alerts', label: 'Alerts', type: 'alert' },
    { key: 'actions', label: 'Actions', type: 'actions' },
  ];
  protected readonly columnLabels = this.columns.map((column) => column.label);
  protected readonly vehicles = computed<TableRow[]>(() => this.records().map((vehicle) => ({
    id: vehicle.id,
    image: this.vehicleImage(vehicle.image),
    registration: vehicle.registration || vehicle.name,
    makeModel: `${vehicle.year || ''} ${vehicle.make || ''} ${vehicle.model || ''}`.trim() || '—',
    fleet: vehicle.fleet_name || '—',
    fleetColor: this.fleetColor(vehicle),
    status: this.vehicleStatus(vehicle),
    driver: vehicle.vehicle_driver_name || '—',
    location: vehicle.location || '—',
    speed: vehicle.speed == null ? '—' : `${Number(vehicle.speed).toFixed(1)} km/h`,
    fuel: '—',
    odometer: vehicle.odo_reading == null ? '—' : `${Number(vehicle.odo_reading).toLocaleString()} km`,
    mot: vehicle.expiry_date || '—',
    alerts:
      vehicle.live_status?.toLowerCase() === 'alert' || (vehicle.total_violations ?? 0) > 0,
    actions: '',
  })));
  protected readonly moving = computed(() => this.statusCount('Moving'));
  protected readonly idling = computed(() => this.statusCount('Idling'));
  protected readonly stopped = computed(() => this.statusCount('Stopped'));
  protected readonly alerts = computed(() => this.statusCount('Alert'));
  protected readonly offline = computed(() => this.statusCount('Offline'));
  protected readonly attentionItems = computed(() => {
    const activeAlerts = this.records().filter(
      (vehicle) => vehicle.live_status?.toLowerCase() === 'alert',
    );
    const offline = this.records().filter((vehicle) => !vehicle.online_status);
    return [
      { label: 'active alerts', vehicles: activeAlerts, tone: 'danger', icon: '/assets/fleetpoint/sidebar-icons/violations.svg' },
      { label: 'offline', vehicles: offline, tone: 'neutral', icon: '/assets/fleetpoint/sidebar-icons/devices.svg' },
    ]
      .filter((item) => item.vehicles.length > 0)
      .map((item) => ({
        ...item,
        registrations: item.vehicles.map((vehicle) => vehicle.registration || vehicle.name).join(', '),
      }));
  });

  constructor(
    private readonly api: VehicleInventoryApiService,
    private readonly fleetApi: FleetInventoryApiService,
    private readonly router: Router,
    private readonly feedback: FeedbackDialogBridgeService,
    protected readonly fleetStatus: FleetStatusService,
  ) {}

  ngOnInit(): void {
    this.fleetApi.getFleets({ limit: 100, offset: 0, id: '', search: '' }).subscribe({
      next: (response) => this.fleetRecords.set(response.data?.data ?? []),
      error: () => this.fleetRecords.set([]),
    });
    forkJoin({ fleets: this.api.getFleetOptions(), categories: this.api.getCategoryOptions(), vehicleTypes: this.api.getVehicleTypeOptions() }).pipe(finalize(() => this.optionsLoading.set(false))).subscribe({
      next: ({ fleets, categories, vehicleTypes }) => {
        this.fleetOptions.set((fleets.data?.data ?? []).filter((item) => item.status === undefined || item.status === 1));
        this.categoryOptions.set(categories.data?.data ?? []);
        this.vehicleTypeOptions.set(vehicleTypes.data?.data ?? []);
      },
    });
    this.loadVehicles();
  }

  protected loadVehicles(showLoader = true): void {
    if (showLoader) this.loading.set(true);
    this.error.set('');
    this.api.getVehicles(this.filters()).pipe(finalize(() => {
      if (showLoader) {
        this.loading.set(false);
        this.hasLoaded.set(true);
      }
    })).subscribe({
      next: (response) => {
        this.records.set(response.data?.data ?? []);
        this.total.set(response.data?.count ?? 0);
      },
      error: (response) => {
        const message = response.error?.message || 'Vehicle inventory could not be loaded.';
        this.error.set(message);
        void this.feedback.open({ type: 'error', title: 'Unable to load vehicles', message, confirmText: 'Close', showCancel: false });
      },
    });
  }

  protected resetFilters(): void {
    this.search.set(''); this.fleetId.set(''); this.categoryId.set(''); this.vehicleTypeId.set(''); this.offset.set(0);
    this.loadCategories();
    this.loadVehicles();
  }
  protected updateSearch(event: Event): void { this.search.set((event.target as HTMLInputElement).value); }
  protected tableSearchChanged(value: string): void {
    this.search.set(value);
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => { this.offset.set(0); this.loadVehicles(); }, 400);
  }
  protected selectFleet(option: DropdownOption): void {
    this.fleetId.set(option.id);
    this.categoryId.set('');
    this.offset.set(0);
    this.loadCategories(option.id);
    this.loadVehicles();
  }
  protected toggleFleetChip(id: string): void {
    // "All" while nothing is selected is already the current state.
    if (id === '' && this.fleetId() === '') return;
    const selectedId = this.fleetId() === id ? '' : id;
    this.fleetId.set(selectedId);
    this.categoryId.set('');
    this.offset.set(0);
    this.loadCategories(selectedId);
    this.loadVehicles();
  }
  protected fleetChipColor(index: number): string {
    const colors = [
      'var(--color-brand-500)',
      'var(--color-info)',
      'var(--color-warning)',
      'var(--color-success)',
      'var(--color-danger)',
    ];
    return colors[index % colors.length];
  }
  private fleetColor(vehicle: VehicleInventoryRecord): string {
    const fleetId = String(vehicle.fleet ?? '');
    const index = this.fleetChips().findIndex(
      (fleet) => fleet.id === fleetId || (vehicle.fleet_name && fleet.name === vehicle.fleet_name),
    );
    return index >= 0
      ? this.fleetChipColor(index)
      : vehicle.fleet_name
        ? 'var(--color-brand-600)'
        : 'var(--color-muted)';
  }
  protected selectCategory(option: DropdownOption): void {
    this.categoryId.set(option.id);
    this.offset.set(0);
    this.loadVehicles();
  }
  protected selectVehicleType(option: DropdownOption): void {
    this.vehicleTypeId.set(option.id);
    this.offset.set(0);
    this.loadVehicles();
  }
  protected selectedLabel(options: DropdownOption[], id: string, fallback: string): string { return options.find((option) => option.id === id)?.label || fallback; }
  protected goToPage(page: number): void { this.offset.set((page - 1) * this.limit); this.loadVehicles(); }

  protected openCreateForm(): void { this.selectedVehicle.set(null); this.formOpen.set(true); }
  protected closeForm(): void { this.formOpen.set(false); this.selectedVehicle.set(null); }
  protected saveVehicle(_: VehicleFormValue): void { this.closeForm(); this.loadVehicles(); }
  protected handleRowAction(event: { action: TableAction; row: TableRow }): void {
    if (event.action === 'map') void this.router.navigate(['/fleetpoint/live-tracking'], {
      state: { vehicleId: event.row['id'] },
    });
    else if (event.action === 'history') void this.router.navigateByUrl('/fleetpoint/trip-replay');
    else if (event.action === 'edit') {
      const vehicle = this.records().find((record) => record.id === Number(event.row['id'])) ?? null;
      if (vehicle) { this.selectedVehicle.set(vehicle); this.formOpen.set(true); }
    }
    else if (event.action === 'delete') this.deleteVehicle(event.row);
    else this.formOpen.set(true);
  }
  protected openVehicle(row: TableRow): void { void this.router.navigate(['/fleetpoint/vehicles', row['id']]); }

  private filters(): VehicleInventoryFilters {
    return { limit: this.limit, offset: this.offset(), search: this.search().trim(), fleetId: this.fleetId(), categoryId: this.categoryId(), vehicleTypeId: this.vehicleTypeId() };
  }

  private async deleteVehicle(row: TableRow): Promise<void> {
    const registration = String(row['registration'] || 'this vehicle');
    const confirmed = await this.feedback.open({ type: 'warning', title: 'Delete vehicle?', message: `${registration} will be permanently deleted. This action cannot be undone.`, confirmText: 'Delete vehicle', cancelText: 'Keep vehicle', showCancel: true });
    if (!confirmed) return;
    this.actionLoading.set(true); this.error.set('');
    this.api.deleteVehicle(String(row['id'])).subscribe({
      next: async () => {
        this.actionLoading.set(false);
        await this.feedback.open({ type: 'success', title: 'Vehicle deleted', message: `${registration} was deleted successfully.`, confirmText: 'Done', showCancel: false });
        if (this.records().length === 1 && this.offset() > 0) this.offset.update((value) => Math.max(0, value - this.limit));
        this.loadVehicles();
      },
      error: (response) => { this.actionLoading.set(false); const message = response.error?.message || 'Vehicle could not be deleted.'; this.error.set(message); void this.feedback.open({ type: 'error', title: 'Unable to delete vehicle', message, confirmText: 'Close', showCancel: false }); },
    });
  }

  private loadCategories(fleetId = ''): void { this.api.getCategoryOptions(fleetId).subscribe({ next: (response) => this.categoryOptions.set(response.data?.data ?? []) }); }

  private vehicleImage(image: string | null): string {
    const value = image?.trim();
    return value && !['none', 'null', 'no image', 'n/a'].includes(value.toLowerCase())
      ? value
      : 'assets/fleetpoint/def-car.svg';
  }

  private vehicleStatus(vehicle: VehicleInventoryRecord): string {
    return vehicle.live_status?.trim() || '—';
  }

  private statusCount(status: string): number {
    return this.records().filter((vehicle) => this.vehicleStatus(vehicle) === status).length;
  }

}
