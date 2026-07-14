import { Routes } from '@angular/router';
import { loadRemoteModule } from '@angular-architects/native-federation-v4';
import { authGuard, guestGuard } from './shared/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'auth',
    canMatch: [guestGuard],
    loadChildren: () => import('./auth/auth.routes').then((module) => module.AUTH_ROUTES),
  },
  {
    path: 'home',
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
        loadComponent: () => import('./pages/home/home-page').then((module) => module.HomePage),
      },
      {
        path: 'users',
        loadComponent: () => import('./pages/users/users-page').then((module) => module.UsersPage),
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./pages/profile/profile-page').then((module) => module.ProfilePage),
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./pages/settings/settings-page').then((module) => module.SettingsPage),
      },
      {
        path: 'billing',
        loadComponent: () =>
          import('./pages/billing/billing-page').then((module) => module.BillingPage),
      },
      {
        path: 'help',
        loadComponent: () => import('./pages/help/help-page').then((module) => module.HelpPage),
      },
    ],
  },
  {
    path: 'fleetpoint',
    canMatch: [authGuard],
    loadChildren: () => loadRemoteModule('fleetpoint', './Routes').then((module) => module.routes),
  },
  { path: 'fleet', redirectTo: 'fleetpoint/dashboard' },
  { path: '', pathMatch: 'full', redirectTo: 'auth/login' },
  { path: '**', redirectTo: 'auth/login' },
];
