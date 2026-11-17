import { TabIndicator } from '@iotility/shared-ui';
import { Component, DestroyRef, ElementRef, afterNextRender, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter, interval } from 'rxjs';
import { DashboardWidgetsService } from '../../shared/services/dashboard-widgets.service';
import { FleetDashboardApiService } from '../../shared/services/fleet-dashboard-api.service';
import { mergeDashboardGraphs } from '../../shared/services/dashboard-graphs';
import { CustomiseModal } from './customise-modal/customise-modal';

/** Graph card height range in px: today's 380 at most, and never so short a donut gets cramped. */
const CARD_HEIGHT = { min: 280, max: 380 };
/** The gap between card rows (gap-4 in the tab grids). */
const ROW_GAP = 16;
/** Room left under the second row, so rounding never tips the page into a scrollbar. */
const BOTTOM_SLACK = 8;

@Component({
  selector: 'app-dashboard-page',
  imports: [TabIndicator, RouterLink, RouterLinkActive, RouterOutlet, CustomiseModal],
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-shell.css',
})
export class DashboardPage {
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
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

  protected readonly currentTime = signal(
    new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
  );

  protected readonly tabs: Array<{ label: string; path: string; exact: boolean; placeholder?: boolean; icon: string }> = [
    { label: 'Overview', path: 'overview', exact: true, icon: 'assets/fleetpoint/sidebar-icons/dashboard.svg' },
    { label: 'Safety', path: 'safety', exact: true, icon: 'assets/fleetpoint/icons/shield-check.svg' },
    { label: 'Maintenance', path: 'maintenance', exact: true, icon: 'assets/fleetpoint/sidebar-icons/maintenance.svg' },
    { label: 'Jobs', path: 'jobs', exact: true, icon: 'assets/fleetpoint/sidebar-icons/jobs.svg' },
    // { label: 'Reports', path: 'reports', exact: true, placeholder: true, icon: 'assets/fleetpoint/sidebar-icons/reports.svg' },
  ];

  constructor() {
    this.activeTab.set(this.tabFromUrl());
    this.loadGraphsForDirectTab();
    afterNextRender(() => this.fitCardsToScreen());
    interval(30_000)
      .pipe(takeUntilDestroyed())
      .subscribe(() =>
        this.currentTime.set(
          new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        ),
      );
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

  /**
   * Sizes the graph cards (--dashboard-card-height) so two rows fit in the scroll area under the
   * tabs without scrolling, within CARD_HEIGHT. Measured from the real scroll area, so it follows
   * the screen and window size. Uses layout heights, not on-screen positions, which the tabs'
   * reveal animation shifts while it plays.
   */
  private fitCardsToScreen(): void {
    const page = this.host.nativeElement.querySelector<HTMLElement>('.dashboard-page');
    const heading = page?.querySelector<HTMLElement>('.dashboard-heading');
    const tabs = page?.querySelector<HTMLElement>('.dashboard-tabs');
    const scrollArea = page?.closest('main');
    if (!page || !heading || !tabs || !scrollArea || typeof ResizeObserver === 'undefined') return;
    const outerHeight = (element: HTMLElement) =>
      element.offsetHeight + parseFloat(getComputedStyle(element).marginBottom || '0');
    const update = () => {
      const pageStyles = getComputedStyle(page);
      const aboveCards = parseFloat(pageStyles.paddingTop) + outerHeight(heading) + outerHeight(tabs);
      const available =
        scrollArea.clientHeight - aboveCards - parseFloat(pageStyles.paddingBottom) - ROW_GAP - BOTTOM_SLACK;
      const height = Math.floor(Math.min(CARD_HEIGHT.max, Math.max(CARD_HEIGHT.min, available / 2)));
      page.style.setProperty('--dashboard-card-height', `${height}px`);
    };
    const observer = new ResizeObserver(update);
    observer.observe(scrollArea);
    this.destroyRef.onDestroy(() => observer.disconnect());
    update();
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

