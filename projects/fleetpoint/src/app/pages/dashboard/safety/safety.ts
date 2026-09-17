import { Component, computed, inject } from '@angular/core';
import { DashboardGraphComponent } from '../../../shared/charts/dashboard-graph/dashboard-graph';
import {
  DashboardGraph,
  FleetDashboardApiService,
} from '../../../shared/services/fleet-dashboard-api.service';
import { emptyDashboardGraphs } from '../../../shared/services/dashboard-graphs';
import { DashboardWidgetsService } from '../../../shared/services/dashboard-widgets.service';

@Component({
  selector: 'app-dashboard-safety',
  imports: [DashboardGraphComponent],
  templateUrl: './safety.html',
  styleUrl: './safety.css',
})
export class Safety {
  private readonly widgets = inject(DashboardWidgetsService);
  private readonly dashcamEventsGraph: DashboardGraph = {
    code: 'DCE',
    name: 'DashCam Events',
    chart_type: null,
    data: null,
  };

  protected readonly safetyGraphs = computed(() => {
    const order = ['ADF', 'DVG', 'DSS', 'DCE'];
    const cached = this.api.cachedGraphs().filter((graph) => order.includes(graph.code));
    const graphs = cached.length
      ? cached
      : emptyDashboardGraphs().filter((graph) => order.includes(graph.code));
    return [...graphs, this.dashcamEventsGraph]
      .filter((graph) => this.widgets.isVisible('safety', graph.code))
      .sort((first, second) => order.indexOf(first.code) - order.indexOf(second.code));
  });

  constructor(private readonly api: FleetDashboardApiService) {}
}
