import { Component, HostListener } from '@angular/core';
import { FeedbackDialogService } from '../services/feedback-dialog.service';

@Component({
  selector: 'app-feedback-dialog',
  templateUrl: './feedback-dialog.html',
  styleUrl: './feedback-dialog.css',
})
export class FeedbackDialog {
  constructor(protected readonly dialog: FeedbackDialogService) {}

  @HostListener('document:keydown.escape')
  protected closeOnEscape(): void {
    if (this.dialog.config()) this.dialog.cancel();
  }
}
