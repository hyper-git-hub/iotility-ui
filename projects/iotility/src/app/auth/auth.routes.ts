import { Routes } from '@angular/router';

export const AUTH_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./auth-layout/auth-layout').then((module) => module.AuthLayout),
    children: [
      {
        path: 'login',
        loadComponent: () => import('./login/login-page').then((module) => module.LoginPage),
      },
      {
        path: 'forgot-password',
        loadComponent: () =>
          import('./forgot-password/forgot-password-page').then(
            (module) => module.ForgotPasswordPage,
          ),
      },
      { path: '', pathMatch: 'full', redirectTo: 'login' },
    ],
  },
];
