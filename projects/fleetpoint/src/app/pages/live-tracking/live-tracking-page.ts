import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { BlockingLoader, Dropdown, DropdownOption } from '@iotility/shared-ui';
import { EMPTY, Subscription, catchError, finalize, forkJoin, switchMap, timer } from 'rxjs';
import { FleetMap, TrackedVehicle, VehicleStatus } from '../../shared/fleet-map/fleet-map';
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

interface LiveVehicle extends TrackedVehicle {
  numericId: number;
  deviceId: string;
  image: string | null;
  seatBelt: boolean;
  kmPerDay: number;
}

@Component({
  selector: 'app-live-tracking-page',
  imports: [BlockingLoader, FleetMap, Dropdown, AllocationForm],
  templateUrl: './live-tracking-page.html',
  styleUrl: './live-tracking-page.css',
})
export class LiveTrackingPage implements OnInit, OnDestroy {
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly search = signal('');
  protected readonly statusFilter = signal<VehicleStatus | 'All'>('All');
  protected readonly locationFilter = signal('all');
  protected readonly selectedVehicle = signal<LiveVehicle | null>(null);
  protected readonly allocationOpen = signal(false);
  protected readonly vehicles = signal<LiveVehicle[]>([]);
  protected readonly filters: Array<VehicleStatus | 'All'> = ['All', 'Moving', 'Idling', 'Offline'];
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
  private selectionRequest = 0;
  private requestedVehicleId = '';

  constructor(
    private readonly api: LiveTrackingApiService,
    private readonly realtime: VehicleRealtimeService,
    private readonly vehicleDetailApi: VehicleDetailApiService,
    private readonly router: Router,
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
          this.error.set(response.error?.message || 'Live vehicle data could not be loaded.');
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
    const vehicles = records.map((vehicle) => this.toTrackedVehicle(vehicle, this.detailReports.get(vehicle.id)));
    this.vehicles.set(vehicles);
    if (selectedId !== undefined) {
      this.selectedVehicle.set(vehicles.find((vehicle) => vehicle.numericId === selectedId) ?? null);
    }
  }

  protected updateSearch(event: Event): void { this.search.set((event.target as HTMLInputElement).value); }
  protected updateLocation(ids: string[]): void { this.locationFilter.set(ids[0] ?? 'all'); }
  protected locationLabel(): string { return 'All locations'; }
  protected selectVehicle(vehicle: TrackedVehicle): void {
    const selected = this.vehicles().find((item) => item.id === vehicle.id) ?? vehicle as LiveVehicle;
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
    this.selectedVehicle.set(null);
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
      : 'assets/fleetpoint/vehicle.svg';
  }

  protected useDefaultVehicleImage(event: Event): void {
    const image = event.target as HTMLImageElement;
    image.onerror = null;
    image.src = 'assets/fleetpoint/vehicle.svg';
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
      kmPerDay: vehicle.km_per_day || 0,
    };
  }

  private applyRealtimeUpdate(update: VehicleRealtimeUpdate): void {
    if (update.rtp !== undefined && Number(update.rtp) !== 1) return;
    const activeVehicle = this.selectedVehicle();
    if (!activeVehicle) return;
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
      const ignition = Boolean(update.ignition_status ?? update.ign);
      const changed: LiveVehicle = {
        ...vehicle,
        speed,
        lat,
        lng,
        status: speed > 5 ? 'Moving' : ignition ? 'Idling' : 'Offline',
        updated: this.updateTime(update.updated_time ?? update.t),
      };
      if (this.selectedVehicle()?.numericId === vehicle.numericId) selected = changed;
      return changed;
    }));
    if (selected) this.selectedVehicle.set(selected);
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

  private updateTime(value: string | number | undefined): string {
    if (!value) return 'Just now';
    const date = typeof value === 'number' ? new Date(value > 1e12 ? value : value * 1000) : new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
    void this.realtime.disconnect();
  }
}
