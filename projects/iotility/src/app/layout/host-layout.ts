import { Component, HostListener, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Header } from './header/header';
import { Sidebar } from './sidebar/sidebar';

@Component({
  selector: 'app-host-layout',
  imports: [Header, RouterOutlet, Sidebar],
  templateUrl: './host-layout.html',
  styleUrl: './host-layout.css',
})
export class HostLayout {
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
