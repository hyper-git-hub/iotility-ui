import { Component } from '@angular/core';
import { ChartData, ChartOptions } from 'chart.js';
import { FleetBarChart } from '../../../shared/charts/bar-chart/bar-chart';
import { FleetLineChart } from '../../../shared/charts/line-chart/line-chart';
import { FleetDoughnutChart } from '../../../shared/charts/doughnut-chart/doughnut-chart';
import { getFleetChartColors } from '../../../shared/charts/chart-colors';

@Component({
  selector: 'app-dashboard-overview',
  imports: [FleetBarChart, FleetLineChart, FleetDoughnutChart],
  templateUrl: './overview.html',
  styleUrl: '../dashboard-page.css',
})
export class Overview {
  private readonly colors = getFleetChartColors();
  protected readonly efficiencyData: ChartData<'line', number[], string> = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [
      {
        label: 'CO₂ (kg)',
        data: [940, 900, 980, 890, 920, 760, 850],
        borderColor: this.colors.brand,
        backgroundColor: `${this.colors.brand}22`,
        fill: true,
        tension: 0.4,
      },
      {
        label: 'Fuel (L)',
        data: [360, 340, 380, 335, 350, 290, 325],
        borderColor: this.colors.warning,
        tension: 0.4,
      },
    ],
  };
  protected readonly efficiencyOptions: ChartOptions<'line'> = {
    animation: { duration: 1400 },
    interaction: { mode: 'index', intersect: false },
    plugins: { legend: { position: 'bottom' } },
    scales: {
      x: { grid: { display: false } },
      y: { beginAtZero: true, grid: { color: `${this.colors.grid}66` } },
    },
  };
  protected readonly utilisationData: ChartData<'bar', number[], string> = {
    labels: ['Vans', 'Trucks', 'Cars', 'EVs', 'Bikes'],
    datasets: [
      {
        label: 'Utilisation',
        data: [84, 72, 94, 67, 78],
        backgroundColor: [
          this.colors.success,
          this.colors.warning,
          this.colors.success,
          this.colors.danger,
          this.colors.info,
        ],
        borderRadius: 7,
      },
    ],
  };
  protected readonly utilisationOptions: ChartOptions<'bar'> = {
    animation: { duration: 1400 },
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false } },
      y: { beginAtZero: true, max: 100, ticks: { callback: (value) => `${value}%` } },
    },
  };
  protected readonly fuelMixData: ChartData<'doughnut', number[], string> = {
    labels: ['Diesel', 'Petrol', 'Electric', 'Hybrid'],
    datasets: [
      {
        data: [46, 24, 18, 12],
        backgroundColor: [
          this.colors.brand,
          this.colors.info,
          this.colors.success,
          this.colors.warning,
        ],
        borderWidth: 0,
        hoverOffset: 8,
      },
    ],
  };
  protected readonly fuelMixOptions: ChartOptions<'doughnut'> = {
    cutout: '68%',
    animation: { duration: 1400 },
    plugins: { legend: { position: 'bottom' } },
  };
  protected readonly fleetStatuses = [
    { label: 'Moving', count: 186, tone: 'success' },
    { label: 'Idling', count: 21, tone: 'warning' },
    { label: 'Stopped', count: 26, tone: 'info' },
    { label: 'Alert', count: 9, tone: 'danger' },
    { label: 'Offline', count: 6, tone: 'muted' },
  ];
  protected readonly actions = [
    { title: '3 vehicles in alert state', detail: 'FP-4821, FP-7734, FP-2201', level: 'High' },
    { title: 'Cold chain breach detected', detail: 'FP-0392 — 12.4°C', level: 'High' },
    { title: '2 vehicles due for service', detail: 'FP-7712, FP-9901 overdue', level: 'Medium' },
    { title: '3 unreviewed dashcam events', detail: 'Harsh braking · Near miss', level: 'Medium' },
  ];
}
