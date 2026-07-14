import { DOCUMENT } from '@angular/common';
import { Inject, Injectable } from '@angular/core';

export type FleetpointFeedbackType = 'success' | 'warning' | 'question' | 'error';
export interface FleetpointFeedbackConfig { type: FleetpointFeedbackType; title: string; message: string; confirmText?: string; cancelText?: string; showCancel?: boolean; }
interface HostDialogRequest { handled: boolean; config: FleetpointFeedbackConfig; respond: (confirmed: boolean) => void; }

@Injectable({ providedIn: 'root' })
export class FeedbackDialogBridgeService {
  constructor(@Inject(DOCUMENT) private readonly document: Document) {}

  open(config: FleetpointFeedbackConfig): Promise<boolean> {
    const view = this.document.defaultView;
    if (!view) return Promise.resolve(false);
    return new Promise<boolean>((resolve) => {
      const detail: HostDialogRequest = { handled: false, config, respond: resolve };
      view.dispatchEvent(new CustomEvent('iotility:feedback-dialog', { detail }));
      if (!detail.handled) resolve(config.showCancel === false ? (view.alert(config.message), true) : view.confirm(config.message));
    });
  }
}
