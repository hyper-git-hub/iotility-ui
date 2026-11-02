import { Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Skeleton, SmoothHeight, Tooltip } from '@iotility/shared-ui';
import { Subscription } from 'rxjs';
import { FeedbackDialogBridgeService } from '../../shared/services/feedback-dialog-bridge.service';
import { PoiApiRecord, PoisApiService } from '../../shared/services/pois-api.service';
import { NOT_AVAILABLE, text } from '../maintenance/maintenance.data';
import { FleetMap, MapZoneOverlay, TrackedVehicle, VehicleStatus } from '../../shared/fleet-map/fleet-map';
import { StatCard } from '../../shared/stat-card/stat-card';
import { PoiForm } from './poi-form/poi-form';

type PoiType =
  | 'depot' | 'customer' | 'fuel' | 'rest' | 'exclusion'
  | 'unsafe' | 'competitor' | 'route' | 'custom';

/**
 * Type vocabulary and icons from the `main` branch POI_TYPE_CONFIG
 * (Building2, Users, Fuel, Coffee, Shield, AlertOctagon, Zap, MapPin).
 * Inlined rather than <img> so `currentColor` applies and the chips follow the
 * app theme instead of a baked-in stroke colour.
 */
const POI_TYPE_CONFIG: Array<{ id: PoiType; label: string; paths: string[] }> = [
  { id: 'depot', label: 'Depot', paths: [
      'M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z',
      'M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2',
      'M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2',
      'M10 6h4',
      'M10 10h4',
      'M10 14h4',
      'M10 18h4',
    ] },
  { id: 'customer', label: 'Customer Site', paths: [
      'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
      'M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8',
      'M22 21v-2a4 4 0 0 0-3-3.87',
      'M16 3.13a4 4 0 0 1 0 7.75',
    ] },
  { id: 'fuel', label: 'Fuel Station', paths: [
      'M3 22h12',
      'M4 9h10',
      'M14 22V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18',
      'M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2a2 2 0 0 0 2-2V9.83a2 2 0 0 0-.59-1.42L18 5',
    ] },
  { id: 'rest', label: 'Rest Stop', paths: [
      'M10 2v2',
      'M14 2v2',
      'M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1',
    ] },
  { id: 'exclusion', label: 'Exclusion Zone', paths: [
      'M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z',
    ] },
  { id: 'unsafe', label: 'Unsafe Area', paths: [
      'M8.7 3.7 2.4 10a2 2 0 0 0 0 2.8l6.3 6.3a2 2 0 0 0 2.8 0l6.3-6.3a2 2 0 0 0 0-2.8l-6.3-6.3a2 2 0 0 0-2.8 0',
      'M12 8v4',
      'M12 16h.01',
    ] },
  { id: 'competitor', label: 'Competitor', paths: [
      'M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z',
    ] },
  { id: 'route', label: 'Route', paths: [
      'M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0',
      'M12 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
    ] },
  { id: 'custom', label: 'Custom', paths: [
      'M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0',
      'M12 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
    ] },
];

/** Legacy minimum accepted radius, reused as the floor for area footprints. */
const POI_RADIUS_MIN = 50;

interface PoiVisit { vehicle: string; driver: string; time: string; dwell: string; breach?: boolean; }
/**
 * Per-type map marker art. The fleet map draws whatever image the marker
 * record carries, so POIs point at the type pin/asset set instead of the
 * default vehicle silhouette.
 */
const POI_MARKER_ASSETS: Record<PoiType, string> = {
  depot: 'assets/fleetpoint/icons/poi-type-depot.svg',
  customer: 'assets/fleetpoint/icons/poi-type-customer.svg',
  fuel: 'assets/fleetpoint/icons/poi-type-fuel.svg',
  rest: 'assets/fleetpoint/icons/poi-type-rest.svg',
  exclusion: 'assets/fleetpoint/icons/poi-type-exclusion.svg',
  unsafe: 'assets/fleetpoint/icons/poi-type-unsafe.svg',
  competitor: 'assets/fleetpoint/icons/poi-type-competitor.svg',
  route: 'assets/fleetpoint/icons/poi-type-route.svg',
  custom: 'assets/fleetpoint/icons/poi-type-custom.svg',
};

/**
 * Types that describe an AREA rather than a single point. These are drawn on the
 * map as a geozone footprint — a filled polygon with an outline — using the POI
 * radius, instead of (or alongside) a pin. The remaining types are explicitly
 * location-based, so they keep a marker only.
 */
const POI_AREA_TYPES: Record<PoiType, boolean> = {
  depot: false,
  customer: false,
  fuel: false,
  rest: false,
  exclusion: true,
  unsafe: true,
  competitor: false,
  route: true,
  custom: false,
};

/** Map colours, matching the legend and the main-branch type palette. */
const POI_MAP_COLORS: Record<PoiType, string> = {
  depot: '#7c3aed',
  customer: '#2563eb',
  fuel: '#d97706',
  rest: '#16a34a',
  exclusion: '#dc2626',
  unsafe: '#ea580c',
  competitor: '#e11d48',
  route: '#0d9488',
  custom: '#6b7280',
};
interface PoiRecord {
  recordId: number; id: string; name: string; address: string; type: PoiType; typeName: string;
  visitsToday: string; assigned: string; radius: number; geozone: boolean; alerts: number; sla?: number;
  lat: number; lng: number; visitsWeek: string; avgDwell: string; contact?: string; phone?: string; visits: PoiVisit[];
}

/**
 * Binds what GET fms-fleet/api/poi sends. The API has one generic "Marker" type, no address and
 * no visit, alert or SLA tracking, so those read "—" and every POI uses the generic Custom pin.
 */
function toPoiRecord(poi: PoiApiRecord): PoiRecord | null {
  const point = territory(poi.territory);
  if (!point) return null;
  const vehicles = poi.assigned_trucks_count;
  return {
    recordId: poi.id, id: `POI${String(poi.id).padStart(2, '0')}`, name: text(poi.name), address: NOT_AVAILABLE,
    type: 'custom', typeName: text(poi.type_name ?? poi.poi_type_name ?? 'Marker'), visitsToday: NOT_AVAILABLE,
    assigned: vehicles ? `${vehicles} vehicle${vehicles === 1 ? '' : 's'}` : NOT_AVAILABLE,
    radius: Number(poi.radius) || POI_RADIUS_MIN, geozone: poi.geo_zone != null, alerts: 0, lat: point.lat, lng: point.lng,
    visitsWeek: NOT_AVAILABLE, avgDwell: NOT_AVAILABLE, visits: [],
  };
}

/** territory arrives as {"lat","lng"}, either parsed or as a JSON string. */
function territory(value: PoiApiRecord['territory']): { lat: number; lng: number } | null {
  let parsed: unknown = value;
  if (typeof value === 'string') {
    try { parsed = JSON.parse(value); } catch { return null; }
  }
  const point = parsed as { lat?: unknown; lng?: unknown } | null;
  const lat = Number(point?.lat), lng = Number(point?.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) && (lat || lng) ? { lat, lng } : null;
}

/** Lucide icon paths from the `main` branch POI card (Clock, Users, MapPin, ShieldCheck, ChevronDown). */
const ICONS: Record<string, string[]> = {
  clock: ['M12 6v6l4 2', 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20'],
  users: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8', 'M22 21v-2a4 4 0 0 0-3-3.87'],
  pin: ['M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0', 'M12 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6'],
  shield: ['M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z', 'm9 12 2 2 4-4'],
  chevron: ['m6 9 6 6 6-6'],
  eye: ['M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7', 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6'],
  pencil: ['M12 20h9', 'M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z'],
  trash: ['M3 6h18', 'M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2', 'M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6', 'M10 11v6', 'M14 11v6'],
};

@Component({
  selector: 'app-poi-page',
  imports: [FleetMap, PoiForm, Skeleton, SmoothHeight, StatCard, Tooltip],
  templateUrl: './poi-page.html',
  styleUrl: './poi-page.css',
})
export class PoiPage {
  private readonly api = inject(PoisApiService);
  private readonly feedback = inject(FeedbackDialogBridgeService);
  private readonly destroyRef = inject(DestroyRef);
  private request?: Subscription;
  /** False until the first POI response; stat cards and the list show skeletons. */
  protected readonly loaded = signal(false);
  protected readonly skeletonCards = [0, 1, 2, 3];
  protected readonly search = signal('');
  protected readonly typeFilter = signal<'all' | PoiType>('all');
  protected readonly expandedId = signal<string | null>(null);
  protected readonly poiFormOpen = signal(false);
  protected readonly typeTabs: Array<{ id: 'all' | PoiType; label: string }> = [
    { id: 'all', label: 'All POIs' }, { id: 'depot', label: 'Depot' },
    { id: 'customer', label: 'Customer Site' }, { id: 'fuel', label: 'Fuel Station' },
    { id: 'rest', label: 'Rest Stop' }, { id: 'exclusion', label: 'Exclusion Zone' },
    { id: 'unsafe', label: 'Unsafe Area' }, { id: 'competitor', label: 'Competitor' },
    { id: 'route', label: 'Route' }, { id: 'custom', label: 'Custom' },
  ];
  private readonly records = signal<PoiRecord[]>([]);
  protected readonly visibleTabs = computed(() => this.typeTabs
    .filter((tab) => tab.id === 'all' || this.count(tab.id) > 0));
  protected readonly total = computed(() => this.records().length);
  /** The API has no visit, alert, SLA or exclusion tracking. */
  protected readonly visitsToday = NOT_AVAILABLE;
  protected readonly activeAlerts = NOT_AVAILABLE;
  protected readonly slaBreaches = NOT_AVAILABLE;
  protected readonly exclusionViolations = NOT_AVAILABLE;
  protected readonly filtered = computed(() => {
    const query = this.search().trim().toLowerCase();
    return this.records().filter((poi) => (this.typeFilter() === 'all' || poi.type === this.typeFilter())
      && (!query || `${poi.name} ${poi.address}`.toLowerCase().includes(query)));
  });
  /**
   * Filter signature handed to the fleet map. The type tabs and the search box
   * reshape the visible POI set, so the map must re-frame on them — without
   * this the camera stays parked on whichever POI was last focused and a
   * filtered set that does not contain it renders off-screen. The record count
   * is included so the map re-frames once the POIs load or one is added.
   */
  protected readonly mapFilterKey = computed(
    () => `${this.typeFilter()}|${this.search().trim().toLowerCase()}|${this.records().length}`,
  );
  protected readonly mapPois = computed<TrackedVehicle[]>(() => this.filtered().map((poi) => ({
    id: poi.id, model: poi.name, driver: poi.typeName, status: this.mapStatus(poi),
    speed: 0, fuel: 0, location: poi.address, updated: `${poi.visitsToday} visits today`,
    lat: poi.lat, lng: poi.lng, image: POI_MARKER_ASSETS[poi.type],
  })));
  /** True when the POI covers an area rather than a single location. */
  protected isArea(poi: PoiRecord): boolean { return POI_AREA_TYPES[poi.type]; }
  /**
   * Area-typed POIs are handed to the map as zone overlays, so they render as a
   * geozone footprint (filled area + outline) built from the POI radius. Their
   * pin is kept as well, so the marker stays clickable and the popup keeps
   * working exactly as it does for point POIs.
   */
  protected readonly mapZones = computed<MapZoneOverlay[]>(() => this.filtered()
    .filter((poi) => POI_AREA_TYPES[poi.type])
    .map((poi) => ({
      id: poi.id,
      label: poi.name,
      geometry: 'circle' as const,
      color: POI_MAP_COLORS[poi.type],
      center: [poi.lat, poi.lng] as [number, number],
      radius: Math.max(POI_RADIUS_MIN, poi.radius),
    })));
  /**
   * Popup body for a POI marker, matching the `main` design: title, address,
   * type with today's visit count, and an alert line when the POI has active
   * alerts. Colours come from the app theme tokens, so it follows light/dark.
   */
  protected readonly poiPopupTemplate = (item: TrackedVehicle): string => {
    const poi = this.records().find((record) => record.id === item.id);
    const visits = poi?.visitsToday ?? NOT_AVAILABLE;
    const alerts = poi?.alerts ?? 0;
    const alertRow = alerts
      ? `<p class="poi-popup-alert"><span aria-hidden="true">⚠</span> ${alerts} active alert${alerts === 1 ? '' : 's'}</p>`
      : '';
    return `
      <div class="poi-popup">
        <h4 class="poi-popup-title">${item.model}</h4>
        <p class="poi-popup-address">${item.location}</p>
        <p class="poi-popup-meta"><span>${item.driver}</span><b>·</b><span>${visits} visits today</span></p>
        ${alertRow}
      </div>`;
  };
  protected updateSearch(event: Event): void { this.search.set((event.target as HTMLInputElement).value); }
  protected selectType(type: 'all' | PoiType): void { this.typeFilter.set(type); this.expandedId.set(null); }
  protected toggle(poi: PoiRecord): void { this.expandedId.update((id) => id === poi.id ? null : poi.id); }
  protected selectFromMap(item: TrackedVehicle): void { this.expandedId.set(item.id); }
  protected openPoiForm(): void { this.poiFormOpen.set(true); }
  protected closePoiForm(): void { this.poiFormOpen.set(false); }
  protected createPoi(): void { this.closePoiForm(); this.api.changed(); }
  protected count(type: 'all' | PoiType): number { return type === 'all' ? this.total() : this.records().filter((poi) => poi.type === type).length; }

  constructor() {
    effect(() => {
      this.api.version();
      untracked(() => this.load());
    });
  }

  protected async remove(poi: PoiRecord): Promise<void> {
    const confirmed = await this.feedback.open({ type: 'warning', title: 'Delete POI?', message: `${poi.name} will be permanently deleted.`, confirmText: 'Delete', cancelText: 'Cancel', showCancel: true });
    if (!confirmed) return;
    const failed = (message?: string) => void this.feedback.open({ type: 'error', title: 'Unable to delete', message: message || 'The POI could not be deleted. Please try again.', showCancel: false });
    this.api.delete(poi.recordId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {
        if (response.status === 1002) return failed(response.message);
        if (this.expandedId() === poi.id) this.expandedId.set(null);
        this.api.changed();
      },
      error: (error: { error?: { message?: string } }) => failed(error.error?.message),
    });
  }

  private load(): void {
    this.request?.unsubscribe();
    this.request = this.api.list().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (pois) => { this.records.set(pois.map(toPoiRecord).filter((poi): poi is PoiRecord => !!poi)); this.loaded.set(true); },
      error: () => { this.records.set([]); this.loaded.set(true); },
    });
  }
  protected typeIconPaths(type: PoiType): string[] {
    return POI_TYPE_CONFIG.find((config) => config.id === type)?.paths ?? POI_TYPE_CONFIG[8].paths;
  }

  protected typeLabel(type: PoiType): string { return this.typeTabs.find((item) => item.id === type)?.label ?? 'Custom'; }
  protected icon(name: keyof typeof ICONS): string[] { return ICONS[name]; }
  protected typeIconPath(type: PoiType): string {
    return ({
      depot: 'M4 20V7l8-4 8 4v13M8 20v-4h8v4M8 9h.01M12 9h.01M16 9h.01M8 12h.01M12 12h.01M16 12h.01',
      customer: 'M3.5 19c.4-3.8 2.2-5.7 5.5-5.7s5.1 1.9 5.5 5.7M6 8a3 3 0 1 0 6 0 3 3 0 0 0-6 0M16 7v5M13.5 9.5h5',
      fuel: 'M5 20V5h9v15M7.5 8h4M3 20h13M14 8l3 3v6a2 2 0 0 0 4 0V9l-2-2',
      rest: 'M5 9h12v4a6 6 0 0 1-12 0V9M17 11h1.5a2.5 2.5 0 0 1 0 5H16M8 5v2m3-3v3m3-2v2',
      exclusion: 'M12 3 5 6v6c0 4 2.8 7 7 9 4.2-2 7-5 7-9V6l-7-3ZM9 9l6 6m0-6-6 6',
      unsafe: 'M10.2 4.7 3.5 17a2 2 0 0 0 1.8 3h13.4a2 2 0 0 0 1.8-3L13.8 4.7a2 2 0 0 0-3.6 0ZM12 9v4m0 3h.01',
      custom: 'M20 10c0 5-5.4 9.1-7.3 10.4a1.2 1.2 0 0 1-1.4 0C9.4 19.1 4 15 4 10a8 8 0 1 1 16 0ZM12 7.5v5M9.5 10h5',
    } as Record<PoiType, string>)[type];
  }
  private mapStatus(poi: PoiRecord): VehicleStatus { return poi.alerts ? 'Alert' : poi.type === 'depot' ? 'Moving' : poi.type === 'customer' ? 'Idling' : 'Offline'; }
}
