import { Component, HostListener, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
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
  constructor(
    protected readonly loading: LoadingService,
    protected readonly authLogout: AuthLogoutService,
    private readonly feedbackDialog: FeedbackDialogService,
  ) {}

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
