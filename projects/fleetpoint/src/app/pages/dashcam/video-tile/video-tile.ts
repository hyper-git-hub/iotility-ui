import { Component, computed, effect, input, signal } from '@angular/core';

@Component({
  selector: 'app-dashcam-video-tile',
  templateUrl: './video-tile.html',
  styleUrl: './video-tile.css',
})
export class DashcamVideoTile {
  /** Clip or snapshot URL; empty when there is no footage for this view. */
  readonly src = input.required<string>();
  readonly label = input.required<string>();
  readonly compact = input(false);
  protected readonly unavailable = signal(false);
  /** Event evidence can be a snapshot instead of a clip. */
  protected readonly image = computed(() => /\.(jpe?g|png|gif|webp)(\?|$)/i.test(this.src()));

  constructor() {
    effect(() => this.unavailable.set(!this.src()));
  }
}
