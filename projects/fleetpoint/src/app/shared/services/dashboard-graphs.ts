import { DashboardGraph } from './fleet-dashboard-api.service';

export const EXPECTED_DASHBOARD_GRAPHS: DashboardGraph[] = [
  { code: 'ADF', name: 'Aggressively Driven Fleets', chart_type: 'line_area_chart', data: { categories: ['Fleet 01', 'Fleet 02', 'Fleet 03', 'Fleet 04'], series: [{ name: 'Harsh Acceleration', data: [12, 7, 16, 9] }, { name: 'Harsh Braking', data: [8, 14, 6, 11] }, { name: 'Sharp Turning', data: [5, 9, 12, 7] }] } },
  { code: 'DA', name: 'Driver Allocations', chart_type: null, data: { fleets: [{ name: 'Fleet 01', data: [{ vehicle: 'FLT-101', driver: 'Richard' }, { vehicle: 'FLT-102', driver: 'Rebecca' }] }, { name: 'Fleet 02', data: [{ vehicle: 'FLT-204', driver: 'Henry' }] }] } },
  { code: 'DSS', name: 'Driver Safety Scorecard', chart_type: 'piechart', data: { categories: ['Geozone Violation', 'Harsh Acceleration', 'Harsh Braking', 'Speed'], values: [18, 24, 13, 31] } },
  { code: 'DTS', name: 'Driver Tasks Status', chart_type: 'piechart', data: { categories: ['Completed', 'Pending', 'In Progress', 'Aborted'], values: [42, 18, 27, 6] } },
  { code: 'DVG', name: 'Driver Violations', chart_type: 'horizontal_bar_chart', data: { categories: ['Richard', 'Rebecca', 'Henry', 'John'], series: [{ name: 'Violations', data: [12, 8, 15, 6] }] } },
  { code: 'JJ', name: 'Jobs', chart_type: 'bar_chart', data: { categories: ['Islamabad', 'Rawalpindi', 'Lahore'], series: [{ name: 'Adhoc', data: [18, 11, 15] }, { name: 'Scheduled', data: [9, 14, 12] }] } },
  { code: 'JSJ', name: 'Statistics of Jobs', chart_type: 'piechart', data: { categories: ['Pending', 'Completed', 'Cancelled'], values: [14, 38, 5] } },
  { code: 'JSS', name: 'Staff Statistics', chart_type: 'horizontal_stackbar_chart', data: { categories: ['Staff'], series: [{ name: 'On job', data: [18] }, { name: 'On bench', data: [6] }, { name: 'Available', data: [11] }] } },
  { code: 'MS', name: 'Maintenance status', chart_type: 'piechart', data: { categories: ['Oil Change', 'Tire Rotation', 'Air Filter', 'Transmission'], values: [12, 8, 5, 3] } },
  { code: 'POVM', name: 'Probability of Vehicle Maintenance', chart_type: 'bar_chart', data: { categories: ['Fleet 01', 'Fleet 02', 'Fleet 03'], series: [{ name: 'Maintenance', data: [7, 11, 5] }, { name: 'Replace', data: [2, 4, 1] }, { name: 'No Maintenance', data: [18, 14, 21] }] } },
  { code: 'RS', name: 'Route Statistics', chart_type: 'bar_chart', data: { categories: ['ISB–RWP', 'I-9 ISB', 'Ring Road', 'M-2'], values: [22, 16, 13, 28] } },
  { code: 'VS', name: 'Vehicle Statistics', chart_type: 'bar_chart', data: [{ fleet_name: 'Fleet 01', vehicle_count: 18 }, { fleet_name: 'Fleet 02', vehicle_count: 13 }, { fleet_name: 'Fleet 03', vehicle_count: 21 }] },
];

export function emptyDashboardGraphs(): DashboardGraph[] {
  return EXPECTED_DASHBOARD_GRAPHS.map((graph) => ({
    ...graph,
    data: graph.code === 'DA' ? { fleets: [] } : [],
  }));
}

export function mergeDashboardGraphs(received: DashboardGraph[]): DashboardGraph[] {
  const byCode = new Map(
    received
      .filter((graph) => Boolean(graph?.code))
      .map((graph) => [graph.code, graph]),
  );
  return EXPECTED_DASHBOARD_GRAPHS.map((fallback) => byCode.get(fallback.code) ?? fallback);
}
