import { Component, computed } from '@angular/core';
import { DataTable, TableColumn, TableRow } from '@iotility/shared-ui';
import { DashboardGraphComponent } from '../../../shared/charts/dashboard-graph/dashboard-graph';
import { FleetDashboardApiService } from '../../../shared/services/fleet-dashboard-api.service';

@Component({
  selector: 'app-dashboard-maintenance',
  imports: [DataTable, DashboardGraphComponent],
  templateUrl: './maintenance.html',
  styleUrl: './maintenance.css',
})
export class Maintenance {
  protected readonly maintenanceGraphs = computed(() =>
    this.api.cachedGraphs().filter((graph) => ['MS', 'POVM'].includes(graph.code)),
  );

  protected readonly columns: TableColumn[] = [
    { key: 'vehicle', label: 'Vehicle' },
    { key: 'make', label: 'Make' },
    { key: 'service', label: 'Service' },
    { key: 'mileage', label: 'Mileage' },
    { key: 'due', label: 'Due' },
    { key: 'status', label: 'Status', type: 'status' },
  ];

  protected readonly rows: TableRow[] = [
    { vehicle: 'LP-9901', make: 'Volvo FH', service: 'Full Service', mileage: '142,300 mi', due: 'Overdue by 12 days', status: 'Overdue' },
    { vehicle: 'LP-7712', make: 'Mercedes Sprinter', service: 'Oil Change', mileage: '67,200 mi', due: 'Due in 3 days', status: 'Due Soon' },
    { vehicle: 'LP-4821', make: 'Volvo FH', service: 'Brake Inspection', mileage: '198,100 mi', due: 'Due in 8 days', status: 'Due Soon' },
    { vehicle: 'LP-3312', make: 'DAF XF', service: 'Tyre Rotation', mileage: '88,400 mi', due: 'Due in 14 days', status: 'Upcoming' },
    { vehicle: 'LP-6612', make: 'Volvo FH Reefer', service: 'Reefer Unit Check', mileage: '54,700 mi', due: 'Due in 21 days', status: 'Upcoming' },
  ];

  constructor(private readonly api: FleetDashboardApiService) {}
}
