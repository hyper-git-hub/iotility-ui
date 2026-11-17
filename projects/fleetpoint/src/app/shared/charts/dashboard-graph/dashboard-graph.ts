import { Component, computed, inject, input, signal } from '@angular/core';
import {
  BarChart,
  ChartCard,
  ChartLegendItem,
  ChartSeries,
  ChartSkeletonType,
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
  /** Option shown as selected before the user picks one (the backend's own default). */
  defaultId?: string;
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
  // Aggressively Driven Fleets — drawn from the AGDF graph (one line per fleet over time):
  // today = hourly, week = Mon–Sun, month = weekly, six_weeks = Wk 1–6. The backend defaults to today.
  ADF: {
    ariaLabel: 'Filter aggressively driven fleets by period',
    options: [
      { id: 'today', label: 'Today' },
      { id: 'week', label: 'Week' },
      { id: 'month', label: 'Month' },
      { id: 'six_weeks', label: 'Last 6 Weeks' },
    ],
    defaultId: 'today',
  },
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
  /** Draw the series as one stacked bar per category rather than side by side. */
  stacked?: boolean;
}

/** Series that are the total of the others (lower case); stacking them would double each bar. */
const TOTAL_SERIES: Record<string, string> = {
  DSS: 'total points',
};

/**
 * Most bars side by side a dashboard card fits before each gets thinner than about 10px
 * (categories past 12 scroll, so at most 12 count). Denser breakdowns stack instead: every
 * dashboard bar graph is a count, so the stack's height is the category's total.
 */
const MAX_GROUPED_BARS = 16;
const VISIBLE_CATEGORIES = 12;

/** Category names the API sends as keys, not labels. */
const CATEGORY_LABELS: Record<string, string> = {
  total_result: 'Staff',
};

/** Categories plus series that may have gaps (null), before they become chart series. */
interface AxisData {
  categories: string[];
  series: Array<{ name: string; data: Array<number | null> }>;
}

interface GraphChart {
  type: 'line' | 'area' | 'donut' | 'bar';
  horizontal?: boolean;
  stacked?: boolean;
  /** Bars side by side, a group per category (only shapes the loading placeholder). */
  grouped?: boolean;
  /** How many legend items the chart usually has, for its loading placeholder. */
  legend?: number;
}

/**
 * The chart each graph uses, as on the main-branch dashboard (src/components/charts). Graphs not
 * listed follow the API's chart_type. A bar graph not marked stacked still stacks when its series
 * can't sit side by side (see barModel).
 */
const GRAPH_CHARTS: Record<string, GraphChart> = {
  ADF: { type: 'area', legend: 3 },
  FCUT: { type: 'area', legend: 2 },
  FCT: { type: 'line', legend: 4 },
  DSS: { type: 'bar', horizontal: true, stacked: true, legend: 5 },
  DVG: { type: 'bar', legend: 3 },
  FUT: { type: 'bar', legend: 3 },
  JJ: { type: 'bar', grouped: true, legend: 2 },
  JSS: { type: 'bar', grouped: true, legend: 4 },
  MS: { type: 'bar', stacked: true, legend: 3 },
  POVM: { type: 'bar', horizontal: true },
  JSJ: { type: 'donut', legend: 4 },
  DTS: { type: 'donut', legend: 4 },
  DCE: { type: 'donut', legend: 5 },
};

export interface DashboardSkeleton {
  type: ChartSkeletonType;
  /** Legend placeholders to show (0 for none). */
  legend: number;
}

/**
 * The loading placeholder for a graph, in its chart's shape: lines, single, side-by-side or
 * stacked columns, single or stacked rows, or a donut. Null for graphs not in
 * GRAPH_CHARTS, which follow the API's chart_type.
 */
export function dashboardSkeleton(code: string): DashboardSkeleton | null {
  const chart = GRAPH_CHARTS[code];
  if (!chart) return null;
  const legend = chart.legend ?? 0;
  // Area and plain line charts read as one type, so they share the calmer plain-lines placeholder.
  if (chart.type === 'area' || chart.type === 'line') return { type: 'lines', legend };
  if (chart.type === 'donut') return { type: 'donut', legend };
  if (chart.horizontal) return { type: chart.stacked ? 'bar-horizontal-stacked' : 'bar-horizontal', legend };
  return { type: chart.stacked ? 'bar-stacked' : chart.grouped ? 'bar-grouped' : 'bar', legend };
}

/** Graphs that rank drivers: highest total first. */
const RANKED_GRAPHS = ['DSS'];

/** Task, job and maintenance statuses: a colour by meaning. */
const STATUS_COLORS: Record<string, 'success' | 'info' | 'warning' | 'danger'> = {
  completed: 'success',
  'in progress': 'info',
  scheduled: 'warning',
  pending: 'warning',
  overdue: 'danger',
  aborted: 'danger',
  cancelled: 'danger',
};

/** Violation types keep one palette colour in every chart (Scorecard, Driver Violations, ...). */
const VIOLATION_COLORS: Record<string, number> = {
  'geozone violation': 0,
  'harsh acceleration': 1,
  'harsh braking': 2,
  'sharp turning': 3,
  'sharp turn': 3,
  speed: 4,
};

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_LABEL = /^(Sun|Mon|Tue|Wed|Thu|Fri|Sat) (\d{1,2})$/;

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
  protected readonly selectedFilterId = computed(
    () => this.selections()[this.graph().code] ?? this.graphFilter()?.defaultId ?? '',
  );
  protected readonly filterAriaLabel = computed(() => this.graphFilter()?.ariaLabel ?? 'Filter');
  /** True while this graph's filtered data is loading. */
  protected readonly filtering = computed(() => !!this.api.filteringGraphs()[this.graph().code]);
  /**
   * The placeholder shows while this graph's filter loads, and while the dashboard's graphs load
   * for the first time (a tab opened directly, with nothing cached yet to show).
   */
  protected readonly loading = computed(
    () => this.filtering() || (this.api.loadingGraphs() && !this.api.cachedGraphs().length),
  );
  protected readonly skeleton = computed<DashboardSkeleton>(
    () =>
      dashboardSkeleton(this.graph().code) ?? {
        type: this.isDoughnut() ? 'donut' : this.isLine() ? 'lines' : this.horizontal() ? 'bar-horizontal' : 'bar',
        legend: 0,
      },
  );

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

  /** The main-branch chart for this graph, or null to follow the API's chart_type. */
  private readonly chart = computed<GraphChart | null>(() => GRAPH_CHARTS[this.graph().code] ?? null);

  protected isDoughnut(): boolean {
    const chart = this.chart();
    if (chart) return chart.type === 'donut';
    return this.graph().chart_type === 'piechart';
  }

  /** Main draws every round chart as a donut; only graphs it doesn't have follow a 'piechart' type. */
  protected isPie(): boolean {
    return !this.chart() && this.graph().chart_type === 'piechart';
  }

  /** Area under the line, except Fuel Consumption, which main draws as plain lines. */
  protected lineArea(): boolean {
    return this.chart()?.type !== 'line';
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
    const chart = this.chart();
    if (chart) return chart.type === 'line' || chart.type === 'area';
    return ['line graph', 'line_area_chart'].includes(this.graph().chart_type ?? '');
  }

  protected readonly horizontal = computed(() => {
    const chart = this.chart();
    if (chart) return !!chart.horizontal;
    const type = this.graph().chart_type;
    return type === 'horizontal_stackbar_chart' || type === 'horizontal_bar_chart';
  });

  protected readonly stacked = computed(() => {
    const chart = this.chart();
    const type = this.graph().chart_type;
    const declared = chart ? !!chart.stacked : type === 'horizontal_stackbar_chart' || type === 'stackbar_chart';
    return declared || !!this.barModel().stacked;
  });

  /** Every fleet the dashboard knows, sorted, so a fleet keeps one colour on every chart. */
  private readonly fleetNames = computed(() => {
    const names = new Set<string>();
    for (const graph of this.api.graphs()) {
      const data = graph.data;
      if (graph.code === 'DA' && data && !Array.isArray(data)) {
        data.fleets?.forEach((fleet) => names.add(fleet.name.trim()));
      }
      if (graph.code === 'VS' && Array.isArray(data)) {
        data.forEach((row) => typeof row['fleet_name'] === 'string' && names.add(row['fleet_name'].trim()));
      }
    }
    return [...names].sort((first, second) => first.localeCompare(second, undefined, { numeric: true }));
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
    const categories = this.categoryLabels(data.categories);
    if (series.length) {
      // One single-value series per category: one bar per category, each in its own colour.
      if (series.length === categories.length && series.every((item) => item.data.length === 1)) {
        return {
          categories,
          series: [{
            name: this.graph().name,
            data: series.map((item) => item.data[0] ?? 0),
            colors: series.map((item, index) => this.colorFor(item.name) ?? this.theme.seriesColor(index)),
          }],
        };
      }
      const code = this.graph().code;
      let axis = this.withMissingDays({ categories, series: this.alignToCategories(series, categories) });
      if (RANKED_GRAPHS.includes(code)) axis = this.rankedByTotal(axis);
      return {
        categories: axis.categories,
        // One series per category (by fleet): grouped, most slots would be empty and the bars thin.
        // Many series per category (by type): grouped, each bar would be a sliver.
        stacked:
          this.coversOwnCategories(series, categories) ||
          series.length * Math.min(categories.length, VISIBLE_CATEGORIES) > MAX_GROUPED_BARS,
        series: this.toChartSeries(axis),
      };
    }
    if (data.values) {
      const values = data.values.map((value) => this.numericValue(value));
      // Maintenance status bars are service types or statuses, not scores: a colour each, not Good/OK/Low.
      const colors =
        this.graph().code === 'MS'
          ? categories.map((category, index) => this.colorFor(category) ?? this.theme.seriesColor(index))
          : this.levelColors(values);
      return { categories, series: [{ name: this.graph().name, data: values, colors }] };
    }
    return { categories, series: [] };
  });

  protected readonly lineModel = computed<AxisChartModel>(() => {
    const data = this.graph().data;
    if (!data || Array.isArray(data)) return { categories: [], series: [] };
    const categories = this.categoryLabels(data.categories);
    const axis = this.withMissingDays({
      categories,
      series: this.alignToCategories(this.chartSeries(data.series), categories),
    });
    return { categories: axis.categories, series: this.toChartSeries(axis) };
  });

  protected readonly slices = computed<ChartSlice[]>(() => {
    const graph = this.graph();
    if (!graph.data) return [];
    const zip = (labels: string[], values: number[]) =>
      labels.map((label, index) => ({ label, value: values[index] ?? 0, color: this.colorFor(label) }));
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
    const series = this.chartSeries(graph.data.series);
    if (graph.code === 'DTS') {
      return zip(
        categories,
        categories.map((_, categoryIndex) => series.reduce((total, item) => total + (item.data[categoryIndex] ?? 0), 0)),
      );
    }
    return series.map((item) => ({
      label: this.readableLabel(item.name),
      value: item.data.reduce((total, value) => total + value, 0),
      color: this.colorFor(item.name),
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
    // Names already written for people ('CO2 (kg)', 'Fleet 02') stay as sent.
    if (!value.includes('_') && /[A-Z]/.test(value)) return value.replace(' Probability Count', '');
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
    const total = TOTAL_SERIES[this.graph().code];
    return total ? named.filter((item) => item.name.toLowerCase() !== total) : named;
  }

  private categoryLabels(categories: string[] | undefined): string[] {
    return (categories ?? []).map((category) => CATEGORY_LABELS[category] ?? category);
  }

  /**
   * Driver Violations (by fleet) sends each fleet's counts only for its own drivers, in category
   * order: TST Fleet's 5 values are the first 5 drivers, Fleet 02's 3 the next 3, and so on.
   * Spreads each series over every category, empty (null) elsewhere, so each bar lands on its own
   * driver and its tooltip lists only that driver's fleet. Series that already cover every
   * category are left as they are.
   */
  private alignToCategories(
    series: GraphSeries[],
    categories: string[],
  ): Array<{ name: string; data: Array<number | null> }> {
    if (!this.coversOwnCategories(series, categories)) return series;
    let offset = 0;
    return series.map((item) => {
      const data: Array<number | null> = categories.map(() => null);
      item.data.forEach((value, index) => (data[offset + index] = value));
      offset += item.data.length;
      return { ...item, data };
    });
  }

  private toChartSeries(axis: AxisData): ChartSeries[] {
    return axis.series.map((item) => ({
      name: this.readableLabel(item.name),
      data: item.data,
      color: this.colorFor(item.name),
    }));
  }

  /**
   * The colour a series or slice keeps on every chart: a status by its meaning, a violation type
   * or a fleet by a fixed palette position. Anything else (undefined) takes its position's colour.
   */
  private colorFor(name: string): string | undefined {
    const key = name.trim().toLowerCase();
    const palette = this.theme.palette();
    const status = STATUS_COLORS[key];
    if (status) return palette[status];
    const violation = VIOLATION_COLORS[key];
    if (violation !== undefined) return palette.series[violation];
    const fleet = this.fleetNames().indexOf(name.trim());
    return fleet >= 0 ? palette.series[fleet % palette.series.length] : undefined;
  }

  /** Categories reordered by their total across every series, highest first. */
  private rankedByTotal(axis: AxisData): AxisData {
    const totals = axis.categories.map((_, index) =>
      axis.series.reduce((total, item) => total + (item.data[index] ?? 0), 0),
    );
    const order = axis.categories.map((_, index) => index).sort((first, second) => totals[second] - totals[first]);
    return {
      categories: order.map((index) => axis.categories[index]),
      series: axis.series.map((item) => ({ ...item, data: order.map((index) => item.data[index] ?? null) })),
    };
  }

  /**
   * Daily graphs label days 'Tue 10'. CO2 and Fuel leaves out days with no usage (Wed 11, then
   * Mon 16), which a line draws as a slope across days that had none; this puts them back at 0.
   * Gaps are shorter than a week, so the weekdays give each gap's length, even across a month end.
   */
  private withMissingDays(axis: AxisData): AxisData {
    const days = axis.categories.map((label) => DAY_LABEL.exec(label.trim()));
    if (days.length < 2 || days.some((day) => !day)) return axis;
    const width = axis.categories.some((label) => / 0\d$/.test(label.trim())) ? 2 : 1;
    const categories: string[] = [];
    // Where each day's values come from in the original lists; -1 for a day put back.
    const sources: number[] = [];
    days.forEach((day, index) => {
      if (index > 0) {
        const previous = days[index - 1]!;
        const weekday = WEEKDAYS.indexOf(previous[1]);
        const gap = (WEEKDAYS.indexOf(day![1]) - weekday + 7) % 7 || 7;
        const from = Number(previous[2]);
        const to = Number(day![2]);
        for (let step = 1; step < gap; step += 1) {
          // Within a month count on from the earlier day; across a month end count back from the later one.
          const back = to - (gap - step);
          const date = to > from || back < 1 ? from + step : back;
          categories.push(`${WEEKDAYS[(weekday + step) % 7]} ${String(date).padStart(width, '0')}`);
          sources.push(-1);
        }
      }
      categories.push(axis.categories[index]);
      sources.push(index);
    });
    return {
      categories,
      series: axis.series.map((item) => ({
        ...item,
        data: sources.map((source) => (source < 0 ? 0 : (item.data[source] ?? null))),
      })),
    };
  }

  /** Each series holds values for its own run of categories only (see alignToCategories). */
  private coversOwnCategories(series: GraphSeries[], categories: string[]): boolean {
    const lengths = series.map((item) => item.data.length);
    return (
      !lengths.every((length) => length === categories.length) &&
      lengths.reduce((total, length) => total + length, 0) === categories.length
    );
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
