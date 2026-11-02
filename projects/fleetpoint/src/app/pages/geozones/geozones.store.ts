import { Injectable, computed, inject } from '@angular/core';
import { GeozonesApiService } from '../../shared/services/geozones-api.service';
import { FeedbackDialogBridgeService } from '../../shared/services/feedback-dialog-bridge.service';
import { GeozoneRecord, toGeozoneRecord } from './geozones.data';

/** Geo-zones mapped for the page; shared by the header and every tab. */
@Injectable({ providedIn: 'root' })
export class GeozonesStore {
  private readonly api = inject(GeozonesApiService);
  private readonly feedback = inject(FeedbackDialogBridgeService);

  readonly loaded = this.api.loaded;
  readonly zones = computed(() => this.api.zones().map(toGeozoneRecord));

  refresh(): void {
    this.api.refresh();
  }

  /** Confirms, deletes the zone and reloads; shows the API's message when it fails. */
  async remove(zone: GeozoneRecord): Promise<boolean> {
    const confirmed = await this.feedback.open({
      type: 'warning',
      title: 'Delete geozone?',
      message: `${zone.name} will be permanently deleted.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      showCancel: true,
    });
    if (!confirmed) return false;
    const failed = (message?: string) =>
      void this.feedback.open({
        type: 'error',
        title: 'Unable to delete',
        message: message || 'The geozone could not be deleted. Please try again.',
        showCancel: false,
      });
    return new Promise((resolve) =>
      this.api.delete(Number(zone.id)).subscribe({
        next: (response) => {
          if (response.status === 1002) {
            failed(response.message);
            resolve(false);
            return;
          }
          this.refresh();
          resolve(true);
        },
        error: () => {
          failed();
          resolve(false);
        },
      }),
    );
  }
}
