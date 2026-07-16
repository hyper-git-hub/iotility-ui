import { inject } from '@angular/core';
import { Routes } from '@angular/router';
import { loadRemoteModule } from '@angular-architects/native-federation-v4';
import { authGuard, guestGuard } from './shared/guards/auth.guard';
import { AuthSessionService } from './shared/services/auth-session.service';

export const routes: Routes = [
  {
    path: 'auth',
    canMatch: [guestGuard],
    loadChildren: () => import('./auth/auth.routes').then((module) => module.AUTH_ROUTES),
  },
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
    pathMatch: 'full',
    redirectTo: () => (inject(AuthSessionService).isAuthenticated ? '/home' : '/auth/login'),
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
        path: 'profile',
        title: 'My Profile | IoTility',
        loadComponent: () =>
          import('./pages/profile/profile-page').then((module) => module.ProfilePage),
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
  {
    path: 'fleetpoint',
    canMatch: [authGuard],
    loadChildren: () => loadRemoteModule('fleetpoint', './Routes').then((module) => module.routes),
  },
  { path: 'fleet', redirectTo: 'fleetpoint/dashboard' },
  { path: '**', redirectTo: 'auth/login' },
];
