export interface FleetChartColors {
  brand: string;
  info: string;
  success: string;
  warning: string;
  danger: string;
  grid: string;
  /** Distinct colors for multi-series charts (e.g. one series per fleet). */
  series: string[];
}

export function getFleetChartColors(): FleetChartColors {
  const styles = getComputedStyle(document.documentElement);
  const probe = document.createElement('span');
  probe.style.display = 'none';
  document.body.appendChild(probe);
  const resolve = (name: string): string => {
    const value = styles.getPropertyValue(name).trim();
    if (!value) return '';
    probe.style.color = value;
    return getComputedStyle(probe).color;
  };
  const seriesTokens = [
    '--color-brand-500',
    '--color-info',
    '--color-success',
    '--color-warning',
    '--color-danger',
    '--color-sky-500',
    '--color-pink-600',
    '--color-lime-600',
    '--color-orange-600',
    '--color-indigo-600',
    '--color-cyan-600',
    '--color-amber-600',
  ];
  const seriesFallback = [
    '#8b5cf6',
    '#3978d4',
    '#21a179',
    '#e7a92d',
    '#e05252',
    '#0ea5e9',
    '#db2777',
    '#65a30d',
    '#ea580c',
    '#4f46e5',
    '#0891b2',
    '#ca8a04',
  ];
  const series = seriesTokens.map((token, index) => resolve(token) || seriesFallback[index]);
  const colors: FleetChartColors = {
    brand: resolve('--color-brand-500'),
    info: resolve('--color-info'),
    success: resolve('--color-success'),
    warning: resolve('--color-warning'),
    danger: resolve('--color-danger'),
    grid: resolve('--color-line'),
    series,
  };
  probe.remove();
  return colors;
}
