import { DOCUMENT } from '@angular/common';
import { Component, computed, Inject, Input, isDevMode } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { FeatureAccessService } from '../../shared/services/feature-access.service';
import { MenuGroup, SIDEBAR_MENU } from './menu.config';

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
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './fleetpoint-sidebar.html',
  styleUrl: './fleetpoint-sidebar.css',
})
export class FleetpointSidebar {
  @Input() badgeCounts: Record<string, number> = {};
  private readonly showAllDevelopmentItems = isDevMode();

  constructor(
    @Inject(DOCUMENT) private readonly document: Document,
    private readonly router: Router,
    private readonly features: FeatureAccessService,
  ) {}

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
