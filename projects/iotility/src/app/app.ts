import { Component, DestroyRef, HostListener, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  Router,
  RouterOutlet,
} from '@angular/router';
import { Loading } from './shared/loading/loading';
import { LoadingService } from './shared/services/loading.service';
import { FeedbackDialog } from './shared/feedback-dialog/feedback-dialog';
import { BlockingLoader } from '@iotility/shared-ui';
import { AuthLogoutService } from './shared/services/auth-logout.service';
import {
  FeedbackDialogConfig,
  FeedbackDialogService,
} from './shared/services/feedback-dialog.service';

interface FeedbackDialogRequest {
  handled: boolean;
  config: FeedbackDialogConfig;
  respond: (confirmed: boolean) => void;
}

@Component({
  selector: 'app-root',
  imports: [BlockingLoader, FeedbackDialog, Loading, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  private static readonly PROGRESS_DELAY_MS = 110;
  private static readonly MINIMUM_PROGRESS_MS = 280;
  private static readonly PROGRESS_FADE_MS = 240;

  private readonly destroyRef = inject(DestroyRef);
  private showTimer?: ReturnType<typeof setTimeout>;
  private completionTimer?: ReturnType<typeof setTimeout>;
  private hideTimer?: ReturnType<typeof setTimeout>;
  private progressShownAt = 0;
  protected readonly navigationProgress = signal<'idle' | 'loading' | 'complete'>('idle');

  constructor(
    protected readonly loading: LoadingService,
    protected readonly authLogout: AuthLogoutService,
    private readonly feedbackDialog: FeedbackDialogService,
    router: Router,
  ) {
    this.destroyRef.onDestroy(() => this.clearProgressTimers());

    router.events.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((event) => {
      if (event instanceof NavigationStart) {
        this.startNavigationProgress();
        return;
      }

      if (
        event instanceof NavigationEnd ||
        event instanceof NavigationCancel ||
        event instanceof NavigationError
      ) {
        this.finishNavigationProgress();
      }
    });
  }

  private startNavigationProgress(): void {
    this.clearProgressTimers();

    if (this.navigationProgress() !== 'idle') {
      this.navigationProgress.set('loading');
      this.progressShownAt ||= performance.now();
      return;
    }

    this.showTimer = setTimeout(() => {
      this.showTimer = undefined;
      this.progressShownAt = performance.now();
      this.navigationProgress.set('loading');
    }, App.PROGRESS_DELAY_MS);
  }

  private finishNavigationProgress(): void {
    if (this.showTimer) {
      clearTimeout(this.showTimer);
      this.showTimer = undefined;
      this.navigationProgress.set('idle');
      return;
    }

    if (this.navigationProgress() !== 'loading') return;

    const visibleFor = performance.now() - this.progressShownAt;
    const completionDelay = Math.max(0, App.MINIMUM_PROGRESS_MS - visibleFor);

    this.completionTimer = setTimeout(() => {
      this.completionTimer = undefined;
      this.navigationProgress.set('complete');
      this.hideTimer = setTimeout(() => {
        this.hideTimer = undefined;
        this.progressShownAt = 0;
        this.navigationProgress.set('idle');
      }, App.PROGRESS_FADE_MS);
    }, completionDelay);
  }

  private clearProgressTimers(): void {
    if (this.showTimer) clearTimeout(this.showTimer);
    if (this.completionTimer) clearTimeout(this.completionTimer);
    if (this.hideTimer) clearTimeout(this.hideTimer);
    this.showTimer = undefined;
    this.completionTimer = undefined;
    this.hideTimer = undefined;
  }

  ngOnInit(): void {
    /* IoTility startup loading is handled by the pre-bootstrap loader in index.html.
    this.loading.showFor(
      {
        label: 'Hypernym',
        title: 'Loading IoTility',
        message: 'Preparing your connected operations platform…',
        initials: 'io',
        logoSrc: 'assets/iotility-light.svg',
        labelLogoSrc: 'assets/hypernym-full.svg',
      },
      2500,
    ); */
  }

  @HostListener('window:iotility:logout')
  protected logoutFromRemote(): void {
    void this.authLogout.request();
  }

  @HostListener('window:iotility:feedback-dialog', ['$event'])
  protected async handleFeedbackDialogRequest(event: Event): Promise<void> {
    const request = (event as CustomEvent<FeedbackDialogRequest>).detail;
    request.handled = true;
    request.respond(await this.feedbackDialog.open(request.config));
  }
}
