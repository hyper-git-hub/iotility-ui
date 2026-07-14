import { Component } from '@angular/core';
import { ChartData, ChartOptions } from 'chart.js';
import { FleetBarChart } from '../../../shared/charts/bar-chart/bar-chart';
import { getFleetChartColors } from '../../../shared/charts/chart-colors';
import { FleetDoughnutChart } from '../../../shared/charts/doughnut-chart/doughnut-chart';

@Component({
  selector: 'app-dashboard-jobs',
  imports: [FleetBarChart, FleetDoughnutChart],
  templateUrl: './jobs.html',
  styleUrl: './jobs.css',
})
export class Jobs {
  private readonly colors = getFleetChartColors();

  protected readonly jobsByLocationData: ChartData<'bar', number[], string> = {
    labels: ['London', 'Manchester', 'Birmingham', 'Leeds', 'Bristol'],
    datasets: [
      {
        label: 'Ad-hoc',
        data: [12, 7, 5, 3, 4],
        backgroundColor: this.colors.danger,
        borderRadius: 6,
      },
      {
        label: 'Scheduled',
        data: [8, 11, 9, 6, 5],
        backgroundColor: this.colors.warning,
        borderRadius: 6,
      },
    ],
  };

  protected readonly jobsByLocationOptions: ChartOptions<'bar'> = {
    interaction: { mode: 'index', intersect: false },
    plugins: { legend: { position: 'bottom' } },
    scales: {
      x: { grid: { display: false } },
      y: { beginAtZero: true, suggestedMax: 12, ticks: { stepSize: 3 } },
    },
  };

  protected readonly jobStatisticsData: ChartData<'doughnut', number[], string> = {
    labels: ['Cancelled', 'Completed', 'In Progress', 'Pending'],
    datasets: [
      {
        data: [4, 33, 14, 16],
        backgroundColor: [
          this.colors.danger,
          this.colors.success,
          this.colors.brand,
          this.colors.warning,
        ],
        borderWidth: 0,
        hoverOffset: 8,
      },
    ],
  };

  protected readonly driverTaskData: ChartData<'doughnut', number[], string> = {
    labels: ['Completed', 'Pending'],
    datasets: [
      {
        data: [34, 66],
        backgroundColor: [this.colors.warning, this.colors.danger],
        borderWidth: 0,
        hoverOffset: 8,
      },
    ],
  };

  protected readonly doughnutOptions: ChartOptions<'doughnut'> = {
    cutout: '64%',
    plugins: { legend: { position: 'bottom' } },
  };

  protected readonly staffStatisticsData: ChartData<'bar', number[], string> = {
    labels: ['London', 'Manchester', 'Birmingham', 'Leeds'],
    datasets: [
      { label: 'Available', data: [2, 2, 1, 1], backgroundColor: this.colors.info, borderRadius: 5 },
      { label: 'On Bench', data: [1, 0, 1, 0], backgroundColor: this.colors.grid, borderRadius: 5 },
      { label: 'On Jobs', data: [5, 4, 3, 2], backgroundColor: this.colors.danger, borderRadius: 5 },
      { label: 'Total Staff', data: [8, 6, 4, 3], backgroundColor: this.colors.warning, borderRadius: 5 },
    ],
  };

  protected readonly staffStatisticsOptions: ChartOptions<'bar'> = {
    interaction: { mode: 'index', intersect: false },
    plugins: { legend: { position: 'bottom' } },
    scales: {
      x: { grid: { display: false } },
      y: { beginAtZero: true, suggestedMax: 8, ticks: { stepSize: 2 } },
    },
  };
}
