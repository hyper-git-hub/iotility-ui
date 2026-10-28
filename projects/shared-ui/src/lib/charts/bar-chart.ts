import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { ChartCanvas, ChartOption } from './chart-canvas';
import {
  ChartSeries,
  ChartTheme,
  ChartValueFormatter,
  axisStyle,
  axisTooltip,
  baseOption,
  defaultFormat,
  lighten,
  linearGradient,
  mergeOption,
  toRgb,
  tooltipBase,
  withAlpha,
} from './chart-theme';

/** Rounded gradient bars: vertical or horizontal, grouped or stacked, with a staggered grow-in. */
@Component({
  selector: 'ui-bar-chart',
  imports: [ChartCanvas],
  template: '<ui-chart-canvas [option]="option()" />',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: ':host { display: block; width: 100%; height: 100%; min-height: 0; }',
})
export class BarChart {
  readonly categories = input.required<string[]>();
  readonly series = input.required<ChartSeries[]>();
  readonly horizontal = input(false);
  readonly stacked = input(false);
  /** Legend inside the chart (bottom). Off when the card header shows it. */
  readonly legend = input(true);
  /**
   * Faint full-length track behind each bar (single, unstacked series only). Only meaningful when
   * the value axis has a real maximum (e.g. percentages); otherwise it implies a false "full" level.
   */
  readonly track = input(false);
  /** Max bar thickness in px; by default wider when there are only a few categories. */
  readonly barMaxWidth = input<number | null>(null);
  readonly valueFormatter = input<ChartValueFormatter>(defaultFormat);
  /** Escape hatch for one-off ECharts tweaks, deep-merged last. */
  readonly overrides = input<ChartOption | undefined>(undefined);

  private readonly theme = inject(ChartTheme);

  protected readonly option = computed<ChartOption>(() => {
    const palette = this.theme.palette();
    const format = this.valueFormatter();
    const horizontal = this.horizontal();
    const stacked = this.stacked();
    const series = this.series();
    const legend = this.legend();
    const base = baseOption(palette, this.theme.reducedMotion);
    const radius = 6;
    // Rounded at the bar's end; in a stack only the outermost segment is rounded.
    const endRadius = horizontal ? [0, radius, radius, 0] : [radius, radius, 0, 0];
    const fill = (color: string) =>
      horizontal
        ? linearGradient(lighten(color, 0.28), color, 'horizontal')
        : linearGradient(lighten(color, 0.24), color);

    const categoryAxis = {
      type: 'category',
      data: this.categories(),
      ...axisStyle(palette, 'category'),
      axisLabel: horizontal
        ? { ...axisStyle(palette, 'category').axisLabel, width: 110, overflow: 'truncate', hideOverlap: false }
        : { ...axisStyle(palette, 'category').axisLabel, interval: 0, width: 76, overflow: 'break', lineHeight: 13 },
      inverse: horizontal,
    };
    const valueAxis = {
      type: 'value',
      ...axisStyle(palette, 'value'),
      axisLabel: { ...axisStyle(palette, 'value').axisLabel, formatter: (value: number) => format(value) },
    };

    return mergeOption(
      {
        ...base,
        legend: legend ? base.legend : { show: false },
        grid: { left: 4, right: 14, top: 14, bottom: legend ? 34 : 4, containLabel: true },
        tooltip: {
          ...tooltipBase(palette),
          trigger: 'axis',
          formatter: axisTooltip(palette, format),
          axisPointer: { type: 'shadow', shadowStyle: { color: withAlpha(palette.brand, palette.dark ? 0.1 : 0.06) } },
        },
        xAxis: horizontal ? valueAxis : categoryAxis,
        yAxis: horizontal ? categoryAxis : valueAxis,
        series: series.map((item, index) => {
          const color = this.theme.seriesColor(index, item.color);
          const rounded = !stacked || index === series.length - 1;
          return {
            id: item.name,
            name: item.name,
            type: 'bar',
            stack: stacked ? 'total' : undefined,
            barMaxWidth: this.barMaxWidth() ?? (this.categories().length <= 4 ? 44 : this.categories().length <= 8 ? 32 : 24),
            barGap: '18%',
            barCategoryGap: '36%',
            showBackground: this.track() && !stacked && series.length === 1,
            backgroundStyle: { color: withAlpha(palette.grid, palette.dark ? 0.35 : 0.5), borderRadius: endRadius },
            itemStyle: { color: fill(color), borderRadius: rounded ? endRadius : 0 },
            data: item.colors
              ? item.data.map((value, point) => ({
                  value,
                  itemStyle: { color: fill(toRgb(item.colors![point] ?? color)) },
                }))
              : item.data,
            emphasis: {
              focus: series.length > 1 ? 'series' : 'none',
              itemStyle: { shadowBlur: 14, shadowColor: withAlpha(color, 0.35) },
            },
            animationDelay: (point: number) => point * 40 + index * 60,
          };
        }),
      },
      this.overrides() as Record<string, unknown> | undefined,
    );
  });
}
