import { ChartOptions, ChartType } from 'chart.js';
export function withFleetChartDefaults<TType extends ChartType>(
  options: ChartOptions<TType> | undefined,
): ChartOptions<TType> {
  const resolvedOptions = (options ?? {}) as NonNullable<ChartOptions<TType>>;
  const legend = resolvedOptions.plugins?.legend;
  const mutedColor = getComputedStyle(document.documentElement)
    .getPropertyValue('--color-muted')
    .trim();
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 1200, easing: 'easeOutQuart' },
    ...resolvedOptions,
    plugins: {
      ...resolvedOptions.plugins,
      legend: {
        ...legend,
        labels: {
          usePointStyle: true,
          pointStyle: 'circle',
          boxWidth: 7,
          boxHeight: 7,
          padding: 14,
          color: mutedColor,
          font: { size: 10 },
          ...legend?.labels,
        },
      },
    },
  } as ChartOptions<TType>;
}
