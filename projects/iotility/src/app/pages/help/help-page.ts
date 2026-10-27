import { Component, inject } from '@angular/core';
import { FeedbackDialogService } from '../../shared/services/feedback-dialog.service';

@Component({
  selector: 'app-help-page',
  templateUrl: './help-page.html',
  styleUrl: './help-page.css',
})
export class HelpPage {
  private readonly feedbackDialog = inject(FeedbackDialogService);

  protected comingSoon(section: string): void {
    void this.feedbackDialog.open({
      type: 'warning',
      title: 'Coming soon',
      message: `${section} aren't available yet. Please check back later.`,
      confirmText: 'OK',
      showCancel: false,
    });
  }
}
