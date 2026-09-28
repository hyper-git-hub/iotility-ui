import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DestroyRef } from '@angular/core';
import { Skeleton, StatusBadge } from '@iotility/shared-ui';
import { finalize, interval } from 'rxjs';
import { DashboardGraphComponent } from '../../../shared/charts/dashboard-graph/dashboard-graph';
import { StatCardTone } from '../../../shared/stat-card/stat-card';
import {
  DashboardCard,
  DashboardGraphData,
  DashboardGraph,
  DashcamDevice,
  FleetDashboardApiService,
} from '../../../shared/services/fleet-dashboard-api.service';
import { emptyDashboardGraphs, mergeDashboardGraphs } from '../../../shared/services/dashboard-graphs';
import { DashboardWidgetsService } from '../../../shared/services/dashboard-widgets.service';

interface OverviewSkeleton {
  code: string;
  type: 'list' | 'bar' | 'line' | 'profile';
}

@Component({
  selector: 'app-dashboard-overview',
  imports: [Skeleton, StatusBadge, DashboardGraphComponent],
  templateUrl: './overview.html',
  styleUrls: ['../dashboard-page.css', './overview.css'],
})
export class Overview implements OnInit {
  private readonly overviewGraphOrder = ['ANT', 'FCUT', 'DOW', 'FUT', 'FCT'];
  private readonly overviewCards = computed<DashboardGraph[]>(() => {
    const driverCard = this.cards().find((card) => card?.code === 'DOW');
    return [
      { code: 'ANT', name: 'Actions Needed Today', chart_type: null, data: null },
      {
        code: 'DOW',
        name: driverCard?.name ?? 'Driver of the Week',
        chart_type: null,
        data: driverCard?.data && typeof driverCard.data === 'object' ? driverCard.data : null,
      },
    ];
  });
  private readonly widgetService = inject(DashboardWidgetsService);
  protected readonly fleetStatusVisible = computed(() =>
    this.widgetService.isVisible('overview', 'fleet-status'),
  );
  protected readonly visibleGraphs = computed(() =>
    this.displayedGraphs().filter((graph) => this.widgetService.isVisible('overview', graph.code)),
  );

  protected readonly cardsLoading = signal(true);
  protected readonly graphsLoading = signal(true);
  protected readonly cardsError = signal('');
  protected readonly metricSkeletons = Array.from({ length: 8 });
  protected readonly loadingSkeletons = computed<OverviewSkeleton[]>(() =>
    [
      { code: 'ANT', type: 'list' as const },
      { code: 'FCUT', type: 'line' as const },
      { code: 'DOW', type: 'profile' as const },
      { code: 'FUT', type: 'bar' as const },
      { code: 'FCT', type: 'line' as const },
    ].filter((item) => this.widgetService.isVisible('overview', item.code)),
  );
  protected readonly cards = signal<DashboardCard<number | string | DashboardGraphData | null>[]>([]);
  protected readonly displayedCards = computed(() => {
    const order = ['DVC', 'J', 'MD', 'MOD', 'TD', 'TDC', 'TF', 'VIM'];
    return this.cards()
      .filter((card) => card.code !== 'VIO')
      .sort((first, second) => {
        const firstIndex = order.indexOf(first.code);
        const secondIndex = order.indexOf(second.code);
        return (
          (firstIndex < 0 ? order.length : firstIndex) -
          (secondIndex < 0 ? order.length : secondIndex)
        );
      })
      .slice(0, 8);
  });
  protected readonly graphs = signal<DashboardGraph[]>([]);
  protected readonly displayedGraphs = computed<DashboardGraph[]>(() => {
    const apiGraphs = mergeDashboardGraphs(this.graphs());
    const apiCodes = new Set(apiGraphs.map((graph) => graph.code));
    return [...apiGraphs, ...this.overviewCards().filter((graph) => !apiCodes.has(graph.code))]
      .filter((graph) => this.overviewGraphOrder.includes(graph.code))
      .sort((first, second) => {
        return (
          this.overviewGraphOrder.indexOf(first.code) -
          this.overviewGraphOrder.indexOf(second.code)
        );
      });
  });
  protected readonly dashcams = signal<DashcamDevice[]>([]);
  /* Live fleet status comes straight from the LFS entry of the graphs API
     response (categories/values/total) — no per-vehicle re-derivation. */
  private readonly fleetStatusData = computed<(DashboardGraphData & { total?: number }) | null>(() => {
    const lfs = this.cards().find((card) => card?.code === 'LFS');
    const data = lfs?.data;
    return data && typeof data === 'object' && !Array.isArray(data)
      ? (data as DashboardGraphData & { total?: number })
      : null;
  });
  protected readonly fleetStatusTotal = computed<number>(() => {
    const data = this.fleetStatusData();
    if (typeof data?.total === 'number') return data.total;
    return (data?.values ?? []).reduce<number>((sum, value) => sum + (Number(value) || 0), 0);
  });
  protected readonly fleetStatus = computed(() => {
    const status = { moving: 0, idling: 0, stopped: 0, alert: 0, offline: 0 };
    const data = this.fleetStatusData();
    if (!data) return status;
    const values = data.values ?? [];
    (data.categories ?? []).forEach((category, index) => {
      const key = category.trim().toLowerCase();
      if (key in status) status[key as keyof typeof status] = Number(values[index]) || 0;
    });
    return status;
  });
  protected readonly fleetStatusOnline = computed<boolean>(
    () => this.fleetStatusTotal() > this.fleetStatus().offline,
  );
  protected readonly fleetStatusItems = computed(() => {
    const status = this.fleetStatus();
    return [
      { key: 'moving', label: 'Moving', value: status.moving, tone: 'moving' },
      { key: 'idling', label: 'Idling', value: status.idling, tone: 'idling' },
      { key: 'stopped', label: 'Stopped', value: status.stopped, tone: 'stopped' },
      { key: 'alert', label: 'Alert', value: status.alert, tone: 'alert' },
      { key: 'offline', label: 'Offline', value: status.offline, tone: 'offline' },
    ];
  });
  private readonly destroyRef = inject(DestroyRef);

  constructor(private readonly api: FleetDashboardApiService) {}

  ngOnInit(): void {
    this.loadDashboard();
    interval(30_000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadGraphs(false));
  }

  protected loadDashboard(): void {
    // this.loadCards();
    this.loadGraphs();
    this.dashcams.set([]);
  }

  // protected loadCards(): void {
  //   this.cardsLoading.set(true);
  //   this.cardsError.set('');
  //   this.api.getCards().pipe(finalize(() => this.cardsLoading.set(false))).subscribe({
  //     next: (cards) => {
  //       if (cards.status !== 1000) {
  //         this.cardsError.set(cards.message || 'Fleet metrics could not be loaded.');
  //         this.cards.set([]);
  //         return;
  //       }
  //       this.cards.set(Array.isArray(cards.data) ? cards.data : []);
  //     },
  //     error: (response) => {
  //       this.cardsError.set(response.error?.message || 'Fleet metrics could not be loaded.');
  //     },
  //   });
  // }

  protected loadGraphs(showSkeleton = true): void {
    if (showSkeleton) this.graphsLoading.set(true);
    this.api
      .getGraphs()
      .pipe(finalize(() => { if (showSkeleton) this.graphsLoading.set(false); }))
      .subscribe({
        next: (response) => {
          if (response.status !== 1000) {
            this.showGraphsWithoutData();
            return;
          }
          const received = Array.isArray(response.data?.graphs)
            ? response.data.graphs.filter((graph) => graph.analytics_type === 'G')
            : [];
          this.cards.set(
            Array.isArray(response.data?.cards)
              ? response.data.cards.filter((card) => card != null)
              : [],
          );
          this.graphs.set(received);
          this.api.cacheGraphs(mergeDashboardGraphs(received));
        },
        error: () => this.showGraphsWithoutData(),
      });
  }

  private showGraphsWithoutData(): void {
    const graphs = emptyDashboardGraphs();
    this.graphs.set(graphs);
    this.api.cacheGraphs(graphs);
  }

  protected cardTone(code: string): StatCardTone {
    if (['DVC', 'MOD', 'QHB', 'QSF'].includes(code)) return 'danger';
    if (['MD', 'VIM', 'QIT', 'QUL'].includes(code)) return 'warning';
    if (['VIO', 'TD', 'QFU', 'QRH'].includes(code)) return 'success';
    if (code === 'QPT') return 'brand';
    return 'info';
  }

  protected statusPercentage(value: number): number {
    const total: number = this.fleetStatusTotal();
    return total > 0 ? (value / total) * 100 : 0;
  }
}
