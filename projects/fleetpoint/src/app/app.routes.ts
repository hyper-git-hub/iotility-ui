import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./layout/fleetpoint-layout').then((module) => module.FleetpointLayout),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./pages/dashboard/dashboard-page').then((module) => module.DashboardPage),
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'overview' },
          {
            path: 'overview',
            loadComponent: () =>
              import('./pages/dashboard/overview/overview').then((module) => module.Overview),
          },
          {
            path: 'safety',
            loadComponent: () =>
              import('./pages/dashboard/safety/safety').then((module) => module.Safety),
          },
          {
            path: 'maintenance',
            loadComponent: () =>
              import('./pages/dashboard/maintenance/maintenance').then(
                (module) => module.Maintenance,
              ),
          },
          {
            path: 'jobs',
            loadComponent: () =>
              import('./pages/dashboard/jobs/jobs').then((module) => module.Jobs),
          },
          {
            path: 'reports',
            loadComponent: () =>
              import('./pages/dashboard/reports/reports').then((module) => module.Reports),
          },
        ],
      },
      {
        path: 'live-tracking',
        loadComponent: () =>
          import('./pages/live-tracking/live-tracking-page').then(
            (module) => module.LiveTrackingPage,
          ),
      },
      {
        path: 'trip-replay',
        title: 'Trip Replay | FleetPoint',
        loadComponent: () =>
          import('./pages/trip-replay/trip-replay-page').then(
            (module) => module.TripReplayPage,
          ),
      },
      {
        path: 'fleets',
        title: 'Fleets | FleetPoint',
        loadComponent: () =>
          import('./pages/fleets/fleets-page').then((module) => module.FleetsPage),
      },
      {
        path: 'vehicles',
        title: 'Vehicles | FleetPoint',
        loadComponent: () =>
          import('./pages/vehicles/vehicles-page').then((module) => module.VehiclesPage),
      },
      {
        path: 'vehicles/:registration',
        title: 'Vehicle Details | FleetPoint',
        loadComponent: () =>
          import('./pages/vehicles/vehicle-detail/vehicle-detail').then(
            (module) => module.VehicleDetail,
          ),
      },
      {
        path: 'drivers',
        title: 'Drivers | FleetPoint',
        loadComponent: () =>
          import('./pages/drivers/drivers-page').then((module) => module.DriversPage),
        children: [
          { path: '', loadComponent: () => import('./pages/drivers/driver-list/driver-list').then((module) => module.DriverList) },
          { path: 'drivers', pathMatch: 'full', redirectTo: '' },
          { path: 'groups', loadComponent: () => import('./pages/drivers/group-list/group-list').then((module) => module.GroupList) },
          { path: 'managers', loadComponent: () => import('./pages/drivers/manager-list/manager-list').then((module) => module.ManagerList) },
        ],
      },
      { path: '**', redirectTo: 'dashboard' },
    ],
  },
];
