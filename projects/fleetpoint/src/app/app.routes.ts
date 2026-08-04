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
          import('./pages/users-roles/users-roles-page').then((module) => module.UsersRolesPage),
      },
      {
        path: 'reports',
        title: 'Reports | FleetPoint',
        loadComponent: () =>
          import('./pages/dashboard/reports/reports').then((module) => module.Reports),
      },
      {
        path: 'settings',
        title: 'Settings | FleetPoint',
        loadComponent: () =>
          import('./pages/settings/settings-page').then((module) => module.SettingsPage),
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'organisation' },
          {
            path: 'organisation',
            loadComponent: () =>
              import('./pages/settings/organisation/organisation-settings').then(
                (module) => module.OrganisationSettings,
              ),
          },
          {
            path: 'notifications',
            loadComponent: () =>
              import('./pages/settings/notifications/notification-settings').then(
                (module) => module.NotificationSettings,
              ),
          },
          {
            path: 'display',
            loadComponent: () =>
              import('./pages/settings/display/display-settings').then(
                (module) => module.DisplaySettings,
              ),
          },
          {
            path: 'integrations',
            loadComponent: () =>
              import('./pages/settings/integrations/integration-settings').then(
                (module) => module.IntegrationSettings,
              ),
          },
          {
            path: 'users',
            loadComponent: () =>
              import('./pages/settings/users/user-access-settings').then(
                (module) => module.UserAccessSettings,
              ),
          },
          {
            path: 'mobile',
            loadComponent: () =>
              import('./pages/settings/mobile/mobile-settings').then(
                (module) => module.MobileSettings,
              ),
          },
        ],
      },
      {
        path: 'documents',
        title: 'Documents | FleetPoint',
        loadComponent: () =>
          import('./pages/documents/documents-page').then((module) => module.DocumentsPage),
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'all' },
          {
            path: 'all',
            loadComponent: () =>
              import('./pages/documents/all-documents/all-documents').then(
                (module) => module.AllDocuments,
              ),
          },
          {
            path: 'vehicle',
            loadComponent: () =>
              import('./pages/documents/vehicle-documents/vehicle-documents').then(
                (module) => module.VehicleDocuments,
              ),
          },
          {
            path: 'driver',
            loadComponent: () =>
              import('./pages/documents/driver-documents/driver-documents').then(
                (module) => module.DriverDocuments,
              ),
          },
          {
            path: 'company',
            loadComponent: () =>
              import('./pages/documents/company-documents/company-documents').then(
                (module) => module.CompanyDocuments,
              ),
          },
        ],
      },
      {
        path: 'jobs',
        title: 'Jobs | FleetPoint',
        loadComponent: () => import('./pages/jobs/jobs-page').then((module) => module.JobsPage),
      },
      {
        path: 'poi',
        title: 'Points of Interest | FleetPoint',
        loadComponent: () => import('./pages/poi/poi-page').then((module) => module.PoiPage),
      },
      {
        path: 'routes',
        title: 'Routes | FleetPoint',
        loadComponent: () =>
          import('./pages/routes/routes-page').then((module) => module.RoutesPage),
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'library' },
          {
            path: 'library',
            loadComponent: () =>
              import('./pages/routes/route-library/route-library').then(
                (module) => module.RouteLibrary,
              ),
          },
          {
            path: 'active-runs',
            loadComponent: () =>
              import('./pages/routes/active-runs/active-runs').then((module) => module.ActiveRuns),
          },
          {
            path: 'dispatch',
            loadComponent: () =>
              import('./pages/routes/dispatch/route-dispatch').then(
                (module) => module.RouteDispatch,
              ),
          },
          {
            path: 'adherence',
            loadComponent: () =>
              import('./pages/routes/adherence/route-adherence').then(
                (module) => module.RouteAdherence,
              ),
          },
        ],
      },
      {
        path: 'maintenance',
        title: 'Maintenance | FleetPoint',
        loadComponent: () =>
          import('./pages/maintenance/maintenance-page').then((module) => module.MaintenancePage),
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'overview' },
          {
            path: 'overview',
            loadComponent: () =>
              import('./pages/maintenance/overview/maintenance-overview').then(
                (module) => module.MaintenanceOverview,
              ),
          },
          {
            path: 'work-orders',
            loadComponent: () =>
              import('./pages/maintenance/work-orders/maintenance-work-orders').then(
                (module) => module.MaintenanceWorkOrders,
              ),
          },
          {
            path: 'workshops',
            loadComponent: () =>
              import('./pages/maintenance/workshops/maintenance-workshops').then(
                (module) => module.MaintenanceWorkshops,
              ),
          },
          {
            path: 'service-log',
            loadComponent: () =>
              import('./pages/maintenance/service-log/maintenance-service-log').then(
                (module) => module.MaintenanceServiceLog,
              ),
          },
          {
            path: 'predictions',
            loadComponent: () =>
              import('./pages/maintenance/predictions/maintenance-predictions').then(
                (module) => module.MaintenancePredictions,
              ),
          },
        ],
      },
      {
        path: 'violations',
        title: 'Violations | FleetPoint',
        loadComponent: () =>
          import('./pages/violations/violations-page').then((module) => module.ViolationsPage),
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'all' },
          {
            path: 'all',
            loadComponent: () =>
              import('./pages/violations/all-violations/all-violations').then(
                (module) => module.AllViolations,
              ),
          },
          {
            path: 'fines',
            loadComponent: () =>
              import('./pages/violations/fines/violation-fines').then(
                (module) => module.ViolationFines,
              ),
          },
          {
            path: 'configuration',
            loadComponent: () =>
              import('./pages/violations/configuration/violation-configuration').then(
                (module) => module.ViolationConfiguration,
              ),
          },
        ],
      },
      {
        path: 'geozones',
        title: 'Geozones | FleetPoint',
        loadComponent: () =>
          import('./pages/geozones/geozones-page').then((module) => module.GeozonesPage),
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'map' },
          {
            path: 'map',
            loadComponent: () =>
              import('./pages/geozones/zone-map/zone-map').then((module) => module.ZoneMap),
          },
          {
            path: 'list',
            loadComponent: () =>
              import('./pages/geozones/zone-list/zone-list').then((module) => module.ZoneList),
          },
          {
            path: 'analytics',
            loadComponent: () =>
              import('./pages/geozones/analytics/geozone-analytics').then(
                (module) => module.GeozoneAnalytics,
              ),
          },
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
        path: 'devices',
        title: 'Devices | FleetPoint',
        loadComponent: () =>
          import('./pages/devices/devices-page').then((module) => module.DevicesPage),
      },
      {
        path: 'dashcam',
        title: 'DashCam | FleetPoint',
        loadComponent: () =>
          import('./pages/dashcam/dashcam-page').then((module) => module.DashcamPage),
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'live' },
          {
            path: 'live',
            loadComponent: () =>
              import('./pages/dashcam/live-view/dashcam-live-view').then(
                (module) => module.DashcamLiveView,
              ),
          },
          {
            path: 'events',
            loadComponent: () =>
              import('./pages/dashcam/events/dashcam-events').then(
                (module) => module.DashcamEvents,
              ),
          },
          {
            path: 'review',
            loadComponent: () =>
              import('./pages/dashcam/review-queue/dashcam-review-queue').then(
                (module) => module.DashcamReviewQueue,
              ),
          },
          {
            path: 'analytics',
            loadComponent: () =>
              import('./pages/dashcam/analytics/dashcam-analytics').then(
                (module) => module.DashcamAnalytics,
              ),
          },
        ],
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
          import('./pages/drivers/driver-detail/driver-detail').then(
            (module) => module.DriverDetail,
          ),
      },
      { path: '**', redirectTo: 'dashboard' },
    ],
  },
];
