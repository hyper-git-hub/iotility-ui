import type { LatLng } from '../maps/maplibre';

/**
 * The maths behind trip replay, kept free of Angular and the map so it can be
 * reasoned about (and exercised) on its own.
 *
 * Replay turns a stream of GPS samples into one continuous function:
 *
 *   replay time (ms)  ->  metres travelled along the drawn road
 *
 * Each sample is first placed where it really happened on the road, its replay
 * time comes from the device clock, and a monotone curve joins the two. The
 * marker never restarts between samples, speed is continuous, and because the
 * curve is monotone it can never roll backwards or overshoot a stop.
 */

export interface ReplaySample {
  lat: number;
  lng: number;
  speed: number;
  timestamp?: string;
}

export interface StopRun {
  /** First sample of the stop. */
  start: number;
  /** Last sample of the stop. */
  end: number;
  /** Real time parked, 0 when the samples carry no usable timestamps. */
  durationMs: number;
}

/** At or below this the vehicle counts as stationary. */
const STOP_SPEED_KPH = 3;
const STOP_MIN_SAMPLES = 4;
/** A "stop" that wanders further than this was moving: its speed field is unreliable. */
const STOP_RADIUS_M = 40;

/** Real gaps are replayed at most this long, so a data hole slows playback but never freezes it. */
const MAX_GAP_MS = 5_000;
/** Replay time for a sample pair without usable timestamps. */
const FALLBACK_GAP_MS = 600;
/** Replay time a whole stop is squeezed into when stops are skipped. */
const STOP_SPAN_MS = 4_000;

/** Corners are rounded at this radius, small enough to stay on the road. */
const CORNER_RADIUS_M = 8;
const CORNER_MIN_TURN_DEGREES = 4;
/** A U-turn keeps its tip: rounding it would stop the vehicle short of where it turned. */
const CORNER_MAX_TURN_DEGREES = 150;
const CORNER_STEPS = 4;

/** Fastest believable travel between two samples, used to bound the road search. */
const MAX_SPEED_MPS = 55;
const MIN_REACH_M = 400;
const UNKNOWN_REACH_M = 2_000;
/** A sample further than this from the road says nothing about where on it the vehicle was. */
const MAX_OFF_ROAD_M = 120;
/** The search has left a stretch of road once the distance rises this much above its best. */
const LEFT_STRETCH_M = 25;
/** An earlier stretch within this much of the best match wins: road that doubles back later is not reached yet. */
const EARLIER_STRETCH_SLACK_M = 10;
/** The first and last samples snap to the trail's ends when this close to them. */
const END_SNAP_M = 150;

const EARTH_RADIUS_M = 6_371_000;
const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

function timeOf(sample: ReplaySample | undefined): number {
  return sample?.timestamp ? new Date(sample.timestamp).getTime() : Number.NaN;
}

function metresBetween(a: LatLng, b: LatLng): number {
  const dLat = toRadians(b[0] - a[0]);
  const dLng = toRadians(b[1] - a[1]) * Math.cos(toRadians((a[0] + b[0]) / 2));
  return Math.hypot(dLat, dLng) * EARTH_RADIUS_M;
}

/** Runs of samples where the vehicle really was parked. */
export function stationaryRuns(samples: readonly ReplaySample[]): StopRun[] {
  const runs: StopRun[] = [];
  const isSlow = (index: number) => (samples[index]?.speed ?? 0) <= STOP_SPEED_KPH;
  const pointOf = (index: number): LatLng => [Number(samples[index].lat), Number(samples[index].lng)];
  let index = 0;
  while (index < samples.length) {
    if (!isSlow(index)) {
      index++;
      continue;
    }
    let end = index;
    while (
      end + 1 < samples.length &&
      isSlow(end + 1) &&
      metresBetween(pointOf(index), pointOf(end + 1)) <= STOP_RADIUS_M
    )
      end++;
    if (end - index + 1 >= STOP_MIN_SAMPLES) {
      const elapsed = timeOf(samples[end]) - timeOf(samples[index]);
      runs.push({ start: index, end, durationMs: Number.isFinite(elapsed) ? elapsed : 0 });
    }
    index = end + 1;
  }
  return runs;
}

/** The stop containing a sample, or undefined while the vehicle is moving. */
export function stopRunAt(runs: readonly StopRun[], index: number): StopRun | undefined {
  let low = 0;
  let high = runs.length - 1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    const run = runs[middle];
    if (index < run.start) high = middle - 1;
    else if (index > run.end) low = middle + 1;
    else return run;
  }
  return undefined;
}

export function formatStopDuration(durationMs: number): string {
  const seconds = Math.round(durationMs / 1000);
  if (seconds <= 0) return 'Stopped';
  if (seconds < 60) return `Stopped ${seconds} s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `Stopped ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `Stopped ${hours} h ${rest} min` : `Stopped ${hours} h`;
}

/** Replay time of every sample, in ms from the first one. */
export function buildReplayOffsets(
  samples: readonly ReplaySample[],
  runs: readonly StopRun[],
  skipStops: boolean,
): number[] {
  if (!samples.length) return [];
  const gaps = new Array<number>(samples.length).fill(0);
  for (let index = 1; index < samples.length; index++) {
    const gap = timeOf(samples[index]) - timeOf(samples[index - 1]);
    gaps[index] = Number.isFinite(gap) && gap > 0 ? Math.min(gap, MAX_GAP_MS) : FALLBACK_GAP_MS;
  }
  if (skipStops) {
    for (const run of runs) {
      const share = STOP_SPAN_MS / Math.max(1, run.end - run.start);
      for (let index = run.start + 1; index <= run.end; index++)
        gaps[index] = Math.min(gaps[index], share);
    }
  }
  const offsets = new Array<number>(samples.length);
  let elapsed = 0;
  for (let index = 0; index < samples.length; index++) {
    elapsed += gaps[index];
    offsets[index] = elapsed;
  }
  return offsets;
}

/**
 * Rounds the kinks of a road polyline so the vehicle and camera follow an arc
 * instead of pivoting on a vertex. The radius is a fixed few metres, unlike
 * Chaikin smoothing, which cuts a corner in proportion to its segment length
 * and would pull long straights off the road.
 */
export function roundCorners(points: LatLng[], radiusM = CORNER_RADIUS_M): LatLng[] {
  if (points.length < 3) return points;
  const rounded: LatLng[] = [points[0]];
  for (let index = 1; index < points.length - 1; index++) {
    const previous = points[index - 1];
    const corner = points[index];
    const next = points[index + 1];
    const lengthIn = metresBetween(previous, corner);
    const lengthOut = metresBetween(corner, next);
    const turn = turnDegrees(previous, corner, next);
    if (
      lengthIn < 1 ||
      lengthOut < 1 ||
      turn < CORNER_MIN_TURN_DEGREES ||
      turn > CORNER_MAX_TURN_DEGREES
    ) {
      rounded.push(corner);
      continue;
    }
    const radius = Math.min(radiusM, lengthIn * 0.45, lengthOut * 0.45);
    const entry = lerpPoint(corner, previous, radius / lengthIn);
    const exit = lerpPoint(corner, next, radius / lengthOut);
    for (let step = 0; step <= CORNER_STEPS; step++) {
      const t = step / CORNER_STEPS;
      const inverse = 1 - t;
      rounded.push([
        inverse * inverse * entry[0] + 2 * inverse * t * corner[0] + t * t * exit[0],
        inverse * inverse * entry[1] + 2 * inverse * t * corner[1] + t * t * exit[1],
      ]);
    }
  }
  rounded.push(points[points.length - 1]);
  return rounded;
}

function lerpPoint(from: LatLng, to: LatLng, t: number): LatLng {
  return [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t];
}

function turnDegrees(previous: LatLng, corner: LatLng, next: LatLng): number {
  const scale = Math.cos(toRadians(corner[0]));
  const inX = (corner[1] - previous[1]) * scale;
  const inY = corner[0] - previous[0];
  const outX = (next[1] - corner[1]) * scale;
  const outY = next[0] - corner[0];
  const lengths = Math.hypot(inX, inY) * Math.hypot(outX, outY);
  if (!lengths) return 0;
  const cosine = (inX * outX + inY * outY) / lengths;
  return (Math.acos(Math.max(-1, Math.min(1, cosine))) * 180) / Math.PI;
}

interface RoadMatch {
  /** Metres along the road. */
  along: number;
  /** Metres from the sample to the road. */
  offRoad: number;
  segment: number;
}

/**
 * Nearest point on the road between `from` and `reach` metres along it. Roads
 * that double back pass near a sample more than once, so each stretch's best
 * point is a candidate and the earliest one close to the overall best wins.
 */
function nearestAhead(
  lat: number,
  lng: number,
  road: readonly LatLng[],
  roadDistances: readonly number[],
  firstSegment: number,
  reach: number,
): RoadMatch | undefined {
  const lngScale = Math.cos(toRadians(lat));
  const metresPerDegree = (Math.PI / 180) * EARTH_RADIUS_M;
  const candidates: RoadMatch[] = [];
  let stretchBest: RoadMatch | undefined;
  for (
    let segment = firstSegment;
    segment < road.length - 1 && roadDistances[segment] <= reach;
    segment++
  ) {
    const aX = (road[segment][1] - lng) * lngScale * metresPerDegree;
    const aY = (road[segment][0] - lat) * metresPerDegree;
    const bX = (road[segment + 1][1] - lng) * lngScale * metresPerDegree;
    const bY = (road[segment + 1][0] - lat) * metresPerDegree;
    const dX = bX - aX;
    const dY = bY - aY;
    const lengthSquared = dX * dX + dY * dY;
    const t = lengthSquared > 0 ? Math.max(0, Math.min(1, -(aX * dX + aY * dY) / lengthSquared)) : 0;
    const offRoad = Math.hypot(aX + dX * t, aY + dY * t);
    if (!stretchBest || offRoad < stretchBest.offRoad) {
      stretchBest = {
        along:
          roadDistances[segment] + (roadDistances[segment + 1] - roadDistances[segment]) * t,
        offRoad,
        segment,
      };
    } else if (offRoad > stretchBest.offRoad + LEFT_STRETCH_M) {
      candidates.push(stretchBest);
      stretchBest = undefined;
    }
  }
  if (stretchBest) candidates.push(stretchBest);
  if (!candidates.length) return undefined;
  const best = Math.min(...candidates.map((candidate) => candidate.offRoad));
  return candidates.find((candidate) => candidate.offRoad <= best + EARLIER_STRETCH_SLACK_M);
}

/**
 * Metres along the road where each sample really was. Walks forward only, and
 * only as far as the vehicle could have driven since the last placed sample,
 * so a later pass over the same road can't steal a match. Samples too far from
 * the road come back NaN.
 */
function projectOntoRoad(
  samples: readonly ReplaySample[],
  road: readonly LatLng[],
  roadDistances: readonly number[],
): number[] {
  const placed = new Array<number>(samples.length).fill(Number.NaN);
  let segment = 0;
  let reached = 0;
  let reachedAt = Number.NaN;
  for (let index = 0; index < samples.length; index++) {
    const lat = Number(samples[index].lat);
    const lng = Number(samples[index].lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) continue;
    const time = timeOf(samples[index]);
    const elapsedSeconds = (time - reachedAt) / 1000;
    const reach =
      Number.isFinite(elapsedSeconds) && elapsedSeconds > 0
        ? Math.max(MIN_REACH_M, elapsedSeconds * MAX_SPEED_MPS)
        : UNKNOWN_REACH_M;
    const match = nearestAhead(lat, lng, road, roadDistances, segment, reached + reach);
    if (!match || match.offRoad > MAX_OFF_ROAD_M) continue;
    if (match.along > reached) {
      reached = match.along;
      segment = match.segment;
    }
    placed[index] = reached;
    if (Number.isFinite(time)) reachedAt = time;
  }
  return placed;
}

function fillUnplaced(values: number[]): number[] {
  const filled = values.slice();
  let previous = -1;
  for (let index = 0; index < filled.length; index++) {
    if (!Number.isFinite(filled[index])) continue;
    if (previous < 0) filled.fill(filled[index], 0, index);
    else {
      const span = index - previous;
      for (let gap = 1; gap < span; gap++)
        filled[previous + gap] =
          filled[previous] + ((filled[index] - filled[previous]) * gap) / span;
    }
    previous = index;
  }
  if (previous < 0) return filled.fill(0);
  filled.fill(filled[previous], previous + 1);
  return filled;
}

/**
 * Metres along the road for every sample: never decreasing, flat through each
 * stop, and meeting the start and end of the trail.
 */
export function sampleRoadDistances(
  samples: readonly ReplaySample[],
  road: readonly LatLng[],
  roadDistances: readonly number[],
  runs: readonly StopRun[],
): number[] {
  if (!samples.length || road.length < 2) return new Array<number>(samples.length).fill(0);
  const distances = fillUnplaced(projectOntoRoad(samples, road, roadDistances));
  const total = roadDistances[roadDistances.length - 1];
  if (distances[0] <= END_SNAP_M) distances[0] = 0;
  for (let index = 1; index < distances.length; index++)
    distances[index] = Math.max(distances[index], distances[index - 1]);
  for (const run of runs) distances.fill(distances[run.start], run.start, run.end + 1);
  const last = distances[distances.length - 1];
  if (total - last <= END_SNAP_M)
    for (let index = distances.length - 1; index >= 0 && distances[index] === last; index--)
      distances[index] = total;
  return distances;
}

/**
 * Monotone cubic interpolation (the PCHIP slopes of Fritsch and Butland). Gives
 * continuous speed through every sample without overshooting: wherever the
 * input is flat, such as a stop, the output is exactly flat too.
 */
export class MonotoneCurve {
  private readonly slopes: Float64Array;
  private cursor = 0;

  constructor(
    private readonly xs: readonly number[],
    private readonly ys: readonly number[],
  ) {
    const count = xs.length;
    this.slopes = new Float64Array(count);
    if (count < 2) return;
    const secant = (index: number) =>
      (ys[index + 1] - ys[index]) / (xs[index + 1] - xs[index]);
    this.slopes[0] = secant(0);
    this.slopes[count - 1] = secant(count - 2);
    for (let index = 1; index < count - 1; index++) {
      const before = secant(index - 1);
      const after = secant(index);
      if (before <= 0 || after <= 0) continue;
      const stepBefore = xs[index] - xs[index - 1];
      const stepAfter = xs[index + 1] - xs[index];
      const weightBefore = 2 * stepAfter + stepBefore;
      const weightAfter = stepAfter + 2 * stepBefore;
      this.slopes[index] =
        (weightBefore + weightAfter) / (weightBefore / before + weightAfter / after);
    }
  }

  at(x: number): number {
    const { xs, ys } = this;
    const count = xs.length;
    if (!count) return 0;
    if (x <= xs[0]) return ys[0];
    if (x >= xs[count - 1]) return ys[count - 1];
    const index = this.segmentAt(x);
    const step = xs[index + 1] - xs[index];
    const t = (x - xs[index]) / step;
    const t2 = t * t;
    const t3 = t2 * t;
    return (
      (2 * t3 - 3 * t2 + 1) * ys[index] +
      (t3 - 2 * t2 + t) * step * this.slopes[index] +
      (-2 * t3 + 3 * t2) * ys[index + 1] +
      (t3 - t2) * step * this.slopes[index + 1]
    );
  }

  /** Playback almost always stays in this segment or the next, so try those first. */
  private segmentAt(x: number): number {
    const { xs } = this;
    let index = this.cursor;
    if (x >= xs[index] && x < xs[index + 1]) return index;
    if (x >= xs[index + 1] && x < xs[index + 2]) return (this.cursor = index + 1);
    let low = 0;
    let high = xs.length - 2;
    while (low < high) {
      index = Math.ceil((low + high) / 2);
      if (xs[index] <= x) low = index;
      else high = index - 1;
    }
    return (this.cursor = low);
  }
}

/**
 * The replay curve: replay time to metres along the road. A light time-aware
 * average takes the GPS noise out of the moving samples first, so speed doesn't
 * shimmer; stops stay untouched and exact.
 */
export function buildMotionCurve(
  offsets: readonly number[],
  distances: readonly number[],
  runs: readonly StopRun[],
): MonotoneCurve {
  const smoothed = distances.slice();
  let run = 0;
  for (let index = 1; index < distances.length - 1; index++) {
    while (run < runs.length && runs[run].end < index - 1) run++;
    const nearStop = run < runs.length && runs[run].start <= index + 1;
    if (nearStop) continue;
    const share = (offsets[index] - offsets[index - 1]) / (offsets[index + 1] - offsets[index - 1]);
    const onStraightLine = distances[index - 1] + (distances[index + 1] - distances[index - 1]) * share;
    smoothed[index] = (distances[index] + onStraightLine) / 2;
  }
  return new MonotoneCurve(offsets as number[], smoothed);
}
