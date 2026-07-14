import { Component, OnInit, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { BlockingLoader, DataTable, Dropdown, DropdownOption, TableAction, TableColumn, TableRow } from '@iotility/shared-ui';
import { finalize, forkJoin } from 'rxjs';
import {
  InventoryOption,
  VehicleInventoryApiService,
  VehicleInventoryFilters,
  VehicleInventoryRecord,
} from '../../shared/services/vehicle-inventory-api.service';
import { VehicleForm, VehicleFormValue } from './vehicle-form/vehicle-form';
import { FeedbackDialogBridgeService } from '../../shared/services/feedback-dialog-bridge.service';

@Component({
  selector: 'app-vehicles-page',
  imports: [BlockingLoader, DataTable, Dropdown, VehicleForm],
  templateUrl: './vehicles-page.html',
  styleUrl: './vehicles-page.css',
})
export class VehiclesPage implements OnInit {
  private searchTimer?: ReturnType<typeof setTimeout>;
  protected readonly loading = signal(true);
  protected readonly actionLoading = signal(false);
  protected readonly error = signal('');
  protected readonly formOpen = signal(false);
  protected readonly total = signal(0);
  protected readonly records = signal<VehicleInventoryRecord[]>([]);
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
  protected readonly offset = signal(0);
  protected readonly limit = 10;
  protected readonly tableActions: TableAction[] = ['map', 'history', 'edit', 'delete'];
  protected readonly columns: TableColumn[] = [
    { key: 'registration', label: 'Vehicle', type: 'vehicle', secondaryKey: 'makeModel', imageKey: 'image' },
    { key: 'fleet', label: 'Fleet', type: 'fleet' },
    { key: 'status', label: 'Status', type: 'status' },
    { key: 'device', label: 'Device ID' },
    { key: 'odometer', label: 'Odometer' },
    { key: 'owner', label: 'Owner' },
    { key: 'commissioned', label: 'Commissioned' },
    { key: 'expiry', label: 'Registration Expiry' },
    { key: 'actions', label: 'Actions', type: 'actions' },
  ];
  protected readonly vehicles = computed<TableRow[]>(() => this.records().map((vehicle) => ({
    id: vehicle.id,
    image: this.vehicleImage(vehicle.image),
    registration: vehicle.registration || vehicle.name,
    makeModel: `${vehicle.year || ''} ${vehicle.make || ''} ${vehicle.model || ''}`.trim() || 'Details unavailable',
    fleet: vehicle.fleet_name || 'Unassigned',
    fleetColor: vehicle.fleet_name ? 'var(--color-brand-600)' : 'var(--color-muted)',
    status: vehicle.status === 1 ? 'Active' : 'Inactive',
    device: vehicle.device_id || 'Not assigned',
    odometer: `${Number(vehicle.odo_reading || 0).toLocaleString()} km`,
    owner: vehicle.owner || 'Not available',
    commissioned: vehicle.date_commissioned || 'Not available',
    expiry: vehicle.expiry_date || 'Not available',
    actions: '',
  })));
  protected readonly active = computed(() => this.records().filter((vehicle) => vehicle.status === 1).length);
  protected readonly inactive = computed(() => this.records().filter((vehicle) => vehicle.status !== 1).length);
  protected readonly unassigned = computed(() => this.records().filter((vehicle) => !vehicle.fleet_name).length);
  protected readonly pageStart = computed(() => this.total() ? this.offset() + 1 : 0);
  protected readonly pageEnd = computed(() => Math.min(this.offset() + this.limit, this.total()));

  constructor(private readonly api: VehicleInventoryApiService, private readonly router: Router, private readonly feedback: FeedbackDialogBridgeService) {}

  ngOnInit(): void {
    forkJoin({ fleets: this.api.getFleetOptions(), categories: this.api.getCategoryOptions(), vehicleTypes: this.api.getVehicleTypeOptions() }).subscribe({
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
    this.api.getVehicles(this.filters()).pipe(finalize(() => { if (showLoader) this.loading.set(false); })).subscribe({
      next: (response) => {
        this.records.set(response.data?.data ?? []);
        this.total.set(response.data?.count ?? 0);
      },
      error: (response) => this.error.set(response.error?.message || 'Vehicle inventory could not be loaded.'),
    });
  }

  protected applyFilters(): void { this.offset.set(0); this.loadVehicles(); }
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
  protected selectFleet(option: DropdownOption): void { this.fleetId.set(option.id); this.categoryId.set(''); this.loadCategories(option.id); }
  protected selectCategory(option: DropdownOption): void { this.categoryId.set(option.id); }
  protected selectVehicleType(option: DropdownOption): void { this.vehicleTypeId.set(option.id); }
  protected selectedLabel(options: DropdownOption[], id: string, fallback: string): string { return options.find((option) => option.id === id)?.label || fallback; }
  protected previousPage(): void { this.offset.update((value) => Math.max(0, value - this.limit)); this.loadVehicles(); }
  protected nextPage(): void { if (this.offset() + this.limit < this.total()) { this.offset.update((value) => value + this.limit); this.loadVehicles(); } }

  protected addVehicle(_: VehicleFormValue): void { this.formOpen.set(false); this.loadVehicles(false); }
  protected handleRowAction(event: { action: TableAction; row: TableRow }): void {
    if (event.action === 'map') void this.router.navigateByUrl('/fleetpoint/live-tracking');
    else if (event.action === 'history') void this.router.navigateByUrl('/fleetpoint/trip-replay');
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
      next: () => { this.actionLoading.set(false); if (this.records().length === 1 && this.offset() > 0) this.offset.update((value) => Math.max(0, value - this.limit)); this.loadVehicles(false); void this.feedback.open({ type: 'success', title: 'Vehicle deleted', message: `${registration} was deleted successfully.`, confirmText: 'Done', showCancel: false }); },
      error: (response) => { this.actionLoading.set(false); const message = response.error?.message || 'Vehicle could not be deleted.'; this.error.set(message); void this.feedback.open({ type: 'error', title: 'Unable to delete vehicle', message, confirmText: 'Close', showCancel: false }); },
    });
  }

  private loadCategories(fleetId = ''): void { this.api.getCategoryOptions(fleetId).subscribe({ next: (response) => this.categoryOptions.set(response.data?.data ?? []) }); }

  private vehicleImage(image: string | null): string {
    const value = image?.trim();
    return value && !['none', 'null', 'no image', 'n/a'].includes(value.toLowerCase())
      ? value
      : 'assets/fleetpoint/vehicle.svg';
  }
}
