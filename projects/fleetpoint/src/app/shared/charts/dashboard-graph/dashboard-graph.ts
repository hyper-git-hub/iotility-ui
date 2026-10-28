import { Component, computed, inject, input, signal } from '@angular/core';
import {
  BarChart,
  ChartCard,
  ChartLegendItem,
  ChartSeries,
  ChartSlice,
  ChartTheme,
  DonutChart,
  DropdownOption,
  LineChart,
} from '@iotility/shared-ui';
import { DashboardGraph, GraphSeries, FleetDashboardApiService } from '../../services/fleet-dashboard-api.service';
import { GraphFilter } from '../graph-filter/graph-filter';

/** One option in a graph's filter dropdown; `id` is sent as `filter_by`. */
export interface DashboardGraphFilter {
  ariaLabel: string;
  options: DropdownOption[];
}

const CALENDER: DropdownOption[] = [
  { id: 'Month', label: 'Month' },
  { id: 'Week', label: 'Week' },
  { id: 'Today', label: 'Today' },
];

const JOB_CALENDER: DropdownOption[] = [
  { id: 'today', label: 'Today' },
  { id: 'last_week', label: 'Last Week' },
  { id: 'this_month', label: 'This Month' },
  { id: 'last_month', label: 'Last Month' },
];

/**
 * Filter options per graph code, matching the legacy FMS dashboard exactly so
 * both apps send identical `filter_by` values to the backend.
 *
 * Only graphs FleetPoint actually renders are listed. The legacy app also
 * filters DP, FE, FU, FC, FUT and DA; those need a live fleet list or a
 * second `order` param, so they are left out until a page needs them.
 */
export const DASHBOARD_GRAPH_FILTERS: Record<string, DashboardGraphFilter> = {
  // Aggressively Driven Fleets — Month / Week / Today
  ADF: { ariaLabel: 'Filter aggressively driven fleets by period', options: CALENDER },
  // Driver Safety Scorecard — Month / Week / Today
  DSS: { ariaLabel: 'Filter driver safety scorecard by period', options: CALENDER },
  // Driver Violations — group by Fleet or Type
  DVG: {
    ariaLabel: 'Group driver violations',
    options: [
      { id: 'fleet', label: 'Fleet' },
      { id: 'type', label: 'Type' },
    ],
  },
  // Statistics of Jobs — Today / Last Week / This Month / Last Month
  JSJ: { ariaLabel: 'Filter job statistics by period', options: JOB_CALENDER },
  // Staff Statistics — same periods as JSJ
  JSS: { ariaLabel: 'Filter staff statistics by period', options: JOB_CALENDER },
  // Maintenance status — group by Service Type or Status Type
  MS: {
    ariaLabel: 'Group maintenance status',
    options: [
      { id: 'service', label: 'Service Type' },
      { id: 'status', label: 'Status Type' },
    ],
  },
};

interface AxisChartModel {
  categories: string[];
  series: ChartSeries[];
}

@Component({
  selector: 'app-dashboard-graph',
  imports: [BarChart, ChartCard, DonutChart, GraphFilter, LineChart],
  templateUrl: './dashboard-graph.html',
  styleUrl: './dashboard-graph.css',
})
export class DashboardGraphComponent {
  readonly graph = input.required<DashboardGraph>();
  /** Where the chart legend renders: top-right of the graph card or the classic bottom. */
  readonly legendPosition = input<'top' | 'bottom'>('bottom');

  private readonly api = inject(FleetDashboardApiService);
  private readonly theme = inject(ChartTheme);

  /** Per-graph filter choice, so switching dashboard tabs keeps it. */
  private readonly selections = signal<Record<string, string>>({});

  protected readonly graphFilter = computed(() => DASHBOARD_GRAPH_FILTERS[this.graph().code] ?? null);
  protected readonly filterOptions = computed<DropdownOption[]>(() => this.graphFilter()?.options ?? []);
  protected readonly selectedFilterId = computed(() => this.selections()[this.graph().code] ?? '');
  protected readonly filterAriaLabel = computed(() => this.graphFilter()?.ariaLabel ?? 'Filter');

  protected onFilterSelected(option: DropdownOption): void {
    const code = this.graph().code;
    this.selections.update((state) => ({ ...state, [code]: option.id }));
    this.api.applyGraphFilter(code, option.id);
  }

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

  protected isPie(): boolean {
    return this.graph().chart_type === 'piechart';
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

  /* Fleet Utilisation (FUT) carries the Good/OK/Low status legend instead of a series legend. */
  protected isFleetUtilisation(): boolean {
    const graph = this.graph();
    return graph.code === 'FUT' || graph.name.trim().toLowerCase() === 'fleet utilisation';
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

  protected readonly horizontal = computed(() => {
    const graph = this.graph();
    return ['DSS', 'JSS'].includes(graph.code) ||
      graph.chart_type === 'horizontal_stackbar_chart' || graph.chart_type === 'horizontal_bar_chart';
  });

  protected readonly stacked = computed(() => {
    const graph = this.graph();
    return ['DSS', 'JSS'].includes(graph.code) ||
      graph.chart_type === 'horizontal_stackbar_chart' || graph.chart_type === 'stackbar_chart';
  });

  /** In-chart legend only when the card header isn't showing one. */
  protected readonly chartLegend = computed(() => this.legendPosition() !== 'top' && !this.isFleetUtilisation());

  protected readonly barModel = computed<AxisChartModel>(() => {
    const data = this.graph().data;
    if (!data) return { categories: [], series: [] };
    if (Array.isArray(data)) {
      const values = data.map((row) => this.rowValue(row));
      return {
        categories: data.map((row) => this.rowLabel(row)),
        series: [{ name: this.graph().name, data: values, colors: this.levelColors(values) }],
      };
    }
    /* Named series win over plain values: multi-series payloads (e.g. one series per
       fleet in Driver Violations) must render as separate series, otherwise the
       chart collapses to a single series labelled with the graph name. */
    const series = this.chartSeries(data.series);
    const categories = data.categories ?? [];
    if (series.length) {
      // One single-value series per category: one bar per category, each in its own colour.
      if (series.length === categories.length && series.every((item) => item.data.length === 1)) {
        return {
          categories,
          series: [{
            name: this.graph().name,
            data: series.map((item) => item.data[0] ?? 0),
            colors: series.map((_, index) => this.theme.seriesColor(index)),
          }],
        };
      }
      return {
        categories,
        series: series.map((item) => ({ name: this.readableLabel(item.name), data: item.data })),
      };
    }
    if (data.values) {
      const values = data.values.map((value) => this.numericValue(value));
      return { categories, series: [{ name: this.graph().name, data: values, colors: this.levelColors(values) }] };
    }
    return { categories, series: [] };
  });

  protected readonly lineModel = computed<AxisChartModel>(() => {
    const data = this.graph().data;
    if (!data || Array.isArray(data)) return { categories: [], series: [] };
    return {
      categories: data.categories ?? [],
      series: this.chartSeries(data.series).map((series) => ({ name: this.readableLabel(series.name), data: series.data })),
    };
  });

  protected readonly slices = computed<ChartSlice[]>(() => {
    const graph = this.graph();
    if (!graph.data) return [];
    const zip = (labels: string[], values: number[]) => labels.map((label, index) => ({ label, value: values[index] ?? 0 }));
    if (Array.isArray(graph.data)) {
      return graph.data.map((row) => ({ label: this.rowLabel(row), value: this.rowValue(row) }));
    }
    const categories = graph.data.categories ?? [];
    if (graph.data.values) {
      return zip(categories, graph.data.values.map((value) => this.numericValue(value)));
    }
    if (this.numericSeries(graph.data.series).length) {
      return zip(categories, this.numericSeries(graph.data.series));
    }
    const series = this.namedSeries(graph.data.series);
    if (graph.code === 'DTS') {
      return zip(
        categories,
        categories.map((_, categoryIndex) => series.reduce((total, item) => total + (item.data[categoryIndex] ?? 0), 0)),
      );
    }
    return series.map((item) => ({
      label: this.readableLabel(item.name),
      value: item.data.reduce((total, value) => total + value, 0),
    }));
  });

  /** Header (top-right) legend: Good/OK/Low for Fleet Utilisation, otherwise the chart's own colours. */
  protected readonly headerLegend = computed<ChartLegendItem[]>(() => {
    const palette = this.theme.palette();
    if (this.isFleetUtilisation()) {
      return [
        { label: 'Good', color: palette.success },
        { label: 'OK', color: palette.warning },
        { label: 'Low', color: palette.danger },
      ];
    }
    if (this.legendPosition() !== 'top' || !this.hasChartData()) return [];
    if (this.isDoughnut()) {
      return this.slices().map((slice, index) => ({ label: slice.label, color: this.theme.seriesColor(index, slice.color) }));
    }
    const model = this.isLine() ? this.lineModel() : this.barModel();
    // A single coloured-per-bar series is described by its axis, not a legend.
    if (model.series.length === 1 && model.series[0].colors) return [];
    return model.series.map((series, index) => ({ label: series.name, color: this.theme.seriesColor(index, series.color) }));
  });

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

  /** Good / OK / Low colours relative to the best value (≥80% / ≥60% / below). */
  private levelColors(values: number[]): string[] {
    const palette = this.theme.palette();
    const maximum = Math.max(...values.filter((value) => Number.isFinite(value)), 0);
    if (maximum <= 0) return values.map(() => palette.danger);
    return values.map((value) => {
      const ratio = value / maximum;
      if (ratio >= 0.8) return palette.success;
      if (ratio >= 0.6) return palette.warning;
      return palette.danger;
    });
  }
}
