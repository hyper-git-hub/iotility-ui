import { Component, NgZone, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Skeleton, StatusBadge } from '@iotility/shared-ui';
import { Subscription, catchError, finalize, forkJoin, of } from 'rxjs';
import { VehicleDetailApiService, VehicleDetailRecord, VehicleMetric } from '../../../shared/services/vehicle-detail-api.service';
import { VehicleRealtimeService, VehicleRealtimeUpdate } from '../../../shared/services/vehicle-realtime.service';
import { FeedbackDialogBridgeService } from '../../../shared/services/feedback-dialog-bridge.service';
import { VehicleForm, VehicleFormValue } from '../vehicle-form/vehicle-form';
import { VehicleHud } from './vehicle-hud/vehicle-hud';
import { VehicleInventoryRecord } from '../../../shared/services/vehicle-inventory-api.service';

interface DetailItem { label: string; value: string; }
interface SummaryCard { label: string; value: string; suffix: string; tone: 'brand' | 'info' | 'success' | 'warning' | 'danger'; icon: string; }

@Component({ selector: 'app-vehicle-detail', imports: [Skeleton, StatusBadge, VehicleForm, VehicleHud], templateUrl: './vehicle-detail.html', styleUrl: './vehicle-detail.css' })
export class VehicleDetail implements OnInit, OnDestroy {
  protected readonly vehicleId: string;
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly record = signal<VehicleDetailRecord | null>(null);
  protected readonly metrics = signal<VehicleMetric[]>([]);
  protected readonly violations = signal<unknown>(null);
  protected readonly maintenance = signal<unknown>(null);
  protected readonly lastJob = signal<unknown>(null);
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
  protected violationMetric(): string { return this.metricValue(this.metrics().find((metric) => metric.code === 'VA') || { code: 'VA', name: '', data: 0 }); }
  protected deviceDetails(): DetailItem[] { const v = this.record(); return [['Device ID', v?.['device_id']], ['SIM Number', v?.['sim_no']], ['Vehicle Type', v?.['vehicle_type']], ['RFID Tag', v?.['rfid_tag']], ['Immobilizer', v?.['is_immobilization_enabled'] ? 'Enabled' : 'Disabled'], ['Ignition', v?.['ignition_status'] ? 'On' : 'Off']].map(([label, value]) => ({ label: String(label), value: this.text(value) })); }
  protected monitoring(): { label: string; enabled: boolean }[] { const v = this.record(); return [['Harsh acceleration', v?.['harsh_acceleration']], ['Harsh braking', v?.['harsh_braking']], ['Geo zone', v?.['geo_zone']], ['Sharp turning', v?.['sharp_turning']], ['Seat belt monitoring', v?.['seat_belt']], ['Immobilization', v?.['is_immobilization_enabled']]].map(([label, enabled]) => ({ label: String(label), enabled: Boolean(enabled) })); }
  protected count(value: unknown): number { const data = value as { count?: number; data?: unknown[] } | null; return Number(data?.count ?? data?.data?.length ?? (Array.isArray(value) ? value.length : 0)); }
  protected summary(value: unknown, fallback: string): string { if (!value) return fallback; const data = value as Record<string, unknown>; const nested = (data['data'] as unknown[])?.[0] as Record<string, unknown> | undefined; return this.text(data['name'] || data['status'] || data['job_status'] || nested?.['name'] || nested?.['status'], fallback); }
  protected image(): string { const value = String(this.record()?.image || '').trim(); return value && !['none', 'null', 'no image', 'n/a'].includes(value.toLowerCase()) ? value : 'assets/fleetpoint/def-car.svg'; }
  protected useDefaultImage(event: Event): void { (event.target as HTMLImageElement).src = 'assets/fleetpoint/def-car.svg'; }
  protected back(): void { void this.router.navigateByUrl('/fleetpoint/vehicles'); }
  /* In-page tab scrolling — plain href="#id" anchors would trigger a Router
     navigation to the root route (home) because of <base href="/">. */
  protected readonly activeTab = signal('vehicle-overview');
  protected scrollTo(id: string): void {
    this.activeTab.set(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
    this.subscription.unsubscribe();
    void this.realtime.disconnect();
  }
}
