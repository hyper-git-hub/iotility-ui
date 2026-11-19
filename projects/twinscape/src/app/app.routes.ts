import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./layout/twinscape-layout').then((module) => module.TwinscapeLayout),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'home' },
      {
        path: 'home',
        title: 'Home | Twinscape',
        loadComponent: () => import('./pages/home/home-page').then((module) => module.HomePage),
      },
      { path: '**', redirectTo: 'home' },
    ],
  },
];
