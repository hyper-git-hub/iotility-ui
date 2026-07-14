export interface FleetChartColors {
  brand: string;
  info: string;
  success: string;
  warning: string;
  danger: string;
  grid: string;
}

export function getFleetChartColors(): FleetChartColors {
  const styles = getComputedStyle(document.documentElement);
  const color = (name: string) => styles.getPropertyValue(name).trim();
  return {
    brand: color('--color-brand-500'),
    info: color('--color-info'),
    success: color('--color-success'),
    warning: color('--color-warning'),
    danger: color('--color-danger'),
    grid: color('--color-line'),
  };
}
