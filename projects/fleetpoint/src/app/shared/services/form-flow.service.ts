import { Injectable, inject, signal } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import { Modal } from '../modal/modal';
import { FeedbackDialogBridgeService } from './feedback-dialog-bridge.service';

export interface FormSubmitOptions<T> {
  /** Loader label while the request runs, e.g. "Creating vehicle...". */
  loading: string;
  /** The message can read the response (e.g. the API's own confirmation text). */
  success: { title: string; message: string | ((response: T) => string) };
  failure: { title: string; message: string };
  /** Whether the response is a success; by default anything but status 1002. */
  ok?: (response: T) => boolean;
}

/** Time for the blocking loader to fade out before the feedback dialog takes over. */
const LOADER_HANDOFF_MS = 240;

/**
 * One visible sequence for every form submit: the form closes, the blocking loader shows while the request runs,
 * then the feedback dialog reports the result. On failure the same form opens again with everything the user
 * typed still in it.
 */
@Injectable({ providedIn: 'root' })
export class FormFlowService {
  private readonly feedback = inject(FeedbackDialogBridgeService);

  /** Label of the request in flight; the layout's blocking loader shows while it's set. */
  readonly loading = signal<string | null>(null);

  async submit<T extends { status?: number | string; message?: string }>(
    modal: Modal,
    request: Observable<T>,
    options: FormSubmitOptions<T>,
  ): Promise<T | null> {
    await modal.collapse();
    this.loading.set(options.loading);
    let response: T | null = null;
    let message: string | undefined;
    try {
      response = await firstValueFrom(request);
    } catch (error) {
      const body = (error as { error?: { message?: string; detail?: string } })?.error;
      message = body?.message ?? body?.detail;
    }
    const ok = response !== null && (options.ok ? options.ok(response) : Number(response.status) !== 1002);
    if (response && !ok) message = response.message;
    this.loading.set(null);
    await new Promise((resolve) => setTimeout(resolve, LOADER_HANDOFF_MS));
    if (ok) {
      const success = options.success.message;
      await this.feedback.open({ type: 'success', title: options.success.title, message: typeof success === 'function' ? success(response!) : success, showCancel: false });
      return response;
    }
    await this.feedback.open({ type: 'error', title: options.failure.title, message: message || options.failure.message, showCancel: false });
    await modal.expand();
    return null;
  }

  /**
   * Cancel / × / Esc / backdrop. With unsaved input, asks before throwing it away; resolves false if the user
   * keeps editing. Otherwise closes the form and resolves true.
   */
  async close(modal: Modal, dirty = false): Promise<boolean> {
    if (dirty) {
      const discard = await this.feedback.open({
        type: 'warning',
        title: 'Discard changes?',
        message: 'You have unsaved changes in this form. They will be lost if you close it.',
        confirmText: 'Discard',
        cancelText: 'Keep editing',
        showCancel: true,
      });
      if (!discard) return false;
    }
    await modal.collapse();
    return true;
  }
}
