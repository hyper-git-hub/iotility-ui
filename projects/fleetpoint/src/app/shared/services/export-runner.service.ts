import { Injectable, WritableSignal, inject } from '@angular/core';
import { ExportFormat, exportErrorMessage, exportFileName, saveExportBlob } from '@iotility/shared-ui';
import { Observable, finalize } from 'rxjs';
import { FeedbackDialogBridgeService } from './feedback-dialog-bridge.service';

/**
 * Runs a page's export request the same way everywhere: marks the format as exporting (drives the
 * shared Export button's spinner), saves the file as "<name>-<date>.<ext>" with the extension taken
 * from the response type, and reports failures in the standard error dialog.
 */
@Injectable({ providedIn: 'root' })
export class ExportRunnerService {
  private readonly feedback = inject(FeedbackDialogBridgeService);

  run(
    request: Observable<Blob>,
    fileBase: string,
    format: ExportFormat,
    exporting: WritableSignal<ExportFormat | null>,
  ): void {
    if (exporting()) return;
    exporting.set(format);
    request.pipe(finalize(() => exporting.set(null))).subscribe({
      next: (blob) =>
        void saveExportBlob(blob, exportFileName(fileBase), format).catch((error) => this.fail(error)),
      error: (error) => void this.fail(error),
    });
  }

  private async fail(error: unknown): Promise<void> {
    void this.feedback.open({
      type: 'error',
      title: 'Unable to export',
      message: await exportErrorMessage(error),
      confirmText: 'Close',
      showCancel: false,
    });
  }
}
