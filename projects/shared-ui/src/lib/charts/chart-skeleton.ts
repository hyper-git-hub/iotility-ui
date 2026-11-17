import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * - line: an area under a line, with a fainter dashed second line
 * - lines: plain lines, no fill
 * - bar / bar-grouped / bar-stacked: single, side-by-side and stacked columns
 * - bar-horizontal / bar-horizontal-stacked: single and stacked rows
 * - donut: a segmented ring with the total in the middle
 */
export type ChartSkeletonType =
  | 'line'
  | 'lines'
  | 'bar'
  | 'bar-grouped'
  | 'bar-stacked'
  | 'bar-horizontal'
  | 'bar-horizontal-stacked'
  | 'donut';

let nextSkeletonId = 0;

/**
 * Placeholder in each chart type's shape (calm shapes, not fake data), in the same tones
 * and shimmer as ui-skeleton so loading cards read as one family.
 */
@Component({
  selector: 'ui-chart-skeleton',
  templateUrl: './chart-skeleton.html',
  styleUrl: './chart-skeleton.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true', '[class]': "'type-' + type()" },
})
export class ChartSkeleton {
  readonly type = input<ChartSkeletonType>('bar');
  /** Legend placeholders under the plot: true for three, or how many the chart's legend has. */
  readonly legend = input<boolean | number>(false);

  protected readonly gradientId = `chart-skeleton-area-${++nextSkeletonId}`;
  protected readonly yTicks = [70, 100, 85, 60];
  protected readonly bars = [42, 68, 53, 81, 62, 47, 74];
  /** Side-by-side columns: one per series, so as many per group as the legend has (2–4, else 3). */
  protected readonly groups = computed(() => {
    const legend = this.legend();
    const size = typeof legend === 'number' && legend >= 2 ? Math.min(legend, 4) : 3;
    return [
      [58, 84, 40, 66],
      [72, 46, 64, 38],
      [44, 66, 30, 52],
      [80, 58, 70, 44],
    ].map((group) => group.slice(0, size));
  });
  /** Stacked columns: each segment's share of the plot height, bottom first. */
  protected readonly stacks = [
    [20, 14, 8],
    [30, 20, 14],
    [16, 12, 9],
    [36, 24, 14],
    [26, 16, 10],
    [18, 12, 8],
    [32, 20, 12],
  ];
  protected readonly rows = [82, 64, 71, 48, 57, 36];
  /** Stacked rows, longest first, as a ranking reads: each segment's share of the width. */
  protected readonly stackedRows = [
    [18, 20, 8, 34],
    [19, 19, 9, 30],
    [17, 21, 10, 26],
    [16, 18, 8, 24],
    [15, 17, 7, 20],
    [10, 11, 9, 16],
    [9, 10, 4, 13],
    [8, 10, 3, 12],
  ];

  /** One x-axis label per column, group or line point. */
  protected readonly xLabels = computed(() => {
    const type = this.type();
    const count = type === 'line' || type === 'lines' ? 6 : type === 'bar-grouped' ? this.groups().length : this.bars.length;
    return Array.from({ length: count });
  });
  protected readonly legendItems = computed(() => {
    const legend = this.legend();
    return Array.from({ length: typeof legend === 'number' ? legend : legend ? 3 : 0 });
  });

  protected total(segments: number[]): number {
    return segments.reduce((sum, segment) => sum + segment, 0);
  }
}
