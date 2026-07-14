import { DOCUMENT } from '@angular/common';
import { Component, Inject, input } from '@angular/core';
@Component({
  selector: 'shared-platform-header',
  templateUrl: './platform-header.html',
  styleUrl: './platform-header.css',
})
export class PlatformHeader {
  readonly showLive = input(false);
  protected isDark = false;
  constructor(@Inject(DOCUMENT) private readonly document: Document) {
    this.isDark = document.documentElement.classList.contains('dark');
  }
  protected toggleTheme(): void {
    this.isDark = !this.isDark;
    this.document.documentElement.classList.toggle('dark', this.isDark);
  }
}
