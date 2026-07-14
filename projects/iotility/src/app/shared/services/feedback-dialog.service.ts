import { Injectable, signal } from '@angular/core';

export type FeedbackDialogType = 'success' | 'warning' | 'question' | 'error';

export interface FeedbackDialogConfig {
  type: FeedbackDialogType;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  showCancel?: boolean;
}

@Injectable({ providedIn: 'root' })
export class FeedbackDialogService {
  readonly config = signal<FeedbackDialogConfig | null>(null);
  readonly closing = signal(false);
  private resolveDialog?: (confirmed: boolean) => void;

  open(config: FeedbackDialogConfig): Promise<boolean> {
    if (this.resolveDialog) return Promise.resolve(false);
    this.closing.set(false);
    this.config.set(config);
    return new Promise<boolean>((resolve) => (this.resolveDialog = resolve));
  }

  confirm(): void {
    this.close(true);
  }
  cancel(): void {
    this.close(false);
  }

  private close(confirmed: boolean): void {
    if (!this.resolveDialog || this.closing()) return;
    this.closing.set(true);
    const resolve = this.resolveDialog;
    window.setTimeout(() => {
      resolve(confirmed);
      this.resolveDialog = undefined;
      this.config.set(null);
      this.closing.set(false);
    }, 220);
  }
}
