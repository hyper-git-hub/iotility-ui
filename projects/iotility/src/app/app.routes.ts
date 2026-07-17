import { inject } from '@angular/core';
import { Routes } from '@angular/router';
import { loadRemoteModule } from '@angular-architects/native-federation-v4';
import { authGuard, guestGuard } from './shared/guards/auth.guard';
import { AuthSessionService } from './shared/services/auth-session.service';

const fleetpointDashboard = 'fleetpoint/dashboard';

export const routes: Routes = [
  {
    path: 'auth',
    canMatch: [guestGuard],
    loadChildren: () => import('./auth/auth.routes').then((module) => module.AUTH_ROUTES),
  },

  /* IoTility host routes are temporarily disabled.
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
  */

  {
    path: '',
    pathMatch: 'full',
    redirectTo: () =>
      inject(AuthSessionService).isAuthenticated ? `/${fleetpointDashboard}` : '/auth/login',
  },
  {
    path: 'fleetpoint',
    canMatch: [authGuard],
    loadChildren: () => loadRemoteModule('fleetpoint', './Routes').then((module) => module.routes),
  },
  { path: 'fleet', redirectTo: fleetpointDashboard },

  // Temporary redirects while the IoTility host routes above are disabled.
  { path: 'home', redirectTo: fleetpointDashboard },
  { path: 'use-cases', redirectTo: fleetpointDashboard },
  { path: 'users', redirectTo: fleetpointDashboard },
  { path: 'settings', redirectTo: fleetpointDashboard },
  { path: 'billing', redirectTo: fleetpointDashboard },
  { path: 'help', redirectTo: fleetpointDashboard },

  {
    path: '**',
    redirectTo: () =>
      inject(AuthSessionService).isAuthenticated ? `/${fleetpointDashboard}` : '/auth/login',
  },
];
