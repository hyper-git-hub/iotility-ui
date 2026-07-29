import { Component, signal } from '@angular/core';
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

  protected footage(event: DashcamEvent, camera: string): string {
    return `videos/dashcam/events/${event.id}_${camera.toLowerCase()}.mp4`;
  }
}
