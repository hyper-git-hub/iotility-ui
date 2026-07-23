import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { BlockingLoader, DateTimePicker } from '@iotility/shared-ui';
import { catchError, finalize, forkJoin, of } from 'rxjs';
import { RealtimeVehicleRecord } from '../../shared/services/live-tracking-api.service';
import {
  PlaybackRecord,
  PlaybackTrailRecord,
  TripReplayApiService,
} from '../../shared/services/trip-replay-api.service';
import { FeedbackDialogBridgeService } from '../../shared/services/feedback-dialog-bridge.service';
import {
  TripPosition,
  TripReplayEvent,
  TripReplayMap,
} from '../../shared/trip-replay-map/trip-replay-map';

interface ReplayStop {
  location: string;
  duration: string;
  start: string;
  end: string;
  positionIndex: number;
}
interface ReplayTrip {
  id: string;
  vehicleId: number;
  vehicle: string;
  vehicleImage: string;
  driver: string;
  date: string;
  score: number;
  start: string;
  end: string;
  distance: number;
  duration: string;
  fuel: number;
  positions: TripPosition[];
  events: TripReplayEvent[];
  stops: ReplayStop[];
  statistics: Array<{ label: string; value: string; isImage?: boolean }>;
}
const EMPTY_TRIP: ReplayTrip = {
  id: '',
  vehicleId: 0,
  vehicle: 'Select a vehicle',
  vehicleImage: 'assets/fleetpoint/vehicle.svg',
  driver: 'Unassigned',
  date: '',
  score: 0,
  start: 'No trail loaded',
  end: 'No trail loaded',
  distance: 0,
  duration: '—',
  fuel: 0,
  positions: [],
  events: [],
  stops: [],
  statistics: [],
};

@Component({
  selector: 'app-trip-replay-page',
  imports: [BlockingLoader, DateTimePicker, TripReplayMap],
  templateUrl: './trip-replay-page.html',
  styleUrl: './trip-replay-page.css',
})
export class TripReplayPage implements OnInit, OnDestroy {
  protected readonly playbackStepDuration = 600;
  protected readonly search = signal('');
  protected readonly vehicles = signal<RealtimeVehicleRecord[]>([]);
  protected readonly selectedVehicleId = signal(0);
  protected readonly trip = signal<ReplayTrip>(EMPTY_TRIP);
  protected readonly positionIndex = signal(0);
  protected readonly playing = signal(false);
  protected readonly speed = signal(1);
  protected readonly activeTab = signal<'events' | 'stops' | 'statistics'>('events');
  protected readonly loading = signal(true);
  protected readonly trailLoading = signal(false);
  protected readonly routeLoading = signal(false);
  protected readonly error = signal('');
  protected readonly startDate = signal('');
  protected readonly endDate = signal('');
  private playbackTimer?: ReturnType<typeof setInterval>;
  private readonly requestedVehicleId: string;
  protected readonly filteredVehicles = computed(() => {
    const query = this.search().trim().toLowerCase();
    return this.vehicles().filter((vehicle) =>
      `${vehicle.registration} ${vehicle.vehicle_driver_name ?? ''} ${vehicle.vehicle_type ?? ''}`
        .toLowerCase()
        .includes(query),
    );
  });
  protected readonly selectedTrip = computed(() => this.trip());
  protected readonly currentPosition = computed(
    () =>
      this.trip().positions[this.positionIndex()] ?? {
        lat: 0,
        lng: 0,
        speed: 0,
        heading: 0,
        time: '—',
      },
  );
  protected readonly maxPosition = computed(() => Math.max(this.trip().positions.length - 1, 0));
  protected readonly progress = computed(() => {
    const last = this.trip().positions.length - 1;
    return last > 0 ? (this.positionIndex() / last) * 100 : 0;
  });

  constructor(
    private readonly api: TripReplayApiService,
    private readonly feedback: FeedbackDialogBridgeService,
    router: Router,
  ) {
    const navigationState = router.getCurrentNavigation()?.extras.state ?? history.state;
    this.requestedVehicleId = String(navigationState?.['vehicleId'] ?? '');
    const end = new Date();
    const start = new Date(end);
    start.setHours(0, 0, 0, 0);
    this.startDate.set(this.inputDate(start));
    this.endDate.set(this.inputDate(end));
  }
  ngOnInit(): void {
    this.api
      .getVehicles()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (response) => {
          const vehicles = response.data?.data ?? [];
          this.vehicles.set(vehicles);
          const selected =
            vehicles.find(
              (vehicle) =>
                String(vehicle.id) === this.requestedVehicleId ||
                vehicle.registration.toLowerCase() === this.requestedVehicleId.toLowerCase(),
            ) ?? vehicles[0];
          if (selected) {
            this.selectVehicle(selected);
            if (this.requestedVehicleId) this.loadTrip();
          }
        },
        error: (response) => {
          const message = response.error?.message || 'Vehicles could not be loaded.';
          void this.feedback.open({ type: 'error', title: 'Unable to load vehicles', message, confirmText: 'Close', showCancel: false });
        },
      });
  }
  protected updateSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }
  protected updateStart(value: string): void {
    this.startDate.set(value);
  }
  protected updateEnd(value: string): void {
    this.endDate.set(value);
  }
  protected selectVehicle(vehicle: RealtimeVehicleRecord): void {
    if (vehicle.id === this.selectedVehicleId()) return;
    this.stop();
    this.selectedVehicleId.set(vehicle.id);
    this.trip.set({
      ...EMPTY_TRIP,
      vehicleId: vehicle.id,
      vehicle: vehicle.registration,
      vehicleImage: vehicle.vehicle_type_image || 'assets/fleetpoint/vehicle.svg',
      driver: vehicle.vehicle_driver_name || 'Unassigned',
    });
    this.error.set('');
  }
  protected loadTrip(): void {
    const vehicleId = this.selectedVehicleId();
    if (!vehicleId || !this.startDate() || !this.endDate() || this.startDate() >= this.endDate()) {
      this.error.set('Select a vehicle and a valid date range.');
      return;
    }
    this.stop();
    this.error.set('');
    this.trailLoading.set(true);
    const range = {
      vehicleId,
      start: this.apiDate(this.startDate()),
      end: this.apiDate(this.endDate()),
    };
    forkJoin({
      detail: this.api.getDetailReport(range).pipe(catchError(() => of(null))),
      trail: this.api.getMapTrail(range),
      stops: this.api.getStops(range).pipe(catchError(() => of(null))),
      statistics: this.api.getStatistics(range).pipe(catchError(() => of(null))),
    })
      .pipe(finalize(() => this.trailLoading.set(false)))
      .subscribe({
        next: (result) =>
          this.buildTrip(
            result.trail.data?.map_trail ?? [],
            result.detail?.data?.data ?? [],
            result.stops?.data?.data ?? [],
            result.statistics?.data,
          ),
        error: (response) => {
          this.trip.set(EMPTY_TRIP);
          const message = response.error?.message || 'Trip replay data could not be loaded.';
          void this.feedback.open({ type: 'error', title: 'Unable to load trip replay', message, confirmText: 'Close', showCancel: false });
        },
      });
  }
  protected togglePlayback(): void {
    this.playing() ? this.pause() : this.play();
  }
  protected play(): void {
    if (this.trip().positions.length < 2) return;
    if (this.positionIndex() >= this.trip().positions.length - 1) this.positionIndex.set(0);
    this.clearTimer();
    this.playing.set(true);
    this.playbackTimer = setInterval(() => {
      const next = this.positionIndex() + 1;
      if (next >= this.trip().positions.length) {
        this.pause();
        return;
      }
      this.positionIndex.set(next);
    }, this.playbackStepDuration / this.speed());
  }
  protected pause(): void {
    this.clearTimer();
    this.playing.set(false);
  }
  protected stop(): void {
    this.pause();
    this.positionIndex.set(0);
  }
  protected setSpeed(value: number): void {
    this.speed.set(value);
    if (this.playing()) this.play();
  }
  protected scrub(event: Event): void {
    this.positionIndex.set(Number((event.target as HTMLInputElement).value));
  }
  protected jumpToEvent(event: TripReplayEvent): void {
    this.pause();
    this.positionIndex.set(event.positionIndex);
    this.activeTab.set('events');
  }
  protected jumpToStop(stop: ReplayStop): void {
    this.pause();
    this.positionIndex.set(stop.positionIndex);
  }
  protected updateRouteLoading(loading: boolean): void {
    this.routeLoading.set(loading);
  }
  protected useDefaultVehicleImage(event: Event): void {
    const image = event.target as HTMLImageElement;
    image.onerror = null;
    image.src = 'assets/fleetpoint/vehicle.svg';
  }
  private buildTrip(
    trail: PlaybackTrailRecord[],
    detail: PlaybackRecord[],
    stops: PlaybackRecord[],
    statisticsPayload: { data?: PlaybackRecord[] } | PlaybackRecord[] | null | undefined,
  ): void {
    const unique = trail
      .filter(
        (row, index, rows) =>
          index ===
          rows.findIndex(
            (item) =>
              Number(item.lat) === Number(row.lat) &&
              Number(item.long) === Number(row.long) &&
              item.timestamp === row.timestamp,
          ),
      )
      .filter((row) => Number.isFinite(Number(row.lat)) && Number.isFinite(Number(row.long)));
    if (unique.length < 2) {
      this.trip.set({
        ...EMPTY_TRIP,
        vehicleId: this.selectedVehicleId(),
        vehicle: this.vehicle()?.registration ?? 'Vehicle',
        vehicleImage: this.vehicle()?.vehicle_type_image || 'assets/fleetpoint/vehicle.svg',
      });
      this.error.set('');
      void this.feedback.open({
        type: 'warning',
        title: 'No trip data found',
        message: `No trip data was found for this vehicle from ${this.selectedPeriod()}.`,
        confirmText: 'Close',
        showCancel: false,
      });
      return;
    }
    let driver = unique[0].driver_name || this.vehicle()?.vehicle_driver_name || 'Unassigned';
    const positions = unique.map((row, index): TripPosition => {
      if (row.driver_name && row.driver_name !== '-') driver = row.driver_name;
      const next = unique[Math.min(index + 1, unique.length - 1)];
      return {
        lat: Number(row.lat),
        lng: Number(row.long),
        speed: Math.round(Number(row.speed) || 0),
        heading: this.bearing(
          Number(row.lat),
          Number(row.long),
          Number(next.lat),
          Number(next.long),
        ),
        time: this.formatTime(row.timestamp),
        timestamp: row.timestamp,
        location: row.location ?? 'Location unavailable',
        driver,
      };
    });
    const events: TripReplayEvent[] = unique.flatMap((row, index) =>
      row.seat_belt_notf
        ? [
            {
              id: `seatbelt-${index}`,
              label: 'Seat belt removed',
              type: 'violation' as const,
              positionIndex: index,
              detail: row.location || 'Safety alert',
            },
          ]
        : [],
    );
    const replayStops = stops.map((stop, index) => {
      const lat = Number(stop['latitude']);
      const lng = Number(stop['longitude']);
      return {
        location: String(stop['location'] ?? 'Unknown location'),
        duration: String(stop['duration'] ?? '—'),
        start: this.formatTime(String(stop['start_time'] ?? '')),
        end: this.formatTime(String(stop['end_time'] ?? '')),
        positionIndex: this.nearestPosition(positions, lat, lng),
        id: index,
      };
    });
    replayStops.forEach((stop, index) =>
      events.push({
        id: `stop-${index}`,
        label: 'Vehicle stop',
        type: 'stop',
        positionIndex: stop.positionIndex,
        detail: `${stop.duration} · ${stop.location}`,
      }),
    );
    const detailRow = detail[0] ?? {};
    const rawStats = Array.isArray(statisticsPayload)
      ? statisticsPayload
      : (statisticsPayload?.data ?? []);
    const statRow = rawStats[0] ?? detailRow;
    const statistics = Object.entries(statRow)
      .filter(([, value]) => value !== null && typeof value !== 'object')
      .slice(0, 12)
      .map(([key, value]) => ({
        label: this.label(key),
        value: String(value ?? '—'),
        isImage: key.toLowerCase().includes('image'),
      }));
    this.trip.set({
      id: String(this.selectedVehicleId()),
      vehicleId: this.selectedVehicleId(),
      vehicle: String(detailRow['vehicle'] ?? this.vehicle()?.registration ?? 'Vehicle'),
      vehicleImage: String(
        detailRow['vehicle_image'] ||
          this.vehicle()?.vehicle_type_image ||
          'assets/fleetpoint/vehicle.svg',
      ),
      driver: String(driver),
      date: new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(
        new Date(unique[0].timestamp),
      ),
      score: Number(detailRow['score'] ?? detailRow['driver_score'] ?? 0),
      start: unique[0].location || 'Starting point',
      end: unique.at(-1)?.location || 'Ending point',
      distance: Number(detailRow['distance'] ?? detailRow['distance_travelled'] ?? 0),
      duration: String(detailRow['duration'] ?? detailRow['total_duration'] ?? '—'),
      fuel: Number(detailRow['fuel'] ?? detailRow['fuel_used'] ?? 0),
      positions,
      events,
      stops: replayStops,
      statistics,
    });
    this.positionIndex.set(0);
  }
  private vehicle(): RealtimeVehicleRecord | undefined {
    return this.vehicles().find((item) => item.id === this.selectedVehicleId());
  }
  private nearestPosition(positions: TripPosition[], lat: number, lng: number): number {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return 0;
    return positions.reduce(
      (best, point, index) =>
        Math.hypot(point.lat - lat, point.lng - lng) <
        Math.hypot(positions[best].lat - lat, positions[best].lng - lng)
          ? index
          : best,
      0,
    );
  }
  private bearing(aLat: number, aLng: number, bLat: number, bLng: number): number {
    const y = Math.sin(((bLng - aLng) * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180);
    const x =
      Math.cos((aLat * Math.PI) / 180) * Math.sin((bLat * Math.PI) / 180) -
      Math.sin((aLat * Math.PI) / 180) *
        Math.cos((bLat * Math.PI) / 180) *
        Math.cos(((bLng - aLng) * Math.PI) / 180);
    return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  }
  private formatTime(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? value || '—'
      : new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'medium' }).format(date);
  }
  private label(value: string): string {
    return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  }
  private inputDate(date: Date): string {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  }
  private selectedPeriod(): string {
    const format = (value: string) => {
      const date = new Date(value);
      return Number.isNaN(date.getTime())
        ? value
        : new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
    };
    return `${format(this.startDate())} to ${format(this.endDate())}`;
  }
  private apiDate(value: string): string {
    return `${value.replace('T', ' ')}:00`;
  }
  private clearTimer(): void {
    if (this.playbackTimer) clearInterval(this.playbackTimer);
    this.playbackTimer = undefined;
  }
  ngOnDestroy(): void {
    this.clearTimer();
  }
}
