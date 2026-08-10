import { Component, computed } from '@angular/core';
import { DashboardGraphComponent } from '../../../shared/charts/dashboard-graph/dashboard-graph';
import { FleetDashboardApiService } from '../../../shared/services/fleet-dashboard-api.service';

@Component({
  selector: 'app-dashboard-safety',
  imports: [DashboardGraphComponent],
  templateUrl: './safety.html',
  styleUrl: './safety.css',
})
export class Safety {
  protected readonly safetyGraphs = computed(() => {
    const order = ['ADF', 'DVG', 'DSS'];
    return this.api.cachedGraphs()
      .filter((graph) => order.includes(graph.code))
      .sort((first, second) => order.indexOf(first.code) - order.indexOf(second.code));
  });

  constructor(private readonly api: FleetDashboardApiService) {}
}
