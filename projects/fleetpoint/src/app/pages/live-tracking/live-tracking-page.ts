import { HttpErrorResponse } from '@angular/common/http';
import { Component, HostListener, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DropdownOption, Skeleton } from '@iotility/shared-ui';
import { EMPTY, Subscription, catchError, finalize, forkJoin, interval, switchMap, timer } from 'rxjs';
import { FleetMap, TrackedVehicle, VehicleStatus } from '../../shared/fleet-map/fleet-map';
import { LiveBadge } from '../../shared/map-overlays/live-badge';
import { VehicleLegend } from '../../shared/map-overlays/vehicle-legend';
import { SearchOverlay } from '../../shared/map-overlays/search-overlay';
import { FullscreenUiService } from '../../shared/services/fullscreen-ui.service';
import {
  DetailReportRecord,
  LiveTrackingApiService,
  RealtimeVehicleRecord,
} from '../../shared/services/live-tracking-api.service';
import {
  VehicleRealtimeService,
  VehicleRealtimeUpdate,
} from '../../shared/services/vehicle-realtime.service';
import { VehicleDetailApiService } from '../../shared/services/vehicle-detail-api.service';
import { AllocationForm } from '../drivers/allocation-form/allocation-form';
import { FeedbackDialogBridgeService } from '../../shared/services/feedback-dialog-bridge.service';

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

@Component({
  selector: 'app-live-tracking-page',
  imports: [Skeleton, FleetMap, AllocationForm, LiveBadge, VehicleLegend, SearchOverlay],
  templateUrl: './live-tracking-page.html',
  styleUrl: './live-tracking-page.css',
})
export class LiveTrackingPage implements OnInit, OnDestroy {
  protected readonly loading = signal(true);
  protected readonly mapLoaded = signal(false);
  protected readonly error = signal('');
  protected readonly search = signal('');
  protected readonly statusFilter = signal<VehicleStatus | 'All'>('All');
  protected readonly locationFilter = signal('all');
  protected readonly selectedVehicle = signal<LiveVehicle | null>(null);
  protected readonly liveTrackingEnabled = signal(false);
  protected readonly allocationOpen = signal(false);
  protected readonly now = signal(Date.now());
  protected readonly vehicles = signal<LiveVehicle[]>([]);
  protected readonly isFullscreen = computed(() => this.fullscreenUi.isFullscreen());
  protected readonly filters: Array<VehicleStatus | 'All'> = ['All', 'Moving', 'Idling', 'Alert', 'Offline'];
  protected readonly vehicleSkeletons = Array.from({ length: 8 });
  protected readonly locationOptions: DropdownOption[] = [
    { id: 'all', label: 'All locations', description: 'Every tracked vehicle' },
  ];
  protected readonly filteredVehicles = computed(() => {
    const query = this.search().trim().toLowerCase();
    return this.vehicles().filter((vehicle) =>
      (this.statusFilter() === 'All' || vehicle.status === this.statusFilter()) &&
      (!query || `${vehicle.id} ${vehicle.model} ${vehicle.driver} ${vehicle.location}`.toLowerCase().includes(query)),
    );
  });
  protected readonly mapVehicles = computed(() =>
    this.filteredVehicles().filter((vehicle) => Number.isFinite(vehicle.lat) && Number.isFinite(vehicle.lng)),
  );
  private readonly subscription = new Subscription();
  private detailReports = new Map<number, DetailReportRecord>();
  private readonly apiSnapshots = new Map<number, LiveVehicle>();
  private readonly realtimeVehicles = new Set<number>();
  private selectionRequest = 0;
  private requestedVehicleId = '';

  constructor(
    private readonly api: LiveTrackingApiService,
    private readonly realtime: VehicleRealtimeService,
    private readonly vehicleDetailApi: VehicleDetailApiService,
    private readonly router: Router,
    private readonly feedback: FeedbackDialogBridgeService,
    private readonly fullscreenUi: FullscreenUiService,
    route: ActivatedRoute,
  ) {
    const navigationState = router.getCurrentNavigation()?.extras.state ?? history.state;
    this.requestedVehicleId = String(
      navigationState?.['vehicleId'] ?? route.snapshot.queryParamMap.get('vehicle_id') ?? '',
    );
  }

  ngOnInit(): void {
    this.loadVehicles();
    this.subscription.add(
      this.realtime.updates$.subscribe((update) => this.applyRealtimeUpdate(update)),
    );
    this.subscription.add(interval(1_000).subscribe(() => this.now.set(Date.now())));
    void this.realtime.connect();
    this.startVehiclePolling();
  }

  protected loadVehicles(): void {
    this.loading.set(true);
    this.error.set('');
    forkJoin({ vehicles: this.api.getVehicles(), report: this.api.getDetailReport() })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ vehicles, report }) => {
          this.detailReports = new Map((report.data?.data ?? []).map((row) => [row.vehicle_id, row]));
          this.updateVehicleSnapshot(vehicles.data?.data ?? []);
          this.selectRequestedVehicle();
        },
        error: (response: HttpErrorResponse) => {
          const message = response.error?.message || 'Live vehicle data could not be loaded.';
          this.error.set(message);
          void this.feedback.open({ type: 'error', title: 'Unable to load live tracking', message, confirmText: 'Close', showCancel: false });
        },
      });
  }

  private startVehiclePolling(): void {
    this.subscription.add(
      timer(60_000, 60_000).pipe(
        switchMap(() => this.api.getVehicles().pipe(catchError(() => EMPTY))),
      ).subscribe((response) => this.updateVehicleSnapshot(response.data?.data ?? [])),
    );
  }

  private updateVehicleSnapshot(records: RealtimeVehicleRecord[]): void {
    const selectedId = this.selectedVehicle()?.numericId;
    const currentVehicles = new Map(this.vehicles().map((vehicle) => [vehicle.numericId, vehicle]));
    const vehicles = records.map((record) => {
      const snapshot = this.toTrackedVehicle(record, this.detailReports.get(record.id));
      this.apiSnapshots.set(record.id, snapshot);
      const current = currentVehicles.get(record.id);
      return current && this.liveTrackingEnabled() && record.id === selectedId && this.realtimeVehicles.has(record.id)
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
            updated: current.updated,
          }
        : snapshot;
    });
    this.vehicles.set(vehicles);
    if (selectedId !== undefined) {
      this.selectedVehicle.set(vehicles.find((vehicle) => vehicle.numericId === selectedId) ?? null);
    }
  }

  protected updateSearch(event: Event): void { this.search.set((event.target as HTMLInputElement).value); }
  protected updateSearchValue(value: string): void { this.search.set(value); }
  protected updateLocation(ids: string[]): void { this.locationFilter.set(ids[0] ?? 'all'); }
  protected locationLabel(): string { return 'All locations'; }
  protected selectVehicle(vehicle: TrackedVehicle): void {
    const previousId = this.selectedVehicle()?.numericId;
    if (previousId !== undefined) this.restoreApiVehicle(previousId);
    const selected = this.vehicles().find((item) => item.id === vehicle.id) ?? vehicle as LiveVehicle;
    this.liveTrackingEnabled.set(false);
    this.selectedVehicle.set(selected);
    this.resolveSelectedVehicleDevice(selected);
  }

  private selectRequestedVehicle(): void {
    if (!this.requestedVehicleId) return;
    const requested = this.requestedVehicleId;
    this.requestedVehicleId = '';
    const vehicle = this.vehicles().find((item) =>
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

  protected openDriverAllocation(): void { this.allocationOpen.set(true); }
  protected closeDriverAllocation(): void { this.allocationOpen.set(false); }
  protected allocationSaved(): void { this.allocationOpen.set(false); this.loadVehicles(); }
  protected viewTripHistory(): void {
    const vehicle = this.selectedVehicle();
    if (vehicle) void this.router.navigate(['/fleetpoint/trip-replay'], { state: { vehicleId: vehicle.numericId } });
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

  private toTrackedVehicle(vehicle: RealtimeVehicleRecord, detail?: DetailReportRecord): LiveVehicle {
    const speed = this.numberValue(vehicle.speed ?? detail?.last_known_speed);
    const online = Boolean(vehicle.online_status);
    return {
      numericId: vehicle.id,
      deviceId: String(vehicle.device_id ?? '').trim(),
      id: vehicle.registration || String(vehicle.id),
      model: vehicle.vehicle_type || 'Vehicle',
      driver: vehicle.vehicle_driver_name || detail?.last_swipe_driver_name || 'Unassigned',
      status: online ? (speed > 5 ? 'Moving' : 'Idling') : 'Offline',
      speed,
      fuel: 0,
      location: vehicle.location || detail?.last_updated_location || 'Location unavailable',
      updated: vehicle.updated_time || detail?.last_updated_time || 'No recent update',
      lat: this.coordinate(vehicle.latitude),
      lng: this.coordinate(vehicle.longitude),
      image: detail?.vehicle_image || vehicle.vehicle_type_image,
      seatBelt: vehicle.seat_belt,
      ignition: vehicle.ignition_status,
      battery: null,
      lastSignalAt: null,
      kmPerDay: vehicle.km_per_day || 0,
    };
  }

  private applyRealtimeUpdate(update: VehicleRealtimeUpdate): void {
    if (update.rtp !== undefined && Number(update.rtp) !== 1) return;
    const activeVehicle = this.selectedVehicle();
    if (!activeVehicle || !this.liveTrackingEnabled()) return;
    const updateId = String(update.vehicle_id ?? update.id ?? '');
    const packetDeviceId = String(update.device_id ?? update.id ?? '');
    const registration = update.registration?.toLowerCase();
    let selected: LiveVehicle | undefined;
    this.vehicles.update((vehicles) => vehicles.map((vehicle) => {
      if (vehicle.numericId !== activeVehicle.numericId) return vehicle;
      if (
        String(vehicle.numericId) !== updateId &&
        (!vehicle.deviceId || vehicle.deviceId !== packetDeviceId) &&
        vehicle.id.toLowerCase() !== registration
      ) return vehicle;
      const speed = this.numberValue(update.speed ?? update.spd ?? vehicle.speed);
      const lat = this.numberValue(update.latitude ?? update.lat, vehicle.lat);
      const lng = this.numberValue(update.longitude ?? update.lng ?? update.lon, vehicle.lng);
      const ignition = this.booleanValue(update.ignition_status ?? update.ign, vehicle.ignition);
      const changed: LiveVehicle = {
        ...vehicle,
        speed,
        lat,
        lng,
        status: speed > 5 ? 'Moving' : ignition ? 'Idling' : 'Offline',
        ignition,
        battery: update.b === undefined || update.b === null
          ? vehicle.battery
          : this.numberValue(update.b, vehicle.battery ?? 0),
        seatBelt: update.sbStatus === undefined || update.sbStatus === null
          ? vehicle.seatBelt
          : this.booleanValue(update.sbStatus, vehicle.seatBelt),
        lastSignalAt: Date.now(),
        updated: this.updateTime(update.updated_time ?? update.t),
      };
      this.realtimeVehicles.add(vehicle.numericId);
      if (this.selectedVehicle()?.numericId === vehicle.numericId) selected = changed;
      return changed;
    }));
    if (selected) this.selectedVehicle.set(selected);
  }

  private restoreApiVehicle(vehicleId: number): void {
    const snapshot = this.apiSnapshots.get(vehicleId);
    this.realtimeVehicles.delete(vehicleId);
    if (!snapshot) return;
    const selectedDeviceId = this.selectedVehicle()?.numericId === vehicleId
      ? this.selectedVehicle()?.deviceId
      : '';
    const resolvedDeviceId = this.vehicles().find((vehicle) => vehicle.numericId === vehicleId)?.deviceId
      || selectedDeviceId;
    const restored = { ...snapshot, deviceId: resolvedDeviceId || snapshot.deviceId };
    this.vehicles.update((vehicles) => vehicles.map((vehicle) =>
      vehicle.numericId === vehicleId ? restored : vehicle,
    ));
    if (this.selectedVehicle()?.numericId === vehicleId) this.selectedVehicle.set(restored);
  }

  private resolveSelectedVehicleDevice(vehicle: LiveVehicle): void {
    const request = ++this.selectionRequest;
    if (vehicle.deviceId) return;
    this.subscription.add(
      this.vehicleDetailApi.getVehicle(String(vehicle.numericId)).subscribe({
        next: (response) => {
          if (request !== this.selectionRequest || this.selectedVehicle()?.numericId !== vehicle.numericId) return;
          const deviceId = String(response.data?.data?.[0]?.device_id ?? '').trim();
          if (!deviceId) return;
          const snapshot = this.apiSnapshots.get(vehicle.numericId);
          if (snapshot) this.apiSnapshots.set(vehicle.numericId, { ...snapshot, deviceId });
          this.vehicles.update((vehicles) => vehicles.map((item) =>
            item.numericId === vehicle.numericId ? { ...item, deviceId } : item,
          ));
          this.selectedVehicle.update((selected) => selected ? { ...selected, deviceId } : selected);
        },
      }),
    );
  }

  private coordinate(value: string | null): number {
    if (!value || value === 'None') return Number.NaN;
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
    const date = typeof value === 'number' ? new Date(value > 1e12 ? value : value * 1000) : new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
  }

  protected onMapReady(fleetMap: FleetMap): void {
    this.mapLoaded.set(true);
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.fullscreenUi.isFullscreen()) void this.fullscreenUi.toggle();
  }

  protected statusColor(status: string): string {
    switch (status) {
      case 'Moving': return 'var(--color-success)';
      case 'Idling': return 'var(--color-warning)';
      case 'Stopped': return '#64748b';
      case 'Alert': return 'var(--color-danger)';
      case 'Offline': return 'var(--color-muted)';
      default: return 'var(--color-muted)';
    }
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
    void this.realtime.disconnect();
  }
}
