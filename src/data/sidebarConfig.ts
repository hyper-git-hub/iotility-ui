// src/data/sidebarConfig.ts
// Sidebar navigation config per module and use case
// To add a new use case: add entry to sidebarMenus with useCases[] filter
// To add a new menu item: add to the relevant items[] array
// TODO: fetch active module + use case from GET /api/users/me/context

export type ModuleId = 'fleetpoint' | 'assetrack' | 'sustainex' | 'twinscape' | 'wasterack'
export type UseCaseId =
  | 'b2b-logistics'
  | 'b2c-delivery'
  | 'waste-management'
  | 'commercial-transport'
  | 'courier'
  | 'public-transport'
  | 'corporate-fleet'
  | 'emergency-services'
  | 'cash-security'
  | 'all'

export interface SidebarItem {
  id: string
  label: string
  icon: string
  path: string
  badge?: number
  children?: SidebarItem[]
}

export interface SidebarSection {
  section: string
  items: SidebarItem[]
}

export interface ModuleSidebar {
  moduleId: ModuleId
  useCases: UseCaseId[]
  accentColor: string
  initials: string
  moduleName: string
  menu: SidebarSection[]
}

export const moduleSidebars: ModuleSidebar[] = [
  {
    moduleId: 'fleetpoint',
    useCases: ['b2b-logistics', 'corporate-fleet'],
    accentColor: '#7c3aed',
    initials: 'FP',
    moduleName: 'IoTility Fleetpoint',
    menu: [
      {
        section: 'Overview',
        items: [
          { id: 'fp-dashboard', label: 'Dashboard', icon: 'LayoutDashboard', path: '/fleetpoint' },
          { id: 'fp-live', label: 'Live Tracking', icon: 'MapPin', path: '/fleetpoint/live-tracking' },
        ],
      },
      {
        section: 'Fleet',
        items: [
          { id: 'fp-vehicles', label: 'Vehicles', icon: 'Truck', path: '/fleetpoint/vehicles' },
          { id: 'fp-drivers', label: 'Drivers', icon: 'Users', path: '/fleetpoint/drivers' },
          { id: 'fp-jobs', label: 'Jobs', icon: 'ClipboardList', path: '/fleetpoint/jobs' },
          { id: 'fp-routes', label: 'Routes', icon: 'Route', path: '/fleetpoint/routes' },
        ],
      },
      {
        section: 'Operations',
        items: [
          { id: 'fp-dashcam', label: 'DashCam', icon: 'Camera', path: '/fleetpoint/dashcam' },
          { id: 'fp-maintenance', label: 'Maintenance', icon: 'Wrench', path: '/fleetpoint/maintenance' },
          { id: 'fp-violations', label: 'Violations', icon: 'AlertTriangle', path: '/fleetpoint/violations' },
          { id: 'fp-geofences', label: 'Geofences', icon: 'Shield', path: '/fleetpoint/geofences' },
        ],
      },
      {
        section: 'Insights',
        items: [
          { id: 'fp-reports', label: 'Reports', icon: 'BarChart2', path: '/fleetpoint/reports' },
          { id: 'fp-documents', label: 'Documents', icon: 'FileText', path: '/fleetpoint/documents' },
        ],
      },
      {
        section: 'Admin',
        items: [
          { id: 'fp-users', label: 'Users & Roles', icon: 'UserCog', path: '/fleetpoint/users' },
          { id: 'fp-settings', label: 'Settings', icon: 'Settings', path: '/fleetpoint/settings' },
        ],
      },
    ],
  },
  {
    moduleId: 'fleetpoint',
    useCases: ['waste-management'],
    accentColor: '#16a34a',
    initials: 'FP',
    moduleName: 'IoTility Fleetpoint — Waste',
    menu: [
      {
        section: 'Overview',
        items: [
          { id: 'fp-dashboard', label: 'Dashboard', icon: 'LayoutDashboard', path: '/fleetpoint' },
          { id: 'fp-live', label: 'Live Tracking', icon: 'MapPin', path: '/fleetpoint/live-tracking' },
        ],
      },
      {
        section: 'Waste Operations',
        items: [
          { id: 'fp-stops', label: 'Stops & Routes', icon: 'Route', path: '/fleetpoint/stops' },
          { id: 'fp-collection', label: 'Collection Schedule', icon: 'CalendarCheck', path: '/fleetpoint/collection' },
          { id: 'fp-bins', label: 'Bin Management', icon: 'Trash2', path: '/fleetpoint/bins' },
          { id: 'fp-vehicles', label: 'Vehicles', icon: 'Truck', path: '/fleetpoint/vehicles' },
          { id: 'fp-drivers', label: 'Drivers', icon: 'Users', path: '/fleetpoint/drivers' },
        ],
      },
      {
        section: 'Insights',
        items: [
          { id: 'fp-reports', label: 'Reports', icon: 'BarChart2', path: '/fleetpoint/reports' },
        ],
      },
      {
        section: 'Admin',
        items: [
          { id: 'fp-settings', label: 'Settings', icon: 'Settings', path: '/fleetpoint/settings' },
        ],
      },
    ],
  },
  {
    moduleId: 'fleetpoint',
    useCases: ['public-transport'],
    accentColor: '#0284c7',
    initials: 'FP',
    moduleName: 'IoTility Fleetpoint — Transit',
    menu: [
      {
        section: 'Overview',
        items: [
          { id: 'fp-dashboard', label: 'Dashboard', icon: 'LayoutDashboard', path: '/fleetpoint' },
          { id: 'fp-live', label: 'Live Tracking', icon: 'MapPin', path: '/fleetpoint/live-tracking' },
        ],
      },
      {
        section: 'Transit Operations',
        items: [
          { id: 'fp-routes', label: 'Routes & Lines', icon: 'Route', path: '/fleetpoint/routes' },
          { id: 'fp-timetables', label: 'Timetables', icon: 'Clock', path: '/fleetpoint/timetables' },
          { id: 'fp-vehicles', label: 'Fleet', icon: 'Bus', path: '/fleetpoint/vehicles' },
          { id: 'fp-drivers', label: 'Drivers', icon: 'Users', path: '/fleetpoint/drivers' },
          { id: 'fp-performance', label: 'On-Time Performance', icon: 'Timer', path: '/fleetpoint/performance' },
        ],
      },
      {
        section: 'Insights',
        items: [
          { id: 'fp-reports', label: 'Reports', icon: 'BarChart2', path: '/fleetpoint/reports' },
        ],
      },
      {
        section: 'Admin',
        items: [
          { id: 'fp-settings', label: 'Settings', icon: 'Settings', path: '/fleetpoint/settings' },
        ],
      },
    ],
  },
]

// Helper to get sidebar for a module + use case
// Falls back to b2b-logistics if use case not found
export function getSidebar(moduleId: ModuleId, useCaseId: UseCaseId): ModuleSidebar | undefined {
  return (
    moduleSidebars.find(s => s.moduleId === moduleId && s.useCases.includes(useCaseId)) ||
    moduleSidebars.find(s => s.moduleId === moduleId && s.useCases.includes('b2b-logistics'))
  )
}
