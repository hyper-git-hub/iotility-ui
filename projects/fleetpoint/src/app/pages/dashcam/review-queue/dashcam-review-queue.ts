import { AnimationCallbackEvent, Component, signal } from '@angular/core';
import { SmoothHeight } from '@iotility/shared-ui';
import { DASHCAM_EVENTS, DashcamEvent } from '../dashcam.data';
import { DashcamVideoTile } from '../video-tile/video-tile';

@Component({
  selector: 'app-dashcam-review-queue',
  imports: [DashcamVideoTile, SmoothHeight],
  templateUrl: './dashcam-review-queue.html',
  styleUrl: './dashcam-review-queue.css',
})
export class DashcamReviewQueue {
  protected readonly queue = signal(
    DASHCAM_EVENTS.filter((event) => event.review === 'Unreviewed'),
  );
  protected readonly expandedId = signal<string | null>(null);

  protected toggle(event: DashcamEvent): void {
    this.expandedId.update((id) => (id === event.id ? null : event.id));
  }

  protected resolve(event: DashcamEvent): void {
    this.queue.update((events) => events.filter((item) => item.id !== event.id));
    if (this.expandedId() === event.id) this.expandedId.set(null);
  }

  protected resolveAll(): void {
    this.queue.set([]);
    this.expandedId.set(null);
  }

  /** Resolved item slides out, then its slot (and the list gap) closes so the rest glide up instead of jumping. */
  protected collapseResolved(event: AnimationCallbackEvent): void {
    const item = event.target as HTMLElement;
    const reduceMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const gap = parseFloat(getComputedStyle(item.parentElement ?? item).rowGap) || 0;
    const height = `${item.offsetHeight}px`;
    const away = reduceMotion ? 'none' : 'translateX(24px)';
    item.style.pointerEvents = 'none';
    item
      .animate(
        [
          { opacity: 1, transform: 'none', height, marginBottom: '0px' },
          { opacity: 0, transform: away, height, marginBottom: '0px', offset: 0.45 },
          {
            opacity: 0,
            transform: away,
            height: '0px',
            paddingTop: '0px',
            paddingBottom: '0px',
            borderWidth: '0px',
            marginBottom: `${-gap}px`,
          },
        ],
        { duration: reduceMotion ? 200 : 420, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' },
      )
      .finished.finally(() => event.animationComplete());
  }

  protected footage(event: DashcamEvent, camera: string): string {
    return `videos/dashcam/events/${event.id}_${camera.toLowerCase()}.mp4`;
  }
}
