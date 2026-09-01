import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, retry, throwError, timer } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthSessionService } from '../services/auth-session.service';
import { FeedbackDialogService } from '../services/feedback-dialog.service';

let handlingInvalidSession = false;

// Gateway outages (502/503/504), server faults and unreachable backends
// (status 0) are surfaced as one friendly message. Page handlers everywhere
// read `response.error?.message`, so rewriting the error body here — in the
// single place every platform API call flows through — makes the whole app
// report the outage instead of misleading feature-specific failures such as
// "Vehicles could not be loaded." when the backend is actually down.
const SERVICE_UNAVAILABLE_MESSAGE =
  'The backend service is temporarily unavailable. Please try again in a few minutes.';

// Transient statuses that can be retried safely: Cloudflare edge/origin
// timeouts (520–527, notably 522 Connection Timed Out, 524 Origin Timeout),
// gateway faults, rate limiting, and local network failure (status 0).
const TRANSIENT_STATUSES = new Set([
  0, 408, 425, 429, 500, 502, 503, 504, 520, 521, 522, 523, 524, 525, 526, 527,
]);
const RETRY_COUNT = 2;
const RETRY_BASE_DELAY_MS = 800;

const isServiceOutage = (error: HttpErrorResponse): boolean =>
  error.status === 0 || error.status >= 500;

const withUnavailableMessage = (error: HttpErrorResponse): HttpErrorResponse => {
  const body = error.error;
  // Blob/string bodies (file downloads, HTML error pages from a gateway)
  // can't carry a usable message, so swap in a fresh JSON body; object bodies
  // keep all their fields with only `message` overridden.
  if (body === null || body === undefined || typeof body === 'string' || body instanceof Blob) {
    return new HttpErrorResponse({
      error: { message: SERVICE_UNAVAILABLE_MESSAGE },
      headers: error.headers,
      status: error.status,
      statusText: error.statusText,
      url: error.url ?? undefined,
    });
  }
  return new HttpErrorResponse({
    error: { ...body, message: SERVICE_UNAVAILABLE_MESSAGE },
    headers: error.headers,
    status: error.status,
    statusText: error.statusText,
    url: error.url ?? undefined,
  });
};

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

  const response$ = next(request.clone({ headers }));

  // 522/520–527/502–504 etc. are transient edge-origin timeouts: the origin
  // may recover within seconds, so retry idempotent GETs a couple of times
  // with linear backoff before surfacing the error. Non-GETs are never
  // retried (no duplicate side effects), and 4xx business errors fail fast.
  const request$ =
    request.method === 'GET'
      ? response$.pipe(
          retry({
            count: RETRY_COUNT,
            delay: (error: unknown, attempt: number) => {
              const status = (error as HttpErrorResponse | undefined)?.status;
              if (!TRANSIENT_STATUSES.has(status ?? -1)) return throwError(() => error);
              return timer(RETRY_BASE_DELAY_MS * attempt);
            },
          }),
        )
      : response$;

  return request$.pipe(
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
      return throwError(() => (isServiceOutage(error) ? withUnavailableMessage(error) : error));
    }),
  );
};
