import { Component, computed, inject } from '@angular/core';
import { DashboardGraphComponent } from '../../../shared/charts/dashboard-graph/dashboard-graph';
import { FleetDashboardApiService } from '../../../shared/services/fleet-dashboard-api.service';
import { emptyDashboardGraphs } from '../../../shared/services/dashboard-graphs';
import { DashboardWidgetsService } from '../../../shared/services/dashboard-widgets.service';

@Component({
  selector: 'app-dashboard-jobs',
  imports: [DashboardGraphComponent],
  templateUrl: './jobs.html',
  styleUrl: './jobs.css',
})
export class Jobs {
  private readonly widgets = inject(DashboardWidgetsService);

  protected readonly jobGraphs = computed(() => {
    const codes = ['DTS', 'JJ', 'JSJ', 'JSS'];
    const cached = this.api.cachedGraphs().filter((graph) => codes.includes(graph.code));
    return (cached.length ? cached : emptyDashboardGraphs().filter((graph) => codes.includes(graph.code)))
      .filter((graph) => this.widgets.isVisible('jobs', graph.code));
  });

  constructor(private readonly api: FleetDashboardApiService) {}
}
