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
import { catchError, finalize, forkJoin, of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { RealtimeVehicleRecord } from '../../shared/services/live-tracking-api.service';
import {
  PLAYBACK_ERROR,
  PlaybackRecord,
  PlaybackTrail,
  PlaybackTrailRecord,
  TripReplayApiService,
  TripSummary,
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
  id: string;
  location: string;
  duration: string;
  /** What the vehicle was doing while stopped (playback/stops `vehicle_status`). */
  status: string;
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
  /** Server-side totals for the range; null when trip-summary isn't available. */
  summary: TripSummary | null;
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
  summary: null,
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
const SPEED_TRAIL_KEY = 'fleetpoint.tripReplay.speedTrail';

function readSpeedTrailPreference(): boolean {
  try {
    return localStorage.getItem(SPEED_TRAIL_KEY) === '1';
  } catch {
    return false;
  }
}

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
  host: { '(document:keydown)': 'onKeydown($event)' },
})
export class TripReplayPage implements OnInit, OnDestroy {
  protected readonly clock = new ReplayClock(inject(NgZone));
  protected readonly positionIndex = this.clock.index;
  protected readonly playing = this.clock.playing;
  protected readonly speedOptions = REPLAY_SPEEDS;
  protected readonly speed = signal(this.clock.speedSetting);
  protected readonly speedIndex = computed(() => REPLAY_SPEEDS.indexOf(this.speed()));
  protected readonly skipStops = signal(true);
  /** Route coloured by speed instead of the brand colour; remembered between visits. */
  protected readonly speedTrail = signal(readSpeedTrailPreference());
  protected readonly timelineHover = signal<TimelineHover | null>(null);
  protected readonly search = signal('');
  protected readonly vehicles = signal<RealtimeVehicleRecord[]>([]);
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
  /** What the replay map picks its 3D body type from. */
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
    // A fixed window: scaled by the event count, a trip with hundreds of events kept one
    // "current" nearly all the time, re-selecting on almost every sample.
    return events.find((e) => Math.abs(e.positionIndex - idx) <= 3) ?? null;
  });
  protected readonly tripStats = computed(() => {
    const trip = this.trip();
    const positions = trip.positions;
    if (!positions.length) return null;
    // The server's totals (playback/trip-summary) win; the trail only fills in what it lacks.
    const summary = trip.summary;
    const speeds = positions.map((p) => p.speed);
    const maxSpeed = Math.max(...speeds);
    const avgSpeed = Math.round(speeds.reduce((sum, s) => sum + s, 0) / speeds.length);
    const idlePositions = positions.filter((p) => p.speed === 0).length;
    const idleMinutes = Math.round((idlePositions * ASSUMED_SAMPLE_MS) / 60_000);
    const known = (value: number | null | undefined): value is number =>
      value !== null && value !== undefined && Number.isFinite(Number(value));
    return {
      distance: known(summary?.distance_km) ? Math.round(Number(summary.distance_km) * 10) / 10 : trip.distance,
      duration: known(summary?.duration_seconds)
        ? this.formatDuration(Number(summary.duration_seconds))
        : this.formatDuration(
            (new Date(positions.at(-1)?.timestamp ?? 0).getTime() - new Date(positions[0].timestamp ?? 0).getTime()) / 1000 || 0,
          ),
      maxSpeed: known(summary?.max_speed) ? Math.round(Number(summary.max_speed)) : maxSpeed,
      avgSpeed: known(summary?.avg_speed) ? Math.round(Number(summary.avg_speed)) : avgSpeed,
      idleTime: known(summary?.idle_seconds) ? Math.round(Number(summary.idle_seconds) / 60) : idleMinutes,
      fuel: known(summary?.fuel_consumed) ? Math.round(Number(summary.fuel_consumed) * 10) / 10 : trip.fuel || null,
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
    // The vehicle list carries each vehicle's image; no fleet-wide detail report is needed.
    this.api
      .getVehicles()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (vehicleResponse) => {
          const vehicles = vehicleResponse.data?.data ?? [];
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
      vehicleImage: this.vehiclePicture(vehicle),
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
    // trip-summary covers what detail-report and statistics were fetched for, so they're gone.
    forkJoin({
      summary: this.api.getTripSummary(range).pipe(catchError(() => of(null))),
      trail: this.api.getMapTrail(range).pipe(
        catchError((err: HttpErrorResponse) => {
          // Not this user's vehicle: say so instead of showing an empty trip.
          if (err.error?.status === PLAYBACK_ERROR.vehicleNotYours) return throwError(() => err);
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
    })
      .pipe(finalize(() => {
        this.trailLoading.set(false);
        this.routeLoading.set(false);
      }))
      .subscribe({
        next: (result) =>
          this.buildTrip(
            result.trail.data ?? { map_trail: [] },
            result.stops?.data?.data ?? [],
            result.violations?.data?.data ?? [],
            result.summary?.data ?? null,
          ),
        error: (response: HttpErrorResponse) => {
          this.trip.set(EMPTY_TRIP);
          this.routeLoading.set(false);
          this.mapFallbackToRaw.set(true);
          // Rely on the status code, not the message text (the backend's texts aren't reliable).
          const message =
            response.error?.status === PLAYBACK_ERROR.vehicleNotYours
              ? "This vehicle isn't in your fleet, so its trips can't be shown."
              : 'Trip replay data could not be loaded.';
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
  protected toggleSpeedTrail(): void {
    const next = !this.speedTrail();
    this.speedTrail.set(next);
    try {
      localStorage.setItem(SPEED_TRAIL_KEY, next ? '1' : '0');
    } catch {
      // Private browsing or blocked storage: the choice lasts for this visit only.
    }
  }

  /**
   * Keyboard control, as video players do: Space plays and pauses, ← → jump between events
   * (or 5% of the trip when it has none), 1–5 pick the speed, Home restarts, C toggles speed
   * colours. Ignored while typing or when a modifier is held, and Space is left to buttons.
   */
  protected onKeydown(event: KeyboardEvent): void {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]')) return;
    if (!this.trip().positions.length || this.loading() || this.trailLoading()) return;
    const onControl = !!target?.closest('button, a, [role="button"]');
    switch (event.key) {
      case ' ':
        if (onControl) return;
        this.togglePlayback();
        break;
      case 'ArrowRight':
      case 'ArrowLeft':
        this.stepThroughTrip(event.key === 'ArrowRight' ? 1 : -1);
        break;
      case 'Home':
        this.stop();
        break;
      case 'c':
      case 'C':
        this.toggleSpeedTrail();
        break;
      default: {
        const speed = REPLAY_SPEEDS[Number(event.key) - 1];
        if (!/^[1-5]$/.test(event.key) || speed === undefined) return;
        this.setSpeed(speed);
      }
    }
    event.preventDefault();
  }

  /** The next or previous event from the playhead; a 5% step through the trip when it has none. */
  private stepThroughTrip(direction: 1 | -1): void {
    const index = this.positionIndex();
    const events = [...this.trip().events].sort((a, b) => a.positionIndex - b.positionIndex);
    const next = direction > 0
      ? events.find((event) => event.positionIndex > index)
      : events.reverse().find((event) => event.positionIndex < index);
    if (next) {
      this.jumpToEvent(next);
      return;
    }
    if (events.length) return;
    const fraction = this.clock.fractionAtIndex(index) + direction * 0.05;
    this.clock.halt();
    this.clock.seekToFraction(Math.max(0, Math.min(1, fraction)));
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
    trailData: PlaybackTrail,
    stops: PlaybackRecord[],
    violations: ViolationRecord[],
    summary: TripSummary | null,
  ): void {
    const trail = trailData.map_trail ?? [];
    const vehicleName = this.vehicle()?.registration ?? 'Vehicle';
    const vehicleImage = this.vehiclePicture(this.vehicle());
    // Fallbacks for when trip-summary isn't available: map-trail carries the range's distance and fuel.
    const trailDistance = Number(trailData.distance ?? 0);
    const trailFuel = Number(trailData.fuel_consumed ?? 0);
    // If OSRM fallback is active, use raw trail data directly without filtering/matching
    if (this.mapFallbackToRaw()) {
      const rawPositions = trail
        .filter((row) => Number.isFinite(Number(row.lat)) && Number.isFinite(Number(row.long)))
        .sort((a, b) => this.trailTimestampMs(a) - this.trailTimestampMs(b));
      if (rawPositions.length < 2) {
        this.trip.set({
          ...EMPTY_TRIP,
          vehicleId: this.selectedVehicleId(),
          vehicle: vehicleName,
          vehicleImage,
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
      const { stops: replayStops, events: stopEvents } = this.stopsOnTrail(stops, positions);
      events.push(...stopEvents);
      const statistics = this.tripStatistics(summary, trailData, events, positions);
      this.trip.set({
        id: String(this.selectedVehicleId()),
        vehicleId: this.selectedVehicleId(),
        vehicle: vehicleName,
        vehicleImage,
        driver: String(driver),
        date: new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(
          new Date(rawPositions[0].timestamp),
        ),
        summary,
        start: rawPositions[0].location || 'Starting point',
        end: rawPositions.at(-1)?.location || 'Ending point',
        distance: trailDistance,
        duration: '—',
        fuel: trailFuel,
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
        vehicle: vehicleName,
        vehicleImage,
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
    const { stops: replayStops, events: stopEvents } = this.stopsOnTrail(stops, positions);
    events.push(...stopEvents);
    const statistics = this.tripStatistics(summary, trailData, events, positions);
    this.trip.set({
      id: String(this.selectedVehicleId()),
      vehicleId: this.selectedVehicleId(),
      vehicle: vehicleName,
      vehicleImage,
      driver: String(driver),
      date: new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(
        new Date(unique[0].timestamp),
      ),
      summary,
      start: unique[0].location || 'Starting point',
      end: unique.at(-1)?.location || 'Ending point',
      distance: trailDistance,
      duration: '—',
      fuel: trailFuel,
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
  /**
   * playback/stops rows (oldest first) placed on the nearest trail sample, plus a stop event for
   * each. The backend's stop id keeps each one's identity; vehicle_status says what it was doing.
   */
  private stopsOnTrail(
    stops: PlaybackRecord[],
    positions: TripPosition[],
  ): { stops: ReplayStop[]; events: TripReplayEvent[] } {
    const replayStops = stops.map((stop, index): ReplayStop => {
      const lat = Number(stop['lat'] ?? stop['latitude']);
      const lng = Number(stop['lng'] ?? stop['long'] ?? stop['longitude']);
      const status = String(stop['vehicle_status'] ?? '').trim();
      return {
        id: String(stop['id'] ?? index),
        location: String(stop['location'] ?? 'Unknown location'),
        duration: String(stop['duration'] ?? '—'),
        status: status && status.toLowerCase() !== 'null' ? this.label(status) : '',
        start: this.formatTime(String(stop['start_time'] ?? '')),
        end: this.formatTime(String(stop['end_time'] ?? '')),
        positionIndex: this.nearestPosition(positions, lat, lng),
      };
    });
    const events = replayStops.map(
      (stop): TripReplayEvent => ({
        id: `stop-${stop.id}`,
        label: 'Vehicle stop',
        type: 'stop',
        positionIndex: stop.positionIndex,
        detail: [stop.duration, stop.status, stop.location].filter(Boolean).join(' · '),
      }),
    );
    return { stops: replayStops, events };
  }
  /** The vehicle's own picture when it has one, else its type's icon, else the default car. */
  protected vehiclePicture(vehicle: RealtimeVehicleRecord | undefined): string {
    return this.vehicleImage(vehicle?.image || vehicle?.vehicle_type_image);
  }
  /**
   * The Stats tab: the trip's figures that the side panel doesn't already show, from trip-summary
   * and map-trail (fuel filled and jobs completed come with the trail).
   */
  private tripStatistics(
    summary: TripSummary | null,
    trail: PlaybackTrail,
    events: TripReplayEvent[],
    positions: TripPosition[],
  ): ReplayTrip['statistics'] {
    const value = (raw: number | null | undefined, unit = '') =>
      raw === null || raw === undefined || !Number.isFinite(Number(raw)) ? '—' : `${Number(raw)}${unit}`;
    return [
      { label: 'Started', value: positions[0]?.time ?? '—' },
      { label: 'Ended', value: positions.at(-1)?.time ?? '—' },
      { label: 'Stops (1 min or longer)', value: value(summary?.stop_count) },
      {
        label: 'Idle time',
        value: summary?.idle_seconds === null || summary?.idle_seconds === undefined
          ? '—'
          : this.formatDuration(Number(summary.idle_seconds)),
      },
      { label: 'Violations', value: String(events.filter((event) => event.type === 'violation').length) },
      { label: 'Fuel filled', value: value(trail.fuel_filled, ' L') },
      { label: 'Jobs completed', value: value(trail.jobs_completed) },
      { label: 'GPS points', value: String(positions.length) },
    ];
  }
  /** Seconds as "1h 05m", "12m 30s" or "45s". */
  private formatDuration(totalSeconds: number): string {
    const seconds = Math.max(0, Math.round(totalSeconds));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const rest = seconds % 60;
    if (hours) return `${hours}h ${String(minutes).padStart(2, '0')}m`;
    if (minutes) return `${minutes}m ${String(rest).padStart(2, '0')}s`;
    return `${rest}s`;
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
