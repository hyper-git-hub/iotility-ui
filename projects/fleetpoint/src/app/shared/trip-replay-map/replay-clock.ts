import { NgZone, signal } from '@angular/core';
import { prefersReducedMotion } from '../maps/smooth-track';

/**
 * Choices on the speed control, as multiples of real time. The replay follows the trip's real
 * timing (see buildReplayOffsets), so these run from a close look (5×, an hour in 12 minutes)
 * to a quick overview (100×, an hour in 36 seconds).
 */
export const REPLAY_SPEEDS = [5, 10, 25, 50, 100] as const;
type ReplaySpeed = (typeof REPLAY_SPEEDS)[number];
/** Where playback starts: an hour's trip in six minutes. */
const DEFAULT_SPEED: ReplaySpeed = 10;

/** How quickly playback spins up, slows down or changes speed. */
const RATE_EASE_MS = 110;
/** Below this share of the chosen speed, slowing down has finished. */
const RATE_SETTLED = 0.02;
/** A longer frame means the tab was hidden: don't jump the trip forward for it. */
const MAX_FRAME_MS = 100;

type FrameListener = (fraction: number) => void;

/**
 * The single playhead behind trip replay. It runs in replay milliseconds, which
 * is what makes motion continuous: the map asks where the playhead is on every
 * frame instead of being told about each GPS sample as it passes.
 *
 * Runs outside Angular. Signals only change at sample boundaries, so templates
 * re-render a few times a second while the map and timeline move at full frame
 * rate through `sample()` and `onFrame()`.
 */
export class ReplayClock {
  /** Sample the playhead has reached. */
  readonly index = signal(0);
  readonly playing = signal(false);
  /** Nothing is being replayed: before the first play, after the end, or after stop. */
  readonly atRest = signal(true);
  /** Bumped on every jump of the playhead, so a resting map knows to wake. */
  readonly seeks = signal(0);
  /** Replay time of every sample. */
  readonly timeline = signal<readonly number[]>([]);

  private offsets: readonly number[] = [];
  private playhead = 0;
  private rate = 0;
  private targetRate = 0;
  private speed: ReplaySpeed = DEFAULT_SPEED;
  private cursor = 0;
  private lastFrameTime?: number;
  private frame?: number;
  private readonly listeners = new Set<FrameListener>();

  constructor(private readonly zone: NgZone) {}

  get playheadMs(): number {
    return this.playhead;
  }

  /** Chosen playback speed, which holds through a pause. */
  get speedSetting(): ReplaySpeed {
    return this.speed;
  }

  /** True while the vehicle is still travelling, including easing to a halt. */
  get moving(): boolean {
    return this.playing() || this.rate > 0;
  }

  get totalMs(): number {
    return this.offsets[this.offsets.length - 1] ?? 0;
  }

  /** How far through the trip the playhead is, 0 to 1. */
  get fraction(): number {
    const total = this.totalMs;
    return total > 0 ? this.playhead / total : 0;
  }

  /** The sample index with the part-way position between samples, for blending their values. */
  get fractionalIndex(): number {
    const index = this.locate(this.playhead);
    const from = this.offsets[index] ?? 0;
    const to = this.offsets[index + 1];
    return to === undefined || to <= from ? index : index + (this.playhead - from) / (to - from);
  }

  /** Reads the timeline signal, so a template using it follows a retime. */
  fractionAtIndex(index: number): number {
    const offsets = this.timeline();
    const total = offsets[offsets.length - 1] ?? 0;
    return total > 0 ? (offsets[index] ?? 0) / total : 0;
  }

  indexAtFraction(fraction: number): number {
    return this.locate(fraction * this.totalMs);
  }

  /** Calls `listener` on every playhead change. Returns the unsubscribe function. */
  onFrame(listener: FrameListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Starts a new trip from its first sample. */
  load(offsets: readonly number[]): void {
    this.halt();
    this.offsets = offsets;
    this.playhead = 0;
    this.cursor = 0;
    this.atRest.set(true);
    this.timeline.set(offsets);
    this.seeks.update((count) => count + 1);
    this.publish();
  }

  /** Swaps in a new timing for the same samples, keeping the place in the trip. */
  retime(offsets: readonly number[]): void {
    const place = this.fractionalIndex;
    const index = Math.floor(place);
    const from = offsets[index] ?? 0;
    const to = offsets[index + 1] ?? from;
    this.offsets = offsets;
    this.playhead = from + (to - from) * (place - index);
    this.cursor = index;
    this.timeline.set(offsets);
    this.publish();
  }

  play(): void {
    if (this.offsets.length < 2) return;
    if (this.playhead >= this.totalMs) this.jumpTo(0);
    this.atRest.set(false);
    this.playing.set(true);
    this.targetRate = this.speed;
    if (prefersReducedMotion()) this.rate = this.speed;
    this.run();
  }

  /** Eases to a halt: playback stops now, the vehicle coasts for a moment. */
  pause(): void {
    this.playing.set(false);
    this.targetRate = 0;
    if (prefersReducedMotion()) this.rate = 0;
  }

  /** Back to the start with nothing playing. */
  stop(): void {
    this.halt();
    this.jumpTo(0);
    this.atRest.set(true);
  }

  setSpeed(speed: ReplaySpeed): void {
    this.speed = speed;
    if (this.playing()) this.targetRate = speed;
  }

  seekToFraction(fraction: number): void {
    this.jumpTo(Math.max(0, Math.min(fraction, 1)) * this.totalMs);
  }

  seekToIndex(index: number): void {
    this.jumpTo(this.offsets[index] ?? 0);
  }

  /**
   * Advances the playhead to a frame's timestamp and returns it. Safe to call
   * more than once per frame, so the map and the clock's own loop stay on the
   * exact same position whichever runs first.
   */
  sample(now: number): number {
    const last = this.lastFrameTime;
    this.lastFrameTime = now;
    if (last === undefined || now <= last) {
      if (last !== undefined) this.lastFrameTime = last;
      return this.playhead;
    }
    const elapsed = Math.min(now - last, MAX_FRAME_MS);
    this.easeRate(elapsed);
    if (this.rate > 0) {
      this.playhead = Math.min(this.playhead + elapsed * this.rate, this.totalMs);
      if (this.playhead >= this.totalMs) this.finish();
    }
    return this.playhead;
  }

  destroy(): void {
    if (this.frame !== undefined) cancelAnimationFrame(this.frame);
    this.frame = undefined;
    this.listeners.clear();
  }

  private easeRate(elapsed: number): void {
    if (this.rate === this.targetRate) return;
    this.rate += (this.targetRate - this.rate) * (1 - Math.exp(-elapsed / RATE_EASE_MS));
    const settled = this.speed * RATE_SETTLED;
    if (Math.abs(this.targetRate - this.rate) < settled) this.rate = this.targetRate;
  }

  private jumpTo(ms: number): void {
    this.playhead = ms;
    this.seeks.update((count) => count + 1);
    this.publish();
  }

  /** Stops dead, with no easing, for jumps and scrubbing. */
  halt(): void {
    this.playing.set(false);
    this.rate = 0;
    this.targetRate = 0;
  }

  private finish(): void {
    this.halt();
    this.atRest.set(true);
  }

  private run(): void {
    if (this.frame !== undefined) return;
    this.lastFrameTime = undefined;
    this.zone.runOutsideAngular(() => {
      this.frame = requestAnimationFrame(this.tick);
    });
  }

  private readonly tick = (now: number): void => {
    this.frame = undefined;
    this.sample(now);
    this.publish();
    if (this.moving) this.frame = requestAnimationFrame(this.tick);
  };

  private publish(): void {
    const index = this.locate(this.playhead);
    if (index !== this.index()) this.index.set(index);
    const fraction = this.fraction;
    this.listeners.forEach((listener) => listener(fraction));
  }

  /** Last sample at or before a replay time. */
  private locate(ms: number): number {
    const { offsets } = this;
    if (offsets.length < 2) return 0;
    const cursor = this.cursor;
    if (ms >= offsets[cursor] && (cursor === offsets.length - 1 || ms < offsets[cursor + 1]))
      return cursor;
    let low = 0;
    let high = offsets.length - 1;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if (offsets[middle] <= ms) low = middle;
      else high = middle - 1;
    }
    return (this.cursor = low);
  }
}
