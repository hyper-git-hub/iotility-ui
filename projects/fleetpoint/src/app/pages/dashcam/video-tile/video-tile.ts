import { Component, input, signal } from '@angular/core';

@Component({
  selector: 'app-dashcam-video-tile',
  templateUrl: './video-tile.html',
  styleUrl: './video-tile.css',
})
export class DashcamVideoTile {
  readonly src = input.required<string>();
  readonly label = input.required<string>();
  readonly compact = input(false);
  protected readonly unavailable = signal(false);
}
