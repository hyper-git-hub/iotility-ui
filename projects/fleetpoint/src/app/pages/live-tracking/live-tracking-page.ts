import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
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

interface LiveVehicle extends TrackedVehicle {
  numericId: number;
  image: string | null;
  seatBelt: boolean;
  kmPerDay: number;
}

@Component({
  selector: 'app-live-tracking-page',
  imports: [BlockingLoader, FleetMap, Dropdown],
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

  constructor(
    private readonly api: LiveTrackingApiService,
    private readonly realtime: VehicleRealtimeService,
  ) {}

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
    this.selectedVehicle.set(this.vehicles().find((item) => item.id === vehicle.id) ?? vehicle as LiveVehicle);
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
    const updateId = String(update.vehicle_id ?? update.id ?? '');
    const registration = update.registration?.toLowerCase();
    let selected: LiveVehicle | undefined;
    this.vehicles.update((vehicles) => vehicles.map((vehicle) => {
      if (String(vehicle.numericId) !== updateId && vehicle.id.toLowerCase() !== registration) return vehicle;
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
