import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthSessionService } from '../services/auth-session.service';
import { FeedbackDialogService } from '../services/feedback-dialog.service';

let handlingInvalidSession = false;

export const apiInterceptor: HttpInterceptorFn = (request, next) => {
  const router = inject(Router);
  const authSession = inject(AuthSessionService);
  const feedbackDialog = inject(FeedbackDialogService);
  const isCobApi = request.url.startsWith(environment.cobPackagesBaseUrl);
  const isPlatformApi =
    request.url.startsWith(environment.userMsBaseUrl) ||
    request.url.startsWith(environment.fleetBaseUrl) ||
    request.url.startsWith(environment.apiBaseUrl);

  if (!isPlatformApi) return next(request);

  if (isCobApi) {
    return next(
      request.clone({
        headers: request.headers.set('consumer-app-secret', environment.cobConsumerAppSecret),
      }),
    );
  }

  const token = localStorage.getItem('userMS-token') || localStorage.getItem('token');
  let headers = request.headers
    .set('User-Platform', 'WEB')
    .set('OS', 'WEB')
    .set('use-case', String(environment.useCaseId));

  if (token) headers = headers.set('Authorization', `Token ${token}`);

  return next(request.clone({ headers })).pipe(
    catchError((error: HttpErrorResponse) => {
      if ((error.status === 401 || error.status === 403) && token) {
        if (!handlingInvalidSession) {
          handlingInvalidSession = true;
          authSession.clear();
          void router.navigate(['/auth/login']).then(async () => {
            await feedbackDialog.open({
              type: 'warning',
              title: 'You have been logged out',
              message:
                'Your account was signed in on another device. Please sign in again to continue.',
              confirmText: 'Sign in again',
              showCancel: false,
            });
            handlingInvalidSession = false;
          });
        }
      }
      return throwError(() => error);
    }),
  );
};
