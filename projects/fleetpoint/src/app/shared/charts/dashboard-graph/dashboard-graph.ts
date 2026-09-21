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
    return data && !Array.isArray(data) ? (data.fleets ?? []) : [];
  }

  protected hasChartData(): boolean {
    const graph = this.graph();
    if (graph.code === 'DA') return false;
    if (!graph.data) return false;
    if (Array.isArray(graph.data)) {
      return graph.data.some((row) => this.rowValue(row) !== 0);
    }

    if (!graph.data.categories?.length) return false;

    const values = [
      ...(graph.data.values ?? []).map((value) => this.numericValue(value)),
      ...this.numericSeries(graph.data.series),
      ...this.chartSeries(graph.data.series).flatMap((series) => series.data),
    ];

    return values.some((value) => Number.isFinite(value) && value !== 0);
  }

  protected isDoughnut(): boolean {
    const graph = this.graph();
    if (graph.code === 'JJ') return false;
    if (graph.chart_type) return graph.chart_type === 'piechart';
    return ['JSJ', 'MS'].includes(graph.code);
  }

  protected actionItems() {
    const data = this.graph().data;
    if (!Array.isArray(data)) return [];
    return data.map((row) => ({
      icon: String(row['icon'] ?? '!'),
      tone: String(row['tone'] ?? 'info'),
      title: String(row['title'] ?? row['name'] ?? ''),
      detail: String(row['detail'] ?? row['description'] ?? ''),
      priority: String(row['priority'] ?? 'low').toLowerCase(),
    }));
  }

  protected urgentActionCount(): number {
    return this.actionItems().filter((item) => item.priority === 'high').length;
  }

  protected driverData() {
    const data = this.graph().data;
    return data && !Array.isArray(data) ? data : null;
  }

  protected graphTitle(): string {
    return this.graph().code === 'JJ' ? 'Jobs by Location' : this.graph().name;
  }

  protected emptyMessage(): string {
    return ['ANT', 'DOW', 'FUT', 'DCE'].includes(this.graph().code)
      ? 'No record found'
      : 'No data available';
  }

  protected isLine(): boolean {
    const graph = this.graph();
    return (
      ['ADF', 'FCT', 'FCUT'].includes(graph.code) ||
      ['line graph', 'line_area_chart'].includes(graph.chart_type ?? '')
    );
  }

  protected barData(): ChartData<'bar', number[], string> {
    const data = this.graph().data;
    if (!data) return { labels: [], datasets: [] };
    if (Array.isArray(data)) {
      const values = data.map((row) => this.rowValue(row));
      return {
        labels: data.map((row) => this.rowLabel(row)),
        datasets: [{
          label: this.graph().name,
          data: values,
          backgroundColor: this.barColors(values),
          borderRadius: 5,
        }],
      };
    }
    if (data.values) {
      const values = data.values.map((value) => this.numericValue(value));
      return {
        labels: data.categories ?? [],
        datasets: [{
          label: this.graph().name,
          data: values,
          backgroundColor: this.barColors(values),
          borderRadius: 5,
        }],
      };
    }
    const series = this.chartSeries(data.series);
    if (series.length === (data.categories?.length ?? 0) && series.every((item) => item.data.length === 1)) {
      const values = series.map((item) => item.data[0] ?? 0);
      return {
        labels: data.categories ?? [],
        datasets: [{
          label: this.graph().name,
          data: values,
          backgroundColor: this.barColors(values),
          borderRadius: 5,
        }],
      };
    }
    return {
      labels: data.categories ?? [],
      datasets: series.map((item, index) => ({
        label: this.readableLabel(item.name),
        data: item.data,
        backgroundColor: this.palette[index % this.palette.length],
        borderRadius: 5,
      })),
    };
  }

  protected lineData(): ChartData<'line', number[], string> {
    const data = this.graph().data;
    if (!data || Array.isArray(data)) return { labels: [], datasets: [] };
    return {
      labels: data.categories ?? [],
      datasets: this.chartSeries(data.series).map((series, index) => ({
        label: this.readableLabel(series.name),
        data: series.data,
        borderColor: this.palette[index % this.palette.length],
        backgroundColor: `color-mix(in srgb, ${this.palette[index % this.palette.length]} 14%, transparent)`,
        fill: true,
        tension: 0.35,
        pointBackgroundColor: this.palette[index % this.palette.length],
        pointBorderColor: this.palette[index % this.palette.length],
        pointBorderWidth: 1,
        pointRadius: 3,
      })),
    };
  }

  protected doughnutData(): ChartData<'doughnut', number[], string> {
    const graph = this.graph();
    if (!graph.data) return { labels: [], datasets: [] };
    if (Array.isArray(graph.data)) {
      return {
        labels: graph.data.map((row) => this.rowLabel(row)),
        datasets: [{ data: graph.data.map((row) => this.rowValue(row)), backgroundColor: this.palette, borderWidth: 0 }],
      };
    }
    if (graph.data.values) {
      return {
        labels: graph.data.categories ?? [],
        datasets: [{ data: graph.data.values.map((value) => this.numericValue(value)), backgroundColor: this.palette, borderWidth: 0 }],
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
    const graph = this.graph();
    const chartType = graph.chart_type;
    const horizontal = ['DSS', 'JSS'].includes(graph.code) ||
      chartType === 'horizontal_stackbar_chart' || chartType === 'horizontal_bar_chart';
    const stacked = ['DSS', 'JSS'].includes(graph.code) ||
      chartType === 'horizontal_stackbar_chart' || chartType === 'stackbar_chart';
    return {
      indexAxis: horizontal ? 'y' : 'x',
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { position: 'bottom' } },
      scales: {
        x: {
          stacked,
          grid: { display: false },
          ticks: horizontal ? {} : {
            autoSkip: false,
            minRotation: 0,
            maxRotation: 0,
            callback: (_value, index) => this.wrapAxisLabel(this.barData().labels?.[index]),
          },
        },
        y: { stacked, beginAtZero: true },
      },
    };
  }

  protected readonly lineOptions: ChartOptions<'line'> = {
    interaction: { mode: 'index', intersect: false },
    plugins: { legend: { position: 'bottom' } },
    scales: { x: { grid: { display: false } }, y: { beginAtZero: true } },
  };

  protected doughnutOptions(): ChartOptions<'doughnut'> {
    return {
      cutout: this.graph().chart_type === 'piechart' ? '0%' : '60%',
      plugins: { legend: { position: 'bottom' } },
    };
  }

  private readableLabel(value: string): string {
    return value
      .replaceAll('_', ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase())
      .replace(' Probability Count', '');
  }

  private wrapAxisLabel(label: unknown, maxLength = 16): string | string[] {
    if (typeof label !== 'string' || label.length <= maxLength) return String(label ?? '');

    const lines: string[] = [];
    for (const word of label.split(/\s+/)) {
      const currentLine = lines.at(-1);
      if (!currentLine || `${currentLine} ${word}`.length > maxLength) {
        lines.push(word);
      } else {
        lines[lines.length - 1] = `${currentLine} ${word}`;
      }
    }
    return lines;
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

  private chartSeries(series: GraphSeries[] | number[] | undefined): GraphSeries[] {
    const named = this.namedSeries(series);
    return this.graph().code === 'DSS'
      ? named.filter((item) => item.name.toLowerCase() !== 'total points')
      : named;
  }

  private rowLabel(row: Record<string, string | number | null>): string {
    const labelKey = Object.keys(row).find((key) => typeof row[key] === 'string');
    return labelKey ? String(row[labelKey]) : '';
  }

  private rowValue(row: Record<string, string | number | null>): number {
    const valueKey = Object.keys(row).find((key) => typeof row[key] === 'number');
    return valueKey ? this.numericValue(row[valueKey]) : 0;
  }

  private numericValue(value: string | number | null): number {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    const parsed = Number.parseFloat(String(value ?? '').replace(/,/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private barColors(values: number[]): string[] {
    const maximum = Math.max(...values.filter((value) => Number.isFinite(value)), 0);
    if (maximum <= 0) return values.map(() => this.colors.danger);

    return values.map((value) => {
      const ratio = value / maximum;
      if (ratio >= 0.8) return this.colors.success;
      if (ratio >= 0.6) return this.colors.warning;
      return this.colors.danger;
    });
  }
}
