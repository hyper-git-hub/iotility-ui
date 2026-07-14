import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, input } from '@angular/core';
import { Chart, ChartConfiguration, ChartDataset, registerables } from 'chart.js';
import { DashboardGraph } from '../../services/fleet-dashboard-api.service';
import { getFleetChartColors } from '../chart-colors';
import { withFleetChartDefaults } from '../chart-defaults';

Chart.register(...registerables);

@Component({
  selector: 'app-dashboard-graph',
  templateUrl: './dashboard-graph.html',
  styleUrl: './dashboard-graph.css',
})
export class DashboardGraphComponent implements AfterViewInit, OnDestroy {
  readonly graph = input.required<DashboardGraph>();
  @ViewChild('canvas') private canvas?: ElementRef<HTMLCanvasElement>;
  private chart?: Chart;
  private readonly colors = getFleetChartColors();

  protected allocations() {
    const data = this.graph().data;
    return !Array.isArray(data) ? (data.fleets ?? []) : [];
  }

  protected hasChartData(): boolean {
    const graph = this.graph();
    if (graph.code === 'DA') return false;
    if (Array.isArray(graph.data)) return graph.data.length > 0;
    return Boolean(graph.data.categories?.length && (graph.data.values?.length || graph.data.series?.some((series) => series.data.length)));
  }

  ngAfterViewInit(): void {
    if (!this.canvas || !this.hasChartData()) return;
    this.chart = new Chart(this.canvas.nativeElement, this.configuration());
  }

  ngOnDestroy(): void { this.chart?.destroy(); }

  private configuration(): ChartConfiguration {
    const graph = this.graph();
    const palette = [this.colors.brand, this.colors.info, this.colors.success, this.colors.warning, this.colors.danger, this.colors.grid];
    if (Array.isArray(graph.data)) {
      return {
        type: 'doughnut',
        data: { labels: graph.data.map((row) => row.fleet_name), datasets: [{ data: graph.data.map((row) => row.vehicle_count), backgroundColor: palette, borderWidth: 0 }] },
        options: withFleetChartDefaults<'doughnut'>({ cutout: '64%', plugins: { legend: { position: 'bottom' } } }),
      };
    }
    if (graph.data.values) {
      return {
        type: 'doughnut',
        data: { labels: graph.data.categories ?? [], datasets: [{ data: graph.data.values, backgroundColor: palette, borderWidth: 0 }] },
        options: withFleetChartDefaults<'doughnut'>({ cutout: '64%', plugins: { legend: { position: 'bottom' } } }),
      };
    }
    if (graph.chart_type === 'piechart') {
      const series = graph.data.series ?? [];
      return {
        type: 'doughnut',
        data: {
          labels: series.map((item) => this.readableLabel(item.name)),
          datasets: [{ data: series.map((item) => item.data.reduce((total, value) => total + value, 0)), backgroundColor: palette, borderWidth: 0 }],
        },
        options: withFleetChartDefaults<'doughnut'>({ cutout: '52%', plugins: { legend: { position: 'bottom' } } }),
      };
    }
    const horizontal = graph.chart_type === 'horizontal_stackbar_chart';
    const datasets: ChartDataset<'bar', number[]>[] = (graph.data.series ?? []).map((series, index) => ({
      label: this.readableLabel(series.name),
      data: series.data,
      backgroundColor: palette[index % palette.length],
      borderRadius: 5,
    }));
    return {
      type: 'bar',
      data: { labels: graph.data.categories ?? [], datasets },
      options: withFleetChartDefaults<'bar'>({
        indexAxis: horizontal ? 'y' : 'x',
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { position: 'bottom' } },
        scales: { x: { stacked: horizontal, grid: { display: false } }, y: { stacked: horizontal, beginAtZero: true } },
      }),
    };
  }

  private readableLabel(value: string): string {
    return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()).replace(' Probability Count', '');
  }
}
