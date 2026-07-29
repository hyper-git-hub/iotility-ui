import { Component } from '@angular/core';
import { ChartData, ChartOptions } from 'chart.js';
import { FleetBarChart } from '../../../shared/charts/bar-chart/bar-chart';
import { getFleetChartColors } from '../../../shared/charts/chart-colors';
import { FleetDoughnutChart } from '../../../shared/charts/doughnut-chart/doughnut-chart';
import { FleetLineChart } from '../../../shared/charts/line-chart/line-chart';
import { CATEGORY_LABELS, DASHCAM_EVENTS, DashcamCategory } from '../dashcam.data';

@Component({
  selector: 'app-dashcam-analytics',
  imports: [FleetBarChart, FleetDoughnutChart, FleetLineChart],
  templateUrl: './dashcam-analytics.html',
  styleUrl: './dashcam-analytics.css',
})
export class DashcamAnalytics {
  private readonly colors = getFleetChartColors();
  protected readonly categoryColors: Record<DashcamCategory, string> = {
    'safety-critical': this.colors.danger,
    fatigue: '#ea580c',
    distraction: this.colors.warning,
    'driving-style': '#2563eb',
    identity: this.colors.brand,
    camera: '#6b7280',
  };
  protected readonly categories = (Object.entries(CATEGORY_LABELS) as [DashcamCategory, string][])
    .map(([id, label]) => ({
      id,
      label,
      value: DASHCAM_EVENTS.filter((event) => event.category === id).length,
      color: this.categoryColors[id],
    }))
    .filter((item) => item.value);
  protected readonly categoryData: ChartData<'doughnut', number[], string> = {
    labels: this.categories.map((item) => item.label),
    datasets: [
      {
        data: this.categories.map((item) => item.value),
        backgroundColor: this.categories.map((item) => item.color),
        borderColor: '#ffffff',
        borderWidth: 3,
        hoverOffset: 6,
      },
    ],
  };
  protected readonly categoryOptions: ChartOptions<'doughnut'> = {
    cutout: '58%',
    plugins: { legend: { display: false } },
  };
  protected readonly driverData: ChartData<'bar', number[], string> = {
    labels: ['Mohammed', 'Connor', 'Aisha', 'Oliver', 'James'],
    datasets: [
      {
        label: 'Total Events',
        data: [2, 2, 2, 1, 1],
        backgroundColor: this.colors.brand,
        borderRadius: 4,
      },
      {
        label: 'Critical',
        data: [2, 1, 0, 1, 0],
        backgroundColor: this.colors.danger,
        borderRadius: 4,
      },
    ],
  };
  protected readonly driverOptions: ChartOptions<'bar'> = {
    interaction: { mode: 'index', intersect: false },
    plugins: { legend: { position: 'bottom', reverse: true } },
    scales: {
      x: { grid: { display: true, color: 'rgba(148,163,184,.13)' }, border: { display: false } },
      y: {
        beginAtZero: true,
        ticks: { stepSize: 1 },
        grid: { color: 'rgba(148,163,184,.16)' },
        border: { display: false },
      },
    },
  };
  protected readonly trendData: ChartData<'line', number[], string> = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [
      {
        label: 'Total Events',
        data: [4, 7, 3, 8, 6, 2, DASHCAM_EVENTS.length],
        borderColor: this.colors.brand,
        backgroundColor: this.colors.brand,
        pointBackgroundColor: '#ffffff',
        pointBorderWidth: 2,
        pointRadius: 3,
        tension: 0.35,
      },
      {
        label: 'Critical',
        data: [1, 3, 1, 2, 2, 0, 4],
        borderColor: this.colors.danger,
        backgroundColor: this.colors.danger,
        pointBackgroundColor: '#ffffff',
        pointBorderWidth: 2,
        pointRadius: 3,
        tension: 0.35,
      },
    ],
  };
  protected readonly trendOptions: ChartOptions<'line'> = {
    interaction: { mode: 'index', intersect: false },
    plugins: { legend: { position: 'bottom', reverse: true } },
    scales: {
      x: { grid: { color: 'rgba(148,163,184,.13)' }, border: { display: false } },
      y: {
        beginAtZero: true,
        ticks: { stepSize: 3 },
        grid: { color: 'rgba(148,163,184,.16)' },
        border: { display: false },
      },
    },
  };
  protected readonly falsePositiveRate = Math.round(
    (DASHCAM_EVENTS.filter((event) => event.review === 'False Positive').length /
      DASHCAM_EVENTS.length) *
      100,
  );
}
