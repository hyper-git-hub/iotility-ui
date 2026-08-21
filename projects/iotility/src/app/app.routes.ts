import { Routes } from '@angular/router';
import { initFederation, loadRemoteModule } from '@angular-architects/native-federation-v4';
import { authGuard, guestGuard } from './shared/guards/auth.guard';

const fleetpointDashboard = 'fleetpoint/dashboard';
const fleetpointManifestUrl = 'federation.manifest.json';

type FleetpointRoutesModule = { routes: Routes };

// The federation orchestrator caches remote entries in memory on globalThis.
// If the fleetpoint dev server rebuilt (e.g. after a git pull or code change),
// the cached chunk URLs are stale and module loading fails. Retry once after
// dropping the cache and re-initializing federation so navigation to the
// fleetpoint routes always recovers instead of silently falling back.
async function loadFleetpointRoutes(): Promise<FleetpointRoutesModule> {
  try {
    return (await loadRemoteModule('fleetpoint', './Routes')) as FleetpointRoutesModule;
  } catch (error) {
    console.warn('Fleetpoint module load failed; re-initializing federation.', error);
    delete (globalThis as Record<string, unknown>)['__NATIVE_FEDERATION__'];
    await initFederation(fleetpointManifestUrl);
    return (await loadRemoteModule('fleetpoint', './Routes')) as FleetpointRoutesModule;
  }
}

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'home',
  },
  {
    path: 'auth',
    canMatch: [guestGuard],
    loadChildren: () => import('./auth/auth.routes').then((module) => module.AUTH_ROUTES),
  },

  // Declared before the empty host-layout route so the fleetpoint remote can
  // never be shadowed by a prefix-matching parent route.
  {
    path: 'fleetpoint',
    canMatch: [authGuard],
    loadChildren: () => loadFleetpointRoutes().then((module) => module.routes),
  },
  { path: 'fleet', pathMatch: 'full', redirectTo: fleetpointDashboard },

  {
    path: 'home',
    title: 'Home | IoTility',
    canMatch: [authGuard],
    loadComponent: () => import('./layout/host-layout').then((module) => module.HostLayout),
    children: [
      {
        path: '',
        loadComponent: () => import('./pages/home/home-page').then((module) => module.HomePage),
      },
    ],
  },
  {
    path: '',
    canMatch: [authGuard],
    loadComponent: () => import('./layout/host-layout').then((module) => module.HostLayout),
    children: [
      {
        path: 'use-cases',
        title: 'Use Cases | IoTility',
        loadComponent: () => import('./pages/home/home-page').then((module) => module.HomePage),
      },
      {
        path: 'users',
        title: 'Users | IoTility',
        loadComponent: () => import('./pages/users/users-page').then((module) => module.UsersPage),
      },
      {
        path: 'settings',
        title: 'Settings | IoTility',
        loadComponent: () =>
          import('./pages/settings/settings-page').then((module) => module.SettingsPage),
      },
      {
        path: 'billing',
        title: 'Billing | IoTility',
        loadComponent: () =>
          import('./pages/billing/billing-page').then((module) => module.BillingPage),
      },
      {
        path: 'help',
        title: 'Help | IoTility',
        loadComponent: () => import('./pages/help/help-page').then((module) => module.HelpPage),
      },
    ],
  },

  // Cleanup: preserve deep links by redirecting known fleetpoint short-hosts,
  // then fall back to home as the last resort (never the first choice).
  {
    path: '**',
    redirectTo: 'home',
  },
];