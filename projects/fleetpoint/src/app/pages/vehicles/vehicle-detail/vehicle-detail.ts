import { Component, OnInit, computed, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { BlockingLoader } from '@iotility/shared-ui';
import { catchError, finalize, forkJoin, of } from 'rxjs';
import { FleetMap, TrackedVehicle } from '../../../shared/fleet-map/fleet-map';
import { VehicleDetailApiService, VehicleDetailRecord, VehicleMetric } from '../../../shared/services/vehicle-detail-api.service';
import { StatCard } from '../../../shared/stat-card/stat-card';

interface DetailItem { label: string; value: string; }

@Component({ selector: 'app-vehicle-detail', imports: [BlockingLoader, FleetMap, StatCard], templateUrl: './vehicle-detail.html', styleUrl: './vehicle-detail.css' })
export class VehicleDetail implements OnInit {
  protected readonly vehicleId: string;
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly record = signal<VehicleDetailRecord | null>(null);
  protected readonly metrics = signal<VehicleMetric[]>([]);
  protected readonly violations = signal<unknown>(null);
  protected readonly maintenance = signal<unknown>(null);
  protected readonly lastJob = signal<unknown>(null);
  protected readonly registration = computed(() => this.text(this.record()?.registration || this.record()?.name, `Vehicle ${this.vehicleId}`));
  protected readonly hasCoordinates = computed(() => Number.isFinite(this.coordinate(this.record()?.latitude)) && Number.isFinite(this.coordinate(this.record()?.longitude)));
  protected readonly mapVehicle = computed<TrackedVehicle>(() => ({
    id: this.vehicleId, model: `${this.text(this.record()?.make)} ${this.text(this.record()?.model)}`.trim(),
    driver: this.text(this.record()?.vehicle_driver_name, 'Unassigned'), status: this.record()?.online_status ? 'Idling' : 'Offline',
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

  constructor(route: ActivatedRoute, private readonly api: VehicleDetailApiService, private readonly router: Router) { this.vehicleId = route.snapshot.paramMap.get('registration') || route.snapshot.paramMap.get('id') || ''; }
  ngOnInit(): void { this.load(); }
  protected load(): void {
    this.loading.set(true); this.error.set('');
    forkJoin({
      vehicle: this.api.getVehicle(this.vehicleId), metrics: this.api.getMetrics(this.vehicleId),
      violations: this.api.getViolations(this.vehicleId).pipe(catchError(() => of(null))),
      maintenance: this.api.getMaintenance(this.vehicleId).pipe(catchError(() => of(null))),
      lastJob: this.api.getLastJob(this.vehicleId).pipe(catchError(() => of(null))),
    }).pipe(finalize(() => this.loading.set(false))).subscribe({
      next: (result) => { const vehicle = result.vehicle.data?.data?.[0]; if (!vehicle) { this.error.set('Vehicle details were not found.'); return; } this.record.set(vehicle); this.metrics.set(result.metrics.data ?? []); this.violations.set(result.violations?.data ?? null); this.maintenance.set(result.maintenance?.data ?? null); this.lastJob.set(result.lastJob?.data ?? null); },
      error: (response) => this.error.set(response.error?.message || 'Vehicle details could not be loaded.'),
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
  protected image(): string { const value = String(this.record()?.image || '').trim(); return value && !['none', 'null', 'no image', 'n/a'].includes(value.toLowerCase()) ? value : 'assets/fleetpoint/vehicle.svg'; }
  protected useDefaultImage(event: Event): void { (event.target as HTMLImageElement).src = 'assets/fleetpoint/vehicle.svg'; }
  protected back(): void { void this.router.navigateByUrl('/fleetpoint/vehicles'); }
  protected tripReplay(): void { void this.router.navigateByUrl('/fleetpoint/trip-replay'); }
  protected text(value: unknown, fallback = 'Not available'): string { if (value === null || value === undefined || value === '' || ['none', 'null'].includes(String(value).toLowerCase())) return fallback; return String(value); }
  private unit(value: unknown, suffix: string): string { return this.text(value) === 'Not available' ? 'Not available' : `${value} ${suffix}`; }
  private coordinate(value: unknown): number { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : Number.NaN; }
  private flag(value: unknown): boolean { return value === true || value === 1 || value === '1'; }
  private falseFlag(value: unknown): boolean { return value === false || value === 0 || value === '0'; }
}
