import { Directive, ElementRef, effect, inject, input } from '@angular/core';
import { ReplayClock } from './replay-clock';

const SCALE = 1000;

/**
 * Turns a range input into a replay timeline: it glides with the playhead on
 * every frame, and dragging holds playback until the thumb is let go. The value
 * and fill are written straight to the element, because a binding would mean a
 * change-detection pass per frame.
 */
@Directive({
  selector: 'input[appReplayScrub]',
  host: {
    type: 'range',
    min: '0',
    max: `${SCALE}`,
    step: 'any',
    '(input)': 'seek()',
    '(pointerdown)': 'beginDrag()',
  },
})
export class ReplayScrub {
  readonly clock = input.required<ReplayClock>({ alias: 'appReplayScrub' });

  private readonly element = inject<ElementRef<HTMLInputElement>>(ElementRef).nativeElement;
  private dragging = false;

  constructor() {
    effect((onCleanup) => {
      const clock = this.clock();
      onCleanup(clock.onFrame((fraction) => this.paint(fraction)));
      this.paint(clock.fraction);
    });
  }

  protected seek(): void {
    this.clock().seekToFraction(Number(this.element.value) / SCALE);
  }

  protected beginDrag(): void {
    const clock = this.clock();
    const resume = clock.playing();
    this.dragging = true;
    clock.halt();
    const end = () => {
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      this.dragging = false;
      if (resume) clock.play();
    };
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  }

  private paint(fraction: number): void {
    if (!this.dragging) this.element.value = String(fraction * SCALE);
    this.element.style.setProperty('--trip-progress', `${fraction * 100}%`);
  }
}
