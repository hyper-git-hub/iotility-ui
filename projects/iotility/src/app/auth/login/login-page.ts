import { HttpErrorResponse } from '@angular/common/http';
import { Component, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { BlockingLoader, SmoothHeight } from '@iotility/shared-ui';
import { finalize, forkJoin, switchMap, tap } from 'rxjs';
import { AuthApiResponse, AuthApiService } from '../../shared/services/auth-api.service';
import { AuthSessionService } from '../../shared/services/auth-session.service';
import { FeedbackDialogService } from '../../shared/services/feedback-dialog.service';

@Component({
  selector: 'app-login-page',
  imports: [BlockingLoader, ReactiveFormsModule, RouterLink, SmoothHeight],
  templateUrl: './login-page.html',
  styleUrl: './login-page.css',
})
export class LoginPage {
  protected readonly submitting = signal(false);
  protected readonly error = signal('');
  protected readonly showPassword = signal(false);
  protected readonly form;

  constructor(
    formBuilder: FormBuilder,
    private readonly authApi: AuthApiService,
    private readonly authSession: AuthSessionService,
    private readonly feedbackDialog: FeedbackDialogService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
  ) {
    this.form = formBuilder.nonNullable.group({
      email: [localStorage.getItem('rememberedEmail') ?? '', [Validators.required, Validators.email]],
      password: ['', Validators.required],
      remember: [Boolean(localStorage.getItem('rememberedEmail'))],
    });
  }

  protected login(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.submitting()) return;

    const { email, password, remember } = this.form.getRawValue();
    this.submitting.set(true);
    this.error.set('');

    this.authApi.login(email, password, remember).pipe(
      tap((response) => {
        const token = response.data?.Token;
        if (response.error || !token) throw new Error(response.message || 'Login failed.');
        localStorage.setItem('token', token);
        localStorage.setItem('userMS-token', token);
        remember
          ? localStorage.setItem('rememberedEmail', email.trim().toLowerCase())
          : localStorage.removeItem('rememberedEmail');
      }),
      switchMap(() => forkJoin({
        profile: this.authApi.getUserProfile(),
        roleAccess: this.authApi.getRoleAccess(),
      })),
      finalize(() => this.submitting.set(false)),
    ).subscribe({
      next: ({ profile, roleAccess }) => {
        if (profile.error) {
          this.clearSession();
          this.error.set(profile.message || 'Unable to load your profile.');
          return;
        }
        if (roleAccess.error) {
          this.clearSession();
          this.error.set(roleAccess.message || 'Unable to load your access permissions.');
          return;
        }
        localStorage.setItem('user', JSON.stringify(profile.data ?? {}));
        localStorage.setItem('language', profile.data?.language || 'en');
        localStorage.setItem('roleAccess', JSON.stringify(roleAccess.data ?? {}));
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
        void this.router.navigateByUrl(this.safeReturnUrl(returnUrl));
      },
      error: (response: HttpErrorResponse | Error) => {
        this.clearSession();
        const message = this.errorMessage(response);
        this.error.set('');
        void this.feedbackDialog.open({
          type: 'error',
          title: 'Unable to sign in',
          message,
          confirmText: 'Try again',
          showCancel: false,
        });
      },
    });
  }

  protected togglePasswordVisibility(): void {
    this.showPassword.update((visible) => !visible);
  }

  private clearSession(): void {
    this.authSession.clear();
  }

  private errorMessage(response: HttpErrorResponse | Error): string {
    if (response instanceof HttpErrorResponse) {
      const body = response.error as AuthApiResponse | string | null;
      if (typeof body === 'string') return body;
      return body?.message || 'The authentication service is temporarily unavailable.';
    }
    return response.message || 'Login failed.';
  }

  private safeReturnUrl(returnUrl: string | null): string {
    return returnUrl?.startsWith('/') && !returnUrl.startsWith('//') ? returnUrl : '/home';
  }
}
