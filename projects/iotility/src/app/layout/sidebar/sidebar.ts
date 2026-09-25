import { Component, OnInit, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { FeedbackDialogService } from '../../shared/services/feedback-dialog.service';
import { LoadingService } from '../../shared/services/loading.service';
import { FLEETPOINT_APP, RecentApp, RecentAppsService } from '../../shared/services/recent-apps.service';

interface UseCaseModule {
  id: string;
  name: string;
  available: boolean;
  icon: string;
  action: () => void;
}

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css',
})
export class Sidebar implements OnInit {
  protected readonly useCasesOpen = signal(false);

  protected readonly modules: UseCaseModule[] = [
    {
      id: 'fleetpoint',
      name: 'Fleetpoint',
      available: true,
      icon: 'assets/fleetpoint.svg',
      action: () => this.openFleetPoint(),
    },
    {
      id: 'assetrack',
      name: 'Assetrack',
      available: false,
      icon: 'assets/assetrack.svg',
      action: () => this.buyModule('Assetrack'),
    },
    {
      id: 'sustainex',
      name: 'Sustainex',
      available: false,
      icon: 'assets/sustainex.svg',
      action: () => this.buyModule('Sustainex'),
    },
    {
      id: 'twinscape',
      name: 'Twinscape',
      available: false,
      icon: 'assets/twinscape.svg',
      action: () => this.buyModule('Twinscape'),
    },
    {
      id: 'wasterack',
      name: 'Wasterack',
      available: false,
      icon: 'assets/wasterack.svg',
      action: () => this.buyModule('Wasterack'),
    },
  ];

  constructor(
    private readonly loading: LoadingService,
    readonly recentApps: RecentAppsService,
    private readonly feedbackDialog: FeedbackDialogService,
  ) {}

  ngOnInit(): void {
    if (localStorage.getItem('firstLoginCompleted') !== 'true') this.useCasesOpen.set(true);
  }

  protected toggleUseCases(): void {
    this.useCasesOpen.update((open) => !open);
  }

  protected closeUseCases(): void {
    localStorage.setItem('firstLoginCompleted', 'true');
    this.useCasesOpen.set(false);
  }

  protected selectModule(action: () => void): void {
    localStorage.setItem('firstLoginCompleted', 'true');
    this.useCasesOpen.set(false);
    action();
  }

  protected openApp(app: RecentApp): void {
    this.recentApps.register(app);
    this.loading.navigate(
      app.url,
      {
        label: 'IoTility',
        title: `Loading ${app.label}`,
        message: 'Preparing your fleet command center…',
        initials: app.initials,
        logoSrc: app.logoSrc,
        labelLogoSrc: app.labelLogoSrc,
      },
      3000,
    );
  }

  protected removeApp(id: string): void {
    this.recentApps.remove(id);
  }

  protected openFleetPoint(): void {
    this.recentApps.register(FLEETPOINT_APP);
    this.loading.navigate(
      '/fleetpoint/dashboard',
      {
        label: 'IoTility',
        title: 'Loading FleetPoint',
        message: 'Preparing your fleet command center...',
        initials: 'FP',
        logoSrc: 'assets/fleetpoint.svg',
        labelLogoSrc: 'assets/iotility-loader-light.svg',
      },
      2000,
    );
  }

  protected buyModule(name: string): void {
    void this.feedbackDialog.open({
      type: 'warning',
      title: 'Coming soon',
      message: `"${name}" isn't available for purchase yet. Please check back later.`,
      confirmText: 'OK',
      showCancel: false,
    });
  }
}
