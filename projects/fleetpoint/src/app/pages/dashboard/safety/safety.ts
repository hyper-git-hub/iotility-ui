import { Component } from '@angular/core';
import { ChartData, ChartOptions } from 'chart.js';
import { FleetBarChart } from '../../../shared/charts/bar-chart/bar-chart';
import { FleetLineChart } from '../../../shared/charts/line-chart/line-chart';
import { FleetDoughnutChart } from '../../../shared/charts/doughnut-chart/doughnut-chart';
import { getFleetChartColors } from '../../../shared/charts/chart-colors';
@Component({
  selector: 'app-dashboard-safety',
  imports: [FleetBarChart, FleetLineChart, FleetDoughnutChart],
  templateUrl: './safety.html',
  styleUrl: './safety.css',
})
export class Safety {
  private readonly c = getFleetChartColors();
  protected readonly scorecardData: ChartData<'bar', number[], string> = {
    labels: ['Oliver P.', 'Haris K.', 'Sarah W.', 'Omar A.', 'Priya S.', 'Hanna M.', 'Aisha O.'],
    datasets: [
      {
        label: 'Harsh Acceleration',
        data: [8200, 12500, 4200, 18100, 5300, 9100, 2400],
        backgroundColor: this.c.warning,
      },
      {
        label: 'Harsh Braking',
        data: [3100, 8200, 1700, 9200, 3700, 5100, 900],
        backgroundColor: this.c.brand,
      },
      {
        label: 'Sharp Turn',
        data: [2400, 3400, 1100, 4100, 2200, 2700, 600],
        backgroundColor: this.c.info,
      },
      {
        label: 'Speed',
        data: [1700, 5200, 900, 6100, 1800, 2900, 400],
        backgroundColor: this.c.danger,
      },
    ],
  };
  protected readonly scorecardOptions: ChartOptions<'bar'> = {
    indexAxis: 'y',
    interaction: { mode: 'index', intersect: false },
    plugins: { legend: { position: 'bottom' } },
    scales: { x: { stacked: true }, y: { stacked: true, grid: { display: false } } },
  };
  protected readonly aggressiveData: ChartData<'line', number[], string> = {
    labels: ['Wk 1', 'Wk 2', 'Wk 3', 'Wk 4', 'Wk 5', 'Wk 6'],
    datasets: [
      {
        label: 'London Fleet',
        data: [45, 52, 38, 61, 42, 55],
        borderColor: this.c.danger,
        tension: 0.4,
        fill: true,
      },
      {
        label: 'Manchester Fleet',
        data: [27, 31, 24, 35, 28, 33],
        borderColor: this.c.warning,
        tension: 0.4,
        fill: true,
      },
    ],
  };
  protected readonly aggressiveOptions: ChartOptions<'line'> = {
    interaction: { mode: 'index', intersect: false },
    plugins: { legend: { position: 'bottom' } },
    scales: { x: { grid: { display: false } }, y: { beginAtZero: true } },
  };
  protected readonly violationsData: ChartData<'bar', number[], string> = {
    labels: ['London', 'Manchester', 'Birmingham', 'Leeds'],
    datasets: [
      {
        label: 'Violations',
        data: [60, 18, 32, 12],
        backgroundColor: [this.c.danger, this.c.warning, this.c.info, this.c.success],
        borderRadius: 7,
      },
    ],
  };
  protected readonly violationsOptions: ChartOptions<'bar'> = {
    plugins: { legend: { display: false } },
    scales: { x: { grid: { display: false } }, y: { beginAtZero: true } },
  };
  protected readonly dashcamData: ChartData<'doughnut', number[], string> = {
    labels: ['Distraction', 'Harsh Acceleration', 'Harsh Braking', 'Near Miss', 'Sharp Turn'],
    datasets: [
      {
        data: [8, 11, 13, 6, 9],
        backgroundColor: [this.c.warning, this.c.brand, this.c.danger, this.c.success, this.c.info],
        borderWidth: 0,
        hoverOffset: 8,
      },
    ],
  };
  protected readonly dashcamOptions: ChartOptions<'doughnut'> = {
    cutout: '62%',
    plugins: { legend: { position: 'bottom' } },
  };
}
