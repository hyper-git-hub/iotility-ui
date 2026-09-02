import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Skeleton, StatCardSkeleton, StatusBadge } from '@iotility/shared-ui';
import { Subscription, catchError, finalize, forkJoin, of } from 'rxjs';
import { FleetMap, TrackedVehicle } from '../../../shared/fleet-map/fleet-map';
import { VehicleDetailApiService, VehicleDetailRecord, VehicleMetric } from '../../../shared/services/vehicle-detail-api.service';
import { VehicleRealtimeService, VehicleRealtimeUpdate } from '../../../shared/services/vehicle-realtime.service';
import { StatCard } from '../../../shared/stat-card/stat-card';
import { FeedbackDialogBridgeService } from '../../../shared/services/feedback-dialog-bridge.service';
import { VehicleForm, VehicleFormValue } from '../vehicle-form/vehicle-form';
import { VehicleInventoryRecord } from '../../../shared/services/vehicle-inventory-api.service';

interface DetailItem { label: string; value: string; }

@Component({ selector: 'app-vehicle-detail', imports: [FleetMap, Skeleton, StatCard, StatCardSkeleton, StatusBadge, VehicleForm], templateUrl: './vehicle-detail.html', styleUrl: './vehicle-detail.css' })
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
  protected readonly heavyEquipment = computed<DetailItem[]>(() => {
    const h = this.record()?.heavy_equipment || {};
    return [['Engine RPM', h['engine_rpm']], ['Engine Load', this.unit(h['engine_load'], '%')], ['Coolant Temperature', this.unit(h['coolant_temp'], '°C')],
      ['Intake Air Temperature', this.unit(h['intake_air_temp'], '°C')], ['Throttle Position', this.unit(h['throttle_position'], '%')],
      ['Fuel Level', this.unit(h['fuel_level'], '%')], ['Operating State', this.getHeavyEquipmentState()], ['Eye Movement', this.flag(h['eye_movement']) ? 'Detected' : 'Not detected']]
      .map(([label, value]) => ({ label: String(label), value: this.text(value) }));
  });

  private readonly subscription = new Subscription();

  constructor(
    route: ActivatedRoute,
    private readonly api: VehicleDetailApiService,
    private readonly router: Router,
    private readonly realtime: VehicleRealtimeService,
    private readonly feedback: FeedbackDialogBridgeService,
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
      this.realtime.updates$.subscribe((update) => this.applyRealtimeUpdate(update)),
    );
    this.load();
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
  protected violationMetric(): string { return this.metricValue(this.metrics().find((metric) => metric.code === 'VA') || { code: 'VA', name: '', data: 0 }); }
  protected isMoving(): boolean { return Number(this.record()?.speed || 0) > 0; }
  protected hasAssignedRoute(): boolean { const routes = this.record()?.['attached_routes_list']; return Array.isArray(routes) && routes.length > 0; }
  protected getHeavyEquipmentState(): string {
    const vehicle = this.record();
    const equipment = vehicle?.heavy_equipment;
    if (!equipment) return '-';

    const idleStatus = this.flag(equipment['idle_status']);
    const notIdleStatus = this.falseFlag(equipment['idle_status']);
    const eyeMovement = this.flag(equipment['eye_movement']);
    const speed = Number(vehicle?.speed ?? 0);

    if (idleStatus && eyeMovement) return 'Productive';
    if (idleStatus && !eyeMovement) return 'Idle';
    if (notIdleStatus && speed > 8) return 'Traveling';
    return '-';
  }
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
  protected tripReplay(): void { void this.router.navigateByUrl('/fleetpoint/trip-replay'); }
  protected text(value: unknown, fallback = 'Not available'): string { if (value === null || value === undefined || value === '' || ['none', 'null'].includes(String(value).toLowerCase())) return fallback; return String(value); }
  private unit(value: unknown, suffix: string): string { return this.text(value) === 'Not available' ? 'Not available' : `${value} ${suffix}`; }
  private coordinate(value: unknown): number { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : Number.NaN; }
  private flag(value: unknown): boolean { return value === true || value === 1 || value === '1'; }
  private falseFlag(value: unknown): boolean { return value === false || value === 0 || value === '0'; }

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

    this.record.set({
      ...vehicle,
      latitude,
      longitude,
      speed,
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
    this.subscription.unsubscribe();
    void this.realtime.disconnect();
  }
}
