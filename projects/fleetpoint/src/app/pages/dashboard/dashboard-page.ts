import { Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { DashboardWidgetsService } from '../../shared/services/dashboard-widgets.service';
import { FleetDashboardApiService } from '../../shared/services/fleet-dashboard-api.service';
import { mergeDashboardGraphs } from '../../shared/services/dashboard-graphs';
import { CustomiseModal } from './customise-modal/customise-modal';

@Component({
  selector: 'app-dashboard-page',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, CustomiseModal],
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-shell.css',
})
export class DashboardPage {
  private readonly router = inject(Router);
  private readonly dashboardApi = inject(FleetDashboardApiService);
  protected readonly widgets = inject(DashboardWidgetsService);
  protected readonly customiseOpen = signal(false);
  protected readonly activeTab = signal('overview');
  protected readonly activeTabLabel = computed(
    () => this.tabs.find((tab) => tab.path === this.activeTab())?.label ?? 'Overview',
  );

  protected readonly todayLabel = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  protected readonly tabs: Array<{ label: string; path: string; exact: boolean; placeholder?: boolean; emoji: string }> = [
    { label: 'Overview', path: 'overview', exact: true, emoji: '📊' },
    { label: 'Safety', path: 'safety', exact: true, emoji: '🛡️' },
    { label: 'Maintenance', path: 'maintenance', exact: true, emoji: '🔧' },
    { label: 'Jobs', path: 'jobs', exact: true, emoji: '📋' },
    { label: 'Reports', path: 'reports', exact: true, placeholder: true, emoji: '📈' },
  ];

  constructor() {
    this.activeTab.set(this.tabFromUrl());
    this.loadGraphsForDirectTab();
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.activeTab.set(this.tabFromUrl()));
  }

  private loadGraphsForDirectTab(): void {
    if (this.activeTab() === 'overview' || this.dashboardApi.cachedGraphs().length) return;

    this.dashboardApi.getGraphs().subscribe({
      next: (response) => {
        if (response.status !== 1000 || !Array.isArray(response.data?.graphs)) return;
        const graphs = response.data.graphs.filter((graph) => graph.analytics_type === 'G');
        this.dashboardApi.cacheGraphs(mergeDashboardGraphs(graphs));
      },
    });
  }

  protected openCustomise(): void {
    this.customiseOpen.set(true);
  }

  protected closeCustomise(): void {
    this.customiseOpen.set(false);
  }

  private tabFromUrl(): string {
    const segment = this.router.url.split(/[?#]/)[0].split('/').pop() ?? 'overview';
    return this.tabs.some((tab) => tab.path === segment) ? segment : 'overview';
  }
}

