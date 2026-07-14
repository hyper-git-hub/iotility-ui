import { Component } from '@angular/core';
import { DataTable, TableColumn, TableRow } from '@iotility/shared-ui';
import { ChartData, ChartOptions } from 'chart.js';
import { FleetBarChart } from '../../../shared/charts/bar-chart/bar-chart';
import { getFleetChartColors } from '../../../shared/charts/chart-colors';
@Component({
  selector: 'app-dashboard-maintenance',
  imports: [DataTable, FleetBarChart],
  templateUrl: './maintenance.html',
  styleUrl: './maintenance.css',
})
export class Maintenance {
  private readonly c = getFleetChartColors();
  protected readonly statusData: ChartData<'bar', number[], string> = {
    labels: ['Oil Change', 'Spark Plug', 'Transmission', 'Air Filter', 'Brake Pads', 'Tyres'],
    datasets: [
      { label: 'Completed', data: [2, 1, 0, 3, 2, 1], backgroundColor: this.c.success },
      { label: 'Scheduled', data: [3, 2, 1, 4, 2, 3], backgroundColor: this.c.warning },
      { label: 'Overdue', data: [1, 1, 1, 0, 0, 2], backgroundColor: this.c.danger },
    ],
  };
  protected readonly statusOptions: ChartOptions<'bar'> = {
    interaction: { mode: 'index', intersect: false },
    plugins: { legend: { position: 'bottom' } },
    scales: {
      x: { stacked: true, grid: { display: false } },
      y: { stacked: true, beginAtZero: true },
    },
  };
  protected readonly probabilityData: ChartData<'bar', number[], string> = {
    labels: ['LP-9901', 'LP-7712', 'LP-4821', 'LP-3312', 'LP-6612', 'LP-2244'],
    datasets: [
      {
        label: 'Maintenance probability',
        data: [92, 78, 65, 45, 31, 18],
        backgroundColor: [
          this.c.danger,
          this.c.warning,
          this.c.warning,
          this.c.success,
          this.c.success,
          this.c.success,
        ],
        borderRadius: 7,
      },
    ],
  };
  protected readonly probabilityOptions: ChartOptions<'bar'> = {
    indexAxis: 'y',
    plugins: { legend: { display: false } },
    scales: {
      x: { beginAtZero: true, max: 100, ticks: { callback: (value) => `${value}%` } },
      y: { grid: { display: false } },
    },
  };
  protected readonly columns: TableColumn[] = [
    { key: 'vehicle', label: 'Vehicle' },
    { key: 'make', label: 'Make' },
    { key: 'service', label: 'Service' },
    { key: 'mileage', label: 'Mileage' },
    { key: 'due', label: 'Due' },
    { key: 'status', label: 'Status', type: 'status' },
  ];
  protected readonly rows: TableRow[] = [
    {
      vehicle: 'LP-9901',
      make: 'Volvo FH',
      service: 'Full Service',
      mileage: '142,300 mi',
      due: 'Overdue by 12 days',
      status: 'Overdue',
    },
    {
      vehicle: 'LP-7712',
      make: 'Mercedes Sprinter',
      service: 'Oil Change',
      mileage: '67,200 mi',
      due: 'Due in 3 days',
      status: 'Due Soon',
    },
    {
      vehicle: 'LP-4821',
      make: 'Volvo FH',
      service: 'Brake Inspection',
      mileage: '198,100 mi',
      due: 'Due in 8 days',
      status: 'Due Soon',
    },
    {
      vehicle: 'LP-3312',
      make: 'DAF XF',
      service: 'Tyre Rotation',
      mileage: '88,400 mi',
      due: 'Due in 14 days',
      status: 'Upcoming',
    },
    {
      vehicle: 'LP-6612',
      make: 'Volvo FH Reefer',
      service: 'Reefer Unit Check',
      mileage: '54,700 mi',
      due: 'Due in 21 days',
      status: 'Upcoming',
    },
  ];
}
