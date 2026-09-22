import { Component, NgZone, OnDestroy, OnInit, computed, effect, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { DateTimePicker, Skeleton, StatusBadge } from '@iotility/shared-ui';
import { Subscription, catchError, finalize, forkJoin, of } from 'rxjs';
import { VehicleDetailApiService, VehicleDetailRecord, VehicleMetric } from '../../../shared/services/vehicle-detail-api.service';
import { VehicleRealtimeService, VehicleRealtimeUpdate } from '../../../shared/services/vehicle-realtime.service';
import { FeedbackDialogBridgeService } from '../../../shared/services/feedback-dialog-bridge.service';
import { VehicleForm, VehicleFormValue } from '../vehicle-form/vehicle-form';
import { VehicleHud } from './vehicle-hud/vehicle-hud';
import { VehicleInventoryRecord } from '../../../shared/services/vehicle-inventory-api.service';
import { FleetMap, TrackedVehicle } from '../../../shared/fleet-map/fleet-map';
import { TripPosition, TripReplayEvent, TripReplayMap } from '../../../shared/trip-replay-map/trip-replay-map';
import { environment } from '../../../../environments/environment';

interface DetailItem { label: string; value: string; }
interface SummaryCard { label: string; value: string; suffix: string; tone: 'brand' | 'info' | 'success' | 'warning' | 'danger'; icon: string; }

@Component({ selector: 'app-vehicle-detail', imports: [DateTimePicker, DecimalPipe, FleetMap, Skeleton, StatusBadge, TripReplayMap, VehicleForm, VehicleHud], templateUrl: './vehicle-detail.html', styleUrl: './vehicle-detail.css' })
export class VehicleDetail implements OnInit, OnDestroy {
  protected readonly vehicleId: string;
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly record = signal<VehicleDetailRecord | null>(null);
  protected readonly metrics = signal<VehicleMetric[]>([]);
  protected readonly violations = signal<unknown>(null);
  protected readonly maintenance = signal<unknown>(null);
  protected readonly lastJob = signal<unknown>(null);
  protected readonly trailData = signal<any>(null);
  protected readonly trailLoading = signal(false);
  protected readonly fillupsData = signal<any[]>([]);
  protected readonly fillupsLoading = signal(false);
  protected readonly mileageData = signal<any[]>([]);
  protected readonly mileageLoading = signal(false);
  protected readonly mileageYear = signal<string>(String(new Date().getFullYear()));
  protected readonly mileageMonth = signal<string>('');
  protected readonly stopsData = signal<any[]>([]);
  protected readonly stopsLoading = signal(false);
  protected readonly showStops = signal(false);
  protected readonly mileageYears = Array.from({ length: 30 }, (_, i) => String(new Date().getFullYear() - i));
  protected readonly mileageMonths = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  protected readonly snapshotResult = signal<any>(null);
  protected readonly snapshotLoading = signal(false);
  protected readonly snapshotDateValue = signal<string>('');
  protected readonly formOpen = signal(false);
  protected readonly editVehicle = computed<VehicleInventoryRecord | null>(() => {
    const vehicle = this.record();
    return vehicle ? this.editableVehicle(vehicle) : null;
  });
  protected readonly registration = computed(() => this.text(this.record()?.registration || this.record()?.name, `Vehicle ${this.vehicleId}`));
  protected readonly details = computed<DetailItem[]>(() => {
    const v = this.record(); if (!v) return [];
    return [
      ['Vehicle Name / ID', v.registration || v.name], ['Record Status', v.status === 1 ? 'Active' : 'Inactive'], ['Fleet', v['fleet_name']],
      ['Make', v['make']], ['Model', v['model']], ['Year', v['year']], ['Colour', v['color']], ['Engine Number', v['engine_number']],
      ['Chassis Number', v['chassis_number']], ['Engine Capacity', this.unit(v['engine_capacity'], 'cc')], ['Fuel Tank Capacity', this.unit(v['fuel_tank_capacity'], 'L')],
      ['Odometer Reading', this.unit(v['odo_reading'], 'km')], ['Owner', v['owner']], ['Date Commissioned', v['date_commissioned']],
      ['Registration Expiry', v['expiry_date']], ['Customer', v['customer_name']],
    ].map(([label, value]) => ({ label: String(label), value: this.text(value) }));
  });
  protected readonly summaryCards = computed<SummaryCard[]>(() => {
    const vehicle = this.record();
    const metric = (code: string): unknown => this.metrics().find((item) => item.code === code)?.data;
    const totalDistance = Number(vehicle?.total_distance_traveled ?? 0);
    const dailyDistance = metric('DS') ?? vehicle?.km_per_day ?? 0;
    const fuel = metric('FS') ?? vehicle?.heavy_equipment?.['fuel_level'];
    const fuelText = this.text(fuel, '—');
    const enabledRules = this.monitoring().filter((item) => item.enabled).length;
    return [
      { label: 'Total distance', value: Number.isFinite(totalDistance) ? Math.round(totalDistance).toLocaleString() : '0', suffix: 'km', tone: 'info', icon: 'assets/fleetpoint/icons/route.svg' },
      { label: 'Distance today', value: this.text(dailyDistance, '0').replace(/\s*km$/i, ''), suffix: 'km', tone: 'brand', icon: 'assets/fleetpoint/icons/map-pin-brand.svg' },
      { label: 'Current speed', value: this.text(vehicle?.speed, '0'), suffix: 'km/h', tone: Number(vehicle?.speed ?? 0) > 80 ? 'danger' : 'success', icon: 'assets/fleetpoint/icons/speedometer.svg' },
      { label: 'Violations', value: this.violationMetric(), suffix: 'total', tone: 'danger', icon: 'assets/fleetpoint/icons/warning.svg' },
      { label: 'Fuel status', value: fuelText, suffix: fuelText === '—' || fuelText.includes('%') ? '' : '%', tone: fuelText === '—' ? 'warning' : Number(String(fuel).replace(/[^0-9.]/g, '')) < 20 ? 'danger' : 'warning', icon: 'assets/fleetpoint/icons/fuel-sensor.svg' },
      { label: 'Ignition', value: vehicle?.ignition_status ? 'On' : 'Off', suffix: vehicle?.online_status ? 'live' : 'reported', tone: vehicle?.ignition_status ? 'success' : 'warning', icon: 'assets/fleetpoint/icons/ignition.svg' },
      { label: 'Safety rules', value: String(enabledRules), suffix: 'enabled', tone: 'success', icon: 'assets/fleetpoint/icons/shield-check.svg' },
      { label: 'Maintenance', value: String(this.count(this.maintenance())), suffix: 'records', tone: 'brand', icon: 'assets/fleetpoint/icons/wrench.svg' },
    ];
  });

  protected readonly lastJobDetail = computed(() => {
    const job = this.lastJob() as any;
    if (!job) return null;
    return {
      jobName: job.job_name || job.name || null,
      driverName: job.driver_name || null,
      driverImage: job.driver_image || null,
      jobType: job.job_type === '1' || job.job_type === 1 ? 'Ad-hoc' : 'Schedule',
      startTime: job.start_time_by_driver || null,
      endTime: job.end_time_by_driver || null,
      distance: job.travelled_distance ?? null,
      speed: job.speed ?? null,
      violations: job.violations ?? 0,
      fillups: job.fill_ups ?? 0,
      completedTasks: job.count_completed_tasks || null,
      pendingTasks: job.count_pending_tasks || null,
      abortedTasks: job.count_aborted_tasks || null,
      tasks: Array.isArray(job.job_tasks) ? job.job_tasks : [],
    };
  });

  /* Feeds the inline trip-replay trail map straight from the same map-trail
     response that drives the trip statistics (lat/long → TripPosition). */
  protected readonly tripPositions = computed<TripPosition[]>(() => {
    const trail = this.trailData() as { map_trail?: any[] } | null;
    const points = Array.isArray(trail?.map_trail) ? trail.map_trail : [];
    return points
      .filter((p) => p && Number.isFinite(Number(p?.lat)) && Number.isFinite(Number(p?.long ?? p?.lng)))
      .map((p) => ({
        lat: Number(p.lat),
        lng: Number(p.long ?? p?.lng),
        speed: Number(p?.speed) || 0,
        heading: Number(p?.heading ?? p?.course) || 0,
        time: String(p?.timestamp ?? ''),
        timestamp: String(p?.timestamp ?? ''),
      }));
  });

  /* ── Trip replay (trips tab) — ported from TripReplayPage: From/To pickers,
     OSRM-snapped trail and the same wall-clock playback engine (VLC-style
     scrub, 1–5× rates, 5s gap clamp). Vehicle comes from this page; stops for
     the event dots come from the vehicle-detail stops API. ── */
  protected readonly replayStartDate = signal('');
  protected readonly replayEndDate = signal('');
  protected readonly playing = signal(false);
  protected readonly replayPositionIndex = signal(0);
  protected readonly replaySpeed = signal(1);
  protected readonly stepDurationMs = signal(600);
  protected readonly routeLoading = signal(false);
  protected readonly playbackRates: Record<number, number> = { 1: 2, 2: 5, 3: 9, 4: 16, 5: 25 };
  protected readonly maxPosition = computed(() => Math.max(this.tripPositions().length - 1, 0));
  protected readonly replayPointNumber = computed(() => (this.tripPositions().length ? this.replayPositionIndex() + 1 : 0));
  protected readonly replayEvents = computed<TripReplayEvent[]>(() => {
    const stops = this.stopsData();
    const positions = this.tripPositions();
    if (!stops.length || !positions.length) return [];
    return stops.map((stop: any, i: number) => ({
      id: `stop-${i}`,
      label: 'Idling',
      type: 'stop' as const,
      positionIndex: this.nearestTimePosition(positions, String(stop?.start_time ?? '')),
      detail: `${this.formatDateShort(stop?.start_time)} → ${this.formatDateShort(stop?.end_time)} · ${this.convertDuration(stop?.duration)}`,
    }));
  });
  private playbackFrame?: number;
  private playbackWallStart = 0;
  private playbackStartIndex = 0;
  private playbackOffsets: number[] = [];
  private playbackTotalMs = 0;
  private playbackRate = 1;
  private static readonly MAX_PLAYBACK_GAP_MS = 5_000;

  /* Ordered pickup→dropoff waypoints drawn from every job task — port of
     hypernym's #jobTrailMap logic: first task's pickup is the route start,
     last task's dropoff is the end, and every task point in between becomes a
     stopover waypoint. These are raw job coordinates (straight-line hops), so
     they are only the fallback/waypoint list: the trail itself is built from
     the OSRM /route geometry in loadJobRoute(). */
  private readonly jobWaypoints = computed<TripPosition[]>(() => {
    const job = this.lastJobDetail();
    const tasks = job?.tasks ?? [];
    if (!tasks.length) return [];
    const start = job?.startTime ? new Date(job.startTime).getTime() : NaN;
    const end = job?.endTime ? new Date(job.endTime).getTime() : NaN;
    const base = Number.isFinite(start) ? start : Number.isFinite(end) ? end : Date.now();
    const span = Number.isFinite(start) && Number.isFinite(end) && end > start ? end - start : tasks.length * 3_600_000;
    const stepMs = span / Math.max(tasks.length, 1);
    const positions: TripPosition[] = [];
    tasks.forEach((task: any, i: number) => {
      const t0 = new Date(base + i * stepMs).toISOString();
      const t1 = new Date(base + (i + 1) * stepMs).toISOString();
      const push = (latRaw: unknown, lngRaw: unknown, time: string, label: string) => {
        const lat = Number(latRaw), lng = Number(lngRaw);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
        positions.push({ lat, lng, speed: 0, heading: 0, time, timestamp: time, location: label });
      };
      push(task?.pick_up__latitude, task?.pick_up__longitude, t0, `Task ${i + 1} Pickup`);
      push(task?.drop_off__latitude, task?.drop_off__longitude, t1, `Task ${i + 1} Dropoff`);
    });
    return positions;
  });

  /* OSRM-snapped job trail. Stays empty until the /route reply lands (and if the
     routing service is unreachable), and the computed below then falls back to
     the raw waypoints so the tab still renders something instead of nothing. */
  private readonly jobRouteTrail = signal<TripPosition[]>([]);
  protected readonly jobRouteLoading = signal(false);
  private jobRouteRequest?: AbortController;
  protected readonly jobRoutePositions = computed<TripPosition[]>(() => {
    const trail = this.jobRouteTrail();
    return trail.length > 1 ? trail : this.jobWaypoints();
  });
  private static readonly JOB_ROUTE_TIMEOUT_MS = 10_000;
  /* OSRM accepts a bounded coordinate list per /route call. */
  private static readonly JOB_ROUTE_MAX_POINTS = 25;

  /* Snap the ordered job waypoints to real roads before any trail is drawn:
     one OSRM /route call with every pickup/dropoff as a stopover (first pickup
     is the origin, last dropoff the destination), then the returned geometry
     replaces the raw straight-line hops. Re-runs when the job payload lands
     after the tab was opened, or when the tab is opened after the payload. */
  private async loadJobRoute(waypoints: TripPosition[]): Promise<void> {
    if (waypoints.length < 2) return;
    this.jobRouteRequest?.abort();
    const controller = new AbortController();
    this.jobRouteRequest = controller;
    this.jobRouteLoading.set(true);
    const timeout = setTimeout(() => controller.abort(), VehicleDetail.JOB_ROUTE_TIMEOUT_MS);
    try {
      const geometry = await this.requestJobGeometry(waypoints, controller.signal);
      if (geometry) this.jobRouteTrail.set(this.jobRoutePoints(geometry, waypoints));
    } finally {
      clearTimeout(timeout);
      if (this.jobRouteRequest === controller) {
        this.jobRouteRequest = undefined;
        this.jobRouteLoading.set(false);
      }
    }
  }

  /* One /route request for the whole waypoint list — OSRM keeps the job order
     and routes through every intermediate stopover. Falls back to the public
     demo router, and returns null when neither answers so the tab keeps the raw
     straight-line waypoints rather than an empty map. */
  private async requestJobGeometry(waypoints: TripPosition[], signal: AbortSignal): Promise<Array<[number, number]> | null> {
    const stride = Math.max(1, Math.ceil(waypoints.length / VehicleDetail.JOB_ROUTE_MAX_POINTS));
    const selected = waypoints.filter((_, index) => index % stride === 0 || index === waypoints.length - 1);
    const coordinates = selected.map((point) => `${point.lng},${point.lat}`).join(';');
    for (const baseUrl of [environment.osrmBaseUrl, environment.osrmFallbackUrl]) {
      try {
        const response = await fetch(
          `${baseUrl}/route/v1/driving/${coordinates}?overview=full&geometries=geojson&alternatives=false&steps=false`,
          { signal },
        );
        if (!response.ok) continue;
        const result = (await response.json()) as {
          code?: string;
          routes?: Array<{ geometry?: { coordinates?: Array<[number, number]> } }>;
        };
        const geometry = result.code === 'Ok' ? result.routes?.[0]?.geometry?.coordinates ?? [] : [];
        if (geometry.length > 1) return geometry;
      } catch {
        // Aborted by a newer load or a timeout — stop; otherwise try the next router.
        if (signal.aborted) return null;
      }
    }
    return null;
  }

  /* Spreads the job's time window and a per-point heading over the OSRM
     geometry so the marker/playback code (time + heading per point) works
     unchanged on the snapped trail. */
  private jobRoutePoints(geometry: Array<[number, number]>, waypoints: TripPosition[]): TripPosition[] {
    const start = Date.parse(String(waypoints[0]?.timestamp || waypoints[0]?.time || ''));
    const end = Date.parse(String(waypoints[waypoints.length - 1]?.timestamp || waypoints[waypoints.length - 1]?.time || ''));
    const span = Number.isFinite(start) && Number.isFinite(end) && end > start ? end - start : 0;
    const last = geometry.length - 1;
    return geometry.map(([lng, lat], index) => {
      const time = span ? new Date(start + (span * index) / last).toISOString() : '';
      return { lat, lng, speed: 0, heading: this.jobHeading(geometry, index), time, timestamp: time };
    });
  }

  private jobHeading(geometry: Array<[number, number]>, index: number): number {
    const [lng, lat] = geometry[Math.min(index + 1, geometry.length - 1)];
    const [prevLng, prevLat] = geometry[Math.max(index - 1, 0)];
    if (lng === prevLng && lat === prevLat) return 0;
    return ((Math.atan2(lng - prevLng, lat - prevLat) * 180) / Math.PI + 360) % 360;
  }

  /* Task markers with pickup/dropoff info cards — parity with hypernym's
     createMarkers(...): pickup pins carry the job start date, dropoff pins the
     job end date (dd-MMM-yyyy, hh:mm a equivalent). Once the trail is OSRM
     geometry the task points are no longer at their waypoint indexes, so each
     event is anchored to the nearest coordinate on the drawn trail. */
  protected readonly jobTrailEvents = computed<TripReplayEvent[]>(() => {
    const job = this.lastJobDetail();
    const pickupDate = job?.startTime ? this.formatDateShort(job.startTime) : '-';
    const dropoffDate = job?.endTime ? this.formatDateShort(job.endTime) : '-';
    const positions = this.jobRoutePositions();
    return this.jobWaypoints().map((waypoint, index) => {
      const pickup = waypoint.location?.includes('Pickup') ?? false;
      return {
        id: `job-task-${index}`,
        label: waypoint.location || `Task point ${index + 1}`,
        type: 'stop' as const,
        positionIndex: this.nearestCoordinatePosition(positions, waypoint.lat, waypoint.lng),
        detail: `${pickup ? 'Pickup' : 'Dropoff'} Date: ${pickup ? pickupDate : dropoffDate}`,
      };
    });
  });

  /* Fillup locations — one marker per fillup record with coordinates. */
  protected readonly fillupMarkers = computed<TrackedVehicle[]>(() => {
    return this.fillupsData()
      .map((fillup: any, i: number) => {
        const lat = Number(fillup?.lat ?? fillup?.latitude);
        const lng = Number(fillup?.long ?? fillup?.lng ?? fillup?.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        return {
          id: `fillup-${i}`,
          model: this.formatDateShort(fillup?.timestamp),
          driver: '',
          status: 'Idling',
          speed: 0,
          fuel: Number(fillup?.volume_consumed) || 0,
          location: '',
          updated: this.formatDateShort(fillup?.timestamp),
          lat,
          lng,
        };
      })
      .filter((marker): marker is TrackedVehicle => marker !== null);
  });

  /* Violation locations — one marker per violation record with coordinates. */
  protected readonly violationMarkers = computed<TrackedVehicle[]>(() => {
    const raw = this.violations() as any;
    const records = Array.isArray(raw) ? raw : raw?.data;
    const list = Array.isArray(records) ? records : [];
    return list
      .map((record: any, i: number) => {
        const lat = Number(record?.lat ?? record?.latitude);
        const lng = Number(record?.long ?? record?.lng ?? record?.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        return {
          id: `violation-${i}`,
          model: record?.violation_type || `Violation ${i + 1}`,
          driver: record?.driver_name || '',
          status: 'Alert',
          speed: Number(record?.speed) || 0,
          fuel: 0,
          location: record?.location || '',
          updated: this.formatDateShort(record?.event_generation_time ?? record?.timestamp),
          lat,
          lng,
        };
      })
      .filter((marker): marker is TrackedVehicle => marker !== null);
  });

  /* Single-vehicle marker for the snapshot tab's map. */
  protected readonly snapshotMarker = computed<TrackedVehicle[]>(() => {
    const snap = this.snapshotResult() as any;
    if (!snap) return [];
    const lat = Number(snap.latitude);
    const lng = Number(snap.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];
    return [{
      id: this.vehicleId,
      model: this.text(snap.vehicle_name || this.record()?.name || this.registration()),
      driver: this.text(snap.assigned_driver, 'Unassigned'),
      status: snap.vehicle_state === 'Idle' ? 'Idling' : 'Moving',
      speed: Number(snap.speed) || 0,
      fuel: Number(snap.volume) || 0,
      location: this.text(snap.location, ''),
      updated: snap.timestamp ? this.formatDateShort(snap.timestamp) : '',
      lat,
      lng,
    }];
  });

  /* Skeleton cards reuse the real static parts (label, tone, icon, suffix) so
     only the value swaps from a shimmer bar to text on load — no reflow. */
  protected readonly skeletonSummaryCards = [
    { label: 'Total distance', tone: 'info', icon: 'assets/fleetpoint/icons/route.svg', suffix: 'km', valueWidth: '3rem' },
    { label: 'Distance today', tone: 'brand', icon: 'assets/fleetpoint/icons/map-pin-brand.svg', suffix: 'km', valueWidth: '3.5rem' },
    { label: 'Current speed', tone: 'success', icon: 'assets/fleetpoint/icons/speedometer.svg', suffix: 'km/h', valueWidth: '3rem' },
    { label: 'Violations', tone: 'danger', icon: 'assets/fleetpoint/icons/warning.svg', suffix: 'total', valueWidth: '2.5rem' },
    { label: 'Fuel status', tone: 'warning', icon: 'assets/fleetpoint/icons/fuel-sensor.svg', suffix: '', valueWidth: '2.25rem' },
    { label: 'Ignition', tone: 'warning', icon: 'assets/fleetpoint/icons/ignition.svg', suffix: 'reported', valueWidth: '2.5rem' },
    { label: 'Safety rules', tone: 'success', icon: 'assets/fleetpoint/icons/shield-check.svg', suffix: 'enabled', valueWidth: '1.5rem' },
    { label: 'Maintenance', tone: 'brand', icon: 'assets/fleetpoint/icons/wrench.svg', suffix: 'records', valueWidth: '1.5rem' },
  ] as const;

  private readonly subscription = new Subscription();
  /* Realtime self-healing: SignalR callbacks run outside the Angular zone and
     can go quiet on backend hiccups, so the HUD would otherwise stay frozen
     until a manual reload. Track the last applied update and, if none arrives
     within the poll window, refresh the telemetry straight from the API so
     speed/needle/stat tiles stay live without a page reload. */
  private lastRealtimeAt = 0;
  private pollRefreshing = false;
  private pollTimer?: ReturnType<typeof setInterval>;
  private trailRange: { start: Date; end: Date } | null = null;
  private static readonly POLL_INTERVAL_MS = 20_000;
  private static readonly REALTIME_STALE_MS = 15_000;

  constructor(
    route: ActivatedRoute,
    private readonly api: VehicleDetailApiService,
    private readonly router: Router,
    private readonly realtime: VehicleRealtimeService,
    private readonly feedback: FeedbackDialogBridgeService,
    private readonly zone: NgZone,
  ) {
    this.vehicleId = route.snapshot.paramMap.get('registration') || route.snapshot.paramMap.get('id') || '';
    this.record.set(this.fallbackRecord());
    this.metrics.set([
      { code: 'VA', name: 'Violation Alerts', data: 0 },
      { code: 'DS', name: 'Distance Today', data: '0 km' },
      { code: 'FS', name: 'Fuel Status', data: 'Not available' },
    ]);
    /* The Last Job trail is only requested while that tab is open, and re-runs
       once the job payload arrives (or the tab is opened after it landed). */
    effect(() => {
      const waypoints = this.jobWaypoints();
      if (this.activeTab() !== 'lastjob' || waypoints.length < 2) return;
      void this.loadJobRoute(waypoints);
    });
  }
  ngOnInit(): void {
    this.subscription.add(
      this.realtime.updates$.subscribe((update) =>
        this.zone.run(() => {
          this.lastRealtimeAt = Date.now();
          this.applyRealtimeUpdate(update);
        }),
      ),
    );
    this.load();
    this.pollTimer = setInterval(() => {
      if (this.pollRefreshing || this.loading()) return;
      if (Date.now() - this.lastRealtimeAt < VehicleDetail.REALTIME_STALE_MS) return;
      this.lastRealtimeAt = Date.now();
      this.refreshTelemetry();
    }, VehicleDetail.POLL_INTERVAL_MS);
  }
  /* Silent-fallback refresh: re-fetches just the live telemetry (vehicle +
     metrics) from the API while realtime is quiet, so the HUD keeps updating
     responsively even when the push channel is down. Never shows loaders. */
  private refreshTelemetry(): void {
    if (this.pollRefreshing) return;
    this.pollRefreshing = true;
    forkJoin({
      vehicle: this.api.getVehicle(this.vehicleId),
      metrics: this.api.getMetrics(this.vehicleId),
    })
      .pipe(finalize(() => (this.pollRefreshing = false)))
      .subscribe({
        next: (result) => {
          const vehicle = result.vehicle.data?.data?.[0];
          if (!vehicle) return;
          this.record.set(vehicle);
          this.metrics.set(result.metrics.data ?? []);
        },
        error: () => (this.pollRefreshing = false),
      });
  }
  protected load(): void {
    this.loading.set(true); this.error.set('');
    forkJoin({
      vehicle: this.api.getVehicle(this.vehicleId), metrics: this.api.getMetrics(this.vehicleId),
      violations: this.api.getViolations(this.vehicleId).pipe(catchError(() => of(null))),
      maintenance: this.api.getMaintenance(this.vehicleId).pipe(catchError(() => of(null))),
      lastJob: this.api.getLastJob(this.vehicleId).pipe(catchError(() => of(null))),
    }).pipe(finalize(() => this.loading.set(false))).subscribe({
      next: (result) => {
        const vehicle = result.vehicle.data?.data?.[0];
        if (!vehicle) { this.showLoadError('Vehicle details were not found.'); return; }
        this.record.set(vehicle); this.metrics.set(result.metrics.data ?? []); this.violations.set(result.violations?.data ?? null); this.maintenance.set(result.maintenance?.data ?? null); this.lastJob.set(result.lastJob?.data ?? null); void this.realtime.connect(vehicle.device_id);
      },
      error: (response) => this.showLoadError(response.error?.message || 'Vehicle details could not be loaded.'),
    });
  }
  protected metricValue(metric: VehicleMetric): string { return this.text(metric.data, '0'); }
  protected violationMetric(): string {
    const metric = this.metrics().find((item) => item.code === 'VA');
    if (metric !== undefined && this.text(metric.data, '') !== '') return this.metricValue(metric);
    /* Fallback: the violations response carries its own total when the VD
       cards endpoint omits or renames the "VA" card. */
    const fallback = this.count(this.violations());
    return fallback > 0 ? String(fallback) : this.metricValue(metric ?? { code: 'VA', name: '', data: 0 });
  }
  protected deviceDetails(): DetailItem[] { const v = this.record(); return [['Device ID', v?.['device_id']], ['SIM Number', v?.['sim_no']], ['Vehicle Type', v?.['vehicle_type']], ['RFID Tag', v?.['rfid_tag']], ['Immobilizer', v?.['is_immobilization_enabled'] ? 'Enabled' : 'Disabled'], ['Ignition', v?.['ignition_status'] ? 'On' : 'Off']].map(([label, value]) => ({ label: String(label), value: this.text(value) })); }
  protected monitoring(): { label: string; enabled: boolean }[] { const v = this.record(); return [['Harsh acceleration', v?.['harsh_acceleration']], ['Harsh braking', v?.['harsh_braking']], ['Geo zone', v?.['geo_zone']], ['Sharp turning', v?.['sharp_turning']], ['Seat belt monitoring', v?.['seat_belt']], ['Immobilization', v?.['is_immobilization_enabled']]].map(([label, enabled]) => ({ label: String(label), enabled: Boolean(enabled) })); }
  protected count(value: unknown): number { const data = value as { count?: number; data?: unknown[] } | null; return Number(data?.count ?? data?.data?.length ?? (Array.isArray(value) ? value.length : 0)); }
  protected summary(value: unknown, fallback: string): string { if (!value) return fallback; const data = value as Record<string, unknown>; const nested = (data['data'] as unknown[])?.[0] as Record<string, unknown> | undefined; return this.text(data['name'] || data['status'] || data['job_status'] || nested?.['name'] || nested?.['status'], fallback); }
  protected image(): string { const value = String(this.record()?.image || '').trim(); return value && !['none', 'null', 'no image', 'n/a'].includes(value.toLowerCase()) ? value : 'assets/fleetpoint/def-car.svg'; }
  protected useDefaultImage(event: Event): void { (event.target as HTMLImageElement).src = 'assets/fleetpoint/def-car.svg'; }
  protected back(): void { void this.router.navigateByUrl('/fleetpoint/vehicles'); }

  protected loadTrailData(start: Date, end: Date): void {
    this.trailRange = { start, end };
    this.trailLoading.set(true);
    this.api.getMapTrail(this.vehicleId, this.toApiDatetime(start), this.toApiDatetime(end))
      .pipe(finalize(() => this.trailLoading.set(false)))
      .subscribe({
        next: (resp) => this.trailData.set(resp.data || null),
        error: () => this.trailData.set(null),
      });
  }

  protected loadStops(): void {
    if (!this.trailRange || this.stopsLoading()) return;
    this.showStops.set(true);
    this.stopsLoading.set(true);
    this.api.getStops(this.vehicleId, this.toApiDatetime(this.trailRange.start), this.toApiDatetime(this.trailRange.end))
      .pipe(finalize(() => this.stopsLoading.set(false)))
      .subscribe({
        next: (resp) => {
          const raw = resp as any;
          const stops = raw?.data?.data;
          this.stopsData.set(Array.isArray(stops) ? stops : []);
        },
        error: () => this.stopsData.set([]),
      });
  }

  protected toggleStops(): void {
    if (this.showStops()) {
      this.showStops.set(false);
      this.stopsData.set([]);
      return;
    }
    this.loadStops();
  }

  protected loadFillups(start: Date, end: Date): void {
    this.fillupsLoading.set(true);
    this.api.getFillups(this.vehicleId, this.toApiDatetime(start), this.toApiDatetime(end))
      .pipe(finalize(() => this.fillupsLoading.set(false)))
      .subscribe({
        next: (resp) => {
          const raw = resp as any;
          const fillups = raw?.response?.[0]?.fillups || resp?.data || [];
          this.fillupsData.set(Array.isArray(fillups) ? fillups : []);
        },
        error: () => this.fillupsData.set([]),
      });
  }

  protected loadMileage(): void {
    this.mileageLoading.set(true);
    this.api.getMileage(this.vehicleId, this.mileageYear(), this.mileageMonth() || undefined)
      .pipe(finalize(() => this.mileageLoading.set(false)))
      .subscribe({
        next: (resp) => {
          const rows = (resp?.data || []) as any[];
          if (!rows.length) { this.mileageData.set([]); return; }
          const totalFuel = rows.reduce((sum, row) => sum + (Number(row.fuel_filled) || 0), 0);
          const totalDistance = rows.reduce((sum, row) => sum + (Number(row.distance_traveled) || 0), 0);
          const mileage = totalFuel > 0 ? totalDistance / totalFuel : null;
          const label = this.mileageMonth() ? 'week' : 'month';
          this.mileageData.set([
            ...rows,
            { [label]: 'Total', fuel_filled: totalFuel, distance_traveled: totalDistance, mileage: mileage !== null && Number.isFinite(mileage) ? mileage : null },
          ]);
        },
        error: () => this.mileageData.set([]),
      });
  }

  protected setMileageYear(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.mileageYear.set(value || String(new Date().getFullYear()));
    this.mileageMonth.set('');
    this.loadMileage();
  }

  protected setMileageMonth(event: Event): void {
    this.mileageMonth.set((event.target as HTMLSelectElement).value);
    this.loadMileage();
  }

  protected convertDuration(duration: unknown): string {
    const seconds = Number(duration);
    if (!Number.isFinite(seconds)) return '—';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remaining = Math.floor(seconds % 60);
    return `${hours}h ${minutes}m ${remaining}s`;
  }

  /* Snapshot timestamp follows the same contract as the legacy FMS tab: the
     picker holds local wall-clock time and the API expects UTC
     'yyyy-MM-dd HH:mm:ss', so both sides must round-trip through Date. */
  protected loadSnapshot(): void {
    if (!this.snapshotDateValue()) return;
    this.snapshotLoading.set(true);
    this.api.getSnapshot(this.vehicleId, this.toApiDatetime(new Date(this.snapshotDateValue())))
      .pipe(finalize(() => this.snapshotLoading.set(false)))
      .subscribe({
        next: (resp) => this.snapshotResult.set(resp?.data ? this.normaliseSnapshot(resp.data) : null),
        error: () => this.snapshotResult.set(null),
      });
  }

  /* The snapshot endpoint returns raw packet values (packet speed, litres,
     unix timestamp, driver object), so normalise them once for the view —
     same shaping the working FMS snapshot tab applies. */
  private normaliseSnapshot(snap: Record<string, any>): Record<string, any> {
    const speed = Number(snap['speed']);
    const volume = Number(snap['volume']);
    const state = snap['vehicle_state'] ? String(snap['vehicle_state']) : '';
    return {
      ...snap,
      vehicle_state: state ? (state === 'Idle' ? 'Idle' : 'Moving') : '',
      speed: Number.isFinite(speed) && snap['speed'] !== null && snap['speed'] !== '' ? Math.round(speed) : null,
      volume: Number.isFinite(volume) && volume > 0 ? Number((volume * 0.219).toFixed(2)) : null,
      temperature: snap['temperature'] ?? null,
      assigned_driver: this.driverName(snap['assigned_driver']),
    };
  }

  private driverName(value: unknown): string {
    if (!value) return '';
    if (typeof value === 'object') return this.text((value as Record<string, unknown>)['name'], '');
    return this.text(value, '');
  }

  protected loadDefaultFillups(): void {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    this.loadFillups(start, end);
  }

  /* Replay controls — same engine as the trip replay page. */
  protected updateReplayStart(value: string): void { this.replayStartDate.set(value); }
  protected updateReplayEnd(value: string): void { this.replayEndDate.set(value); }
  private initReplayRange(): void {
    const end = new Date();
    const start = new Date(end);
    start.setHours(0, 0, 0, 0);
    this.replayStartDate.set(this.inputDate(start));
    this.replayEndDate.set(this.inputDate(end));
  }
  private inputDate(date: Date): string {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
    return local.toISOString().slice(0, 16);
  }
  protected replayLoad(): void {
    const start = this.replayStartDate(), end = this.replayEndDate();
    if (!start || !end || start >= end) return;
    this.pause();
    this.replayPositionIndex.set(0);
    this.showStops.set(false);
    this.stopsData.set([]);
    this.loadTrailData(new Date(start), new Date(end));
  }
  protected togglePlayback(): void { this.playing() ? this.pause() : this.play(); }
  protected play(): void {
    const positions = this.tripPositions();
    if (positions.length < 2) return;
    if (this.replayPositionIndex() >= positions.length - 1) this.replayPositionIndex.set(0);
    this.clearPlaybackFrame();
    this.playing.set(true);
    this.playbackRate = this.playbackRates[this.replaySpeed()] ?? 2;
    this.playbackStartIndex = this.replayPositionIndex();
    this.playbackOffsets = this.buildTimeOffsets(positions, this.playbackStartIndex);
    this.playbackTotalMs = this.playbackOffsets[this.playbackOffsets.length - 1] || 1;
    this.playbackWallStart = performance.now();
    const lastIndex = positions.length - 1;
    const wallStart = this.playbackWallStart;
    const startIdx = this.playbackStartIndex;
    const rate = this.playbackRate;
    const offsets = this.playbackOffsets;
    const totalTripMs = this.playbackTotalMs;
    let lastIdx = 0;
    this.zone.runOutsideAngular(() => {
      const advance = (now: number) => {
        if (!this.playing()) return;
        if (this.playbackWallStart !== wallStart || this.playbackStartIndex !== startIdx) {
          this.playbackFrame = requestAnimationFrame(advance);
          return;
        }
        const elapsedTripMs = (now - wallStart) * rate;
        let idx = 0;
        for (let i = offsets.length - 1; i >= 0; i--) {
          if (offsets[i] <= elapsedTripMs) { idx = i; break; }
        }
        const nextIndex = Math.min(startIdx + idx, lastIndex);
        if (nextIndex !== this.replayPositionIndex()) {
          this.stepDurationMs.set(Math.max(40, (offsets[idx] - offsets[lastIdx]) / rate));
          this.replayPositionIndex.set(nextIndex);
          lastIdx = idx;
        }
        if (elapsedTripMs >= totalTripMs) { this.pause(); return; }
        this.playbackFrame = requestAnimationFrame(advance);
      };
      this.playbackFrame = requestAnimationFrame(advance);
    });
  }
  protected pause(): void { this.clearPlaybackFrame(); this.playing.set(false); }
  protected stopPlayback(): void { this.pause(); this.replayPositionIndex.set(0); }
  protected setReplaySpeed(value: number): void { this.replaySpeed.set(value); if (this.playing()) this.play(); }
  protected scrub(event: Event): void { this.seekTo(Number((event.target as HTMLInputElement).value)); }
  private seekTo(index: number): void {
    const last = this.maxPosition();
    const clamped = Math.max(0, Math.min(index, last));
    if (clamped === last && this.playing()) { this.replayPositionIndex.set(clamped); this.pause(); return; }
    this.replayPositionIndex.set(clamped);
    if (this.playing()) this.play();
  }
  private nearestTimePosition(positions: TripPosition[], value: string): number {
    const target = new Date(value).getTime();
    if (!Number.isFinite(target)) return 0;
    let best = 0;
    let bestDiff = Number.POSITIVE_INFINITY;
    for (let index = 0; index < positions.length; index++) {
      const parsed = new Date(positions[index].timestamp ?? positions[index].time).getTime();
      if (!Number.isFinite(parsed)) continue;
      const diff = Math.abs(parsed - target);
      if (diff < bestDiff) { bestDiff = diff; best = index; }
    }
    return best;
  }
  /* Snapped trails no longer contain the task waypoints verbatim, so each task
     marker is anchored to the closest vertex of the drawn geometry. */
  private nearestCoordinatePosition(positions: TripPosition[], lat: number, lng: number): number {
    if (!positions.length || !Number.isFinite(lat) || !Number.isFinite(lng)) return 0;
    const cosLat = Math.cos((lat * Math.PI) / 180);
    let best = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let index = 0; index < positions.length; index++) {
      const point = positions[index];
      const dLat = Number(point.lat) - lat;
      const dLng = (Number(point.lng) - lng) * cosLat;
      const distance = dLat * dLat + dLng * dLng;
      if (distance < bestDistance) { bestDistance = distance; best = index; }
    }
    return best;
  }

  private buildTimeOffsets(positions: TripPosition[], startIdx: number): number[] {
    const offsets = [0];
    for (let i = startIdx + 1; i < positions.length; i++) {
      const prev = new Date(positions[i - 1]?.timestamp ?? '').getTime();
      const curr = new Date(positions[i]?.timestamp ?? '').getTime();
      const gap = Number.isFinite(prev) && Number.isFinite(curr) && curr > prev
        ? Math.min(curr - prev, VehicleDetail.MAX_PLAYBACK_GAP_MS)
        : this.stepDurationMs();
      offsets.push(offsets[offsets.length - 1] + gap);
    }
    return offsets;
  }
  private clearPlaybackFrame(): void {
    if (this.playbackFrame !== undefined) cancelAnimationFrame(this.playbackFrame);
    this.playbackFrame = undefined;
  }

  private toApiDatetime(date: Date): string {
    return date.toISOString().slice(0, 19).replace('T', ' ');
  }

  protected formatDateShort(value: unknown): string {
    if (!value) return '—';
    let date: Date;
    const v = value as string | number;
    if (typeof v === 'number') {
      date = new Date(v > 1e12 ? v : v * 1000);
    } else {
      date = new Date(v);
    }
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  protected getTaskStatusLabel(status: unknown): string {
    const s = String(status);
    if (s === '1') return 'Pending';
    if (s === '2') return 'Started';
    if (s === '3') return 'Completed';
    if (s === '4') return 'Aborted';
    return '—';
  }

  protected taskLine(task: any): string {
    const status = this.getTaskStatusLabel(task?.task_status);
    if (!task?.abort_reason && !task?.abort_reason_description) return status;
    const parts = [status];
    if (task?.abort_reason) parts.push(task.abort_reason);
    if (task?.abort_reason_description) parts.push(task.abort_reason_description);
    return parts.join(' · ');
  }

  /* Tab switching — plain href="#id" anchors would trigger a Router
     navigation to the root route (home) because of <base href="/">. */
  protected readonly activeTab = signal('overview');
  protected openTab(id: string): void {
    this.activeTab.set(id);
    if (id === 'trips') {
      if (!this.replayStartDate()) this.initReplayRange();
      if (!this.trailData()) this.replayLoad();
    }
    if (id === 'fuel' && !this.fillupsData().length) {
      this.loadDefaultFillups();
      this.loadMileage();
    }
    /* Snapshot tab opens pre-filled with "now", mirroring the FMS tab which
       defaults snapshotDate to the current time so the Load button is usable. */
    if (id === 'snapshot' && !this.snapshotDateValue()) {
      this.snapshotDateValue.set(this.inputDate(new Date()));
    }
  }
  protected openEdit(): void { this.formOpen.set(true); }
  protected closeForm(): void { this.formOpen.set(false); }
  protected saveVehicle(_: VehicleFormValue): void { this.closeForm(); this.load(); }
  protected tripReplay(): void { void this.router.navigateByUrl('/fleetpoint/trip-replay'); }
  protected text(value: unknown, fallback = 'Not available'): string { if (value === null || value === undefined || value === '' || ['none', 'null'].includes(String(value).toLowerCase())) return fallback; return String(value); }
  private unit(value: unknown, suffix: string): string { return this.text(value) === 'Not available' ? 'Not available' : `${value} ${suffix}`; }
  private flag(value: unknown): boolean { return value === true || value === 1 || value === '1'; }

  private applyRealtimeUpdate(update: VehicleRealtimeUpdate): void {
    const vehicle = this.record();
    if (!vehicle || (update.rtp !== undefined && Number(update.rtp) !== 1)) return;
    const packetId = String(update.device_id ?? update.id ?? '');
    const matches = packetId === String(vehicle.device_id ?? '')
      || packetId === String(vehicle.id)
      || update.registration?.toLowerCase() === vehicle.registration?.toLowerCase();
    if (!matches) return;

    const latitude = this.realtimeNumber(update.lat ?? update.latitude, vehicle.latitude);
    const longitude = this.realtimeNumber(update.lon ?? update.lng ?? update.longitude, vehicle.longitude);
    const speed = this.realtimeNumber(update.spd ?? update.speed, vehicle.speed ?? 0);
    const ignition = update.ignition_status ?? update.ign;
    const timestamp = this.realtimeTime(update.t ?? update.updated_time);
    const seatBelt = update.sbStatus === undefined
      ? vehicle['seat_belt']
      : Number(update.sbStatus) === 0;
    const rawHeading = update['course'] ?? update['heading'] ?? update['cog'] ?? update['dir'];

    this.record.set({
      ...vehicle,
      latitude,
      longitude,
      speed,
      heading: rawHeading === undefined ? vehicle['heading'] : Number(rawHeading),
      ignition_status: ignition === undefined ? vehicle.ignition_status : this.flag(ignition),
      online_status: true,
      updated_time: timestamp,
      location: update.location ?? vehicle.location,
      last_volume: update.vol ?? vehicle.last_volume,
      seat_belt: seatBelt,
    });
  }

  private realtimeNumber(value: unknown, fallback: unknown): number {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
    const fallbackNumber = Number(fallback);
    return Number.isFinite(fallbackNumber) ? fallbackNumber : 0;
  }

  private realtimeTime(value: string | number | undefined): string {
    if (!value) return new Date().toLocaleString();
    const date = typeof value === 'number'
      ? new Date(value > 1e12 ? value : value * 1000)
      : new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
  }

  private showLoadError(message: string): void {
    this.error.set(message);
    void this.feedback.open({
      type: 'error',
      title: 'Unable to load vehicle details',
      message,
      confirmText: 'Close',
      showCancel: false,
    });
  }

  // Bridges the detail record (VehicleDetailRecord) to the shape the shared
  // vehicle form expects for editing, defaulting fields the detail endpoint
  // does not surface so the form opens pre-filled and editable.
  private editableVehicle(v: VehicleDetailRecord): VehicleInventoryRecord {
    const pick = <T>(key: string, fallback: T): T => {
      const value = v[key] as T | null | undefined;
      return value === null || value === undefined ? fallback : value;
    };
    return {
      id: v.id,
      device_id: pick<string | null>('device_id', null),
      odo_reading: pick<number | string | null>('odo_reading', '0'),
      fleet_name: pick<string | null>('fleet_name', null),
      name: v.name,
      registration: v.registration,
      make: v.make,
      model: v.model,
      year: v.year,
      status: v.status,
      date_commissioned: pick<string | null>('date_commissioned', null),
      image: v.image,
      engine_number: pick<string>('engine_number', ''),
      chassis_number: pick<string>('chassis_number', ''),
      color: pick<string>('color', ''),
      engine_capacity: pick<string | number>('engine_capacity', 0),
      wheels: pick<string | number>('wheels', 4),
      fuel_tank_capacity: pick<string | number>('fuel_tank_capacity', 0),
      purchase_type: pick<string | number>('purchase_type', '2'),
      engine_type: pick<string | number>('engine_type', ''),
      type: pick<string | number>('type', ''),
      device: pick<string | number>('device', ''),
      camera_device_id: pick<string | number | null>('camera_device_id', null),
      camera_device_type: pick<string | null>('camera_device_type', null),
      fleet: pick<string | number | null>('fleet', null),
      fleet_category: pick<string | number | null>('fleet_category', null),
      speed_threshold: pick<string | number>('speed_threshold', 0),
      harsh_acceleration: pick<boolean>('harsh_acceleration', false),
      harsh_braking: pick<boolean>('harsh_braking', false),
      sharp_turning: pick<boolean>('sharp_turning', false),
      geo_zone: pick<boolean>('geo_zone', false),
      fuel_sensor: pick<boolean>('fuel_sensor', false),
    };
  }

  private fallbackRecord(): VehicleDetailRecord {
    return {
      id: 0,
      name: 'Vehicle details',
      registration: '',
      make: '',
      model: '',
      year: '',
      image: null,
      vehicle_type_image: null,
      status: 0,
      online_status: false,
      speed: 0,
      latitude: null,
      longitude: null,
      location: null,
      updated_time: null,
      updated_at: null,
      heavy_equipment: null,
      fleet_name: null,
      device_id: null,
      ignition_status: false,
      last_volume: null,
      km_per_day: 0,
      vehicle_driver_name: null,
      total_distance_traveled: 0,
      total_violations: 0,
      next_maintenance: null,
    };
  }

  ngOnDestroy(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.clearPlaybackFrame();
    this.subscription.unsubscribe();
    void this.realtime.disconnect();
  }
}
