import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { LoadingService } from '../../shared/services/loading.service';
import { RecentApp, RecentAppsService } from '../../shared/services/recent-apps.service';

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css',
})
export class Sidebar {
  constructor(
    private readonly loading: LoadingService,
    readonly recentApps: RecentAppsService,
  ) {}

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
}
