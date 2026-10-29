import { Component, ElementRef, HostListener, Injector, afterNextRender, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { FullscreenUiService } from '../shared/services/fullscreen-ui.service';
import { FleetpointHeader } from './header/fleetpoint-header';
import { FleetpointSidebar } from './sidebar/fleetpoint-sidebar';

/** Must match the sidebar's own width transition (--sidebar-motion in fleetpoint-sidebar.css). */
const SIDEBAR_MOTION_MS = 260;
const SIDEBAR_EASING = 'cubic-bezier(0.23, 1, 0.32, 1)';

@Component({
  selector: 'app-fleetpoint-layout',
  imports: [FleetpointHeader, FleetpointSidebar, RouterOutlet],
  templateUrl: './fleetpoint-layout.html',
  styleUrl: './fleetpoint-layout.css',
})
export class FleetpointLayout {
  private readonly fullscreenUi = inject(FullscreenUiService);
  private readonly injector = inject(Injector);
  private readonly sidebar = viewChild(FleetpointSidebar);
  private readonly content = viewChild<ElementRef<HTMLElement>>('content');
  protected readonly isFullscreen = computed(() => this.fullscreenUi.isFullscreen());
  protected readonly sidebarOpen = signal(false);
  protected readonly sidebarCollapsed = computed(() => this.sidebar()?.collapsed() ?? false);
  private slide?: Animation;

  constructor() {
    /*
     * Collapse/expand without re-laying out the page on every frame: the sidebar's slot snaps to its
     * final width (one reflow, so maps and charts resize once) while the sidebar animates its own
     * width over the content, and the content column slides from its old position to the new one
     * with a transform. Both use the same timing, so their edges travel together.
     */
    let first = true;
    effect(() => {
      this.sidebarCollapsed();
      if (first) {
        first = false;
        return;
      }
      // Component effects run before the template updates, so this is still the old position.
      const before = untracked(() => this.content()?.nativeElement.getBoundingClientRect().left);
      untracked(() => afterNextRender(() => this.slideContent(before), { injector: this.injector }));
    });
  }


  protected openSidebar(): void {
    this.sidebarOpen.set(true);
  }
  protected closeSidebar(): void {
    this.sidebarOpen.set(false);
  }
  @HostListener('document:keydown.escape') protected escape(): void {
    this.closeSidebar();
  }

  private slideContent(before: number | undefined): void {
    const content = this.content()?.nativeElement;
    if (!content || before === undefined) return;
    this.slide?.cancel();
    const shift = before - content.getBoundingClientRect().left;
    const desktop = !matchMedia('(max-width: 767px)').matches;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!shift || !desktop || reduced) return;
    // Expanding narrows the content; fill the strip it leaves on the right while it slides back.
    content.style.setProperty('--slide-gap', `${Math.max(0, -shift)}px`);
    content.classList.add('sliding');
    this.slide = content.animate(
      [{ transform: `translateX(${shift}px)` }, { transform: 'translateX(0)' }],
      { duration: SIDEBAR_MOTION_MS, easing: SIDEBAR_EASING },
    );
    this.slide.finished
      .catch(() => undefined)
      .finally(() => content.classList.remove('sliding'));
  }
}
