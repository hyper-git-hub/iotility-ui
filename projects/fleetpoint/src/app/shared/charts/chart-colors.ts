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
  const probe = document.createElement('span');
  probe.style.display = 'none';
  document.body.appendChild(probe);
  const resolve = (name: string): string => {
    const value = styles.getPropertyValue(name).trim();
    if (!value) return '';
    probe.style.color = value;
    return getComputedStyle(probe).color;
  };
  const colors: FleetChartColors = {
    brand: resolve('--color-brand-500'),
    info: resolve('--color-info'),
    success: resolve('--color-success'),
    warning: resolve('--color-warning'),
    danger: resolve('--color-danger'),
    grid: resolve('--color-line'),
  };
  probe.remove();
  return colors;
}
