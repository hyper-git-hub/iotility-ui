import { Component, OnInit, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { BlockingLoader, DataTable, TableAction, TableColumn, TableRow } from '@iotility/shared-ui';
import { finalize, forkJoin } from 'rxjs';
import {
  InventoryOption,
  VehicleInventoryApiService,
  VehicleInventoryFilters,
  VehicleInventoryRecord,
} from '../../shared/services/vehicle-inventory-api.service';
import { VehicleForm, VehicleFormValue } from './vehicle-form/vehicle-form';

@Component({
  selector: 'app-vehicles-page',
  imports: [BlockingLoader, DataTable, VehicleForm],
  templateUrl: './vehicles-page.html',
  styleUrl: './vehicles-page.css',
})
export class VehiclesPage implements OnInit {
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly formOpen = signal(false);
  protected readonly total = signal(0);
  protected readonly records = signal<VehicleInventoryRecord[]>([]);
  protected readonly fleetOptions = signal<InventoryOption[]>([]);
  protected readonly vehicleOptions = signal<InventoryOption[]>([]);
  protected readonly search = signal('');
  protected readonly fleetId = signal('');
  protected readonly vehicleId = signal('');
  protected readonly status = signal('');
  protected readonly offset = signal(0);
  protected readonly limit = 10;
  protected readonly tableActions: TableAction[] = ['map', 'history', 'edit'];
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

  constructor(private readonly api: VehicleInventoryApiService, private readonly router: Router) {}

  ngOnInit(): void {
    forkJoin({ fleets: this.api.getFleetOptions(), vehicles: this.api.getVehicleOptions() }).subscribe({
      next: ({ fleets, vehicles }) => {
        this.fleetOptions.set((fleets.data?.data ?? []).filter((item) => item.status === undefined || item.status === 1));
        this.vehicleOptions.set((vehicles.data?.data ?? []).filter((item) => item.status === undefined || item.status === 1));
      },
    });
    this.loadVehicles();
  }

  protected loadVehicles(): void {
    this.loading.set(true);
    this.error.set('');
    this.api.getVehicles(this.filters()).pipe(finalize(() => this.loading.set(false))).subscribe({
      next: (response) => {
        this.records.set(response.data?.data ?? []);
        this.total.set(response.data?.count ?? 0);
      },
      error: (response) => this.error.set(response.error?.message || 'Vehicle inventory could not be loaded.'),
    });
  }

  protected applyFilters(): void { this.offset.set(0); this.loadVehicles(); }
  protected resetFilters(): void {
    this.search.set(''); this.fleetId.set(''); this.vehicleId.set(''); this.status.set(''); this.offset.set(0);
    this.loadVehicles();
  }
  protected updateSearch(event: Event): void { this.search.set((event.target as HTMLInputElement).value); }
  protected updateFleet(event: Event): void { this.fleetId.set((event.target as HTMLSelectElement).value); }
  protected updateVehicle(event: Event): void { this.vehicleId.set((event.target as HTMLSelectElement).value); }
  protected updateStatus(event: Event): void { this.status.set((event.target as HTMLSelectElement).value); }
  protected previousPage(): void { this.offset.update((value) => Math.max(0, value - this.limit)); this.loadVehicles(); }
  protected nextPage(): void { if (this.offset() + this.limit < this.total()) { this.offset.update((value) => value + this.limit); this.loadVehicles(); } }

  protected addVehicle(_: VehicleFormValue): void { this.formOpen.set(false); this.loadVehicles(); }
  protected handleRowAction(event: { action: TableAction; row: TableRow }): void {
    if (event.action === 'map') void this.router.navigateByUrl('/fleetpoint/live-tracking');
    else if (event.action === 'history') void this.router.navigateByUrl('/fleetpoint/trip-replay');
    else this.formOpen.set(true);
  }
  protected openVehicle(row: TableRow): void { void this.router.navigate(['/fleetpoint/vehicles', row['id']]); }

  private filters(): VehicleInventoryFilters {
    return { limit: this.limit, offset: this.offset(), search: this.search().trim(), fleetId: this.fleetId(), vehicleId: this.vehicleId(), status: this.status() };
  }

  private vehicleImage(image: string | null): string {
    const value = image?.trim();
    return value && !['none', 'null', 'no image', 'n/a'].includes(value.toLowerCase())
      ? value
      : 'assets/fleetpoint/vehicle.svg';
  }
}
