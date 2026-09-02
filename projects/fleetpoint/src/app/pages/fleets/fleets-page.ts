import { Component, ElementRef, OnDestroy, OnInit, ViewChild, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Dropdown, DropdownOption, Skeleton, StatCardSkeleton } from '@iotility/shared-ui';
import { finalize } from 'rxjs';
import { ProgressBar } from '../../shared/progress-bar/progress-bar';
import {
  FleetInventoryApiService,
  FleetInventoryRecord,
} from '../../shared/services/fleet-inventory-api.service';
import { StatCard } from '../../shared/stat-card/stat-card';
import { FleetForm } from './fleet-form/fleet-form';
import { FeedbackDialogBridgeService } from '../../shared/services/feedback-dialog-bridge.service';

interface FleetSummary {
  id: number;
  name: string;
  color: string;
  vehicles: number;
  drivers: number;
  activeVehicles: number;
  alertVehicles: number;
  avgFuel: string;
  description: string;
  safetyScore: number;
  fuelEfficiency: number;
  utilisation: number;
  location: string;
  vehicleIds: Array<{ label: string; state: 'alert' | 'online' | 'offline' }>;
}

@Component({
  selector: 'app-fleets-page',
  imports: [Dropdown, FleetForm, ProgressBar, Skeleton, StatCard, StatCardSkeleton],
  templateUrl: './fleets-page.html',
  styleUrl: './fleets-page.css',
})
export class FleetsPage implements OnInit, OnDestroy {
  private loadMoreObserver?: IntersectionObserver;

  @ViewChild('loadMoreSentinel')
  set loadMoreSentinel(element: ElementRef<HTMLElement> | undefined) {
    this.loadMoreObserver?.disconnect();
    if (!element || typeof IntersectionObserver === 'undefined') return;
    this.loadMoreObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) this.loadMore();
      },
      { rootMargin: '160px 0px', threshold: 0.01 },
    );
    this.loadMoreObserver.observe(element.nativeElement);
  }
  protected readonly fleetActions: DropdownOption[] = [
    { id: 'view', label: 'View on Map', icon: 'view' },
    { id: 'edit', label: 'Edit Fleet', icon: 'edit' },
  ];
  protected readonly loading = signal(true);
  protected readonly loadingMore = signal(false);
  protected readonly hasLoaded = signal(false);
  protected readonly initialLoading = computed(() => this.loading() && !this.hasLoaded());
  protected readonly refreshing = computed(() => this.loading() && this.hasLoaded());
  protected readonly error = signal('');
  protected readonly fleetSkeletons = Array.from({ length: 2 });
  protected readonly kpiSkeletons = Array.from({ length: 4 });
  protected readonly formOpen = signal(false);
  protected readonly fleets = signal<FleetSummary[]>([]);
  protected readonly fleetRecords = signal<FleetInventoryRecord[]>([]);
  protected readonly selectedFleet = signal<FleetInventoryRecord | null>(null);
  protected readonly total = signal(0);
  protected readonly offset = signal(0);
  protected readonly limit = 10;
  protected readonly totalVehicles = computed(() =>
    this.fleets().reduce((total, fleet) => total + fleet.vehicles, 0),
  );
  protected readonly totalDrivers = computed(() =>
    this.fleets().reduce((total, fleet) => total + fleet.drivers, 0),
  );
  protected readonly totalAlerts = computed(
    () => this.fleets().reduce((total, fleet) => total + fleet.alertVehicles, 0),
  );
  protected readonly hasMore = computed(() => this.fleets().length < this.total());

  constructor(
      private readonly api: FleetInventoryApiService,
      private readonly router: Router,
      private readonly feedback: FeedbackDialogBridgeService,
  ) {}

  ngOnInit(): void {
    this.loadFleets();
  }

  ngOnDestroy(): void {
    this.loadMoreObserver?.disconnect();
  }

  protected loadFleets(append = false, requestOffset = this.offset()): void {
    if (append) {
      this.loadingMore.set(true);
    } else {
      this.loading.set(true);
    }
    this.error.set('');
    this.api
      .getFleets({
        limit: this.limit,
        offset: requestOffset,
        id: '',
        search: '',
      })
      .pipe(finalize(() => {
        if (append) {
          this.loadingMore.set(false);
        } else {
          this.loading.set(false);
          this.hasLoaded.set(true);
        }
      }))
      .subscribe({
        next: (response) => {
          const records = response.data?.data ?? [];
          const previousRecords = append ? this.fleetRecords() : [];
          const previousFleets = append ? this.fleets() : [];
          this.fleetRecords.set([...previousRecords, ...records]);
          this.fleets.set([
            ...previousFleets,
            ...records.map((fleet, index) => this.toFleet(fleet, previousFleets.length + index)),
          ]);
          this.offset.set(requestOffset);
          this.total.set(response.data?.count ?? 0);
        },
        error: (response) => {
          const message = response.error?.message || 'Fleet data could not be loaded.';
          this.error.set(message);
          void this.feedback.open({ type: 'error', title: 'Unable to load fleets', message, confirmText: 'Close', showCancel: false });
        },
      });
  }

  protected loadMore(): void {
    if (!this.loadingMore() && this.hasMore()) {
      this.loadFleets(true, this.fleets().length);
    }
  }
  protected openCreate(): void {
    this.selectedFleet.set(null);
    this.formOpen.set(true);
  }
  protected closeForm(): void {
    this.formOpen.set(false);
    this.selectedFleet.set(null);
  }
  protected fleetSaved(): void {
    this.closeForm();
    this.offset.set(0);
    this.loadFleets();
  }
  protected trackFleet(): void {
    void this.router.navigateByUrl('/fleetpoint/live-tracking');
  }
  protected handleFleetAction(action: DropdownOption, fleet: FleetSummary): void {
    if (action.id === 'view') {
      this.trackFleet();
      return;
    }
    this.selectedFleet.set(this.fleetRecords().find((record) => record.id === fleet.id) ?? null);
    this.formOpen.set(true);
  }

  private toFleet(fleet: FleetInventoryRecord, index: number): FleetSummary {
    const colors = [
      'var(--color-brand-500)',
      'var(--color-info)',
      'var(--color-success)',
      'var(--color-warning)',
      'var(--color-danger)',
    ];
    const assignedVehicles = fleet.assigned_vehicles ?? [];
    const driverIds = new Set(
      assignedVehicles.flatMap((vehicle) =>
        (vehicle.associated_drivers_name ?? [])
          .map((driver) => driver.driver_id)
          .filter((id): id is number => id != null),
      ),
    );
    const mileageValues = assignedVehicles
      .map((vehicle) => Number.parseFloat(vehicle.mileage ?? ''))
      .filter(Number.isFinite);
    const allocatedVehicles = assignedVehicles.filter((vehicle) => vehicle.device_allocation).length;
    const staticScores = [78, 82, 88, 74, 91];
    const staticFuelEfficiency = [72, 76, 85, 69, 88];

    return {
      id: fleet.id,
      name: fleet.name,
      color: colors[index % colors.length],
      vehicles: fleet.total_vehicles || 0,
      drivers: driverIds.size,
      activeVehicles: assignedVehicles.filter((vehicle) => vehicle.online_status).length,
      alertVehicles: assignedVehicles.filter((vehicle) => (vehicle.total_violations ?? 0) > 0)
        .length,
      avgFuel: mileageValues.length
        ? `${(mileageValues.reduce((sum, value) => sum + value, 0) / mileageValues.length).toFixed(1)} km/L`
        : 'Not available',
      description: 'Fleet operations and assigned vehicles',
      safetyScore: staticScores[index % staticScores.length],
      fuelEfficiency: staticFuelEfficiency[index % staticFuelEfficiency.length],
      utilisation: fleet.total_vehicles
        ? Math.round((allocatedVehicles / fleet.total_vehicles) * 100)
        : 0,
      location:
        assignedVehicles.find((vehicle) => vehicle.location)?.location || 'Main operations depot',
      vehicleIds: assignedVehicles.map((vehicle) => ({
        label: vehicle.registration || vehicle.name || String(vehicle.id),
        state:
          (vehicle.total_violations ?? 0) > 0
            ? 'alert'
            : vehicle.online_status
              ? 'online'
              : 'offline',
      })),
    };
  }
}
