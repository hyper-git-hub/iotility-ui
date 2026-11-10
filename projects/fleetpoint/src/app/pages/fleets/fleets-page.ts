import { PluralPipe } from '@iotility/shared-ui';
import { Component, ElementRef, OnDestroy, OnInit, ViewChild, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Dropdown, DropdownOption, Skeleton } from '@iotility/shared-ui';
import { finalize } from 'rxjs';
import { ProgressBar } from '../../shared/progress-bar/progress-bar';
import {
  FleetInventoryApiService,
  FleetInventoryRecord,
} from '../../shared/services/fleet-inventory-api.service';
import { StatCard } from '../../shared/stat-card/stat-card';
import { FleetForm } from './fleet-form/fleet-form';
import { FeedbackDialogBridgeService } from '../../shared/services/feedback-dialog-bridge.service';

/** A fleet card, straight from the API. A value it doesn't send is null and shows as '—'. */
interface FleetSummary {
  id: number;
  name: string;
  color: string;
  vehicles: number | null;
  drivers: number | null;
  activeVehicles: number | null;
  alertVehicles: number;
  avgFuel: string;
  description: string;
  safetyScore: number | null;
  fuelEfficiency: number | null;
  utilisation: number | null;
  location: string;
  vehicleIds: Array<{ id?: number; label: string; state: 'alert' | 'online' | 'offline' }>;
}

/** A whole-number count or percentage from the API, or null when it isn't a number. */
function apiNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number) : null;
}

@Component({
  selector: 'app-fleets-page',
  imports: [PluralPipe, Dropdown, FleetForm, ProgressBar, Skeleton, StatCard],
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
  protected readonly formOpen = signal(false);
  protected readonly fleets = signal<FleetSummary[]>([]);
  protected readonly fleetRecords = signal<FleetInventoryRecord[]>([]);
  protected readonly selectedFleet = signal<FleetInventoryRecord | null>(null);
  /** `total_fleet_count`, `total_vehicle_count` and `total_driver_count`; null shows as '—'. */
  protected readonly total = signal<number | null>(null);
  protected readonly totalVehicles = signal<number | null>(null);
  protected readonly totalDrivers = signal<number | null>(null);
  protected readonly offset = signal(0);
  protected readonly limit = 10;
  /** Vehicles in alert (`live_status` "Alert") across the fleets loaded so far. */
  protected readonly totalAlerts = computed(
    () => this.fleets().reduce((total, fleet) => total + fleet.alertVehicles, 0),
  );
  protected readonly hasMore = computed(() => this.fleets().length < (this.total() ?? 0));

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
          this.total.set(apiNumber(response.data?.total_fleet_count));
          this.totalVehicles.set(apiNumber(response.data?.total_vehicle_count));
          this.totalDrivers.set(apiNumber(response.data?.total_driver_count));
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
  protected trackFleet(fleet: FleetSummary): void {
    void this.router.navigate(['/fleetpoint/live-tracking'], {
      queryParams: { fleet_id: fleet.id },
    });
  }
  protected openVehicle(id?: number): void {
    if (id == null) return;
    void this.router.navigate(['/fleetpoint/vehicles', id]);
  }
  protected handleFleetAction(action: DropdownOption, fleet: FleetSummary): void {
    if (action.id === 'view') {
      this.trackFleet(fleet);
      return;
    }
    this.selectedFleet.set(this.fleetRecords().find((record) => record.id === fleet.id) ?? null);
    this.formOpen.set(true);
  }

  /** Bar colour for a score; no colour (an empty track) without one. */
  protected scoreClass(score: number | null): string {
    if (score === null) return '';
    return score >= 85 ? 'score-high' : score >= 70 ? 'score-medium' : 'score-low';
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
    const avgFuel = apiNumber(fleet.avg_fuel);
    return {
      id: fleet.id,
      name: fleet.name,
      color: colors[index % colors.length],
      vehicles: apiNumber(fleet.total_vehicles),
      drivers: apiNumber(fleet.total_drivers),
      // Counted from the fleet's own vehicle list; '—' when the API sends no list.
      activeVehicles: fleet.assigned_vehicles
        ? assignedVehicles.filter((vehicle) => vehicle.online_status).length
        : null,
      alertVehicles: assignedVehicles.filter(
        (vehicle) => vehicle.live_status?.toLowerCase() === 'alert',
      ).length,
      avgFuel: avgFuel === null ? '—' : `${avgFuel}%`,
      description: fleet.category || fleet.customer_name || '—',
      safetyScore: apiNumber(fleet.safety_score),
      fuelEfficiency: apiNumber(fleet.fuel_efficiency),
      utilisation: apiNumber(fleet.utilisation),
      location:
        assignedVehicles.find((vehicle) => vehicle.location)?.location || '—',
      vehicleIds: assignedVehicles.map((vehicle) => ({
        id: vehicle.id,
        label: vehicle.registration || vehicle.name || String(vehicle.id),
        state:
          vehicle.live_status?.toLowerCase() === 'alert'
            ? 'alert'
            : vehicle.online_status
              ? 'online'
              : 'offline',
      })),
    };
  }
}
