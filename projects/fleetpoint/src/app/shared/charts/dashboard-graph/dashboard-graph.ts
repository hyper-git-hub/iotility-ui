import { Component, input } from '@angular/core';
import { ChartData, ChartOptions } from 'chart.js';
import { DashboardGraph } from '../../services/fleet-dashboard-api.service';
import { FleetBarChart } from '../bar-chart/bar-chart';
import { getFleetChartColors } from '../chart-colors';
import { FleetDoughnutChart } from '../doughnut-chart/doughnut-chart';

@Component({
  selector: 'app-dashboard-graph',
  imports: [FleetBarChart, FleetDoughnutChart],
  templateUrl: './dashboard-graph.html',
  styleUrl: './dashboard-graph.css',
})
export class DashboardGraphComponent {
  readonly graph = input.required<DashboardGraph>();
  private readonly colors = getFleetChartColors();
  private readonly palette = [
    this.colors.brand,
    this.colors.info,
    this.colors.success,
    this.colors.warning,
    this.colors.danger,
    this.colors.grid,
  ];

  protected allocations() {
    const data = this.graph().data;
    return !Array.isArray(data) ? (data.fleets ?? []) : [];
  }

  protected hasChartData(): boolean {
    const graph = this.graph();
    if (graph.code === 'DA') return false;
    if (Array.isArray(graph.data)) return graph.data.length > 0;
    return Boolean(
      graph.data.categories?.length &&
      (graph.data.values?.length || graph.data.series?.some((series) => series.data.length)),
    );
  }

  protected isDoughnut(): boolean {
    const graph = this.graph();
    return graph.code === 'DTS' || Array.isArray(graph.data) || (!Array.isArray(graph.data) && Boolean(graph.data.values));
  }

  protected barData(): ChartData<'bar', number[], string> {
    const data = this.graph().data;
    if (Array.isArray(data)) return { labels: [], datasets: [] };
    return {
      labels: data.categories ?? [],
      datasets: (data.series ?? []).map((series, index) => ({
        label: this.readableLabel(series.name),
        data: series.data,
        backgroundColor: this.palette[index % this.palette.length],
        borderRadius: 5,
      })),
    };
  }

  protected doughnutData(): ChartData<'doughnut', number[], string> {
    const graph = this.graph();
    if (Array.isArray(graph.data)) {
      return {
        labels: graph.data.map((row) => row.fleet_name),
        datasets: [{ data: graph.data.map((row) => row.vehicle_count), backgroundColor: this.palette, borderWidth: 0 }],
      };
    }
    if (graph.data.values) {
      return {
        labels: graph.data.categories ?? [],
        datasets: [{ data: graph.data.values, backgroundColor: this.palette, borderWidth: 0 }],
      };
    }
    if (graph.code === 'DTS') {
      const categories = graph.data.categories ?? [];
      const series = graph.data.series ?? [];
      return {
        labels: categories,
        datasets: [{
          data: categories.map((_, categoryIndex) =>
            series.reduce((total, item) => total + (item.data[categoryIndex] ?? 0), 0),
          ),
          backgroundColor: this.palette,
          borderWidth: 0,
        }],
      };
    }
    const series = graph.data.series ?? [];
    return {
      labels: series.map((item) => this.readableLabel(item.name)),
      datasets: [{
        data: series.map((item) => item.data.reduce((total, value) => total + value, 0)),
        backgroundColor: this.palette,
        borderWidth: 0,
      }],
    };
  }

  protected barOptions(): ChartOptions<'bar'> {
    const horizontal = this.graph().chart_type === 'horizontal_stackbar_chart';
    return {
      indexAxis: horizontal ? 'y' : 'x',
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { position: 'bottom' } },
      scales: {
        x: { stacked: horizontal, grid: { display: false } },
        y: { stacked: horizontal, beginAtZero: true },
      },
    };
  }

  protected readonly doughnutOptions: ChartOptions<'doughnut'> = {
    cutout: '60%',
    plugins: { legend: { position: 'bottom' } },
  };

  private readableLabel(value: string): string {
    return value
      .replaceAll('_', ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase())
      .replace(' Probability Count', '');
  }
}
