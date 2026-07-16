export interface MenuItem {
  label: string;
  route: string;
  icon: string;
  featureId: number;
  badgeKey?: 'jobs' | 'maintenance';
}

export interface MenuGroup {
  title: string;
  items: MenuItem[];
}

export const SIDEBAR_MENU: MenuGroup[] = [
  {
    title: 'Overview',
    items: [
      {
        label: 'Dashboard',
        route: '/dashboard',
        icon: 'assets/fleetpoint/sidebar-icons/dashboard.svg',
        featureId: 2,
      },
      {
        label: 'Live Tracking',
        route: '/live-tracking',
        icon: 'assets/fleetpoint/sidebar-icons/live-tracking.svg',
        featureId: 101,
      },
      {
        label: 'Trip Replay',
        route: '/trip-replay',
        icon: 'assets/fleetpoint/sidebar-icons/trip-replay.svg',
        featureId: 42,
      },
    ],
  },
  {
    title: 'Fleet Management',
    items: [
      {
        label: 'Fleets',
        route: '/fleets',
        icon: 'assets/fleetpoint/sidebar-icons/fleets.svg',
        featureId: 5,
      },
      {
        label: 'Vehicles',
        route: '/vehicles',
        icon: 'assets/fleetpoint/sidebar-icons/vehicles.svg',
        featureId: 5,
      },
      {
        label: 'Drivers',
        route: '/drivers',
        icon: 'assets/fleetpoint/sidebar-icons/drivers.svg',
        featureId: 11,
      },
      {
        label: 'Devices',
        route: '/devices',
        icon: 'assets/fleetpoint/sidebar-icons/devices.svg',
        featureId: 175,
      },
      {
        label: 'POI',
        route: '/poi',
        icon: 'assets/fleetpoint/sidebar-icons/poi.svg',
        featureId: 10,
      },
    ],
  },
  {
    title: 'Operations',
    items: [
      {
        label: 'Jobs',
        route: '/jobs',
        icon: 'assets/fleetpoint/sidebar-icons/jobs.svg',
        featureId: 105,
        badgeKey: 'jobs',
      },
      {
        label: 'Routes',
        route: '/routes',
        icon: 'assets/fleetpoint/sidebar-icons/routes.svg',
        featureId: 50,
      },
      {
        label: 'DashCam',
        route: '/dashcam',
        icon: 'assets/fleetpoint/sidebar-icons/dashcam.svg',
        featureId: 151,
      },
      {
        label: 'Maintenance',
        route: '/maintenance',
        icon: 'assets/fleetpoint/sidebar-icons/maintenance.svg',
        featureId: 70,
        badgeKey: 'maintenance',
      },
      {
        label: 'Violations',
        route: '/violations',
        icon: 'assets/fleetpoint/sidebar-icons/violations.svg',
        featureId: 21,
      },
      {
        label: 'Geozones',
        route: '/geozones',
        icon: 'assets/fleetpoint/sidebar-icons/geozones.svg',
        featureId: 46,
      },
    ],
  },
  {
    title: 'Insights',
    items: [
      {
        label: 'Reports',
        route: '/reports',
        icon: 'assets/fleetpoint/sidebar-icons/reports.svg',
        featureId: 499,
      },
      {
        label: 'Documents',
        route: '/documents',
        icon: 'assets/fleetpoint/sidebar-icons/documents.svg',
        featureId: 114,
      },
    ],
  },
  {
    title: 'Admin',
    items: [
      {
        label: 'Users & Roles',
        route: '/users-roles',
        icon: 'assets/fleetpoint/sidebar-icons/users-roles.svg',
        featureId: 28,
      },
      {
        label: 'Settings',
        route: '/settings',
        icon: 'assets/fleetpoint/sidebar-icons/settings.svg',
        featureId: 110,
      },
    ],
  },
];
