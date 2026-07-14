import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthApiResponse, AuthApiService } from './auth-api.service';
import { AuthSessionService } from './auth-session.service';
import { FeedbackDialogService } from './feedback-dialog.service';

@Injectable({ providedIn: 'root' })
export class AuthLogoutService {
  readonly loggingOut = signal(false);

  constructor(
    private readonly authApi: AuthApiService,
    private readonly authSession: AuthSessionService,
    private readonly feedbackDialog: FeedbackDialogService,
    private readonly router: Router,
  ) {}

  async request(): Promise<void> {
    if (this.loggingOut()) return;
    const confirmed = await this.feedbackDialog.open({
      type: 'question', title: 'Log out of IoTility?',
      message: 'You will need to sign in again to access your workspace.',
      confirmText: 'Log out', cancelText: 'Stay signed in',
    });
    if (!confirmed) return;
    const email = this.authSession.email;
    if (!email) { this.finish(); return; }
    this.loggingOut.set(true);
    this.authApi.logout(email).pipe(finalize(() => this.loggingOut.set(false))).subscribe({
      next: (response) => response.error
        ? this.showError(response.message || 'The logout request could not be completed.')
        : this.finish(),
      error: (response: HttpErrorResponse) => this.showError(this.errorMessage(response)),
    });
  }

  private finish(): void {
    this.authSession.clear();
    void this.router.navigateByUrl('/auth/login');
  }

  private showError(message: string): void {
    void this.feedbackDialog.open({ type: 'error', title: 'Unable to log out', message, confirmText: 'Close', showCancel: false });
  }

  private errorMessage(response: HttpErrorResponse): string {
    const body = response.error as AuthApiResponse | string | null;
    return typeof body === 'string' ? body : body?.message || 'The authentication service is temporarily unavailable.';
  }
}
