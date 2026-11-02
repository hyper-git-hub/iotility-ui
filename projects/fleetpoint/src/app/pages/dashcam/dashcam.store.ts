import { Injectable, computed, inject } from '@angular/core';
import { DashcamApiService } from '../../shared/services/dashcam-api.service';
import { toDashcamEvent, toDashcamVehicle } from './dashcam.data';

/** DashCam devices and events mapped for the page; shared by the header and every tab. */
@Injectable({ providedIn: 'root' })
export class DashcamStore {
  private readonly api = inject(DashcamApiService);

  readonly loaded = this.api.loaded;
  readonly events = computed(() => this.api.events().map((record) => toDashcamEvent(record, this.api.devices())));
  readonly vehicles = computed(() => this.api.devices().map((device) => toDashcamVehicle(device, this.events())));

  refresh(): void {
    this.api.refresh();
  }
}
