import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnDestroy,
  OnInit,
  computed,
  effect,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Dropdown, DropdownOption, Skeleton, StatusBadge } from '@iotility/shared-ui';
import { EMPTY, Subscription, catchError, filter, finalize, interval, switchMap, timer } from 'rxjs';
import {
  FleetMap,
  MapZoneOverlay,
  TrackedVehicle,
  VehicleStatus,
} from '../../shared/fleet-map/fleet-map';
import { SearchOverlay } from '../../shared/map-overlays/search-overlay';
import { VehicleLegend } from '../../shared/map-overlays/vehicle-legend';
import { FullscreenUiService } from '../../shared/services/fullscreen-ui.service';
import {
  GeoZoneRecord,
  LiveTrackingApiService,
  RealtimeVehicleRecord,
} from '../../shared/services/live-tracking-api.service';
import { FleetStatusService } from '../../shared/services/fleet-status.service';
import {
  VehicleRealtimeService,
  VehicleRealtimeUpdate,
} from '../../shared/services/vehicle-realtime.service';
import { VehicleTelemetryStreamService } from '../../shared/services/vehicle-telemetry-stream.service';
import { environment } from '../../../environments/environment';
import { VehicleDetailApiService } from '../../shared/services/vehicle-detail-api.service';
import { AllocationForm } from '../drivers/allocation-form/allocation-form';
import { FeedbackDialogBridgeService } from '../../shared/services/feedback-dialog-bridge.service';
import {
  FleetInventoryApiService,
  FleetInventoryRecord,
} from '../../shared/services/fleet-inventory-api.service';

interface LiveVehicle extends TrackedVehicle {
  numericId: number;
  deviceId: string;
  image: string | null;
  seatBelt: boolean;
  ignition: boolean;
  battery: number | null;
  lastSignalAt: number | null;
  kmPerDay: number;
}

type InventoryVehicle = NonNullable<FleetInventoryRecord['assigned_vehicles']>[number];

/** Precomputed list row, so the per-second clock tick doesn't recompute display values for every row. */
interface VehicleRow {
  vehicle: LiveVehicle;
  image: string;
  details: string;
  state: string;
  stateClass: string;
}

/** Positions in the vehicle array per packet key, so a packet finds its vehicle without a scan. */
interface VehicleIndex {
  byId: Map<string, number[]>;
  byDevice: Map<string, number[]>;
  byRegistration: Map<string, number[]>;
}

interface TrackingDriver {
  id: string;
  name: string;
  initials: string;
  role: string;
  vehicle: string;
  vehicleId: number | null;
  trips: number;
  distance: number;
  rating: number;
  status: 'online' | 'idling';
}

@Component({
  selector: 'app-live-tracking-page',
  imports: [
    Dropdown,
    Skeleton,
    FleetMap,
    AllocationForm,
    SearchOverlay,
    StatusBadge,
    VehicleLegend,
  ],
  templateUrl: './live-tracking-page.html',
  styleUrl: './live-tracking-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LiveTrackingPage implements OnInit, OnDestroy {
  private readonly vehiclesLoading = signal(true);
  private readonly fleetsLoading = signal(true);
  protected readonly loading = computed(() => this.vehiclesLoading() || this.fleetsLoading());
  protected readonly mapLoaded = signal(false);
  protected readonly error = signal('');
  protected readonly search = signal('');
  protected readonly statusFilter = signal<VehicleStatus | 'All'>('All');
  protected readonly driverSearch = signal('');
  protected readonly driverStatusFilter = signal<VehicleStatus | 'All'>('All');
  protected readonly selectedFleet = signal('all');
  protected readonly trackingView = signal<'vehicles' | 'drivers'>('vehicles');
  protected readonly fleetRecords = signal<FleetInventoryRecord[]>([]);
  protected readonly selectedVehicle = signal<LiveVehicle | null>(null);
  protected readonly liveTrackingEnabled = signal(false);
  protected readonly allocationOpen = signal(false);
  protected readonly now = signal(Date.now());
  protected readonly vehicles = signal<LiveVehicle[]>([]);
  protected readonly zones = signal<MapZoneOverlay[]>([]);
  protected readonly isFullscreen = computed(() => this.fullscreenUi.isFullscreen());
  protected readonly fullscreenTrackingState = signal<'idle' | 'enabling' | 'waiting' | 'active'>(
    'idle',
  );
  protected readonly isFullscreenTrackingEnabling = computed(
    () => this.fullscreenTrackingState() === 'enabling',
  );
  protected readonly isFullscreenTrackingWaiting = computed(
    () => this.fullscreenTrackingState() === 'waiting',
  );
  protected readonly isFullscreenTrackingActive = computed(
    () => this.fullscreenTrackingState() === 'active',
  );
  protected readonly filters: Array<VehicleStatus | 'All'> = [
    'All',
    'Moving',
    'Idling',
    'Alert',
    'Offline',
  ];
  protected readonly vehicleSkeletons = Array.from({ length: 8 });
  protected readonly fleetOptions = computed<DropdownOption[]>(() => {
    const fleets = this.fleetRecords();
    const total = fleets.reduce((sum, fleet) => sum + fleet.total_vehicles, 0);
    return [
      { id: 'all', label: `All Fleets (${total} vehicles)` },
      ...fleets.map((fleet) => ({
        id: String(fleet.id),
        label: `${fleet.name} (${fleet.total_vehicles} vehicles)`,
      })),
    ];
  });
  protected readonly selectedFleetRecords = computed(() =>
    this.selectedFleet() === 'all'
      ? this.fleetRecords()
      : this.fleetRecords().filter((fleet) => String(fleet.id) === this.selectedFleet()),
  );
  protected readonly drivers = computed<TrackingDriver[]>(() => {
    const drivers = this.selectedFleetRecords().flatMap((fleet) =>
      (fleet.assigned_vehicles ?? []).flatMap((vehicle) => {
        const assignedDrivers = vehicle.associated_drivers_name?.length
          ? vehicle.associated_drivers_name
          : vehicle.vehicle_driver_name
            ? [{ driver_name: vehicle.vehicle_driver_name }]
            : [];
        return assignedDrivers.map((driver, index) => {
          const name = driver.driver_name?.trim() || '—';
          const staticIndex = Math.abs(Number(driver.driver_id ?? vehicle.id ?? index)) % 5;
          return {
            id: String(driver.driver_id ?? `${vehicle.id ?? vehicle.registration}-${index}`),
            name,
            initials: name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase(),
            role: fleet.name || '—',
            vehicle: vehicle.registration || vehicle.name || '—',
            vehicleId: vehicle.id ?? null,
            trips: [7, 12, 5, 11, 6][staticIndex],
            distance: [289, 187, 198, 156, 267][staticIndex],
            rating: [91, 96, 72, 89, 83][staticIndex],
            status: vehicle.online_status ? 'online' as const : 'idling' as const,
          };
        });
      }),
    );
    return drivers;
  });
  /** Live status per vehicle id, so driver filtering is a lookup instead of a scan per driver. */
  private readonly vehicleStatusById = computed(
    () => new Map(this.vehicles().map((vehicle) => [vehicle.numericId, vehicle.status])),
  );
  /** Fleet inventory records by vehicle id and by registration (first record wins, as a scan would). */
  private readonly inventoryIndex = computed(() => {
    const byId = new Map<number, InventoryVehicle>();
    const byRegistration = new Map<string, InventoryVehicle>();
    for (const record of this.fleetRecords().flatMap((fleet) => fleet.assigned_vehicles ?? [])) {
      if (record.id != null && !byId.has(record.id)) byId.set(record.id, record);
      if (record.registration && !byRegistration.has(record.registration)) byRegistration.set(record.registration, record);
    }
    return { byId, byRegistration };
  });
  /** Status chips filter drivers by the live status of their assigned vehicle. */
  protected driverVehicleStatus(driver: TrackingDriver): VehicleStatus {
    return (driver.vehicleId !== null && this.vehicleStatusById().get(driver.vehicleId)) || 'Offline';
  }
  protected readonly filteredDrivers = computed(() => {
    const query = this.driverSearch().trim().toLowerCase();
    const status = this.driverStatusFilter();
    return this.drivers().filter(
      (driver) =>
        (status === 'All' || this.driverVehicleStatus(driver) === status) &&
        (!query ||
          `${driver.name} ${driver.role} ${driver.vehicle}`.toLowerCase().includes(query)),
    );
  });
  /** Rebuilt only when the fleet selection or inventory changes, not on every realtime tick. */
  private readonly fleetVehicleIds = computed(
    () =>
      new Set(
        this.selectedFleetRecords().flatMap((fleet) =>
          (fleet.assigned_vehicles ?? []).map((vehicle) => vehicle.id),
        ),
      ),
  );
  /** Lower-cased search text per vehicle object; a realtime update replaces the object, so entries never go stale. */
  private readonly searchText = new WeakMap<LiveVehicle, string>();
  protected readonly filteredVehicles = computed(() => {
    const query = this.search().trim().toLowerCase();
    const allFleets = this.selectedFleet() === 'all';
    const fleetVehicleIds = this.fleetVehicleIds();
    const status = this.statusFilter();
    return this.vehicles().filter(
      (vehicle) =>
        (allFleets || fleetVehicleIds.has(vehicle.numericId)) &&
        (status === 'All' || vehicle.status === status) &&
        (!query || this.vehicleSearchText(vehicle).includes(query)),
    );
  });
  /**
   * Display values per row, cached per vehicle object: realtime updates replace only the
   * vehicles they touch, so untouched rows keep their model and the template only reads fields.
   */
  private rowCache = new WeakMap<LiveVehicle, VehicleRow>();
  private rowCacheIndex?: object;
  protected readonly vehicleRows = computed<VehicleRow[]>(() => {
    const index = this.inventoryIndex();
    if (index !== this.rowCacheIndex) {
      this.rowCache = new WeakMap();
      this.rowCacheIndex = index;
    }
    return this.filteredVehicles().map((vehicle) => {
      let row = this.rowCache.get(vehicle);
      if (!row) {
        row = {
          vehicle,
          image: this.vehicleImage(vehicle.image),
          details: this.vehicleDetails(vehicle),
          state: vehicle.status === 'Moving' ? `${vehicle.speed} km/h` : vehicle.status,
          stateClass: `state-${vehicle.status.toLowerCase()}`,
        };
        this.rowCache.set(vehicle, row);
      }
      return row;
    });
  });
  protected readonly mapVehicles = computed(() =>
    this.filteredVehicles().filter(
      (vehicle) => Number.isFinite(vehicle.lat) && Number.isFinite(vehicle.lng),
    ),
  );
  /**
   * Filter signature handed to the fleet map. Changing a filter that reshapes
   * the visible markers (fleet dropdown, status chips, search) re-frames the
   * camera on the new marker set, instead of leaving the zoom where the
   * previously focused vehicle was. Realtime updates keep this key stable, so
   * they never move the camera.
   */
  protected readonly mapFilterKey = computed(
    () => `${this.selectedFleet()}|${this.statusFilter()}|${this.search().trim().toLowerCase()}`,
  );
  protected readonly badgeClock = computed(() => {
    const date = new Date(this.now());
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  });
  protected readonly liveBadgeLabel = computed(() => {
    const base = `${this.fleetStatus.hasOnlineVehicles() ? 'Live' : 'Offline'} · ${this.badgeClock()}`;
    const count = this.fleetStatus.onlineCount();
    return this.fleetStatus.hasOnlineVehicles() && count > 0
      ? `${base} · ${count} ${count === 1 ? 'vehicle' : 'vehicles'}`
      : base;
  });
  private static readonly LIVE_FRESH_MS = 60_000;
  /** Realtime packets are applied in batches this often (one list/map update per batch). */
  private static readonly REALTIME_FLUSH_MS = 100;
  private pendingUpdates: VehicleRealtimeUpdate[] = [];
  private realtimeFlush?: ReturnType<typeof setTimeout>;
  private vehicleLookup?: { vehicles: LiveVehicle[]; index: VehicleIndex };
  private readonly subscription = new Subscription();
  private readonly apiSnapshots = new Map<number, LiveVehicle>();
  private readonly realtimeVehicles = new Set<number>();
  private selectionRequest = 0;
  private requestedVehicleId = '';
  private fullscreenTrackingTimeout?: ReturnType<typeof setTimeout>;

  constructor(
    private readonly api: LiveTrackingApiService,
    private readonly fleetApi: FleetInventoryApiService,
    private readonly realtime: VehicleRealtimeService,
    private readonly telemetryStream: VehicleTelemetryStreamService,
    private readonly vehicleDetailApi: VehicleDetailApiService,
    private readonly router: Router,
    private readonly feedback: FeedbackDialogBridgeService,
    private readonly fullscreenUi: FullscreenUiService,
    protected readonly fleetStatus: FleetStatusService,
    route: ActivatedRoute,
  ) {
    const navigationState = router.getCurrentNavigation()?.extras.state ?? history.state;
    this.requestedVehicleId = String(
      navigationState?.['vehicleId'] ?? route.snapshot.queryParamMap.get('vehicle_id') ?? '',
    );
    this.selectedFleet.set(route.snapshot.queryParamMap.get('fleet_id') ?? 'all');
    effect(() => {
      if (!this.isFullscreen() || !this.liveTrackingEnabled() || !this.selectedVehicle()) {
        this.fullscreenTrackingState.set('idle');
        return;
      }
      if (this.fullscreenTrackingState() !== 'enabling') {
        this.fullscreenTrackingState.set(
          this.selectedVehicle()?.lastSignalAt ? 'active' : 'waiting',
        );
      }
    });
  }

  ngOnInit(): void {
    this.loadVehicles();
    this.loadFleets();
    this.subscription.add(
      this.liveSource.updates$.subscribe((update) => this.applyRealtimeUpdate(update)),
    );
    this.subscription.add(interval(1_000).subscribe(() => this.now.set(Date.now())));
    // No device id: the whole fleet over one connection (SSE fleet stream, or
    // the SignalR firehose when the flag is off); packets are matched per vehicle.
    void this.liveSource.connect();
    this.startVehiclePolling();
  }

  /** SSE (hn-iot-realtime-stream) when the flag is on, else SignalR. */
  private get liveSource(): VehicleRealtimeService | VehicleTelemetryStreamService {
    return environment.sseTelemetryEnabled ? this.telemetryStream : this.realtime;
  }

  private loadFleets(): void {
    this.fleetsLoading.set(true);
    this.subscription.add(
      this.fleetApi
        .getFleets({ limit: 100, offset: 0, id: '', search: '' })
        .pipe(finalize(() => this.fleetsLoading.set(false)))
        .subscribe({
          next: (response) => {
            const records = response.data?.data ?? [];
            this.fleetRecords.set(records);
            if (
              this.selectedFleet() !== 'all' &&
              !records.some((fleet) => String(fleet.id) === this.selectedFleet())
            ) {
              this.selectedFleet.set('all');
            }
          },
          error: () => this.fleetRecords.set([]),
        }),
    );
  }

  protected loadVehicles(): void {
    this.vehiclesLoading.set(true);
    this.error.set('');
    this.subscription.add(
      this.api.getGeoZones().subscribe({
        next: (response) =>
          this.zones.set((response.data?.data ?? []).flatMap((zone) => this.toMapZone(zone))),
        error: () => this.zones.set([]),
      }),
    );
    this.api
      .getVehicles()
      .pipe(finalize(() => this.vehiclesLoading.set(false)))
      .subscribe({
        next: (response) => {
          if (response.status !== 1000) {
            this.error.set(response.message || 'Live vehicle data could not be loaded.');
            this.vehicles.set([]);
            return;
          }
          this.updateVehicleSnapshot(response.data?.data ?? []);
          this.selectRequestedVehicle();
        },
        error: (response: HttpErrorResponse) => {
          const message = response.error?.message || 'Live vehicle data could not be loaded.';
          this.error.set(message);
          void this.feedback.open({
            type: 'error',
            title: 'Unable to load live tracking',
            message,
            confirmText: 'Close',
            showCancel: false,
          });
        },
      });
  }

  /* REST fallback only: while the fleet stream is connected it is the live
     source and the vehicle list is not re-fetched. Polls only while the stream
     is down (e.g. the gateway rejects this origin) or SignalR is in use. */
  private startVehiclePolling(): void {
    this.subscription.add(
      timer(30_000, 30_000)
        .pipe(
          filter(() => !(environment.sseTelemetryEnabled && this.telemetryStream.connected())),
          switchMap(() => this.api.getVehicles().pipe(catchError(() => EMPTY))),
        )
        .subscribe((response) => this.updateVehicleSnapshot(response.data?.data ?? [])),
    );
  }

  private updateVehicleSnapshot(records: RealtimeVehicleRecord[]): void {
    const selectedId = this.selectedVehicle()?.numericId;
    const currentVehicles = new Map(this.vehicles().map((vehicle) => [vehicle.numericId, vehicle]));
    const vehicles = records.map((record) => {
      const snapshot = this.toTrackedVehicle(record);
      this.apiSnapshots.set(record.id, snapshot);
      const current = currentVehicles.get(record.id);
      const tracked = this.liveTrackingEnabled() && record.id === selectedId;
      // The fleet stream moves every vehicle, so a fresh live fix outranks the
      // poll's REST position, which would otherwise drag the marker backwards.
      const freshLive = Date.now() - (current?.lastSignalAt ?? 0) < LiveTrackingPage.LIVE_FRESH_MS;
      return current && this.realtimeVehicles.has(record.id) && (tracked || freshLive)
        ? {
            ...snapshot,
            lat: current.lat,
            lng: current.lng,
            speed: current.speed,
            status: current.status,
            ignition: current.ignition,
            battery: current.battery,
            seatBelt: current.seatBelt,
            lastSignalAt: current.lastSignalAt,
            fixTime: current.fixTime,
            updated: current.updated,
          }
        : snapshot;
    });
    this.vehicles.set(vehicles);
    const onlineCount = vehicles.filter((v) => v.status !== 'Offline').length;
    this.fleetStatus.update(vehicles.length, onlineCount);
    if (selectedId !== undefined) {
      this.selectedVehicle.set(
        vehicles.find((vehicle) => vehicle.numericId === selectedId) ?? null,
      );
    }
  }

  protected updateSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }
  protected updateSearchValue(value: string): void {
    this.search.set(value);
  }
  protected updateDriverSearch(event: Event): void {
    this.driverSearch.set((event.target as HTMLInputElement).value);
  }
  protected selectFleet(option: DropdownOption): void {
    this.selectedFleet.set(option.id);
  }
  protected fleetLabel(): string {
    return this.fleetOptions().find((option) => option.id === this.selectedFleet())?.label ?? 'All Fleets';
  }
  protected vehicleDetails(vehicle: LiveVehicle): string {
    const index = this.inventoryIndex();
    const record = index.byId.get(vehicle.numericId) ?? index.byRegistration.get(vehicle.id);
    return [record?.make, record?.model, record?.year].filter(Boolean).join(' · ') || '—';
  }
  private vehicleSearchText(vehicle: LiveVehicle): string {
    let text = this.searchText.get(vehicle);
    if (text === undefined) {
      text = `${vehicle.id} ${vehicle.model} ${vehicle.driver} ${vehicle.location}`.toLowerCase();
      this.searchText.set(vehicle, text);
    }
    return text;
  }
  protected selectDriverVehicle(driver: TrackingDriver): void {
    const vehicle = this.vehicles().find((item) => item.numericId === driver.vehicleId);
    if (vehicle) this.selectVehicle(vehicle);
  }
  protected selectVehicle(vehicle: TrackedVehicle): void {
    if (this.selectedVehicle()?.id === vehicle.id) {
      this.clearSelectedVehicle();
      return;
    }
    const previousId = this.selectedVehicle()?.numericId;
    if (previousId !== undefined) this.restoreApiVehicle(previousId);
    const selected =
      this.vehicles().find((item) => item.id === vehicle.id) ?? (vehicle as LiveVehicle);
    this.liveTrackingEnabled.set(false);
    this.selectedVehicle.set(selected);
    this.resolveSelectedVehicleDevice(selected);
  }

  private selectRequestedVehicle(): void {
    if (!this.requestedVehicleId) return;
    const requested = this.requestedVehicleId;
    this.requestedVehicleId = '';
    const vehicle = this.vehicles().find(
      (item) =>
        String(item.numericId) === requested || item.id.toLowerCase() === requested.toLowerCase(),
    );
    if (vehicle) this.selectVehicle(vehicle);
  }

  protected clearSelectedVehicle(): void {
    this.selectionRequest += 1;
    const selectedId = this.selectedVehicle()?.numericId;
    if (selectedId !== undefined) this.restoreApiVehicle(selectedId);
    this.liveTrackingEnabled.set(false);
    this.selectedVehicle.set(null);
  }

  protected enableLiveTracking(): void {
    const vehicleId = this.selectedVehicle()?.numericId;
    if (vehicleId === undefined) return;
    this.realtimeVehicles.delete(vehicleId);
    this.liveTrackingEnabled.set(true);
  }

  protected toggleLiveTracking(): void {
    this.liveTrackingEnabled() ? this.stopLiveTracking() : this.enableLiveTracking();
  }

  protected onFullscreenVehicleClick(vehicle: TrackedVehicle): void {
    if (this.selectedVehicle()?.id !== vehicle.id) this.selectVehicle(vehicle);
    if (this.liveTrackingEnabled()) {
      this.stopLiveTracking();
      return;
    }
    this.enableLiveTracking();
    this.fullscreenTrackingState.set('enabling');
    clearTimeout(this.fullscreenTrackingTimeout);
    this.fullscreenTrackingTimeout = setTimeout(() => {
      this.fullscreenTrackingState.set(this.selectedVehicle()?.lastSignalAt ? 'active' : 'waiting');
    }, 800);
  }

  protected onFullscreenChanged(entering: boolean): void {
    if (entering) {
      if (this.selectedVehicle()) this.enableLiveTracking();
    }
  }

  protected stopLiveTracking(): void {
    const vehicleId = this.selectedVehicle()?.numericId;
    this.liveTrackingEnabled.set(false);
    if (vehicleId !== undefined) this.restoreApiVehicle(vehicleId);
  }

  protected lastSignalLabel(vehicle: LiveVehicle): string {
    if (!vehicle.lastSignalAt) return 'Waiting…';
    const seconds = Math.max(0, Math.floor((this.now() - vehicle.lastSignalAt) / 1_000));
    if (seconds < 5) return 'Just now';
    if (seconds < 60) return `${seconds} sec ago`;
    const minutes = Math.floor(seconds / 60);
    return minutes === 1 ? '1 min ago' : `${minutes} min ago`;
  }

  protected openDriverAllocation(): void {
    this.allocationOpen.set(true);
  }
  protected closeDriverAllocation(): void {
    this.allocationOpen.set(false);
  }
  protected allocationSaved(): void {
    this.allocationOpen.set(false);
    this.loadVehicles();
  }
  protected viewTripHistory(): void {
    const vehicle = this.selectedVehicle();
    if (vehicle)
      void this.router.navigate(['/fleetpoint/trip-replay'], {
        state: { vehicleId: vehicle.numericId },
      });
  }
  /** Opens the violations list pre-filtered to the selected vehicle's alerts. */
  protected viewAllAlerts(): void {
    const vehicle = this.selectedVehicle();
    if (!vehicle) return;
    void this.router.navigate(['/fleetpoint/violations/all'], {
      queryParams: { vehicle: vehicle.id, range: 'month' },
    });
  }
  /** Opens the driver detail page of the driver assigned to the selected vehicle. */
  protected contactDriver(): void {
    const vehicle = this.selectedVehicle();
    if (!vehicle) return;
    const driverId = this.assignedDriverId(vehicle.numericId);
    if (!driverId) {
      void this.router.navigate(['/fleetpoint/drivers']);
      return;
    }
    void this.router.navigate(['/fleetpoint/drivers', driverId]);
  }
  /** Driver id taken from the fleet inventory assignment for this vehicle. */
  private assignedDriverId(vehicleId: number): number | null {
    const record = this.inventoryIndex().byId.get(vehicleId);
    const driver = record?.associated_drivers_name?.find((item) => item.driver_id != null);
    const id = Number(driver?.driver_id);
    return Number.isFinite(id) && id > 0 ? id : null;
  }

  protected onMapReady(_fleetMap: FleetMap): void {
    this.mapLoaded.set(true);
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.fullscreenUi.isFullscreen()) void this.fullscreenUi.toggle();
  }

  protected statusColor(status: string): string {
    switch (status) {
      case 'Moving':
        return 'var(--color-success)';
      case 'Idling':
        return 'var(--color-warning)';
      case 'Alert':
        return 'var(--color-danger)';
      default:
        return 'var(--color-muted)';
    }
  }

  protected vehicleImage(image: string | null): string {
    const value = image?.trim();
    return value && !['none', 'null', 'no image', 'n/a'].includes(value.toLowerCase())
      ? value
      : 'assets/fleetpoint/def-car.svg';
  }

  protected useDefaultVehicleImage(event: Event): void {
    const image = event.target as HTMLImageElement;
    image.onerror = null;
    image.src = 'assets/fleetpoint/def-car.svg';
  }

  private toTrackedVehicle(vehicle: RealtimeVehicleRecord): LiveVehicle {
    const speed = Math.max(0, this.numberValue(vehicle.speed));
    const online = Boolean(vehicle.online_status);
    return {
      numericId: vehicle.id,
      deviceId: String(vehicle.device_id ?? '').trim(),
      id: vehicle.registration || vehicle.name || String(vehicle.id),
      model: vehicle.vehicle_device_type || vehicle.vehicle_type || 'Vehicle',
      driver: vehicle.vehicle_driver_name || 'Unassigned',
      status: online ? (speed > 8 ? 'Moving' : 'Idling') : 'Offline',
      speed,
      fuel: 0,
      location: vehicle.location || 'Location unavailable',
      updated: vehicle.updated_time || 'No recent update',
      lat: this.coordinate(vehicle.latitude),
      lng: this.coordinate(vehicle.longitude),
      image: vehicle.image || vehicle.vehicle_type_image,
      seatBelt: Boolean(vehicle.seat_belt),
      ignition: Boolean(vehicle.ignition_status),
      battery: null,
      lastSignalAt: null,
      kmPerDay: vehicle.km_per_day || 0,
    };
  }

  private toMapZone(zone: GeoZoneRecord): MapZoneOverlay[] {
    const territory = zone.territory;
    if (!territory) return [];
    const color = '#7c3aed';
    if (Array.isArray(territory)) {
      const points = territory
        .map((point) => this.zonePoint(point))
        .filter((point): point is [number, number] => Boolean(point));
      return points.length > 2
        ? [{ id: String(zone.id), label: zone.name, geometry: 'polygon', color, points }]
        : [];
    }
    if (typeof territory !== 'object') return [];
    const record = territory as Record<string, unknown>;
    const center = this.zonePoint(record);
    const radius = this.numberValue(record['radius'], Number.NaN);
    if (center && Number.isFinite(radius)) {
      return [
        {
          id: String(zone.id),
          label: zone.name,
          geometry: 'circle',
          color,
          center,
          radius: radius * 1000,
        },
      ];
    }
    const rawPoints = record['coordinates'] ?? record['points'] ?? record['paths'];
    if (!Array.isArray(rawPoints)) return [];
    const points = rawPoints
      .map((point) => this.zonePoint(point))
      .filter((point): point is [number, number] => Boolean(point));
    return points.length > 2
      ? [{ id: String(zone.id), label: zone.name, geometry: 'polygon', color, points }]
      : [];
  }

  private zonePoint(value: unknown): [number, number] | null {
    if (!value || typeof value !== 'object') return null;
    const point = value as Record<string, unknown>;
    const lat = this.numberValue(point['lat'] ?? point['latitude'], Number.NaN);
    const lng = this.numberValue(point['lng'] ?? point['longitude'], Number.NaN);
    return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
  }

  /**
   * A fleet stream delivers hundreds of packets a second. Applying each one on arrival
   * re-filtered the list, re-rendered the map and recounted the fleet per packet; instead
   * packets are buffered and applied together, in arrival order, every REALTIME_FLUSH_MS.
   */
  private applyRealtimeUpdate(update: VehicleRealtimeUpdate): void {
    this.pendingUpdates.push(update);
    this.realtimeFlush ??= setTimeout(() => this.flushRealtimeUpdates(), LiveTrackingPage.REALTIME_FLUSH_MS);
  }

  private flushRealtimeUpdates(): void {
    this.realtimeFlush = undefined;
    const updates = this.pendingUpdates;
    this.pendingUpdates = [];
    const vehicles = this.vehicles();
    const index = this.vehicleIndex(vehicles);
    const activeVehicle = this.selectedVehicle();
    const trackingOnly = activeVehicle && this.liveTrackingEnabled() ? activeVehicle.numericId : null;
    // Copied once on the first match; untouched vehicles keep their object identity, so
    // the map and list only redo work for the vehicles that actually moved.
    let next: LiveVehicle[] | null = null;
    let selected: LiveVehicle | undefined;
    for (const update of updates) {
      if (update.rtp !== undefined && Number(update.rtp) !== 1) continue;
      for (const position of this.matchingVehicles(index, update)) {
        const vehicle = (next ?? vehicles)[position];
        if (trackingOnly !== null && vehicle.numericId !== trackingOnly) continue;
        const changed = this.withPacket(vehicle, update);
        next ??= vehicles.slice();
        next[position] = changed;
        this.realtimeVehicles.add(vehicle.numericId);
        if (activeVehicle?.numericId === vehicle.numericId) selected = changed;
      }
    }
    if (!next) return;
    // Same ids at the same positions, so the lookup index stays valid for the new array.
    this.vehicleLookup = { vehicles: next, index };
    this.vehicles.set(next);
    if (selected) this.selectedVehicle.set(selected);
    this.fleetStatus.update(next.length, next.filter((vehicle) => vehicle.status !== 'Offline').length);
  }

  /** Positions of the vehicles a packet belongs to: by vehicle id, device id or registration. */
  private matchingVehicles(index: VehicleIndex, update: VehicleRealtimeUpdate): Set<number> {
    const matches = new Set<number>();
    const add = (positions: number[] | undefined) => positions?.forEach((position) => matches.add(position));
    add(index.byId.get(String(update.vehicle_id ?? update.id ?? '')));
    const deviceId = String(update.device_id ?? update.id ?? '');
    if (deviceId) add(index.byDevice.get(deviceId));
    const registration = update.registration?.toLowerCase();
    if (registration !== undefined) add(index.byRegistration.get(registration));
    return matches;
  }

  /** Id → positions index for the current vehicle array, rebuilt only when the array is replaced by a snapshot. */
  private vehicleIndex(vehicles: LiveVehicle[]): VehicleIndex {
    if (this.vehicleLookup?.vehicles === vehicles) return this.vehicleLookup.index;
    const index: VehicleIndex = { byId: new Map(), byDevice: new Map(), byRegistration: new Map() };
    const add = (map: Map<string, number[]>, key: string, position: number) => {
      const positions = map.get(key);
      if (positions) positions.push(position);
      else map.set(key, [position]);
    };
    vehicles.forEach((vehicle, position) => {
      add(index.byId, String(vehicle.numericId), position);
      if (vehicle.deviceId) add(index.byDevice, vehicle.deviceId, position);
      add(index.byRegistration, vehicle.id.toLowerCase(), position);
    });
    this.vehicleLookup = { vehicles, index };
    return index;
  }

  private withPacket(vehicle: LiveVehicle, update: VehicleRealtimeUpdate): LiveVehicle {
    // Some devices report a negative speed when they have no GPS speed fix.
    const speed = Math.max(0, this.numberValue(update.speed ?? update.spd ?? vehicle.speed));
    return {
      ...vehicle,
      speed,
      lat: this.numberValue(update.latitude ?? update.lat, vehicle.lat),
      lng: this.numberValue(update.longitude ?? update.lng ?? update.lon, vehicle.lng),
      status: speed > 8 ? 'Moving' : 'Idling',
      ignition: this.booleanValue(update.ignition_status ?? update.ign, vehicle.ignition),
      updated: this.updateTime(update.updated_time ?? update.t),
      fixTime: this.epoch(update.t),
      lastSignalAt: Date.now(),
    };
  }

  private restoreApiVehicle(vehicleId: number): void {
    const snapshot = this.apiSnapshots.get(vehicleId);
    this.realtimeVehicles.delete(vehicleId);
    if (!snapshot) return;
    const selectedDeviceId =
      this.selectedVehicle()?.numericId === vehicleId ? this.selectedVehicle()?.deviceId : '';
    const resolvedDeviceId =
      this.vehicles().find((vehicle) => vehicle.numericId === vehicleId)?.deviceId ||
      selectedDeviceId;
    const restored = { ...snapshot, deviceId: resolvedDeviceId || snapshot.deviceId };
    this.vehicles.update((vehicles) =>
      vehicles.map((vehicle) => (vehicle.numericId === vehicleId ? restored : vehicle)),
    );
    if (this.selectedVehicle()?.numericId === vehicleId) this.selectedVehicle.set(restored);
  }

  private resolveSelectedVehicleDevice(vehicle: LiveVehicle): void {
    const request = ++this.selectionRequest;
    if (vehicle.deviceId) return;
    this.subscription.add(
      this.vehicleDetailApi.getVehicle(String(vehicle.numericId)).subscribe({
        next: (response) => {
          if (
            request !== this.selectionRequest ||
            this.selectedVehicle()?.numericId !== vehicle.numericId
          )
            return;
          const deviceId = String(response.data?.data?.[0]?.device_id ?? '').trim();
          if (!deviceId) return;
          const snapshot = this.apiSnapshots.get(vehicle.numericId);
          if (snapshot) this.apiSnapshots.set(vehicle.numericId, { ...snapshot, deviceId });
          this.vehicles.update((vehicles) =>
            vehicles.map((item) =>
              item.numericId === vehicle.numericId ? { ...item, deviceId } : item,
            ),
          );
          this.selectedVehicle.update((selected) =>
            selected ? { ...selected, deviceId } : selected,
          );
        },
      }),
    );
  }

  private coordinate(value: number | string | null): number {
    if (value === null || value === '' || value === 'None') return Number.NaN;
    return this.numberValue(value, Number.NaN);
  }

  private numberValue(value: unknown, fallback = 0): number {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  private booleanValue(value: unknown, fallback = false): boolean {
    if (value === undefined || value === null || value === '') return fallback;
    if (typeof value === 'string') return !['0', 'false', 'off'].includes(value.toLowerCase());
    return Boolean(value);
  }

  private updateTime(value: string | number | undefined): string {
    if (!value) return 'Just now';
    const date =
      typeof value === 'number' ? new Date(value > 1e12 ? value : value * 1000) : new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
  }

  private epoch(value: string | number | undefined): number | undefined {
    if (!value) return undefined;
    const ms = typeof value === 'number' ? (value > 1e12 ? value : value * 1000) : Date.parse(value);
    return Number.isFinite(ms) ? ms : undefined;
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
    void this.liveSource.disconnect();
    clearTimeout(this.fullscreenTrackingTimeout);
    clearTimeout(this.realtimeFlush);
  }
}
