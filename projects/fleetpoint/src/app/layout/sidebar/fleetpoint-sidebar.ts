import { DOCUMENT } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';

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
  constructor(
    @Inject(DOCUMENT) private readonly document: Document,
    private readonly router: Router,
  ) {}

  protected readonly groups = [
    { label: 'Overview', items: ['Dashboard', 'Live Tracking', 'Trip Replay'] },
    { label: 'Fleet Management', items: ['Fleets', 'Vehicles', 'Drivers', 'Devices', 'POI'] },
    {
      label: 'Operations',
      items: ['Jobs', 'Routes', 'DashCam', 'Maintenance', 'Violations', 'Geozones'],
    },
    { label: 'Insights', items: ['Reports', 'Documents'] },
    { label: 'Admin', items: ['Users & Roles', 'Settings'] },
  ];

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
