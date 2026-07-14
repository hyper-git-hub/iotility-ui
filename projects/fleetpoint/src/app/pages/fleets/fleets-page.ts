import { Component, OnInit, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { BlockingLoader, Dropdown, DropdownOption } from '@iotility/shared-ui';
import { finalize } from 'rxjs';
import { FleetInventoryApiService, FleetInventoryRecord } from '../../shared/services/fleet-inventory-api.service';
import { InventoryOption } from '../../shared/services/vehicle-inventory-api.service';
import { StatCard } from '../../shared/stat-card/stat-card';
import { FleetForm, FleetFormValue } from './fleet-form/fleet-form';

interface FleetSummary {
  id: number;
  name: string;
  color: string;
  vehicles: number;
  status: string;
  customer: string;
  modifiedBy: string;
  createdAt: string;
  updatedAt: string;
  vehicleIds: string[];
}

@Component({
  selector: 'app-fleets-page',
  imports: [BlockingLoader, Dropdown, FleetForm, StatCard],
  templateUrl: './fleets-page.html',
  styleUrl: './fleets-page.css',
})
export class FleetsPage implements OnInit {
  protected readonly fleetActions: DropdownOption[] = [
    { id: 'view', label: 'View on Map', icon: 'view' },
    { id: 'edit', label: 'Edit Fleet', icon: 'edit' },
  ];
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly formOpen = signal(false);
  protected readonly fleets = signal<FleetSummary[]>([]);
  protected readonly fleetOptions = signal<InventoryOption[]>([]);
  protected readonly fleetFilterOptions = computed<DropdownOption[]>(() => [
    { id: '', label: 'All fleets' },
    ...this.fleetOptions().map((fleet) => ({ id: String(fleet.id), label: fleet.name || `Fleet ${fleet.id}` })),
  ]);
  protected readonly total = signal(0);
  protected readonly search = signal('');
  protected readonly selectedFleetId = signal('');
  protected readonly offset = signal(0);
  protected readonly limit = 10;
  protected readonly totalVehicles = computed(() => this.fleets().reduce((total, fleet) => total + fleet.vehicles, 0));
  protected readonly activeFleets = computed(() => this.fleets().filter((fleet) => fleet.status === 'Active').length);
  protected readonly inactiveFleets = computed(() => this.fleets().filter((fleet) => fleet.status === 'Inactive').length);
  protected readonly pageStart = computed(() => this.total() ? this.offset() + 1 : 0);
  protected readonly pageEnd = computed(() => Math.min(this.offset() + this.limit, this.total()));

  constructor(private readonly api: FleetInventoryApiService, private readonly router: Router) {}

  ngOnInit(): void {
    this.api.getFleetOptions().subscribe({ next: (response) => this.fleetOptions.set(response.data?.data ?? []) });
    this.loadFleets();
  }

  protected loadFleets(): void {
    this.loading.set(true);
    this.error.set('');
    this.api.getFleets({ limit: this.limit, offset: this.offset(), id: this.selectedFleetId(), search: this.search().trim() })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (response) => {
          this.fleets.set((response.data?.data ?? []).map((fleet, index) => this.toFleet(fleet, index)));
          this.total.set(response.data?.count ?? 0);
        },
        error: (response) => this.error.set(response.error?.message || 'Fleet data could not be loaded.'),
      });
  }

  protected updateSearch(event: Event): void { this.search.set((event.target as HTMLInputElement).value); }
  protected selectFleetFilter(option: DropdownOption): void { this.selectedFleetId.set(option.id); }
  protected selectedFleetLabel(): string { return this.fleetFilterOptions().find((option) => option.id === this.selectedFleetId())?.label || 'All fleets'; }
  protected applyFilters(): void { this.offset.set(0); this.loadFleets(); }
  protected resetFilters(): void { this.search.set(''); this.selectedFleetId.set(''); this.offset.set(0); this.loadFleets(); }
  protected previousPage(): void { this.offset.update((value) => Math.max(0, value - this.limit)); this.loadFleets(); }
  protected nextPage(): void { if (this.offset() + this.limit < this.total()) { this.offset.update((value) => value + this.limit); this.loadFleets(); } }
  protected createFleet(_: FleetFormValue): void { this.formOpen.set(false); this.loadFleets(); }
  protected trackFleet(): void { void this.router.navigateByUrl('/fleetpoint/live-tracking'); }
  protected handleFleetAction(action: DropdownOption): void { action.id === 'view' ? this.trackFleet() : this.formOpen.set(true); }

  private toFleet(fleet: FleetInventoryRecord, index: number): FleetSummary {
    const colors = ['var(--color-brand-500)', 'var(--color-info)', 'var(--color-success)', 'var(--color-warning)', 'var(--color-danger)'];
    return {
      id: fleet.id,
      name: fleet.name,
      color: colors[index % colors.length],
      vehicles: fleet.total_vehicles || 0,
      status: fleet.status === 1 ? 'Active' : 'Inactive',
      customer: fleet.customer_name || 'Not available',
      modifiedBy: fleet.modified_by_user || 'Not available',
      createdAt: fleet.created_at || 'Not available',
      updatedAt: fleet.updated_at || 'Not available',
      vehicleIds: (fleet.assigned_vehicles ?? []).map((vehicle) => vehicle.registration || vehicle.name || String(vehicle.id)),
    };
  }
}
