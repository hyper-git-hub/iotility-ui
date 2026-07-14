import { HttpErrorResponse } from '@angular/common/http';
import { Component, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { BlockingLoader, SmoothHeight } from '@iotility/shared-ui';
import { finalize } from 'rxjs';
import { AuthApiResponse, AuthApiService } from '../../shared/services/auth-api.service';
import { FeedbackDialogService } from '../../shared/services/feedback-dialog.service';

type ResetStep = 'email' | 'otp' | 'password' | 'success';

@Component({
  selector: 'app-forgot-password-page',
  imports: [BlockingLoader, ReactiveFormsModule, RouterLink, SmoothHeight],
  templateUrl: './forgot-password-page.html',
  styleUrl: './forgot-password-page.css',
})
export class ForgotPasswordPage {
  protected readonly step = signal<ResetStep>('email');
  protected readonly submitting = signal(false);
  protected readonly message = signal('');
  protected readonly error = signal('');
  protected readonly showPassword = signal(false);
  protected readonly form;

  constructor(
    formBuilder: FormBuilder,
    private readonly authApi: AuthApiService,
    private readonly feedbackDialog: FeedbackDialogService,
  ) {
    this.form = formBuilder.nonNullable.group({
      email: ['', [Validators.required, Validators.email]],
      otp: ['', [Validators.required, Validators.pattern(/^\d{4,8}$/)]],
      password: ['', [Validators.required, Validators.pattern(/^(?=[^A-Z]*[A-Z])(?=[^a-z]*[a-z])(?=[^0-9]*[0-9]).{8,15}$/)]],
      confirmPassword: ['', Validators.required],
    });
  }

  protected requestCode(): void {
    const control = this.form.controls.email;
    control.markAsTouched();
    if (control.invalid) return;
    this.runRequest(
      this.authApi.requestPasswordReset(control.value),
      () => {
        this.step.set('otp');
        this.message.set('We sent a verification code to your email.');
      },
    );
  }

  protected verifyCode(): void {
    const control = this.form.controls.otp;
    control.markAsTouched();
    if (control.invalid) return;
    this.runRequest(
      this.authApi.verifyPasswordResetCode(this.form.controls.email.value, control.value),
      () => {
        this.step.set('password');
        this.message.set('Code accepted. Create your new password.');
      },
    );
  }

  protected savePassword(): void {
    const password = this.form.controls.password;
    const confirmation = this.form.controls.confirmPassword;
    password.markAsTouched(); confirmation.markAsTouched();
    if (password.invalid || confirmation.invalid) return;
    if (password.value !== confirmation.value) {
      this.error.set('Passwords do not match.');
      return;
    }
    this.runRequest(
      this.authApi.resetPassword(
        this.form.controls.email.value,
        this.form.controls.otp.value,
        password.value,
      ),
      () => {
        this.step.set('success');
        this.message.set('Your password has been changed successfully.');
      },
    );
  }

  protected resendCode(): void {
    this.runRequest(
      this.authApi.resendPasswordResetCode(this.form.controls.email.value),
      () => this.message.set('A new verification code has been sent.'),
    );
  }

  protected backToEmail(): void {
    this.step.set('email');
    this.form.controls.otp.reset();
    this.error.set(''); this.message.set('');
  }

  protected togglePasswordVisibility(): void {
    this.showPassword.update((visible) => !visible);
  }

  private runRequest(request: ReturnType<AuthApiService['requestPasswordReset']>, success: () => void): void {
    this.submitting.set(true); this.error.set(''); this.message.set('');
    request.pipe(finalize(() => this.submitting.set(false))).subscribe({
      next: (response) => {
        if (response.error) {
          this.showRequestError(response.message || 'The request could not be completed.');
          return;
        }
        success();
      },
      error: (response: HttpErrorResponse) => this.showRequestError(this.errorMessage(response)),
    });
  }

  private showRequestError(message: string): void {
    this.error.set('');
    void this.feedbackDialog.open({
      type: 'error',
      title: 'Request unsuccessful',
      message,
      confirmText: 'Try again',
      showCancel: false,
    });
  }

  private errorMessage(response: HttpErrorResponse): string {
    const body = response.error as AuthApiResponse | string | null;
    if (typeof body === 'string') return body;
    return body?.message || 'The authentication service is temporarily unavailable.';
  }
}
