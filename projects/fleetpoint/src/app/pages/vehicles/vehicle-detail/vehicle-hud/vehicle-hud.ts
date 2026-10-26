import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import maplibregl from 'maplibre-gl';
import { createIotMap, timezoneCenter } from '../../../../shared/maps/maplibre';
import { SmoothTrack, TrackPoint, metresBetween } from '../../../../shared/maps/smooth-track';
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
const ARROW_BEARING_OFFSET = 0;

/* ── Smooth live marker ───────────────────────────────────────
   Each fix is handed to SmoothTrack (shared/maps/smooth-track.ts), which drives
   the marker along the road at the vehicle's real pace, so it never teleports
   between packets; the arrow eases toward the heading of the road it drives. */
/* Per-frame share of the remaining rotation the arrow turns through (~0.3s to
   settle at 60fps). */
const BEARING_EASE = 0.2;
/* Minimum ground distance (metres) between two fixes before the travel bearing
   is trusted — below this it is GPS jitter, not real movement. */
const MOVE_BEARING_MIN_M = 4;

/* ── Speed-adaptive zoom ─────────────────────────────────────
   Zoom per speed (km/h → zoom), interpolated linearly between stops. */
const ZOOM_BY_SPEED: Array<[number, number]> = [
  [0, 16],
  [30, 15.5],
  [60, 15],
  [90, 14.5],
  [120, 14],
  [150, 13.5],
];
/* Weight of each new packet in the smoothed speed that drives the zoom. */
const ZOOM_SPEED_SMOOTHING = 0.35;
/* Ignore target changes smaller than this, so cruising doesn't breathe. */
const ZOOM_HYSTERESIS = 0.25;
/* Fastest the camera zooms, in zoom levels per second. */
const ZOOM_RATE_PER_S = 0.6;

function zoomForSpeed(kmh: number): number {
  const [first] = ZOOM_BY_SPEED;
  if (kmh <= first[0]) return first[1];
  for (let i = 1; i < ZOOM_BY_SPEED.length; i++) {
    const [s1, z1] = ZOOM_BY_SPEED[i];
    if (kmh <= s1) {
      const [s0, z0] = ZOOM_BY_SPEED[i - 1];
      return z0 + ((kmh - s0) / (s1 - s0)) * (z1 - z0);
    }
  }
  return ZOOM_BY_SPEED[ZOOM_BY_SPEED.length - 1][1];
}

/* ── Speed trend ──────────────────────────────────────────── */
const TREND_WINDOW_MS = 15 * 60_000;
const TREND_MIN_SPAN_MS = 60_000;
const TREND_TICK_MS = 100;

function trendY(speed: number): number {
  return 46 - (Math.min(MAX_SPEED, Math.max(0, speed)) / MAX_SPEED) * 42;
}

/* Monotone cubic (Fritsch–Carlson) through the points: a smooth curve that
   never overshoots between samples, so it can't dip below 0 km/h or bulge
   above a real peak the way a plain spline would. */
function smoothTrendPath(points: Array<{ x: number; y: number }>): string {
  if (!points.length) return '';
  const fmt = (value: number) => value.toFixed(1);
  if (points.length === 1) return `M${fmt(points[0].x)} ${fmt(points[0].y)}`;
  const n = points.length;
  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(Math.max(1e-6, points[i + 1].x - points[i].x));
    slope.push((points[i + 1].y - points[i].y) / dx[i]);
  }
  const tangent = points.map((_, i) => {
    if (i === 0) return slope[0];
    if (i === n - 1) return slope[n - 2];
    return slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2;
  });
  for (let i = 0; i < n - 1; i++) {
    if (slope[i] === 0) {
      tangent[i] = 0;
      tangent[i + 1] = 0;
      continue;
    }
    const a = tangent[i] / slope[i];
    const b = tangent[i + 1] / slope[i];
    const h = a * a + b * b;
    if (h > 9) {
      const tau = 3 / Math.sqrt(h);
      tangent[i] = tau * a * slope[i];
      tangent[i + 1] = tau * b * slope[i];
    }
  }
  let path = `M${fmt(points[0].x)} ${fmt(points[0].y)}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const step = dx[i] / 3;
    path += ` C${fmt(p0.x + step)} ${fmt(p0.y + tangent[i] * step)} ${fmt(p1.x - step)} ${fmt(p1.y - tangent[i + 1] * step)} ${fmt(p1.x)} ${fmt(p1.y)}`;
  }
  return path;
}

function normalizeDegrees(value: number): number {
  return ((value % 360) + 360) % 360;
}

/* Signed shortest turn (−180, 180] from one heading to another, so the arrow
   rotates the short way round instead of unwinding through 360°. */
function shortestAngle(from: number, to: number): number {
  return ((to - from + 540) % 360) - 180;
}

/* Compass bearing of travel from one fix to the next. */
function travelBearing(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  return normalizeDegrees(bearingBetween({ lat: a.lat, lon: a.lng }, { lat: b.lat, lon: b.lng }));
}

function prefersReducedMotion(): boolean {
  return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

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
  private readonly zone = inject(NgZone);
  private map?: maplibregl.Map;
  private marker?: maplibregl.Marker;
  private roadBearing: number | null = null;
  private bearingToken = 0;

  /* Live-marker glide + heading smoothing. The tracker plays each fix along
     the road, and `displayedBearing` turns toward `targetBearing`, so neither
     the dot nor the arrow jumps between packets. */
  private prevFix?: TrackPoint;
  private displayedBearing = 0;
  private targetBearing = 0;
  private moveRaf = 0;
  private readonly track = new SmoothTrack(this.zone, {
    move: (pos, heading) => this.moveMarker(pos, heading),
  });

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
  /* Clock for the trend's sliding window, ticked off-zone (see startTrendClock)
     so the line scrolls continuously instead of re-stretching per sample. */
  private readonly trendNow = signal(Date.now());
  private trendTimer?: ReturnType<typeof setInterval>;
  /* Trend points in viewBox space: a sliding window ending now (at least a
     minute, at most the 15 min of history kept), with a live tip that rides
     the animated needle so the end of the line glides with the speedometer. */
  private readonly trendPoints = computed(() => {
    const samples = this.speedSamples();
    if (!samples.length) return [];
    const now = this.trendNow();
    const span = Math.min(TREND_WINDOW_MS, Math.max(TREND_MIN_SPAN_MS, now - samples[0].time));
    const start = now - span;
    const toPoint = (time: number, speed: number) => ({
      x: ((time - start) / span) * 320,
      y: trendY(speed),
    });
    return [
      ...samples.filter((sample) => sample.time < now).map((sample) => toPoint(sample.time, sample.speed)),
      toPoint(now, this.displayedSpeed()),
    ];
  });
  protected readonly speedTrendPath = computed(() => smoothTrendPath(this.trendPoints()));
  protected readonly speedTrendArea = computed(() => {
    const points = this.trendPoints();
    const path = this.speedTrendPath();
    return path ? `${path} L320 50 L${points[0].x.toFixed(1)} 50 Z` : '';
  });
  protected readonly trendPeak = computed(() =>
    Math.max(0, ...this.speedSamples().map((sample) => sample.speed)),
  );
  protected readonly hasSpeedTrend = computed(() => this.speedSamples().length > 0);
  protected readonly trendEndY = computed(() => trendY(this.displayedSpeed()));
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
    this.updateZoomTarget(speed);
  });

  /* ── Speed-adaptive zoom ──
     Like Google Maps navigation: street level while crawling, pulling back to
     show more road ahead as speed rises. `hudZoom` eases toward `zoomTarget`
     on its own rAF; the glide's per-frame syncCamera reads it as it goes. */
  private hudZoom = HUD_ZOOM;
  private zoomTarget = HUD_ZOOM;
  private smoothedSpeed: number | null = null;
  private zoomRaf = 0;
  private zoomLastFrame = 0;

  private updateZoomTarget(speed: number): void {
    // Smoothed so a single noisy packet can't pump the camera in and out.
    this.smoothedSpeed = this.smoothedSpeed === null
      ? speed
      : this.smoothedSpeed + (speed - this.smoothedSpeed) * ZOOM_SPEED_SMOOTHING;
    const target = zoomForSpeed(this.smoothedSpeed);
    if (Math.abs(target - this.zoomTarget) < ZOOM_HYSTERESIS) return;
    this.zoomTarget = target;
    if (prefersReducedMotion()) {
      this.hudZoom = target;
      this.recenterCamera();
      return;
    }
    if (this.zoomRaf) return;
    this.zoomLastFrame = performance.now();
    this.zone.runOutsideAngular(() => {
      this.zoomRaf = requestAnimationFrame(this.easeZoom);
    });
  }

  /* Ease-out toward the target, capped at ZOOM_RATE_PER_S so a big speed
     change still reads as a gentle pull-back rather than a jump. */
  private readonly easeZoom = (): void => {
    this.zoomRaf = 0;
    const now = performance.now();
    const seconds = Math.min(0.1, Math.max(0, now - this.zoomLastFrame) / 1000);
    this.zoomLastFrame = now;
    const delta = this.zoomTarget - this.hudZoom;
    const step = Math.min(ZOOM_RATE_PER_S * seconds, Math.abs(delta) * Math.min(1, 3 * seconds));
    this.hudZoom = Math.abs(delta) < 0.005 ? this.zoomTarget : this.hudZoom + Math.sign(delta) * step;
    this.recenterCamera();
    if (this.hudZoom !== this.zoomTarget) this.zoomRaf = requestAnimationFrame(this.easeZoom);
  };

  private recenterCamera(): void {
    const pos = this.marker?.getLngLat();
    if (pos) this.syncCamera(pos.lat, pos.lng);
  }

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
    /* The trend window slides with the clock. Ticking outside Angular is
       enough: the signal marks this OnPush view dirty on its own (same as the
       speedometer sweep), without a global change-detection pass per tick. */
    this.zone.runOutsideAngular(() => {
      this.trendTimer = setInterval(() => {
        if (this.speedSamples().length) this.trendNow.set(Date.now());
      }, TREND_TICK_MS);
    });
    /* Keep the marker and camera locked to the live coordinates. The camera
       offset keeps the pin near the left border of the band, clear of the
       speedometer. The marker only exists once real coordinates are available. */
    effect(() => {
      const coords = this.coords();
      if (!this.map) return;
      if (!coords) {
        this.stopMarkerGlide();
        this.marker?.remove();
        this.marker = undefined;
        this.roadBearing = null;
        this.prevFix = undefined;
        this.syncCamera(HUD_FALLBACK.lat, HUD_FALLBACK.lng);
        return;
      }
      // First fix drops the marker in place; every later fix glides to it.
      if (!this.marker) this.placeMarkerNow(coords);
      else this.glideMarkerTo(coords);
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
      zoom: this.hudZoom,
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
    if (coords) this.placeMarkerNow(coords);
  }

  /* Blink the marker only while the vehicle reports online — toggles the
     hud-live class that drives the CSS pulse halo. */
  private syncMarkerLive(): void {
    const element = this.marker?.getElement();
    if (!element) return;
    element.classList.toggle('hud-live', this.online());
    const status = this.vehicle()?.online_status;
    // Darker green than the status chip so the arrow holds contrast on parks.
    const color = status === true
      ? '#16a34a'
      : status === false
        ? '#9ca3af'
        : '#525DF7';
    element.style.setProperty('--hud-nav-marker-color', color);
  }

  /* Navigation marker: a symmetric chevron pointing north (so the bearing
     rotation needs no art offset), outlined in white with a drop shadow over a
     soft status-tinted halo — legible on any tile colour without a hard ring.
     Anchored center on the vehicle's exact coordinates. */
  private buildMarker(coords: { lat: number; lng: number }): maplibregl.Marker {
    const element = document.createElement('div');
    element.className = 'hud-nav-marker';
    /* MapLibre generates this DOM imperatively, so it never carries the
       component's _ngcontent attribute — size it with inline styles and SVG
       width/height attributes (component CSS cannot reach it). */
    element.style.cssText = 'width:48px;height:48px;';
    element.innerHTML =
      `<div class="hud-nav-marker-pulse"></div><div class="hud-nav-marker-halo"></div><svg width="48" height="48" viewBox="0 0 48 48" style="display:block;overflow:visible" aria-hidden="true">
        <path d="M24 6 L38 40 L24 31.5 L10 40 Z" fill="currentColor" stroke="#fff" stroke-width="3.5" stroke-linejoin="round" paint-order="stroke"></path>
      </svg>`;
    return new maplibregl.Marker({ element, anchor: 'center', rotationAlignment: 'map' })
      .setLngLat([coords.lng, coords.lat])
      .addTo(this.map!);
  }

  private isMoving(): boolean {
    return (Number(this.vehicle()?.speed) || 0) > 2;
  }

  /* First fix (or after the signal was lost): there is nothing to glide from,
     so drop the marker straight onto the coordinates and face it immediately. */
  private placeMarkerNow(coords: TrackPoint): void {
    if (!this.map) return;
    this.stopMarkerGlide();
    if (!this.marker) this.marker = this.buildMarker(coords);
    this.marker.setLngLat([coords.lng, coords.lat]);
    this.syncMarkerLive();
    this.syncCamera(coords.lat, coords.lng);
    this.displayedBearing = this.initialBearing();
    this.targetBearing = this.displayedBearing;
    this.applyRotation();
    this.prevFix = coords;
    this.track.seed(coords);
    this.maybeLoadRoadBearing(coords);
  }

  /* Every later fix: hand it to the smooth tracker, which drives the marker
     (and the camera that follows it) along the road at the vehicle's real
     pace, and turn the arrow toward the new heading. */
  private glideMarkerTo(coords: TrackPoint): void {
    if (!this.map || !this.marker) return;
    this.syncMarkerLive();
    const target = this.computeTargetBearing(coords);
    if (target !== null) this.targetBearing = target;
    this.maybeLoadRoadBearing(coords);
    this.prevFix = coords;
    this.track.push({ ...coords, t: Number(this.vehicle()?.['fix_time']), speedKmh: this.speed() });
    this.turnArrow();
  }

  /* Per-frame position from the tracker (outside Angular). While it drives a
     road edge, the arrow faces along that edge rather than the raw packet. */
  private moveMarker(pos: TrackPoint, heading: number | null): void {
    if (!this.map || !this.marker) return;
    this.marker.setLngLat([pos.lng, pos.lat]);
    this.syncCamera(pos.lat, pos.lng);
    if (heading === null) return;
    this.targetBearing = heading;
    this.turnArrow();
  }

  /* Which way the arrow should point for this fix:
     1. the packet's own bearing (brng / course / heading / …) while moving,
     2. else the bearing of travel between the last fix and this one (formula),
     3. else the nearest-road bearing once it loads (stationary only),
     4. else keep the current heading (returns null — don't spin in place). */
  private computeTargetBearing(next: { lat: number; lng: number }): number | null {
    const packet = Number(this.vehicle()?.['heading']);
    if (this.isMoving() && Number.isFinite(packet)) return normalizeDegrees(packet);
    const prev = this.prevFix;
    if (prev && metresBetween(prev, next) >= MOVE_BEARING_MIN_M) return travelBearing(prev, next);
    if (this.roadBearing !== null) return normalizeDegrees(this.roadBearing);
    return null;
  }

  /* Starting orientation when the marker first appears: the packet heading if
     the feed carries one, otherwise the nearest-road bearing, otherwise north. */
  private initialBearing(): number {
    const packet = Number(this.vehicle()?.['heading']);
    if (Number.isFinite(packet)) return normalizeDegrees(packet);
    if (this.roadBearing !== null) return normalizeDegrees(this.roadBearing);
    return 0;
  }

  private applyRotation(): void {
    this.marker?.setRotation(normalizeDegrees(this.displayedBearing + ARROW_BEARING_OFFSET));
  }
  /* Ease the arrow toward `targetBearing` on its own rAF, outside Angular so
     the rotation never triggers change detection. */
  private readonly easeBearing = (): void => {
    this.moveRaf = 0;
    const delta = shortestAngle(this.displayedBearing, this.targetBearing);
    if (Math.abs(delta) > 0.4) {
      this.displayedBearing = normalizeDegrees(this.displayedBearing + delta * BEARING_EASE);
      this.applyRotation();
      this.moveRaf = requestAnimationFrame(this.easeBearing);
    } else if (delta !== 0) {
      this.displayedBearing = this.targetBearing;
      this.applyRotation();
    }
  };

  private turnArrow(): void {
    if (prefersReducedMotion()) {
      this.displayedBearing = this.targetBearing;
      this.applyRotation();
      return;
    }
    if (this.moveRaf) return;
    this.zone.runOutsideAngular(() => {
      this.moveRaf = requestAnimationFrame(this.easeBearing);
    });
  }

  private stopMarkerGlide(): void {
    if (this.moveRaf) cancelAnimationFrame(this.moveRaf);
    this.moveRaf = 0;
    this.track.destroy();
  }


  /* Only reach out to Overpass when neither the packet nor the travel vector can
     supply a heading — i.e. the vehicle is standing still. A moving vehicle is
     steered by its own bearing, so the network call (and its lag) is skipped. */
  private maybeLoadRoadBearing(coords: { lat: number; lng: number }): void {
    if (this.isMoving()) return;
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
        // Still parked and nothing better has arrived — turn to face the road.
        if (this.isMoving()) return;
        this.targetBearing = normalizeDegrees(result.bearing);
        this.turnArrow();
      },
      () => { /* keep the current heading */ },
    );
  }

  ngOnDestroy(): void {
    clearInterval(this.trendTimer);
    cancelAnimationFrame(this.speedRaf);
    cancelAnimationFrame(this.zoomRaf);
    this.stopMarkerGlide();
    this.marker = undefined;
    this.map?.remove();
    this.map = undefined;
  }

  protected readonly online = computed(() => {
    const status = this.vehicle()?.online_status;
    return status === true;
  });

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
    // The sweep drives `displayedSpeed` (a signal), which marks this OnPush view
    // dirty on its own — so run the frame loop outside Angular to avoid a global
    // change-detection pass per frame (same pattern as the marker glide).
    this.zone.runOutsideAngular(() => {
      this.speedRaf = requestAnimationFrame(this.stepSpeed);
    });
  }

  private readonly stepSpeed = (): void => {
    // Use performance.now(), not the rAF timestamp: a frame timestamp can
    // predate speedAnimStart, and a negative progress makes the cubic ease
    // explode (the needle read 743 km/h, or dipped below zero).
    const elapsed = performance.now() - this.speedAnimStart;
    const progress = Math.min(1, Math.max(0, elapsed / this.speedAnimDur));
    const eased = 1 - Math.pow(1 - progress, 3);
    const value = this.speedAnimFrom + (this.speedAnimTo - this.speedAnimFrom) * eased;
    this.displayedSpeed.set(Math.min(MAX_SPEED, Math.max(0, progress < 1 ? value : this.speedAnimTo)));
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
