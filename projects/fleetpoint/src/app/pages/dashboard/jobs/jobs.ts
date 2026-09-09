import { Component, computed } from '@angular/core';
import { DashboardGraphComponent } from '../../../shared/charts/dashboard-graph/dashboard-graph';
import { FleetDashboardApiService } from '../../../shared/services/fleet-dashboard-api.service';
import { emptyDashboardGraphs } from '../../../shared/services/dashboard-graphs';

@Component({
  selector: 'app-dashboard-jobs',
  imports: [DashboardGraphComponent],
  templateUrl: './jobs.html',
  styleUrl: './jobs.css',
})
export class Jobs {
  protected readonly jobGraphs = computed(() => {
    const codes = ['DTS', 'JJ', 'JSJ', 'JSS'];
    const cached = this.api.cachedGraphs().filter((graph) => codes.includes(graph.code));
    return cached.length ? cached : emptyDashboardGraphs().filter((graph) => codes.includes(graph.code));
  });

  constructor(private readonly api: FleetDashboardApiService) {}
}
