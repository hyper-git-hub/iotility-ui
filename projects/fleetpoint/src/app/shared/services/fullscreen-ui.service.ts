import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class FullscreenUiService {
  readonly isFullscreen = signal(false);

  toggle(): void {
    this.isFullscreen.update((fullscreen) => !fullscreen);
  }
}
