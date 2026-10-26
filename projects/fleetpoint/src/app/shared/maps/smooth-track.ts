import { NgZone } from '@angular/core';
import { environment } from '../../../environments/environment';

/**
 * Smooth live tracking for one vehicle marker (MapLibre port of hypernym-fms-fe
 * Utils/smooth-track.ts).
 *
 * Packets are discrete fixes, so moving the marker on arrival makes it sit
 * still and then jump. Instead each new fix becomes a segment that is animated
 * over the time the vehicle really took to drive it (device clock), along the
 * road where OSRM can supply one. The marker therefore runs about one packet
 * behind real time and its on-screen pace is its real pace.
 *
 * Packet timing is not trusted to be regular:
 *   - a long silence, then one far-away fix  → jump, the route taken is unknown
 *   - a burst of buffered fixes              → queued and fast-forwarded so the
 *                                              lag never exceeds MAX_LAG_MS
 *   - duplicates / out-of-order late packets → dropped by device time
 *   - a hidden browser tab                   → on return, jump to the latest
 *
 * Every tracker on a page shares one requestAnimationFrame loop, so a fleet map
 * with hundreds of vehicles costs one callback per frame. Road snapping can be
 * switched per tracker (`setRouting`): worth one OSRM call per packet for the
 * vehicles someone is looking at, not for a whole fleet.
 */

export interface TrackPoint {
  lat: number;
  lng: number;
}

export interface TrackFix extends TrackPoint {
  /** Device timestamp in ms; NaN when the packet carried none usable. */
  t: number;
  /**
   * Speed the packet reports (km/h). When it is faster than the hop's own
   * distance/time, the hop plays quicker — up to SPEED_PACE_MAX_GAIN — so the
   * marker visibly speeds up with the speedometer. Omit for pure device pacing.
   */
  speedKmh?: number;
}

export interface TrackHooks {
  /**
   * Called every animation frame, outside Angular. `heading` is the compass
   * bearing (0..360) of the road edge being driven, or null when the marker is
   * not travelling along a segment.
   */
  move(pos: TrackPoint, heading: number | null): void;
}

interface Segment {
  to: TrackPoint;
  path: TrackPoint[];
  baseMs: number;
  jump: boolean;
  routeDone: boolean;
  queuedAt: number;
  abort?: AbortController;
}

interface Active {
  path: TrackPoint[];
  cum: number[];
  total: number;
  durationMs: number;
  startedAt: number;
  edge: number;
}

/** Below this a new fix is GPS jitter around a parked vehicle (metres). */
const STATIONARY_M = 5;
/** Silence longer than this is a connectivity gap: jump rather than invent a path. */
const MAX_GAP_MS = 120_000;
/** Faster than this between two fixes is a bad fix or a gap, not driving. */
const MAX_SPEED_KMH = 250;
/** One segment never plays slower than MAX, so one late packet costs little lag. */
const MIN_SEGMENT_MS = 250;
const MAX_SEGMENT_MS = 20_000;
/** Backlog above this much playback time is fast-forwarded. */
const MAX_LAG_MS = 15_000;
/** Backlog beyond this many fixes is skipped outright. */
const MAX_QUEUE = 30;
/** From a seeded position (no device time) animate briefly if it is close. */
const FIRST_FIX_MS = 1_000;
const FIRST_FIX_MAX_M = 300;
/** Road snapping. Steady state is one small route call per packet; a slow OSRM
    costs a straight line, never a stall. */
const ROUTE_MIN_M = 30;
const ROUTE_RADIUS_M = 35;
const ROUTE_WAIT_MS = 700;
const ROUTE_TIMEOUT_MS = 3_000;
/** Reject a route this much longer than the straight line: OSRM took a detour
    (wrong carriageway, U-turn) the vehicle almost certainly did not. */
const ROUTE_MAX_DETOUR = 1.6;
const ROUTE_DETOUR_SLACK_M = 60;
/** While catching up on a backlog, don't spend route calls on it. */
const ROUTE_MAX_BACKLOG = 2;
/** Most a reported speed may shorten a hop (0.25 = play in 75% of its time).
    Positions bound how far the marker can go, so a faster hop ends with the
    marker holding at the fix; capping the gain keeps that hold brief. */
const SPEED_PACE_MAX_GAIN = 0.25;
/** A frame gap this long means the tab was hidden. */
const HIDDEN_GAP_MS = 1_000;

function normalizeDegrees(value: number): number {
  return ((value % 360) + 360) % 360;
}

/** Approximate ground distance in metres (equirectangular — accurate at the
    sub-kilometre scale between consecutive fixes). */
export function metresBetween(a: TrackPoint, b: TrackPoint): number {
  const toRad = (deg: number): number => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng) * Math.cos(toRad((a.lat + b.lat) / 2));
  return Math.hypot(dLat, dLng) * 6_371_000;
}

/** Compass bearing (0..360) of travel from one point to the next. */
export function bearingBetween(a: TrackPoint, b: TrackPoint): number {
  const toRad = (deg: number): number => (deg * Math.PI) / 180;
  const y = Math.sin(toRad(b.lng - a.lng)) * Math.cos(toRad(b.lat));
  const x = Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat))
    - Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lng - a.lng));
  return normalizeDegrees((Math.atan2(y, x) * 180) / Math.PI);
}

function prefersReducedMotion(): boolean {
  return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

/** OSRM driving path between two fixes, or null to fall back to the straight
    line. `bearing` (the previous hop) snaps the start onto the carriageway the
    vehicle was already driving along. */
async function fetchRoadPath(
  from: TrackPoint,
  to: TrackPoint,
  bearing: number | null,
  signal: AbortSignal,
): Promise<TrackPoint[] | null> {
  const r = ROUTE_RADIUS_M;
  let query = `${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson&radiuses=${r};${r}`;
  if (bearing !== null) query += `&bearings=${Math.round(bearing)},60;`;
  for (const baseUrl of [environment.osrmBaseUrl, environment.osrmFallbackUrl]) {
    try {
      const response = await fetch(`${baseUrl}/route/v1/driving/${query}`, { signal });
      if (!response.ok) continue;
      const result = (await response.json()) as {
        code?: string;
        routes?: { distance?: number; geometry?: { coordinates?: [number, number][] } }[];
      };
      const route = result.code === 'Ok' ? result.routes?.[0] : undefined;
      const coords = route?.geometry?.coordinates;
      if (!route || !coords || coords.length < 2) continue;
      const straight = metresBetween(from, to);
      const limit = Math.max(straight * ROUTE_MAX_DETOUR, straight + ROUTE_DETOUR_SLACK_M);
      if ((route.distance ?? Infinity) > limit) return null;
      // Start and end on the reported fixes so consecutive segments join exactly.
      return [from, ...coords.map(([lng, lat]) => ({ lat, lng })), to];
    } catch {
      if (signal.aborted) return null;
    }
  }
  return null;
}

/** The single animation loop shared by every SmoothTrack on the page. */
class Ticker {
  private readonly tracks = new Set<SmoothTrack>();
  private raf = 0;

  add(track: SmoothTrack, zone: NgZone): void {
    this.tracks.add(track);
    if (this.raf) return;
    // Frames never need change detection; the hooks touch the map directly.
    zone.runOutsideAngular(() => {
      this.raf = requestAnimationFrame(this.tick);
    });
  }

  remove(track: SmoothTrack): void {
    this.tracks.delete(track);
    if (!this.tracks.size && this.raf) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    }
  }

  private readonly tick = (now: number): void => {
    this.raf = 0;
    this.tracks.forEach((track) => {
      if (!track.step(now)) this.tracks.delete(track);
    });
    if (this.tracks.size) this.raf = requestAnimationFrame(this.tick);
  };
}

const ticker = new Ticker();

export class SmoothTrack {
  private last: { pos: TrackPoint; t: number; arrived: number; seeded: boolean } | null = null;
  private lastBearing: number | null = null;
  private queue: Segment[] = [];
  private active: Active | null = null;
  private current: TrackPoint | null = null;
  private speedup = 1;
  private running = false;
  private lastFrame = 0;
  private routing = true;

  constructor(
    private readonly zone: NgZone,
    private readonly hooks: TrackHooks,
  ) {}

  /** Where the marker is drawn right now (lags the newest fix while animating). */
  get position(): TrackPoint | null {
    return this.current;
  }

  /**
   * Turn road snapping on or off for future fixes. A segment already queued
   * keeps whatever path it has, so switching never makes the marker jump.
   */
  setRouting(on: boolean): void {
    this.routing = on;
  }

  /** Place the vehicle without animation, e.g. at its last position from the API. */
  seed(pos: TrackPoint): void {
    this.current = pos;
    this.last = { pos, t: Number.NaN, arrived: performance.now(), seeded: true };
  }

  push(fix: TrackFix): void {
    const now = performance.now();
    const pos = { lat: fix.lat, lng: fix.lng };
    if (!this.last) {
      this.seed(pos);
      this.hooks.move(pos, null);
      return;
    }

    const from = this.last.pos;
    const dist = metresBetween(from, pos);
    let dt: number;
    let jump = prefersReducedMotion();
    if (this.last.seeded) {
      dt = FIRST_FIX_MS;
      jump = jump || dist > FIRST_FIX_MAX_M;
    } else if (Number.isFinite(fix.t) && Number.isFinite(this.last.t)) {
      dt = fix.t - this.last.t;
      if (dt < 0) return; // a late packet the map has already moved past
    } else {
      dt = now - this.last.arrived;
    }

    if (dist < STATIONARY_M) {
      // Keep the anchor position so slow creep still accumulates into a move.
      this.last = { ...this.last, t: fix.t, arrived: now, seeded: false };
      return;
    }
    this.last = { pos, t: fix.t, arrived: now, seeded: false };

    dt = Math.max(dt, MIN_SEGMENT_MS);
    const kmh = (dist / (dt / 1000)) * 3.6;
    jump = jump || dt > MAX_GAP_MS || kmh > MAX_SPEED_KMH;
    const reported = fix.speedKmh ?? 0;
    if (!jump && reported > kmh) {
      const atReportedSpeed = (dist / (reported / 3.6)) * 1000;
      dt = Math.max(dt * (1 - SPEED_PACE_MAX_GAIN), atReportedSpeed, MIN_SEGMENT_MS);
    }

    const segment: Segment = {
      to: pos,
      path: [from, pos],
      baseMs: Math.min(dt, MAX_SEGMENT_MS),
      jump,
      routeDone: true,
      queuedAt: now,
    };
    if (this.routing && !jump && dist >= ROUTE_MIN_M && this.queue.length < ROUTE_MAX_BACKLOG) {
      this.requestRoute(segment, from, pos);
    }
    this.lastBearing = bearingBetween(from, pos);

    this.queue.push(segment);
    if (this.queue.length > MAX_QUEUE) {
      const skipped = this.queue.splice(0, this.queue.length - MAX_QUEUE);
      skipped.forEach((item) => item.abort?.abort());
      this.queue[0].jump = true;
    }
    this.start();
  }

  destroy(): void {
    ticker.remove(this);
    this.running = false;
    this.queue.forEach((item) => item.abort?.abort());
    this.queue = [];
    this.active = null;
  }

  // -- road route ---------------------------------------------------------

  private requestRoute(segment: Segment, from: TrackPoint, to: TrackPoint): void {
    const abort = new AbortController();
    const bearing = this.lastBearing;
    segment.abort = abort;
    segment.routeDone = false;
    this.zone.runOutsideAngular(() => {
      const timer = setTimeout(() => abort.abort(), ROUTE_TIMEOUT_MS);
      void fetchRoadPath(from, to, bearing, abort.signal)
        .then((path) => {
          if (path) segment.path = path;
        })
        .finally(() => {
          clearTimeout(timer);
          segment.routeDone = true;
        });
    });
  }

  // -- animation ----------------------------------------------------------

  private start(): void {
    if (this.running) return;
    this.running = true;
    this.lastFrame = performance.now();
    ticker.add(this, this.zone);
  }

  /** Advance one frame. Called by the shared ticker; returns false once idle. */
  step(now: number): boolean {
    const frameMs = Math.max(0, now - this.lastFrame);
    this.lastFrame = now;

    if (frameMs > HIDDEN_GAP_MS) {
      // The user didn't see the backlog play; show where the vehicle is now.
      this.flush();
      this.running = false;
      return false;
    }

    if (!this.active) this.begin(now);
    const active = this.active as Active | null;
    if (active) {
      // Clamped below too: a frame timestamp can predate startedAt, and a
      // negative progress would extrapolate the marker backwards.
      const progress = Math.min(1, Math.max(0, (now - active.startedAt) / active.durationMs));
      const pos = this.advance(active, progress * active.total);
      const a = active.path[active.edge];
      const b = active.path[active.edge + 1];
      const heading = b && metresBetween(a, b) > 1 ? bearingBetween(a, b) : null;
      this.current = pos;
      this.hooks.move(pos, heading);
      if (progress >= 1) {
        // Start the next segment from the instant this one ended, not from the
        // next frame, so per-segment rounding never accumulates into lag.
        this.active = null;
        this.begin(now, active.startedAt + active.durationMs);
      }
    }

    this.running = !!(this.active || this.queue.length);
    return this.running;
  }

  private begin(now: number, startAt = now): void {
    const segment = this.queue[0];
    if (!segment) return;
    // Give the road route a moment, but never let it hold the vehicle for long.
    if (!segment.routeDone && now - segment.queuedAt < ROUTE_WAIT_MS) return;
    this.queue.shift();
    segment.abort?.abort();

    if (segment.jump || !this.current) {
      this.teleport(segment.to);
      return;
    }

    const path = [this.current, ...segment.path.slice(1)];
    const cum = [0];
    for (let i = 1; i < path.length; i++) cum.push(cum[i - 1] + metresBetween(path[i - 1], path[i]));

    // Play in real time, but replay a backlog within about MAX_LAG_MS. The
    // speed-up is locked when the backlog is first seen: recomputing it per
    // segment shrinks it as the backlog drains, which made catch-up take
    // ~2.5x longer. The newest fix always plays in real time so the marker is
    // still moving when the next packet arrives.
    if (!this.queue.length) {
      this.speedup = 1;
    } else {
      const pending = this.queue.reduce((sum, item) => sum + (item.jump ? 0 : item.baseMs), segment.baseMs);
      this.speedup = Math.max(this.speedup, pending / MAX_LAG_MS);
    }

    this.active = {
      path,
      cum,
      total: cum[cum.length - 1],
      durationMs: Math.max(MIN_SEGMENT_MS, segment.baseMs / this.speedup),
      startedAt: startAt,
      edge: 0,
    };
  }

  /** Position `distance` metres along the active path. */
  private advance(active: Active, distance: number): TrackPoint {
    while (active.edge < active.path.length - 2 && active.cum[active.edge + 1] <= distance) active.edge++;
    const a = active.path[active.edge];
    const b = active.path[active.edge + 1] ?? a;
    const length = (active.cum[active.edge + 1] ?? 0) - active.cum[active.edge];
    const fraction = length > 0 ? Math.min(1, (distance - active.cum[active.edge]) / length) : 1;
    return { lat: a.lat + (b.lat - a.lat) * fraction, lng: a.lng + (b.lng - a.lng) * fraction };
  }

  private teleport(pos: TrackPoint): void {
    this.current = pos;
    this.hooks.move(pos, null);
  }

  private flush(): void {
    this.speedup = 1;
    const tail = this.queue.length ? this.queue[this.queue.length - 1].to : null;
    this.queue.forEach((item) => item.abort?.abort());
    this.queue = [];
    if (this.active) {
      this.teleport(this.active.path[this.active.path.length - 1]);
      this.active = null;
    }
    if (tail) this.teleport(tail);
  }
}
