import { Component, NgZone, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Skeleton, StatCardSkeleton, StatusBadge } from '@iotility/shared-ui';
import { Subscription, catchError, finalize, forkJoin, of } from 'rxjs';
import { FleetMap, TrackedVehicle } from '../../../shared/fleet-map/fleet-map';
import { VehicleDetailApiService, VehicleDetailRecord, VehicleMetric } from '../../../shared/services/vehicle-detail-api.service';
import { VehicleRealtimeService, VehicleRealtimeUpdate } from '../../../shared/services/vehicle-realtime.service';
import { StatCard } from '../../../shared/stat-card/stat-card';
import { FeedbackDialogBridgeService } from '../../../shared/services/feedback-dialog-bridge.service';
import { VehicleForm, VehicleFormValue } from '../vehicle-form/vehicle-form';
import { VehicleHud } from './vehicle-hud/vehicle-hud';
import { VehicleInventoryRecord } from '../../../shared/services/vehicle-inventory-api.service';

interface DetailItem { label: string; value: string; }

@Component({ selector: 'app-vehicle-detail', imports: [FleetMap, Skeleton, StatCard, StatCardSkeleton, StatusBadge, VehicleForm, VehicleHud], templateUrl: './vehicle-detail.html', styleUrl: './vehicle-detail.css' })
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
  protected readonly hasCoordinates = computed(() => Number.isFinite(this.coordinate(this.record()?.latitude)) && Number.isFinite(this.coordinate(this.record()?.longitude)));
  protected readonly mapVehicle = computed<TrackedVehicle>(() => ({
    id: this.vehicleId, model: `${this.text(this.record()?.make)} ${this.text(this.record()?.model)}`.trim(),
    driver: this.text(this.record()?.vehicle_driver_name, 'Unassigned'), status: this.record()?.online_status ? (Number(this.record()?.speed || 0) > 5 ? 'Moving' : 'Idling') : 'Offline',
    speed: Number(this.record()?.speed || 0), fuel: Number(this.record()?.heavy_equipment?.['fuel_level'] || 0),
    location: this.text(this.record()?.location), updated: this.text(this.record()?.updated_time || this.record()?.updated_at),
    lat: this.coordinate(this.record()?.latitude) || 0, lng: this.coordinate(this.record()?.longitude) || 0,
  }));
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
  protected metricTone(index: number): 'brand' | 'info' | 'success' | 'warning' | 'danger' { return ['danger', 'warning', 'info', 'success', 'brand', 'danger'][index % 6] as never; }
  protected metricValue(metric: VehicleMetric): string { return this.text(metric.data, '0'); }

  // Icon paths + corner tag per fact for the telemetry-style spec tiles.
  private static readonly SPEC_META: Record<string, { icon: string[]; tag: string; color: string; tagStyle?: string }> = {
    'Vehicle Name / ID': { icon: ['M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z'], tag: 'Primary', color: '#a78bfa', tagStyle: 'background: rgba(139, 92, 246, 0.15); color: #a78bfa; border-color: rgba(139, 92, 246, 0.5);' },
    'Record Status': { icon: ['M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z'], tag: 'Operational', color: '#34d399', tagStyle: 'background: rgba(16, 185, 129, 0.1); color: #6ee7b7; border-color: rgba(16, 185, 129, 0.3);' },
    'Fleet': { icon: ['M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10'], tag: 'Metro Hub', color: '#818cf8', tagStyle: '' },
    'Make': { icon: ['M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z'], tag: 'OEM', color: '#22d3ee', tagStyle: '' },
    'Model': { icon: ['M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4'], tag: 'Sedan', color: '#60a5fa', tagStyle: '' },
    'Year': { icon: ['M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z'], tag: 'Next Gen', color: '#34d399', tagStyle: 'color: #34d399;' },
    'Colour': { icon: ['M7 21a4 4 0 01-4-4 5 5 0 014-4h4a5 5 0 014 4 4 4 0 01-4 4H7zm0 0v-4'], tag: '#F472B6', color: '#f472b6', tagStyle: 'background: rgba(244, 114, 182, 0.1); color: #f9a8d4; border-color: rgba(244, 114, 182, 0.3);' },
    'Engine Number': { icon: ['M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z', 'M15 12a3 3 0 11-6 0 3 3 0 016 0z'], tag: 'BLOCK', color: '#fb7185', tagStyle: '' },
    'Chassis Number': { icon: ['M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'], tag: 'MATCHED', color: '#c084fc', tagStyle: 'background: rgba(16, 185, 129, 0.15); color: #6ee7b7; border-color: rgba(16, 185, 129, 0.4);' },
    'Engine Capacity': { icon: ['M13 10V3L4 14h7v7l9-11h-7z'], tag: 'DISP', color: '#22d3ee', tagStyle: 'color: #22d3ee;' },
    'Fuel Tank Capacity': { icon: ['M19 14l-7 7m0 0l-7-7m7 7V3'], tag: 'MAX', color: '#34d399', tagStyle: '' },
    'Odometer Reading': { icon: ['M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'], tag: 'Fresh', color: '#2dd4bf', tagStyle: 'background: rgba(6, 182, 212, 0.1); color: #22d3ee; border-color: rgba(6, 182, 212, 0.3);' },
    'Owner': { icon: ['M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z'], tag: 'OWN', color: '#a78bfa', tagStyle: '' },
    'Date Commissioned': { icon: ['M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z'], tag: 'COMM', color: '#fbbf24', tagStyle: '' },
    'Registration Expiry': { icon: ['M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'], tag: 'EXPIRY', color: '#fb7185', tagStyle: '' },
    'Customer': { icon: ['M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z'], tag: 'CUST', color: '#818cf8', tagStyle: '' },
  };
  protected specMeta(label: string): { icon: string[]; tag: string; color: string; tagStyle?: string } {
    return VehicleDetail.SPEC_META[label] ?? { icon: ['M4 6h16M4 12h16M4 18h16'], tag: 'SPEC', color: '#94a3b8', tagStyle: '' };
  }
  protected violationMetric(): string { return this.metricValue(this.metrics().find((metric) => metric.code === 'VA') || { code: 'VA', name: '', data: 0 }); }
  protected isMoving(): boolean { return Number(this.record()?.speed || 0) > 0; }
  protected hasAssignedRoute(): boolean { const routes = this.record()?.['attached_routes_list']; return Array.isArray(routes) && routes.length > 0; }
  protected deviceDetails(): DetailItem[] { const v = this.record(); return [['Device ID', v?.['device_id']], ['SIM Number', v?.['sim_no']], ['Vehicle Type', v?.['vehicle_type']], ['RFID Tag', v?.['rfid_tag']], ['Immobilizer', v?.['is_immobilization_enabled'] ? 'Enabled' : 'Disabled'], ['Ignition', v?.['ignition_status'] ? 'On' : 'Off']].map(([label, value]) => ({ label: String(label), value: this.text(value) })); }
  protected monitoring(): { label: string; enabled: boolean }[] { const v = this.record(); return [['Harsh acceleration', v?.['harsh_acceleration']], ['Harsh braking', v?.['harsh_braking']], ['Geo zone', v?.['geo_zone']], ['Sharp turning', v?.['sharp_turning']], ['Seat belt monitoring', v?.['seat_belt']], ['Immobilization', v?.['is_immobilization_enabled']]].map(([label, enabled]) => ({ label: String(label), enabled: Boolean(enabled) })); }
  protected count(value: unknown): number { const data = value as { count?: number; data?: unknown[] } | null; return Number(data?.count ?? data?.data?.length ?? (Array.isArray(value) ? value.length : 0)); }
  protected summary(value: unknown, fallback: string): string { if (!value) return fallback; const data = value as Record<string, unknown>; const nested = (data['data'] as unknown[])?.[0] as Record<string, unknown> | undefined; return this.text(data['name'] || data['status'] || data['job_status'] || nested?.['name'] || nested?.['status'], fallback); }
  protected image(): string { const value = String(this.record()?.image || '').trim(); return value && !['none', 'null', 'no image', 'n/a'].includes(value.toLowerCase()) ? value : 'assets/fleetpoint/def-car.svg'; }
  protected useDefaultImage(event: Event): void { (event.target as HTMLImageElement).src = 'assets/fleetpoint/def-car.svg'; }
  protected back(): void { void this.router.navigateByUrl('/fleetpoint/vehicles'); }
  protected openEdit(): void { this.formOpen.set(true); }
  protected closeForm(): void { this.formOpen.set(false); }
  protected saveVehicle(_: VehicleFormValue): void { this.closeForm(); this.load(); }
  protected getNeedleRotation(): number {
    const speed = Number(this.record()?.speed || 0);
    const maxSpeed = 160;
    const normalized = Math.min(Math.max(speed / maxSpeed, 0), 1);
    return -90 + (normalized * 180);
  }

  protected getArcDash(): string {
    return '502.65';
  }

  protected getArcOffset(): string {
    const speed = Number(this.record()?.speed || 0);
    const maxSpeed = 160;
    const normalized = Math.min(Math.max(speed / maxSpeed, 0), 1);
    const arcLength = 502.65;
    return String(arcLength - (normalized * arcLength));
  }
  protected tripReplay(): void { void this.router.navigateByUrl('/fleetpoint/trip-replay'); }
  protected text(value: unknown, fallback = 'Not available'): string { if (value === null || value === undefined || value === '' || ['none', 'null'].includes(String(value).toLowerCase())) return fallback; return String(value); }
  private unit(value: unknown, suffix: string): string { return this.text(value) === 'Not available' ? 'Not available' : `${value} ${suffix}`; }
  private coordinate(value: unknown): number { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : Number.NaN; }
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
