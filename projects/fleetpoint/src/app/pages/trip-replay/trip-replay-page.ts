import { ExportFormat, ExportMenu, TabIndicator } from '@iotility/shared-ui';
import { DecimalPipe } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import {
  ChangeDetectionStrategy,
  Component,
  NgZone,
  OnDestroy,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { Router } from '@angular/router';
import { DateTimePicker, Skeleton, Tooltip } from '@iotility/shared-ui';
import { ProgressBar } from '../../shared/progress-bar/progress-bar';
import { catchError, finalize, forkJoin, of } from 'rxjs';
import {
  DetailReportRecord,
  RealtimeVehicleRecord,
} from '../../shared/services/live-tracking-api.service';
import {
  PlaybackRecord,
  PlaybackTrailRecord,
  TripReplayApiService,
} from '../../shared/services/trip-replay-api.service';
import { ViolationRecord } from '../../shared/services/violations-api.service';
import { ExportRunnerService } from '../../shared/services/export-runner.service';
import { FeedbackDialogBridgeService } from '../../shared/services/feedback-dialog-bridge.service';
import {
  TripPosition,
  TripReplayEvent,
  TripReplayMap,
} from '../../shared/trip-replay-map/trip-replay-map';
import { REPLAY_SPEEDS, ReplayClock } from '../../shared/trip-replay-map/replay-clock';
import { buildReplayOffsets, stationaryRuns } from '../../shared/trip-replay-map/replay-motion';
import { ReplayScrub } from '../../shared/trip-replay-map/replay-scrub';
import { VIOLATION_ICON } from '../violations/all-violations/all-violations';

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
  vehicleImage: 'assets/fleetpoint/def-car.svg',
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
// Trip reports don't say how long each sample covers, so idle time assumes this.
const ASSUMED_SAMPLE_MS = 600;

interface TimelineHover {
  /** Where the pointer is along the timeline, as a percentage. */
  left: number;
  time: string;
  speed: number;
  location: string;
}

@Component({
  selector: 'app-trip-replay-page',
  imports: [
    TabIndicator,
    DateTimePicker,
    ExportMenu,
    DecimalPipe,
    ProgressBar,
    ReplayScrub,
    Skeleton,
    Tooltip,
    TripReplayMap,
  ],
  templateUrl: './trip-replay-page.html',
  styleUrl: './trip-replay-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TripReplayPage implements OnInit, OnDestroy {
  protected readonly clock = new ReplayClock(inject(NgZone));
  protected readonly positionIndex = this.clock.index;
  protected readonly playing = this.clock.playing;
  protected readonly speedOptions = REPLAY_SPEEDS;
  protected readonly speed = signal(this.clock.speedSetting);
  protected readonly speedIndex = computed(() => REPLAY_SPEEDS.indexOf(this.speed()));
  protected readonly skipStops = signal(true);
  protected readonly timelineHover = signal<TimelineHover | null>(null);
  protected readonly search = signal('');
  protected readonly vehicles = signal<RealtimeVehicleRecord[]>([]);
  protected readonly vehicleImages = signal<Record<number, string>>({});
  protected readonly selectedVehicleId = signal(0);
  protected readonly trip = signal<ReplayTrip>(EMPTY_TRIP);
  protected readonly selectedEventId = signal<string | null>(null);
  protected readonly activeTab = signal<'events' | 'stops' | 'statistics'>('events');
  protected readonly loading = signal(true);
  protected readonly trailLoading = signal(false);
  protected readonly routeLoading = signal(false);
  protected readonly mapLoaded = signal(false);
  protected readonly mapFallbackToRaw = signal(false);
  protected readonly displayedSpeed = signal(0);
  protected readonly error = signal('');
  protected readonly vehicleSkeletons = Array.from({ length: 8 });
  protected readonly detailSkeletons = Array.from({ length: 5 });
  protected readonly legendItems: Array<{ label: string; color: string }> = [
    { label: 'Travelled', color: 'var(--color-brand-500)' },
    { label: 'Start', color: 'var(--color-success)' },
    { label: 'End', color: 'color-mix(in srgb, var(--color-danger) 65%, white)' },
    { label: 'Violation', color: 'var(--color-danger)' },
    { label: 'DashCam', color: 'var(--color-warning)' },
    { label: 'Stop', color: 'var(--color-info)' },
  ];
  protected readonly startDate = signal('');
  protected readonly endDate = signal('');
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
  protected readonly stopEvents = computed(() => this.trip().events.filter((e) => e.type === 'stop'));
  // Tab counts: violations/dashcam alerts live under Events (stops have their
  // own tab), so the badge must mirror exactly what each list renders.
  protected readonly eventCount = computed(
    () => this.trip().events.length - this.stopEvents().length,
  );
  protected readonly stopCount = computed(() => this.stopEvents().length);
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
  protected readonly progress = computed(
    () => this.clock.fractionAtIndex(this.positionIndex()) * 100,
  );
  protected readonly pointNumber = computed(() =>
    this.trip().positions.length ? this.positionIndex() + 1 : 0,
  );
  protected readonly currentEvent = computed(() => {
    const id = this.selectedEventId();
    return id ? this.trip().events.find((event) => event.id === id) ?? null : null;
  });
  protected readonly playbackEvent = computed(() => {
    const idx = this.positionIndex();
    const events = this.trip().events;
    if (!events.length) return null;
    const threshold = Math.max(3, Math.floor(events.length * 0.02));
    return events.find((e) => Math.abs(e.positionIndex - idx) <= threshold) ?? null;
  });
  protected readonly tripStats = computed(() => {
    const trip = this.trip();
    const positions = trip.positions;
    if (!positions.length) return null;
    const speeds = positions.map((p) => p.speed);
    const maxSpeed = Math.max(...speeds);
    const avgSpeed = Math.round(speeds.reduce((sum, s) => sum + s, 0) / speeds.length);
    const idlePositions = positions.filter((p) => p.speed === 0).length;
    const idleMinutes = Math.round((idlePositions * ASSUMED_SAMPLE_MS) / 60_000);
    return {
      distance: trip.distance,
      duration: trip.duration,
      maxSpeed,
      avgSpeed,
      idleTime: idleMinutes,
      fuel: trip.fuel,
    };
  });

  protected readonly exporting = signal<ExportFormat | null>(null);
  /** The vehicle and range of the trip on screen; Export Report downloads its travel history. */
  protected readonly loadedRange = signal<{ vehicleId: number; start: string; end: string } | null>(null);
  private readonly exporter = inject(ExportRunnerService);

  constructor(
    private readonly api: TripReplayApiService,
    private readonly feedback: FeedbackDialogBridgeService,
    private readonly sanitizer: DomSanitizer,
    router: Router,
  ) {
    const navigationState = router.getCurrentNavigation()?.extras.state ?? history.state;
    this.requestedVehicleId = String(navigationState?.['vehicleId'] ?? '');
    const end = new Date();
    const start = new Date(end);
    start.setHours(0, 0, 0, 0);
    this.startDate.set(this.inputDate(start));
    this.endDate.set(this.inputDate(end));
    effect(() => {
      const playing = this.playing();
      const playback = this.playbackEvent();
      const selected = this.selectedEventId();
      if (playing && playback && playback.id !== selected) {
        this.selectedEventId.set(playback.id);
      } else if (playing && !playback && selected) {
        this.selectedEventId.set(null);
      }
    });
    // A new trip starts from the top; toggling stops only retimes the same one.
    let loaded: TripPosition[] | undefined;
    effect(() => {
      const positions = this.trip().positions;
      const offsets = buildReplayOffsets(positions, stationaryRuns(positions), this.skipStops());
      untracked(() => {
        if (positions === loaded) this.clock.retime(offsets);
        else this.clock.load(offsets);
      });
      loaded = positions;
    });
  }
  ngOnInit(): void {
    forkJoin({
      vehicles: this.api.getVehicles(),
      detail: this.api.getVehicleDetail().pipe(catchError(() => of(null))),
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ vehicles: vehicleResponse, detail }) => {
          const vehicles = vehicleResponse.data?.data ?? [];
          this.vehicles.set(vehicles);
          this.vehicleImages.set(
            Object.fromEntries(
              (detail?.data?.data ?? [])
                .filter((record) => record.vehicle_image)
                .map((record) => [record.vehicle_id, record.vehicle_image as string]),
            ),
          );
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
          void this.feedback.open({
            type: 'error',
            title: 'Unable to load vehicles',
            message,
            confirmText: 'Close',
            showCancel: false,
          });
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
      vehicleImage: this.vehicleImage(
        this.vehicleImages()[vehicle.id] || vehicle.vehicle_type_image,
      ),
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
    this.routeLoading.set(true);
    const range = {
      vehicleId,
      start: this.apiDate(this.startDate()),
      end: this.apiDate(this.endDate()),
    };
    this.loadedRange.set(range);
    forkJoin({
      detail: this.api.getDetailReport(range).pipe(catchError(() => of(null))),
      vehicleDetail: this.api.getVehicleDetail().pipe(catchError(() => of(null))),
      trail: this.api.getMapTrail(range).pipe(
        catchError((err) => {
          // OSRM service is down/crashed - use raw GPS data fallback
          this.routeLoading.set(false);
          this.mapFallbackToRaw.set(true);
          return of({ data: { map_trail: [] } });
        }),
      ),
      violations: this.api
        .getViolations(range, this.vehicle()?.registration ?? '')
        .pipe(catchError(() => of(null))),
      stops: this.api.getStops(range).pipe(catchError(() => of(null))),
      statistics: this.api.getStatistics(range).pipe(catchError(() => of(null))),
    })
      .pipe(finalize(() => {
        this.trailLoading.set(false);
        this.routeLoading.set(false);
      }))
      .subscribe({
        next: (result) =>
          this.buildTrip(
            result.trail.data?.map_trail ?? [],
            result.detail?.data?.data ?? [],
            result.stops?.data?.data ?? [],
            result.violations?.data?.data ?? [],
            result.statistics?.data,
            result.vehicleDetail?.data?.data ?? [],
          ),
        error: (response) => {
          this.trip.set(EMPTY_TRIP);
          this.routeLoading.set(false);
          this.mapFallbackToRaw.set(true);
          const message = response.error?.message || 'Trip replay data could not be loaded.';
          void this.feedback.open({
            type: 'error',
            title: 'Unable to load trip replay',
            message,
            confirmText: 'Close',
            showCancel: false,
          });
        },
      });
  }
  protected togglePlayback(): void {
    if (this.playing()) this.clock.pause();
    else this.clock.play();
  }
  protected stop(): void {
    this.clock.stop();
  }
  protected setSpeed(value: (typeof REPLAY_SPEEDS)[number]): void {
    this.speed.set(value);
    this.clock.setSpeed(value);
  }
  protected toggleSkipStops(): void {
    this.skipStops.update((skip) => !skip);
  }
  // Shows when and where the trip is at any point along the timeline.
  protected previewTimeline(event: PointerEvent): void {
    const { left, width } = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const fraction = width ? Math.max(0, Math.min((event.clientX - left) / width, 1)) : 0;
    const position = this.trip().positions[this.clock.indexAtFraction(fraction)];
    this.timelineHover.set(
      position
        ? {
            left: fraction * 100,
            time: this.clockTime(position.time),
            speed: position.speed,
            location: position.location ?? '',
          }
        : null,
    );
  }
  protected markerPosition(event: TripReplayEvent): number {
    return this.clock.fractionAtIndex(event.positionIndex) * 100;
  }
  // Violation icon markup from the Violations page icon set (colour stays red
  // via the existing text-danger / stroke styles).
  protected eventIcon(event: TripReplayEvent): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(event.icon ?? VIOLATION_ICON['Default']);
  }
  protected clockTime(value: string | undefined): string {
    if (!value || value === '—') return '—:—';
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return new Intl.DateTimeFormat('en', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(date);
    }
    return value.match(/\b\d{1,2}:\d{2}\b/)?.[0] ?? value;
  }
  protected isEventActive(event: TripReplayEvent): boolean {
    return this.selectedEventId() === event.id || this.currentEvent()?.id === event.id;
  }
  protected jumpToEventFromMap(event: TripReplayEvent): void {
    this.jumpToEvent(event);
    this.activeTab.set('events');
  }
  protected jumpToEvent(event: TripReplayEvent): void {
    this.clock.halt();
    this.clock.seekToIndex(event.positionIndex);
    this.selectedEventId.set(event.id);
  }
  protected jumpToStop(stop: ReplayStop): void {
    this.clock.halt();
    this.clock.seekToIndex(stop.positionIndex);
  }
  protected updateRouteLoading(loading: boolean): void {
    this.routeLoading.set(loading);
  }
  protected useDefaultVehicleImage(event: Event): void {
    const image = event.target as HTMLImageElement;
    image.onerror = null;
    image.src = 'assets/fleetpoint/def-car.svg';
  }
  protected vehicleImage(image: string | null | undefined): string {
    const value = image?.trim();
    return value && !['none', 'null', 'no image', 'n/a'].includes(value.toLowerCase())
      ? value
      : 'assets/fleetpoint/def-car.svg';
  }
  private buildTrip(
    trail: PlaybackTrailRecord[],
    detail: PlaybackRecord[],
    stops: PlaybackRecord[],
    violations: ViolationRecord[],
    statisticsPayload: { data?: PlaybackRecord[] } | PlaybackRecord[] | null | undefined,
    vehicleDetail: DetailReportRecord[] = [],
  ): void {
    const imageRecord = vehicleDetail.find(
      (record) => record.vehicle_id === this.selectedVehicleId(),
    );
    // If OSRM fallback is active, use raw trail data directly without filtering/matching
    if (this.mapFallbackToRaw()) {
      const rawPositions = trail
        .filter((row) => Number.isFinite(Number(row.lat)) && Number.isFinite(Number(row.long)))
        .sort((a, b) => this.trailTimestampMs(a) - this.trailTimestampMs(b));
      if (rawPositions.length < 2) {
        this.trip.set({
          ...EMPTY_TRIP,
          vehicleId: this.selectedVehicleId(),
          vehicle: this.vehicle()?.registration ?? 'Vehicle',
          vehicleImage: this.vehicleImage(
            this.vehicleImages()[this.selectedVehicleId()] || this.vehicle()?.vehicle_type_image,
          ),
        });
        this.error.set('');
        void this.feedback.open({
          type: 'warning',
          title: 'No trip data found',
          message: `No trip data was found for this vehicle from ${this.selectedPeriod()}.`,
          confirmText: 'Close',
          showCancel: false,
        });
          this.mapFallbackToRaw.set(false);
        return;
      }
      let driver = rawPositions[0].driver_name || this.vehicle()?.vehicle_driver_name || 'Unassigned';
      const positions = rawPositions.map((row, index): TripPosition => {
        if (row.driver_name && row.driver_name !== '-') driver = row.driver_name;
        const next = rawPositions[Math.min(index + 1, rawPositions.length - 1)];
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
      const events: TripReplayEvent[] = [];
      events.push(...this.violationEvents(violations, positions));
      const replayStops = stops.map((stop, index) => {
        const lat = Number(stop['lat'] ?? stop['latitude']);
        const lng = Number(stop['lng'] ?? stop['long'] ?? stop['longitude']);
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
        .map(([key, value]) => {
          const raw = String(value ?? '—');
          const isImage = key.toLowerCase().includes('image');
          return {
            label: this.label(key),
            value: isImage ? this.vehicleImage(raw) : raw,
            isImage,
          };
        });
      this.trip.set({
        id: String(this.selectedVehicleId()),
        vehicleId: this.selectedVehicleId(),
        vehicle: String(detailRow['vehicle'] ?? this.vehicle()?.registration ?? 'Vehicle'),
        vehicleImage: this.vehicleImage(
          imageRecord?.vehicle_image ??
            (detailRow['vehicle_image'] as string | undefined) ??
            this.vehicle()?.vehicle_type_image,
        ),
        driver: String(driver),
        date: new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(
          new Date(rawPositions[0].timestamp),
        ),
        score: Number(detailRow['score'] ?? detailRow['driver_score'] ?? 0),
        start: rawPositions[0].location || 'Starting point',
        end: rawPositions.at(-1)?.location || 'Ending point',
        distance: Number(detailRow['distance'] ?? detailRow['distance_travelled'] ?? 0),
        duration: String(detailRow['duration'] ?? detailRow['total_duration'] ?? '—'),
        fuel: Number(detailRow['fuel'] ?? detailRow['fuel_used'] ?? 0),
        positions,
        events,
        stops: replayStops,
        statistics,
      });
      this.mapFallbackToRaw.set(false);
      return;
    }
    // Normal OSRM-matched path
    const unique = this.longestContinuousTrail(
      trail
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
        .filter((row) => Number.isFinite(Number(row.lat)) && Number.isFinite(Number(row.long)))
        // Chronological order: the map sorts trail points by timestamp, so the
        // page's positions/events/playback indices must follow the same order
        // or markers and event dots land at the wrong trail locations.
        .sort((a, b) => this.trailTimestampMs(a) - this.trailTimestampMs(b)),
    );
    if (unique.length < 2) {
      this.trip.set({
        ...EMPTY_TRIP,
        vehicleId: this.selectedVehicleId(),
        vehicle: this.vehicle()?.registration ?? 'Vehicle',
        vehicleImage: this.vehicleImage(
          this.vehicleImages()[this.selectedVehicleId()] || this.vehicle()?.vehicle_type_image,
        ),
      });
      this.error.set('');
      void this.feedback.open({
        type: 'warning',
        title: 'No trip data found',
        message: `No trip data was found for this vehicle from ${this.selectedPeriod()}.`,
        confirmText: 'Close',
        showCancel: false,
      });
      this.mapFallbackToRaw.set(false);
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
              icon: this.violationIcon('seatbelt'),
            },
          ]
        : [],
    );
    events.push(...this.violationEvents(violations, positions));
    const replayStops = stops.map((stop, index) => {
      const lat = Number(stop['lat'] ?? stop['latitude']);
      const lng = Number(stop['lng'] ?? stop['long'] ?? stop['longitude']);
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
      .map(([key, value]) => {
        const raw = String(value ?? '—');
        const isImage = key.toLowerCase().includes('image');
        return {
          label: this.label(key),
          value: isImage ? this.vehicleImage(raw) : raw,
          isImage,
        };
      });
    this.trip.set({
      id: String(this.selectedVehicleId()),
      vehicleId: this.selectedVehicleId(),
      vehicle: String(detailRow['vehicle'] ?? this.vehicle()?.registration ?? 'Vehicle'),
      vehicleImage: this.vehicleImage(
        imageRecord?.vehicle_image ??
          (detailRow['vehicle_image'] as string | undefined) ??
          this.vehicle()?.vehicle_type_image,
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
  }

  // Stable sort key for trail rows: unparseable timestamps keep API order
  // (Array.prototype.sort is stable) instead of jumping to the front.
  private trailTimestampMs(row: PlaybackTrailRecord): number {
    const ms = new Date(row.timestamp).getTime();
    return Number.isFinite(ms) ? ms : 0;
  }
  private longestContinuousTrail(trail: PlaybackTrailRecord[]): PlaybackTrailRecord[] {
    if (trail.length < 2) return trail;
    const segments: PlaybackTrailRecord[][] = [[]];
    for (const point of trail) {
      const segment = segments.at(-1)!;
      const previous = segment.at(-1);
      if (previous && this.isImpossibleTrailJump(previous, point)) segments.push([]);
      segments.at(-1)!.push(point);
    }
    return segments.reduce(
      (longest, segment) => (segment.length > longest.length ? segment : longest),
      [],
    );
  }

  private isImpossibleTrailJump(
    previous: PlaybackTrailRecord,
    current: PlaybackTrailRecord,
  ): boolean {
    const previousTime = new Date(previous.timestamp).getTime();
    const currentTime = new Date(current.timestamp).getTime();
    const elapsedSeconds = Math.max(1, (currentTime - previousTime) / 1_000);
    const distance = this.distanceMetres(
      Number(previous.lat),
      Number(previous.long),
      Number(current.lat),
      Number(current.long),
    );
    // Permit a generous 198 km/h between samples, but never bridge a reset or
    // device switch spanning hundreds of metres in only a few seconds.
    return distance > Math.max(300, elapsedSeconds * 55);
  }

  private distanceMetres(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const radians = (value: number) => (value * Math.PI) / 180;
    const deltaLat = radians(lat2 - lat1);
    const deltaLng = radians(lng2 - lng1);
    const value =
      Math.sin(deltaLat / 2) ** 2 +
      Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(deltaLng / 2) ** 2;
    return 12_742_000 * Math.asin(Math.sqrt(value));
  }

  private vehicle(): RealtimeVehicleRecord | undefined {
    return this.vehicles().find((item) => item.id === this.selectedVehicleId());
  }
  // Maps violation rows (from /common/violation) into trail events so they
  // appear as markers on the route and in the Events list, alongside stops.
  // Uses geographic matching (lat/lng → nearest trail sample) so violations
  // with identical timestamps still land on distinct spots along the route.
  private violationEvents(
    violations: ViolationRecord[],
    positions: TripPosition[],
  ): TripReplayEvent[] {
    const seen = new Set<string>();
    return violations
      .filter((record) => Number.isFinite(Number(record.latitude)) && Number.isFinite(Number(record.longitude)))
      .flatMap((record, index): TripReplayEvent[] => {
        const lat = Number(record.latitude);
        const lng = Number(record.longitude);
        const label = record.name || record.violation_type || 'Violation';
        const positionIndex = this.nearestPosition(positions, lat, lng);
        const bucket = `${label}|${positionIndex}`;
        if (seen.has(bucket)) return [];
        seen.add(bucket);
        const speed = Number(record.speed);
        const when = record.event_generation_time
          ? ` · ${this.clockTime(record.event_generation_time)}`
          : '';
        return [
          {
            id: `violation-${index}`,
            label,
            type: 'violation' as const,
            positionIndex,
            detail: `${record.description || label}${speed ? ` · ${speed} km/h` : ''}${when}`,
            icon: this.violationIcon(record.violation_type || record.name || ''),
          },
        ];
      });
  }
  // Same type-key aliases as the Violations page so the icon set stays in sync.
  private violationTypeKey(value: string): string {
    const compact = String(value ?? '')
      .replace(/[\s_-]+/g, '')
      .toLowerCase();
    const aliases: Record<string, string> = {
      speed: 'Speed',
      speeding: 'Speed',
      overspeed: 'Speed',
      harshbraking: 'HarshBraking',
      harshacceleration: 'HarshAcceleration',
      sharpturn: 'SharpTurn',
      idle: 'Idle',
      idling: 'Idle',
      territoryviolation: 'TerritoryViolation',
      geozone: 'Geozone',
      geozoneviolation: 'Geozone',
      inzone: 'InZone',
      outofzone: 'OutOfZone',
      roaddeparture: 'RoadDeparture',
      roaddeparturewarning: 'RoadDeparture',
      forwardcollision: 'ForwardCollision',
      forwardcollisionwarning: 'ForwardCollision',
    };
    return aliases[compact] ?? String(value ?? '');
  }
  private violationIcon(value: string): string {
    return VIOLATION_ICON[this.violationTypeKey(value)] ?? VIOLATION_ICON['Default'];
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
  // Playback is time-driven, so an event marker must sit at the sample whose
  // timestamp matches the event time; a purely geographic match can land on an
  // earlier (or later) sample and desynchronise the timeline dot from the map.
  private nearestTimePosition(positions: TripPosition[], value: string): number {
    const target = new Date(value).getTime();
    if (!Number.isFinite(target)) return 0;
    let best = 0;
    let bestDiff = Number.POSITIVE_INFINITY;
    for (let index = 0; index < positions.length; index++) {
      const raw = positions[index].timestamp ?? positions[index].time;
      if (!raw) continue;
      const parsed = new Date(raw).getTime();
      if (!Number.isFinite(parsed)) continue;
      const diff = Math.abs(parsed - target);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = index;
      }
    }
    return best;
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
  protected exportReport(format: ExportFormat): void {
    const range = this.loadedRange();
    if (!range) return;
    const name = `Trip ${this.vehicle()?.registration ?? range.vehicleId}`;
    this.exporter.run(this.api.exportTravelHistory(range, format), name, format, this.exporting);
  }

  private apiDate(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return `${value.replace('T', ' ')}:00`;
    const pad = (part: number) => String(part).padStart(2, '0');
    return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
  }
  ngOnDestroy(): void {
    this.clock.destroy();
  }
}
