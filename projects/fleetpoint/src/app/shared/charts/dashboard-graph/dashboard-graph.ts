import { Component, input } from '@angular/core';
import { ChartData, ChartOptions } from 'chart.js';
import { DashboardGraph, GraphSeries } from '../../services/fleet-dashboard-api.service';
import { FleetBarChart } from '../bar-chart/bar-chart';
import { getFleetChartColors } from '../chart-colors';
import { FleetDoughnutChart } from '../doughnut-chart/doughnut-chart';
import { FleetLineChart } from '../line-chart/line-chart';

@Component({
  selector: 'app-dashboard-graph',
  imports: [FleetBarChart, FleetDoughnutChart, FleetLineChart],
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
    if (Array.isArray(graph.data)) {
      return graph.data.some((row) => Number.isFinite(row.vehicle_count) && row.vehicle_count !== 0);
    }

    if (!graph.data.categories?.length) return false;

    const values = [
      ...(graph.data.values ?? []),
      ...this.numericSeries(graph.data.series),
      ...this.namedSeries(graph.data.series).flatMap((series) => series.data),
    ];

    return values.some((value) => Number.isFinite(value) && value !== 0);
  }

  protected isDoughnut(): boolean {
    const graph = this.graph();
    return graph.code === 'DTS' ||
      (graph.code !== 'JJ' && graph.chart_type === 'piechart') ||
      Array.isArray(graph.data) ||
      (!Array.isArray(graph.data) && Boolean(graph.data.values));
  }

  protected isLine(): boolean {
    return this.graph().chart_type === 'line_area_chart';
  }

  protected barData(): ChartData<'bar', number[], string> {
    const data = this.graph().data;
    if (Array.isArray(data)) return { labels: [], datasets: [] };
    return {
      labels: data.categories ?? [],
      datasets: this.namedSeries(data.series).map((series, index) => ({
        label: this.readableLabel(series.name),
        data: series.data,
        backgroundColor: this.palette[index % this.palette.length],
        borderRadius: 5,
      })),
    };
  }

  protected lineData(): ChartData<'line', number[], string> {
    const data = this.graph().data;
    if (Array.isArray(data)) return { labels: [], datasets: [] };
    return {
      labels: data.categories ?? [],
      datasets: this.namedSeries(data.series).map((series, index) => {
        const color = this.palette[index % this.palette.length];
        return {
          label: this.readableLabel(series.name),
          data: series.data,
          borderColor: color,
          tension: 0.35,
          pointBackgroundColor: color,
          pointBorderColor: color,
          pointBorderWidth: 1,
          pointRadius: 3,
        };
      }),
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
    if (this.numericSeries(graph.data.series).length) {
      return {
        labels: graph.data.categories ?? [],
        datasets: [{ data: this.numericSeries(graph.data.series), backgroundColor: this.palette, borderWidth: 0 }],
      };
    }
    if (graph.code === 'DTS') {
      const categories = graph.data.categories ?? [];
      const series = this.namedSeries(graph.data.series);
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
    const series = this.namedSeries(graph.data.series);
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
    const chartType = this.graph().chart_type;
    const horizontal = chartType === 'horizontal_stackbar_chart' || chartType === 'horizontal_bar_chart';
    const stacked = chartType === 'horizontal_stackbar_chart' || chartType === 'stackbar_chart';
    return {
      indexAxis: horizontal ? 'y' : 'x',
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { position: 'bottom' } },
      scales: {
        x: { stacked, grid: { display: false } },
        y: { stacked, beginAtZero: true },
      },
    };
  }

  protected readonly lineOptions: ChartOptions<'line'> = {
    interaction: { mode: 'index', intersect: false },
    plugins: { legend: { position: 'bottom' } },
    scales: { x: { grid: { display: false } }, y: { beginAtZero: true } },
  };

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

  private namedSeries(series: GraphSeries[] | number[] | undefined): GraphSeries[] {
    return Array.isArray(series) && series.every((item) => typeof item === 'object')
      ? series as GraphSeries[]
      : [];
  }

  private numericSeries(series: GraphSeries[] | number[] | undefined): number[] {
    return Array.isArray(series) && series.every((item) => typeof item === 'number')
      ? series as number[]
      : [];
  }
}
