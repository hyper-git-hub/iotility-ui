import { Component, HostListener, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { FleetpointHeader } from './header/fleetpoint-header';
import { FleetpointSidebar } from './sidebar/fleetpoint-sidebar';

@Component({
  selector: 'app-fleetpoint-layout',
  imports: [FleetpointHeader, FleetpointSidebar, RouterOutlet],
  templateUrl: './fleetpoint-layout.html',
  styleUrl: './fleetpoint-layout.css',
})
export class FleetpointLayout {
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
