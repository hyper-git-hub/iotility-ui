import { DOCUMENT } from '@angular/common';
import { Component, computed, effect, Inject, Input, isDevMode, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { Logo, StatusBadge, TabIndicator, Tooltip } from '@iotility/shared-ui';
import { FeatureAccessService } from '../../shared/services/feature-access.service';
import { FleetStatusService } from '../../shared/services/fleet-status.service';
import { MenuGroup, SIDEBAR_MENU } from './menu.config';
import { SidebarBadgeService } from '../../shared/services/sidebar-badge.service';

interface HostDialogRequest {
  handled: boolean;
  config: {
    type: 'question';
    title: string;
    message: string;
    confirmText: string;
    cancelText: string;
  };
  respond: (confirmed: boolean) => void;
}

@Component({
  selector: 'app-fleetpoint-sidebar',
  imports: [RouterLink, RouterLinkActive, Logo, StatusBadge, TabIndicator, Tooltip],
  templateUrl: './fleetpoint-sidebar.html',
  styleUrl: './fleetpoint-sidebar.css',
})
export class FleetpointSidebar {
  @Input() badgeCounts: Record<string, number> = {};
  private readonly showAllDevelopmentItems = isDevMode();
  private static readonly COLLAPSED_KEY = 'fleetpoint:sidebar-collapsed';

  readonly collapsed = signal(this.restoreCollapsed());

  constructor(
    @Inject(DOCUMENT) private readonly document: Document,
    private readonly router: Router,
    private readonly features: FeatureAccessService,
    protected readonly fleetStatus: FleetStatusService,
    private readonly sidebarBadgeService: SidebarBadgeService,
  ) {
    // Sync badge counts from service whenever they change
    effect(() => { this.badgeCounts = this.sidebarBadgeService.badgeCounts(); });
  }

  protected readonly visibleMenu = computed<MenuGroup[]>(() =>
    SIDEBAR_MENU.map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => this.showAllDevelopmentItems || this.features.has(item.featureId),
      ),
    })).filter((group) => group.items.length > 0),
  );

  protected routeFor(route: string): string {
    return this.router.url.startsWith('/fleetpoint') ? `/fleetpoint${route}` : route;
  }

  // Badge pills cap at 99+ once the count reaches 100; the tooltip keeps the exact number.
  protected badgeLabel(count: number): string | number {
    return count >= 100 ? '99+' : count;
  }

  /** Sliding hover highlight: one pill glides to whichever item the pointer is over. */
  protected highlightNav(event: PointerEvent): void {
    const nav = event.currentTarget as HTMLElement;
    const pill = nav.querySelector<HTMLElement>('.nav-hover');
    const item = (event.target as HTMLElement).closest<HTMLElement>('a');
    if (!pill || !item || !nav.contains(item)) return;
    // The active item has its own sliding pill; don't stack a second one on it.
    if (item.classList.contains('active')) {
      pill.style.opacity = '0';
      return;
    }
    const navBox = nav.getBoundingClientRect();
    const box = item.getBoundingClientRect();
    const firstShow = !pill.classList.contains('ready') || pill.style.opacity !== '1';
    if (firstShow) pill.classList.remove('ready'); // appear in place, don't slide in from the last spot
    pill.style.transform = `translate(${box.left - navBox.left + nav.scrollLeft}px, ${box.top - navBox.top + nav.scrollTop}px)`;
    pill.style.width = `${box.width}px`;
    pill.style.height = `${box.height}px`;
    if (firstShow) {
      void pill.offsetWidth;
      pill.classList.add('ready');
    }
    pill.style.opacity = '1';
  }

  protected clearNavHighlight(event: PointerEvent): void {
    const pill = (event.currentTarget as HTMLElement).querySelector<HTMLElement>('.nav-hover');
    if (pill) pill.style.opacity = '0';
  }

  protected toggleCollapsed(): void {
    this.collapsed.update((value) => !value);
    try {
      localStorage.setItem(FleetpointSidebar.COLLAPSED_KEY, this.collapsed() ? '1' : '0');
    } catch {
      /* ignore storage errors */
    }
  }

  private restoreCollapsed(): boolean {
    try {
      return localStorage.getItem(FleetpointSidebar.COLLAPSED_KEY) === '1';
    } catch {
      return false;
    }
  }

  protected async confirmReturnToIotility(): Promise<void> {
    const config: HostDialogRequest['config'] = {
      type: 'question',
      title: 'Return to IoTility?',
      message: 'Are you sure you want to leave FleetPoint and return to IoTility?',
      confirmText: 'Back to IoTility',
      cancelText: 'Stay in FleetPoint',
    };
    const view = this.document.defaultView;
    if (!view) return;
    const confirmed = await new Promise<boolean>((resolve) => {
      const detail: HostDialogRequest = { handled: false, config, respond: resolve };
      view.dispatchEvent(new CustomEvent('iotility:feedback-dialog', { detail }));
      if (!detail.handled) resolve(view.confirm(config.message));
    });
    if (confirmed) await this.router.navigateByUrl('/home');
  }
}
