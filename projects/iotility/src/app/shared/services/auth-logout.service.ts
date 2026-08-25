import { Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthApiService } from './auth-api.service';
import { AuthSessionService } from './auth-session.service';
import { FeedbackDialogService } from './feedback-dialog.service';
import { RecentAppsService } from './recent-apps.service';

@Injectable({ providedIn: 'root' })
export class AuthLogoutService {
  readonly loggingOut = signal(false);

  constructor(
    private readonly authApi: AuthApiService,
    private readonly authSession: AuthSessionService,
    private readonly feedbackDialog: FeedbackDialogService,
    private readonly recentApps: RecentAppsService,
    private readonly router: Router,
  ) {}

  async request(): Promise<void> {
    if (this.loggingOut()) return;
    const confirmed = await this.feedbackDialog.open({
      type: 'question',
      title: 'Log out of IoTility?',
      message: 'You will need to sign in again to access your workspace.',
      confirmText: 'Log out',
      cancelText: 'Stay signed in',
    });
    if (!confirmed) return;
    const email = this.authSession.email;
    if (!email) {
      this.finish();
      return;
    }
    this.loggingOut.set(true);
    this.authApi
      .logout(email)
      .pipe(finalize(() => this.loggingOut.set(false)))
      .subscribe({
        next: () => this.finish(),
        error: () => this.finish(),
      });
  }

  private finish(): void {
    this.authSession.clear();
    this.recentApps.reload();
    void this.router.navigateByUrl('/auth/login');
  }
}
