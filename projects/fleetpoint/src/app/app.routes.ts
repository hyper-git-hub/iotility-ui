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
        title: 'Dashboard | FleetPoint',
        loadComponent: () =>
          import('./pages/dashboard/dashboard-page').then((module) => module.DashboardPage),
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'overview' },
          {
            path: 'overview',
            title: 'Dashboard | FleetPoint',
            loadComponent: () =>
              import('./pages/dashboard/overview/overview').then((module) => module.Overview),
          },
          {
            path: 'safety',
            title: 'Safety | FleetPoint',
            loadComponent: () =>
              import('./pages/dashboard/safety/safety').then((module) => module.Safety),
          },
          {
            path: 'maintenance',
            title: 'Maintenance | FleetPoint',
            loadComponent: () =>
              import('./pages/dashboard/maintenance/maintenance').then(
                (module) => module.Maintenance,
              ),
          },
          {
            path: 'jobs',
            title: 'Jobs | FleetPoint',
            loadComponent: () =>
              import('./pages/dashboard/jobs/jobs').then((module) => module.Jobs),
          },
          {
            path: 'reports',
            title: 'Reports | FleetPoint',
            loadComponent: () =>
              import('./pages/dashboard/reports/reports').then((module) => module.Reports),
          },
        ],
      },
      {
        path: 'live-tracking',
        title: 'Live Tracking | FleetPoint',
        loadComponent: () =>
          import('./pages/live-tracking/live-tracking-page').then(
            (module) => module.LiveTrackingPage,
          ),
      },
      {
        path: 'profile',
        title: 'My Profile | FleetPoint',
        loadComponent: () =>
          import('./pages/profile/profile-page').then((module) => module.ProfilePage),
      },
      {
        path: 'users-roles',
        title: 'Users & Roles | FleetPoint',
        loadComponent: () =>
          import('./pages/users-roles/users-roles-page').then(
            (module) => module.UsersRolesPage,
          ),
      },
      {
        path: 'reports',
        title: 'Reports | FleetPoint',
        loadComponent: () =>
          import('./pages/dashboard/reports/reports').then((module) => module.Reports),
      },
      {
        path: 'jobs',
        title: 'Jobs | FleetPoint',
        loadComponent: () =>
          import('./pages/jobs/jobs-page').then((module) => module.JobsPage),
      },
      {
        path: 'poi',
        title: 'Points of Interest | FleetPoint',
        loadComponent: () =>
          import('./pages/poi/poi-page').then((module) => module.PoiPage),
      },
      {
        path: 'routes',
        title: 'Routes | FleetPoint',
        loadComponent: () =>
          import('./pages/routes/routes-page').then((module) => module.RoutesPage),
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'library' },
          { path: 'library', loadComponent: () => import('./pages/routes/route-library/route-library').then((module) => module.RouteLibrary) },
          { path: 'active-runs', loadComponent: () => import('./pages/routes/active-runs/active-runs').then((module) => module.ActiveRuns) },
          { path: 'dispatch', loadComponent: () => import('./pages/routes/dispatch/route-dispatch').then((module) => module.RouteDispatch) },
          { path: 'adherence', loadComponent: () => import('./pages/routes/adherence/route-adherence').then((module) => module.RouteAdherence) },
        ],
      },
      {
        path: 'trip-replay',
        title: 'Trip Replay | FleetPoint',
        loadComponent: () =>
          import('./pages/trip-replay/trip-replay-page').then((module) => module.TripReplayPage),
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
          {
            path: '',
            loadComponent: () =>
              import('./pages/drivers/driver-list/driver-list').then((module) => module.DriverList),
          },
          { path: 'drivers', pathMatch: 'full', redirectTo: '' },
          {
            path: 'allocations',
            title: 'Driver Allocations | FleetPoint',
            loadComponent: () =>
              import('./pages/drivers/driver-vehicle-allocation/driver-vehicle-allocation').then(
                (module) => module.DriverVehicleAllocation,
              ),
          },
          {
            path: 'groups',
            title: 'Driver Groups | FleetPoint',
            loadComponent: () =>
              import('./pages/drivers/group-list/group-list').then((module) => module.GroupList),
          },
          {
            path: 'managers',
            title: 'Driver Managers | FleetPoint',
            loadComponent: () =>
              import('./pages/drivers/manager-list/manager-list').then(
                (module) => module.ManagerList,
              ),
          },
        ],
      },
      {
        path: 'drivers/:id',
        title: 'Driver Details | FleetPoint',
        loadComponent: () =>
          import('./pages/drivers/driver-detail/driver-detail').then((module) => module.DriverDetail),
      },
      { path: '**', redirectTo: 'dashboard' },
    ],
  },
];
