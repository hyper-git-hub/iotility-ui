import { Routes } from '@angular/router';

export const AUTH_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./auth-layout/auth-layout').then((module) => module.AuthLayout),
    children: [
      {
        path: 'login',
        title: 'Sign In | IoTility',
        loadComponent: () => import('./login/login-page').then((module) => module.LoginPage),
      },
      {
        path: 'mfa',
        title: 'Secure Your Account | IoTility',
        loadComponent: () => import('./mfa/mfa-page').then((module) => module.MfaPage),
      },
      {
        path: 'forgot-password',
        title: 'Forgot Password | IoTility',
        loadComponent: () =>
          import('./forgot-password/forgot-password-page').then(
            (module) => module.ForgotPasswordPage,
          ),
      },
      { path: '', pathMatch: 'full', redirectTo: 'login' },
    ],
  },
];
