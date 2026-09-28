import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  computed,
  effect,
  input,
  signal,
  viewChild,
} from '@angular/core';
import maplibregl from 'maplibre-gl';
import { createIotMap, timezoneCenter } from '../../../../shared/maps/maplibre';
import { Skeleton } from '@iotility/shared-ui';
import { environment } from '../../../../../environments/environment';
import { VehicleDetailRecord, VehicleMetric } from '../../../../shared/services/vehicle-detail-api.service';

/**
 * Live trip cockpit HUD shown above the vehicle overview row. Ultra-wide
 * layout: a 58/42 split — left has an abstract map + route hood, right holds a
 * neon speedometer dial and the telemetry stat cards. Every number is driven by
 * the vehicle detail record (live-updated via realtime) with static fallbacks
 * for parts with no backing API data.
 */

const CX = 140;
const CY = 110;
const MAX_SPEED = 180;
/* The dial sweeps 216° — 0 km/h sits 18° below horizontal on the left, 180 km/h
   mirrors it on the right, 90 km/h points straight up. That is 1.2° per km/h. */
const DEG_PER_UNIT = 1.2;

interface GaugeTick {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stroke: string;
  width: number;
}
interface GaugeLabel {
  x: number;
  y: number;
  value: number;
}
interface GaugeLine { x1: number; y1: number; x2: number; y2: number }

function polar(value: number, radius: number): { x: number; y: number } {
  const radians = ((162 + value * DEG_PER_UNIT) * Math.PI) / 180;
  return { x: CX + radius * Math.cos(radians), y: CY + radius * Math.sin(radians) };
}

function gaugePoint(value: number, radius: number, length: number): { p1: { x: number; y: number }; p2: { x: number; y: number } } {
  return { p1: polar(value, radius), p2: polar(value, length) };
}

/* Dial tick + pin colors ride the theme ramp: cyan → blue → indigo → purple →
   fuchsia → pink → rose. Uses Tailwind theme tokens so it follows the palette. */
const MAJOR_TICK_AT: Array<[number, string, number]> = [
  [0, 'var(--color-sky-400)', 1],
  [20, 'var(--color-sky-400)', 1],
  [40, 'var(--color-blue-400)', 1],
  [60, 'var(--color-indigo-400)', 1],
  [80, 'var(--color-purple-400)', 1],
  [100, 'var(--color-fuchsia-400)', 1],
  [120, 'var(--color-pink-400)', 1],
  [140, 'var(--color-rose-400)', 1],
  [160, 'var(--color-rose-500)', 1],
  [180, 'var(--color-rose-500)', 1],
];
const TICKS: GaugeTick[] = MAJOR_TICK_AT.map(([value, stroke, width]) => {
  const { p1, p2 } = gaugePoint(value, 108, 98);
  return { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, stroke, width };
});

/* Ten-kilometre subdivisions make the scale genuinely readable rather than
   decorative. Major values keep the colour ramp; minor marks stay neutral. */
const MINOR_TICKS: GaugeLine[] = Array.from({ length: 17 }, (_, index) => (index + 1) * 10)
  .filter((value) => value % 20 !== 0)
  .map((value) => {
    const { p1, p2 } = gaugePoint(value, 106, 101);
    return { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y };
  });

/* Printed numbers centered on each major tick's angle, just inside the ticks. */
const LABEL_RADIUS = 86;
const LABELS: GaugeLabel[] = MAJOR_TICK_AT.map(([value]) => {
  const { x, y } = polar(value, LABEL_RADIUS);
  return { x, y, value };
});

/* ── Live map (MapLibre, fleet dark style) ────────────────────
   A real MapLibre map (same dark street style as the fleet map) is embedded in
   the HUD band. The vehicle marker is dropped on its actual coordinates; the
   camera is offset east so the marker sits left-of-center, keeping the visible
   roads on the left half clear while the right half dissolves under the gauge. */

/* FleetMap (the "Current Location" card) centers a selected vehicle with
   flyTo({ zoom: 16 }) — the HUD mirrors that zoom so both maps read at the
   same street scale. */
const HUD_ZOOM = 14.5;
/* 3D camera: pitched down toward the horizon with a slight bearing so the
   dark style's 3D buildings read as depth behind the route. */
const HUD_PITCH = 0;
const HUD_BEARING = 0;
/* Horizontal placement of the vehicle on the HUD band: 18% from the left
   border (well clear of the speedometer). Implemented as a screen-space
   camera offset so it stays exact under pitch/bearing. */
const HUD_MARKER_X = 0.32;
/* Fallback camera until live coordinates arrive (marker hidden meanwhile). */
const HUD_FALLBACK = { lat: timezoneCenter()[0], lng: timezoneCenter()[1] } as const;
/* Slight visual correction so the arrow reads more upward while preserving
   the live road/GPS bearing as its source of truth. */
const ARROW_BEARING_OFFSET = -10;

/* Bearing of the road segment nearest to the vehicle (OSM), so the marker can
   sit exactly along the street instead of a noisy GPS heading. */
interface RoadBearingResult { bearing: number | null }
const bearingCache = new Map<string, Promise<RoadBearingResult>>();

function bearingBetween(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const toRad = (deg: number): number => (deg * Math.PI) / 180;
  const y = Math.sin(toRad(b.lon - a.lon)) * Math.cos(toRad(b.lat));
  const x = Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat))
    - Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lon - a.lon));
  return (Math.atan2(y, x) * 180) / Math.PI;
}

async function fetchRoadBearing(lat: number, lng: number): Promise<RoadBearingResult> {
  const query = `[out:json][timeout:10];way(around:60,${lat},${lng})["highway"];out geometry;`;
  const res = await fetch(environment.overpassApiUrl + '?data=' + encodeURIComponent(query));
  if (!res.ok) throw new Error(`Overpass ${res.status}`);
  const json = (await res.json()) as {
    elements?: Array<{ geometry?: Array<{ lat: number; lon: number }> }>;
  };
  let bestDist = Infinity;
  let bestBearing: number | null = null;
  for (const way of json.elements ?? []) {
    const geo = way.geometry ?? [];
    for (let i = 0; i < geo.length - 1; i++) {
      const a = geo[i];
      const b = geo[i + 1];
      /* Distance from the vehicle to segment AB (equirectangular, meters-ish). */
      const mx = (a.lat + b.lat) / 2;
      const cosMx = Math.cos((mx * Math.PI) / 180);
      const axx = a.lon * cosMx;
      const bxx = b.lon * cosMx;
      const px = lng * cosMx;
      const ay = a.lat;
      const by = b.lat;
      const abx = bxx - axx;
      const aby = by - ay;
      const apx = px - axx;
      const apy = lat - ay;
      const lenSq = abx * abx + aby * aby || 1e-12;
      const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / lenSq));
      const dx = apx - t * abx;
      const dy = apy - t * aby;
      const dist = dx * dx + dy * dy;
      if (dist < bestDist) {
        bestDist = dist;
        bestBearing = (bearingBetween(a, b) + 360) % 360;
      }
    }
  }
  return { bearing: bestBearing };
}

@Component({
  selector: 'app-vehicle-hud',
  imports: [Skeleton],
  templateUrl: './vehicle-hud.html',
  styleUrl: './vehicle-hud.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VehicleHud implements AfterViewInit, OnDestroy {
  readonly vehicle = input<VehicleDetailRecord | null>(null);
  readonly metrics = input<VehicleMetric[]>([]);
  readonly lastJob = input<unknown>(null);
  readonly routes = input<unknown>(null);
  /* While loading, the HUD renders its exact shell (same size, same layout)
     with shimmer bars in every data slot so nothing shifts when data pops in. */
  readonly loading = input(false);

  /* Skeleton telemetry tiles mirror the live grid 1:1 (labels, accents, widths). */
  protected readonly skeletonStatTiles = [
    { label: 'Today', accent: 'blue', width: '4.5rem' },
    { label: 'Odometer', accent: 'violet', width: '4rem' },
    { label: 'Fuel level', accent: 'cyan', width: '3.5rem' },
    { label: 'Violations', accent: 'rose', width: '3rem' },
    { label: 'Ignition', accent: null, width: '2.5rem' },
    { label: 'Maintenance', accent: null, width: '4.5rem' },
  ] as const;

  private readonly mapHost = viewChild.required<ElementRef<HTMLDivElement>>('mapHost');
  private map?: maplibregl.Map;
  private marker?: maplibregl.Marker;
  private roadBearing: number | null = null;
  private bearingToken = 0;

  protected readonly ticks = TICKS;
  protected readonly minorTicks = MINOR_TICKS;
  protected readonly labels = LABELS;

  protected readonly speed = computed(() => {
    const value = Math.round(Number(this.vehicle()?.speed ?? 0));
    return Number.isFinite(value) ? Math.max(0, Math.min(MAX_SPEED, value)) : 0;
  });
  /* ── Live vehicle coordinates ── */
  private readonly coords = computed(() => {
    const lat = Number(this.vehicle()?.latitude);
    const lng = Number(this.vehicle()?.longitude);
    const ok = Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0);
    return ok ? { lat, lng } : null;
  });

  private readonly speedSamples = signal<Array<{ time: number; speed: number }>>([]);
  protected readonly speedTrendPath = computed(() => {
    const samples = this.speedSamples();
    if (!samples.length) return '';
    const points = samples.length === 1 ? [samples[0], { ...samples[0], time: Date.now() }] : samples;
    const start = points[0].time;
    const range = Math.max(1, points[points.length - 1].time - start);
    return points
      .map((sample, index) => {
        const x = points.length === 2 && samples.length === 1 ? index * 320 : ((sample.time - start) / range) * 320;
        const y = 46 - (Math.min(MAX_SPEED, sample.speed) / MAX_SPEED) * 42;
        return `${index ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');
  });
  protected readonly speedTrendArea = computed(() => {
    const path = this.speedTrendPath();
    return path ? `${path} L320 50 L0 50 Z` : '';
  });
  protected readonly trendPeak = computed(() =>
    Math.max(0, ...this.speedSamples().map((sample) => sample.speed)),
  );
  protected readonly hasSpeedTrend = computed(() => this.speedSamples().length > 0);
  protected readonly trendEndY = computed(() => {
    const samples = this.speedSamples();
    const speed = samples[samples.length - 1]?.speed ?? 0;
    return 46 - (Math.min(MAX_SPEED, speed) / MAX_SPEED) * 42;
  });
  protected readonly trendLimitY = computed(() => {
    const limit = this.speedLimit();
    return limit === null ? null : 46 - (Math.min(MAX_SPEED, limit) / MAX_SPEED) * 42;
  });

  /* Drive the sweep whenever a new target speed arrives from realtime. */
  private readonly speedTargetEffect = effect(() => {
    const speed = this.speed();
    this.vehicle()?.updated_time;
    this.recordSpeedSample(speed);
    this.animateSpeedTo(speed);
  });

  /* ── Smoothed speed ──
     Real vehicles sweep: the needle eases through intermediate values instead
     of teleporting, and the digital readout counts along with it. The target
     comes from realtime updates; `displayedSpeed` animates toward it. */
  private readonly displayedSpeed = signal(0);
  protected readonly shownSpeed = computed(() => Math.round(this.displayedSpeed()));
  private speedRaf = 0;
  private speedAnimFrom = 0;
  private speedAnimTo = 0;
  private speedAnimStart = 0;
  private speedAnimDur = 0;

  constructor() {
    /* Keep the marker and camera locked to the live coordinates. The camera
       offset keeps the pin near the left border of the band, clear of the
       speedometer. The marker only exists once real coordinates are available. */
    effect(() => {
      const coords = this.coords();
      if (!this.map) return;
      if (!coords) {
        this.marker?.remove();
        this.marker = undefined;
        this.roadBearing = null;
        this.syncCamera(HUD_FALLBACK.lat, HUD_FALLBACK.lng);
        return;
      }
      if (!this.marker) this.marker = this.buildMarker(coords);
      this.marker.setLngLat([coords.lng, coords.lat]);
      this.syncMarkerLive();
      this.applyMarkerRotation();
      this.syncCamera(coords.lat, coords.lng);
      void this.loadRoadBearing(coords);
    });
  }

  /* Camera locked to the vehicle, matching the FleetMap "Current Location"
     card (zoom 16) but with a screen-space offset that parks the marker
     HUD_MARKER_X of the way from the left border — same trick FleetMap uses
     with panel padding, expressed as a pixel offset so pitch/bearing keep it
     exact regardless of latitude. */
  private syncCamera(lat: number, lng: number): void {
    const map = this.map;
    if (!map) return;
    const width = this.mapHost().nativeElement.clientWidth || 0;
    /* jumpTo has no `offset` in this maplibre version — express the same
       screen-space shift as right padding so the center lands at
       HUD_MARKER_X * width from the left border. */
    const rightPadding = Math.max(0, width * (1 - 2 * HUD_MARKER_X));
    map.jumpTo({
      center: [lng, lat],
      zoom: HUD_ZOOM,
      pitch: HUD_PITCH,
      bearing: HUD_BEARING,
      padding: { right: rightPadding },
    });
  }

  ngAfterViewInit(): void {
    const coords = this.coords();
    const anchor = coords ?? HUD_FALLBACK;
    this.map = createIotMap(
      this.mapHost().nativeElement,
      [anchor.lat, anchor.lng],
      HUD_ZOOM,
      { interactive: true, pitch: HUD_PITCH, bearing: HUD_BEARING },
    );
    /* Off-center framing needs the pixel offset, which is applied via
       syncCamera once the container has a real width. */
    this.syncCamera(anchor.lat, anchor.lng);
    /* Anything that arrived before the map existed (or while it was being
       created) is applied here, so the marker is always in sync with the
       latest live record. */
    if (coords) {
      if (!this.marker) this.marker = this.buildMarker(coords);
      this.marker.setLngLat([coords.lng, coords.lat]);
      this.syncMarkerLive();
      this.applyMarkerRotation();
      void this.loadRoadBearing(coords);
    }
  }

  /* Blink the marker only while the vehicle reports online — toggles the
     hud-live class that drives the CSS pulse halo. */
  private syncMarkerLive(): void {
    this.marker?.getElement().classList.toggle('hud-live', this.online());
  }

  /* The nav-arrow marker from the SVG map, verbatim: a blurred #525DF7 glow
     layer (feGaussianBlur 4.39, same as the reference filter) under the sharp
     arrow, anchored center on the vehicle's exact coordinates. */
  private buildMarker(coords: { lat: number; lng: number }): maplibregl.Marker {
    const element = document.createElement('div');
    element.className = 'hud-nav-marker';
    /* MapLibre generates this DOM imperatively, so it never carries the
       component's _ngcontent attribute — size it with inline styles and SVG
       width/height attributes (component CSS cannot reach it). */
    element.style.cssText = 'width:44px;height:45px;';
    const path = 'M11.3988 55.3672L67.1755 11.5117C67.7052 11.0953 68.4908 11.4315 68.5808 12.1131L77.4407 79.2672C77.5625 80.1903 76.3815 80.6323 75.8604 79.8586L55.5756 49.7388C55.3789 49.4467 55.0326 49.297 54.6932 49.3575L12.1063 56.9413C11.2107 57.1008 10.6841 55.9292 11.3988 55.3672Z';
    element.innerHTML =
      `<div class="hud-nav-marker-pulse"></div><svg width="44" height="45" viewBox="0 0 89 92" style="display:block;overflow:visible" aria-hidden="true">
        <defs>
          <filter id="hudNavGlowFilter" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB">
            <feGaussianBlur stdDeviation="4.39"></feGaussianBlur>
          </filter>
        </defs>
        <path d="${path}" fill="#525DF7" filter="url(#hudNavGlowFilter)"></path>
        <path d="${path}" fill="#525DF7"></path>
      </svg>`;
    return new maplibregl.Marker({ element, anchor: 'center', rotationAlignment: 'map' })
      .setLngLat([coords.lng, coords.lat])
      .addTo(this.map!);
  }

  /* Rotate the arrow to lie flat along the street: prefer the OSM road bearing
     nearest the vehicle (exact road alignment); fall back to the vehicle's GPS
     heading while the road bearing loads, then to 0. */
  private applyMarkerRotation(): void {
    if (!this.marker) return;
    const heading = Number(this.vehicle()?.['heading']);
    const fallback = Number.isFinite(heading) ? heading : 0;
    const bearing = this.roadBearing ?? fallback;
    this.marker.setRotation((bearing + ARROW_BEARING_OFFSET + 360) % 360);
  }

  private loadRoadBearing(coords: { lat: number; lng: number }): void {
    const key = coords.lat.toFixed(5) + ',' + coords.lng.toFixed(5);
    let request = bearingCache.get(key);
    if (!request) {
      request = fetchRoadBearing(coords.lat, coords.lng);
      bearingCache.set(key, request);
      request.catch(() => bearingCache.delete(key));
    }
    const token = ++this.bearingToken;
    request.then(
      (result) => {
        if (token !== this.bearingToken || result.bearing === null) return;
        this.roadBearing = result.bearing;
        this.applyMarkerRotation();
      },
      () => { /* keep GPS heading fallback */ },
    );
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.speedRaf);
    this.marker = undefined;
    this.map?.remove();
    this.map = undefined;
  }

  protected readonly online = computed(() => Boolean(this.vehicle()?.online_status));

  /* The needle shares the tick angle math: it rests on the 0 km/h tick (162°)
     and sweeps the full 216° dial — 1.2° per km/h, landing on every tick. */
  protected readonly needleRotation = computed(() => -18 + this.displayedSpeed() * DEG_PER_UNIT);

  /* Ease-out sweep from the current reading to the new target, like a real
     speedometer reacting to acceleration/braking. ~0.55s per 40 km/h, clamped
     to 0.4–1.6s. Honors prefers-reduced-motion by snapping instantly. */
  private animateSpeedTo(target: number): void {
    cancelAnimationFrame(this.speedRaf);
    const reduceMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const from = this.displayedSpeed();
    if (reduceMotion || from === target) {
      this.displayedSpeed.set(target);
      return;
    }
    this.speedAnimFrom = from;
    this.speedAnimTo = target;
    this.speedAnimStart = performance.now();
    this.speedAnimDur = Math.min(1600, Math.max(400, Math.abs(target - from) * 14));
    this.speedRaf = requestAnimationFrame(this.stepSpeed);
  }

  private readonly stepSpeed = (now: number): void => {
    const progress = Math.min(1, (now - this.speedAnimStart) / this.speedAnimDur);
    const eased = 1 - Math.pow(1 - progress, 3);
    const value = this.speedAnimFrom + (this.speedAnimTo - this.speedAnimFrom) * eased;
    this.displayedSpeed.set(progress < 1 ? value : this.speedAnimTo);
    if (progress < 1) this.speedRaf = requestAnimationFrame(this.stepSpeed);
  };

  private recordSpeedSample(speed: number): void {
    const now = Date.now();
    const cutoff = now - 15 * 60_000;
    this.speedSamples.update((samples) => {
      const recent = samples.filter((sample) => sample.time >= cutoff);
      const last = recent[recent.length - 1];
      if (last && last.speed === speed && now - last.time < 10_000) return recent;
      return [...recent, { time: now, speed }].slice(-180);
    });
  }

  protected readonly routeCode = computed(() => {
    const route = this.firstRoute();
    const value =
      route?.['route_code'] ?? route?.['code'] ?? route?.['path'] ?? route?.['name'] ?? route?.['destination'];
    return this.text(value, 'LIVE TRIP');
  });

  protected readonly routeName = computed(() => {
    const vehicle = this.vehicle();
    const makeModel = [vehicle?.make, vehicle?.model].filter(Boolean).join(' ') || 'Vehicle';
    return this.text(vehicle?.location, makeModel);
  });

  protected readonly distanceKm = computed(() => {
    const metric = this.metrics().find((item) => item.code === 'DS');
    if (metric?.data !== null && metric?.data !== undefined) {
      const parsed = Number(String(metric.data).replace(/[^0-9.]/g, ''));
      if (Number.isFinite(parsed)) return Math.round(parsed);
    }
    const daily = Number(this.vehicle()?.km_per_day ?? 0);
    return Number.isFinite(daily) ? Math.round(daily) : 0;
  });

  protected readonly updatedText = computed(() =>
    this.text(this.vehicle()?.updated_time || this.vehicle()?.updated_at, '—'),
  );

  protected readonly driverText = computed(() =>
    this.text(this.vehicle()?.vehicle_driver_name, 'Unassigned'),
  );
  protected readonly driverInitials = computed(() => this.driverText().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase());
  protected readonly latitudeText = computed(() => {
    const value = Number(this.vehicle()?.latitude);
    return Number.isFinite(value) ? value.toFixed(5) + '°' : '—';
  });
  protected readonly speedLimit = computed<number | null>(() => {
    const value = Number(this.vehicle()?.['speed_threshold']);
    return Number.isFinite(value) && value > 0 ? value : null;
  });
  protected readonly speedSegments = Array.from({ length: 36 }, (_, index) => (index + 1) * 5);
  protected readonly speedDelta = computed(() => {
    const limit = this.speedLimit();
    return limit === null ? null : this.shownSpeed() - limit;
  });
  protected readonly speedDeltaText = computed(() => {
    const delta = this.speedDelta();
    if (delta === null) return '—';
    return delta > 0 ? `+${delta} km/h Over limit` : `${Math.abs(delta)} km/h below limit`;
  });
  protected readonly longitudeText = computed(() => {
    const value = Number(this.vehicle()?.longitude);
    return Number.isFinite(value) ? value.toFixed(5) + '°' : '—';
  });
  protected readonly deviceText = computed(() => this.text(this.vehicle()?.device_id, 'Not allocated'));

  protected readonly totalDistanceText = computed(() => {
    const raw = this.vehicle()?.['odo_reading'];
    if (raw === null || raw === undefined || raw === '') return '—';
    const value = Number(raw);
    return Number.isFinite(value) ? value.toLocaleString() : this.text(raw, '—');
  });

  protected readonly fuelText = computed(() => {
    const metric = this.metrics().find((item) => item.code === 'FS');
    const raw = metric?.data ?? null;
    const metricText = this.text(raw, '').trim();
    if (metricText) return metricText;
    return '—';
  });

  protected readonly violationsText = computed(() => {
    const metric = this.metrics().find((item) => item.code === 'VA');
    const raw = metric?.data ?? null;
    const metricText = this.text(raw, '').trim();
    if (metricText) return metricText;
    return String(Number(this.vehicle()?.total_violations ?? 0) ?? 0);
  });

  protected readonly ignitionText = computed(() =>
    this.vehicle()?.ignition_status ? 'On' : 'Off',
  );

  protected readonly nextMaintenanceText = computed(() => {
    const value = this.vehicle()?.next_maintenance;
    return value === 0 || value === '0' ? '—' : this.text(value, '—');
  });

  private firstRoute(): Record<string, unknown> | undefined {
    const routes = this.routes();
    if (Array.isArray(routes) && routes.length > 0) {
      return routes[0] as Record<string, unknown>;
    }
    const job = this.lastJob() as Record<string, unknown> | null | undefined;
    if (job) {
      const nested = (job['data'] as unknown[] | undefined)?.[0] as Record<string, unknown> | undefined;
      return nested ?? job;
    }
    return undefined;
  }

  protected text(value: unknown, fallback = 'Not available'): string {
    if (value === null || value === undefined || value === '' || ['none', 'null'].includes(String(value).toLowerCase())) {
      return fallback;
    }
    return String(value);
  }
}
