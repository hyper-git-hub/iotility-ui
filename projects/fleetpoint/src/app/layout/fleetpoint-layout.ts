import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { FullscreenUiService } from '../shared/services/fullscreen-ui.service';
import { FleetpointHeader } from './header/fleetpoint-header';
import { FleetpointSidebar } from './sidebar/fleetpoint-sidebar';

@Component({
  selector: 'app-fleetpoint-layout',
  imports: [FleetpointHeader, FleetpointSidebar, RouterOutlet],
  templateUrl: './fleetpoint-layout.html',
  styleUrl: './fleetpoint-layout.css',
})
export class FleetpointLayout {
  private readonly fullscreenUi = inject(FullscreenUiService);
  protected readonly isFullscreen = computed(() => this.fullscreenUi.isFullscreen());
  protected readonly sidebarOpen = signal(false);
  protected openSidebar(): void {
    this.sidebarOpen.set(true);
  }
  protected closeSidebar(): void {
    this.sidebarOpen.set(false);
  }
  @HostListener('document:keydown.escape') protected escape(): void {
    this.closeSidebar();
  }
}
