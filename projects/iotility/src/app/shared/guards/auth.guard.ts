import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';
import { AuthSessionService } from '../services/auth-session.service';

export const authGuard: CanMatchFn = (_route, segments) => {
  const session = inject(AuthSessionService);
  const router = inject(Router);
  if (session.isAuthenticated) return true;

  session.clear();
  const attemptedUrl = `/${segments.map((segment) => segment.path).join('/')}`;
  return router.createUrlTree(['/auth/login'], {
    queryParams: attemptedUrl !== '/' ? { returnUrl: attemptedUrl } : undefined,
  });
};

export const guestGuard: CanMatchFn = () => {
  const session = inject(AuthSessionService);
  const router = inject(Router);
  return session.isAuthenticated ? router.createUrlTree(['/home']) : true;
};
