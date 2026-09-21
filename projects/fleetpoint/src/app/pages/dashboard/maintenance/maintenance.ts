import { Component, computed, inject } from '@angular/core';
import { DataTable, TableColumn, TableRow } from '@iotility/shared-ui';
import { DashboardGraphComponent } from '../../../shared/charts/dashboard-graph/dashboard-graph';
import { FleetDashboardApiService } from '../../../shared/services/fleet-dashboard-api.service';
import { emptyDashboardGraphs } from '../../../shared/services/dashboard-graphs';
import { DashboardWidgetsService } from '../../../shared/services/dashboard-widgets.service';

@Component({
  selector: 'app-dashboard-maintenance',
  imports: [DataTable, DashboardGraphComponent],
  templateUrl: './maintenance.html',
  styleUrl: './maintenance.css',
})
export class Maintenance {
  private readonly widgets = inject(DashboardWidgetsService);
  protected readonly tableVisible = computed(() => this.widgets.isVisible('maintenance', 'service-table'));

  protected readonly maintenanceGraphs = computed(() => {
    const codes = ['MS', 'POVM'];
    const cached = this.api.cachedGraphs().filter((graph) => codes.includes(graph.code));
    return (cached.length ? cached : emptyDashboardGraphs().filter((graph) => codes.includes(graph.code)))
      .filter((graph) => this.widgets.isVisible('maintenance', graph.code))
      .sort((first, second) => codes.indexOf(first.code) - codes.indexOf(second.code));
  });

  protected readonly columns: TableColumn[] = [
    { key: 'vehicle', label: 'Vehicle' },
    { key: 'make', label: 'Make' },
    { key: 'service', label: 'Service' },
    { key: 'mileage', label: 'Mileage' },
    { key: 'due', label: 'Due' },
    { key: 'status', label: 'Status', type: 'status' },
  ];

  protected readonly rows: TableRow[] = [];

  constructor(private readonly api: FleetDashboardApiService) {}
}
