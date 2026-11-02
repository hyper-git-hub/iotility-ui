import { AnimationCallbackEvent, Component, computed, inject, signal } from '@angular/core';
import { Skeleton, SmoothHeight } from '@iotility/shared-ui';
import { DashcamEvent, NOT_AVAILABLE, categoryLabel } from '../dashcam.data';
import { DashcamStore } from '../dashcam.store';
import { DashcamVideoTile } from '../video-tile/video-tile';

@Component({
  selector: 'app-dashcam-review-queue',
  imports: [DashcamVideoTile, Skeleton, SmoothHeight],
  templateUrl: './dashcam-review-queue.html',
  styleUrl: './dashcam-review-queue.css',
})
export class DashcamReviewQueue {
  private readonly store = inject(DashcamStore);
  protected readonly loaded = this.store.loaded;
  protected readonly notAvailable = NOT_AVAILABLE;
  protected readonly categoryLabel = categoryLabel;
  /** Events resolved in this session; the API keeps no review state for DashCam events. */
  private readonly resolved = signal<ReadonlySet<string>>(new Set());
  protected readonly queue = computed(() => this.store.events().filter((event) => !this.resolved().has(event.id)));
  protected readonly expandedId = signal<string | null>(null);

  protected toggle(event: DashcamEvent): void {
    this.expandedId.update((id) => (id === event.id ? null : event.id));
  }

  protected resolve(event: DashcamEvent): void {
    this.resolved.update((ids) => new Set(ids).add(event.id));
    if (this.expandedId() === event.id) this.expandedId.set(null);
  }

  protected resolveAll(): void {
    this.resolved.set(new Set(this.store.events().map((event) => event.id)));
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

  /** The event's evidence clip plays in the front view, as the FMS playback does; other views have none. */
  protected footage(event: DashcamEvent, camera: string): string {
    return camera === 'Front' ? event.mediaUrl : '';
  }
}
