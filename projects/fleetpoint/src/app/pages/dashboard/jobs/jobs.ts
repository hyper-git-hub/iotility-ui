import { Component, computed } from '@angular/core';
import { DashboardGraphComponent } from '../../../shared/charts/dashboard-graph/dashboard-graph';
import { FleetDashboardApiService } from '../../../shared/services/fleet-dashboard-api.service';

@Component({
  selector: 'app-dashboard-jobs',
  imports: [DashboardGraphComponent],
  templateUrl: './jobs.html',
  styleUrl: './jobs.css',
})
export class Jobs {
  protected readonly jobGraphs = computed(() =>
    this.api.cachedGraphs().filter((graph) => ['DTS', 'JJ', 'JSJ', 'JSS'].includes(graph.code)),
  );

  constructor(private readonly api: FleetDashboardApiService) {}
}
