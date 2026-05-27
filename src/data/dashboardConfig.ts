// src/data/dashboardConfig.ts
// Widget registry for dashboard customisation
// To add a new widget:
//   1. Create component in src/components/charts/
//   2. Add entry here with module, useCases, roles
//   3. Import and register in FleetDashboard.tsx widgetComponents map
// TODO: fetch user widget preferences from GET /api/users/me/dashboard-config
// TODO: save user widget preferences to PATCH /api/users/me/dashboard-config

export type WidgetSize = 'full' | 'half' | 'third'
export type DashboardTab = 'overview' | 'safety' | 'maintenance' | 'jobs' | 'reports'

export interface Widget {
  id: string
  title: string
  description: string
  component: string
  size: WidgetSize
  tab: DashboardTab
  modules: string[]
  useCases: string[]
  roles: string[]
  defaultVisible: boolean
}

export const widgetRegistry: Widget[] = [
  // ── OVERVIEW TAB ──────────────────────────────────────────
  {
    id: 'live-fleet-status',
    title: 'Live Fleet Status',
    description: 'Real-time count of moving, idle, alert and offline vehicles',
    component: 'LiveFleetStatus',
    size: 'full',
    tab: 'overview',
    modules: ['fleetpoint'],
    useCases: ['all'],
    roles: ['super-admin', 'fleet-manager', 'dispatcher'],
    defaultVisible: true,
  },
  {
    id: 'top-actions',
    title: 'Actions Needed Today',
    description: 'Critical items requiring immediate attention',
    component: 'TopActions',
    size: 'half',
    tab: 'overview',
    modules: ['fleetpoint'],
    useCases: ['all'],
    roles: ['super-admin', 'fleet-manager'],
    defaultVisible: true,
  },
  {
    id: 'co2-trend',
    title: 'CO₂ & Fuel Efficiency',
    description: 'Daily CO₂ emissions and fuel consumption trend',
    component: 'CO2TrendChart',
    size: 'half',
    tab: 'overview',
    modules: ['fleetpoint', 'sustainex'],
    useCases: ['all'],
    roles: ['super-admin', 'fleet-manager'],
    defaultVisible: true,
  },
  {
    id: 'driver-of-week',
    title: 'Driver of the Week',
    description: 'Top performing driver based on safety score',
    component: 'DriverOfWeek',
    size: 'third',
    tab: 'overview',
    modules: ['fleetpoint'],
    useCases: ['all'],
    roles: ['super-admin', 'fleet-manager'],
    defaultVisible: true,
  },
  {
    id: 'fleet-utilisation',
    title: 'Fleet Utilisation',
    description: 'Vehicle utilisation rate today vs this week',
    component: 'FleetUtilisationChart',
    size: 'third',
    tab: 'overview',
    modules: ['fleetpoint'],
    useCases: ['all'],
    roles: ['super-admin', 'fleet-manager'],
    defaultVisible: true,
  },
  {
    id: 'fuel-consumption',
    title: 'Fuel Consumption',
    description: 'Fuel consumption by fleet this week',
    component: 'FuelConsumptionChart',
    size: 'third',
    tab: 'overview',
    modules: ['fleetpoint'],
    useCases: ['all'],
    roles: ['super-admin', 'fleet-manager'],
    defaultVisible: true,
  },

  // ── SAFETY TAB ────────────────────────────────────────────
  {
    id: 'driver-safety-scorecard',
    title: 'Driver Safety Scorecard',
    description: 'Safety scores per driver — speed, harsh braking, sharp turns',
    component: 'DriverSafetyScorecard',
    size: 'half',
    tab: 'safety',
    modules: ['fleetpoint'],
    useCases: ['all'],
    roles: ['super-admin', 'fleet-manager'],
    defaultVisible: true,
  },
  {
    id: 'aggressive-driving',
    title: 'Aggressively Driven Fleets',
    description: 'Aggressive driving events by fleet over time',
    component: 'AggressiveDrivingChart',
    size: 'half',
    tab: 'safety',
    modules: ['fleetpoint'],
    useCases: ['all'],
    roles: ['super-admin', 'fleet-manager'],
    defaultVisible: true,
  },
  {
    id: 'driver-violations',
    title: 'Driver Violations',
    description: 'Violation events by fleet and type',
    component: 'DriverViolationsChart',
    size: 'half',
    tab: 'safety',
    modules: ['fleetpoint'],
    useCases: ['all'],
    roles: ['super-admin', 'fleet-manager'],
    defaultVisible: true,
  },
  {
    id: 'dashcam-events',
    title: 'DashCam Events',
    description: 'Harsh braking, distraction and collision events from dashcams',
    component: 'DashcamEventsChart',
    size: 'half',
    tab: 'safety',
    modules: ['fleetpoint'],
    useCases: ['all'],
    roles: ['super-admin', 'fleet-manager'],
    defaultVisible: true,
  },

  // ── MAINTENANCE TAB ───────────────────────────────────────
  {
    id: 'maintenance-status',
    title: 'Maintenance Status',
    description: 'Breakdown of maintenance by service type',
    component: 'MaintenanceStatusChart',
    size: 'half',
    tab: 'maintenance',
    modules: ['fleetpoint'],
    useCases: ['all'],
    roles: ['super-admin', 'fleet-manager'],
    defaultVisible: true,
  },
  {
    id: 'maintenance-probability',
    title: 'Probability of Vehicle Maintenance',
    description: 'Predictive maintenance likelihood per vehicle',
    component: 'MaintenanceProbabilityChart',
    size: 'half',
    tab: 'maintenance',
    modules: ['fleetpoint'],
    useCases: ['all'],
    roles: ['super-admin', 'fleet-manager'],
    defaultVisible: true,
  },
  {
    id: 'vehicles-due-service',
    title: 'Vehicles Due for Service',
    description: 'Vehicles approaching or overdue for scheduled maintenance',
    component: 'VehiclesDueService',
    size: 'full',
    tab: 'maintenance',
    modules: ['fleetpoint'],
    useCases: ['all'],
    roles: ['super-admin', 'fleet-manager'],
    defaultVisible: true,
  },

  // ── JOBS TAB ─────────────────────────────────────────────
  {
    id: 'jobs-by-location',
    title: 'Jobs by Location',
    description: 'Ad-hoc vs scheduled jobs by city',
    component: 'JobsByLocationChart',
    size: 'half',
    tab: 'jobs',
    modules: ['fleetpoint'],
    useCases: ['b2b-logistics', 'b2c-delivery', 'courier'],
    roles: ['super-admin', 'fleet-manager', 'dispatcher'],
    defaultVisible: true,
  },
  {
    id: 'job-statistics',
    title: 'Job Statistics',
    description: 'Pending vs completed jobs today',
    component: 'JobStatisticsChart',
    size: 'half',
    tab: 'jobs',
    modules: ['fleetpoint'],
    useCases: ['b2b-logistics', 'b2c-delivery', 'courier'],
    roles: ['super-admin', 'fleet-manager', 'dispatcher'],
    defaultVisible: true,
  },
  {
    id: 'driver-tasks-status',
    title: 'Driver Tasks Status',
    description: 'Task completion status by fleet and driver',
    component: 'DriverTasksChart',
    size: 'half',
    tab: 'jobs',
    modules: ['fleetpoint'],
    useCases: ['all'],
    roles: ['super-admin', 'fleet-manager'],
    defaultVisible: true,
  },
  {
    id: 'staff-statistics',
    title: 'Staff Statistics',
    description: 'Total staff, on jobs, on bench and available',
    component: 'StaffStatisticsChart',
    size: 'half',
    tab: 'jobs',
    modules: ['fleetpoint'],
    useCases: ['all'],
    roles: ['super-admin'],
    defaultVisible: true,
  },

  // ── USE CASE SPECIFIC ─────────────────────────────────────
  {
    id: 'collection-completion',
    title: 'Collection Completion Rate',
    description: 'Waste collection completion rate by route today',
    component: 'CollectionCompletionChart',
    size: 'half',
    tab: 'overview',
    modules: ['fleetpoint'],
    useCases: ['waste-management'],
    roles: ['super-admin', 'fleet-manager'],
    defaultVisible: true,
  },
  {
    id: 'on-time-performance',
    title: 'On-Time Performance',
    description: 'Route on-time arrival rate vs target',
    component: 'OnTimePerformanceChart',
    size: 'half',
    tab: 'overview',
    modules: ['fleetpoint'],
    useCases: ['public-transport', 'courier'],
    roles: ['super-admin', 'fleet-manager'],
    defaultVisible: true,
  },
  {
    id: 'response-time',
    title: 'Emergency Response Time',
    description: 'Average response time vs target SLA',
    component: 'ResponseTimeChart',
    size: 'half',
    tab: 'overview',
    modules: ['fleetpoint'],
    useCases: ['emergency-services'],
    roles: ['super-admin', 'fleet-manager'],
    defaultVisible: true,
  },
  {
    id: 'temperature-monitoring',
    title: 'Temperature Monitoring',
    description: 'Cold chain temperature readings across refrigerated fleet',
    component: 'TemperatureMonitoringChart',
    size: 'half',
    tab: 'overview',
    modules: ['fleetpoint'],
    useCases: ['b2b-logistics', 'b2c-delivery'],
    roles: ['super-admin', 'fleet-manager'],
    defaultVisible: true,
  },
]

// Helper — get widgets for a user's context
// Filters by module, use case, role and defaultVisible
export function getWidgetsForContext(
  moduleId: string,
  useCaseId: string,
  role: string,
  tab: DashboardTab,
  userVisibleWidgets?: string[]
): Widget[] {
  return widgetRegistry.filter(w => {
    const moduleMatch = w.modules.includes(moduleId)
    const useCaseMatch = w.useCases.includes('all') || w.useCases.includes(useCaseId)
    const roleMatch = w.roles.includes(role)
    const tabMatch = w.tab === tab
    const visibleMatch = userVisibleWidgets
      ? userVisibleWidgets.includes(w.id)
      : w.defaultVisible
    return moduleMatch && useCaseMatch && roleMatch && tabMatch && visibleMatch
  })
}
