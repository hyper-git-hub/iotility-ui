import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class FullscreenUiService {
  readonly isFullscreen = signal(false);
  private readonly document = inject(DOCUMENT);

  constructor() {
    this.document.addEventListener('fullscreenchange', () => {
      this.isFullscreen.set(Boolean(this.document.fullscreenElement));
    });
  }

  async toggle(): Promise<void> {
    if (this.document.fullscreenElement) {
      await this.document.exitFullscreen();
    } else {
      await this.document.documentElement.requestFullscreen();
    }
  }
}
