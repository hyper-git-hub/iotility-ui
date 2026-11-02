import { Component, computed, inject, signal } from '@angular/core';
import { DropdownOption, Skeleton } from '@iotility/shared-ui';
import { DashcamVehicle, NOT_AVAILABLE } from '../dashcam.data';
import { DashcamStore } from '../dashcam.store';
import { DashcamVideoTile } from '../video-tile/video-tile';

@Component({
  selector: 'app-dashcam-live-view',
  imports: [DashcamVideoTile, Skeleton],
  templateUrl: './dashcam-live-view.html',
  styleUrl: './dashcam-live-view.css',
})
export class DashcamLiveView {
  private readonly store = inject(DashcamStore);
  protected readonly loaded = this.store.loaded;
  protected readonly skeletonRows = [0, 1, 2, 3];
  protected readonly vehicles = this.store.vehicles;
  private readonly chosenId = signal<string | null>(null);
  /** The picked vehicle, else the first online one; null while there are no dashcam devices. */
  protected readonly selected = computed<DashcamVehicle | null>(() => {
    const vehicles = this.vehicles();
    return (
      vehicles.find((vehicle) => vehicle.id === this.chosenId()) ?? vehicles.find((vehicle) => vehicle.online) ?? null
    );
  });
  protected readonly layout = signal<'1' | '2' | '3' | '4'>('2');
  protected readonly layoutOptions: DropdownOption[] = [
    { id: '1', label: '1×1' },
    { id: '2', label: '2×2' },
    { id: '3', label: '3×3' },
    { id: '4', label: '4×4' },
  ];
  /** Latest AI camera events; the API has no live/unreviewed flag. */
  protected readonly liveAlerts = computed(() => this.store.events().slice(0, 6));
  protected readonly displayedCameras = computed(() => {
    const capacity = { '1': 1, '2': 4, '3': 9, '4': 16 }[this.layout()];
    return (this.selected()?.cameras ?? []).slice(0, capacity);
  });
  protected select(vehicle: DashcamVehicle): void {
    if (vehicle.online) this.chosenId.set(vehicle.id);
  }
  protected hasAlert(vehicle: DashcamVehicle): boolean {
    return this.store.events().some((event) => event.vehicle === vehicle.plate);
  }
  /** Live speed and position aren't part of the DashCam device list. */
  protected status(): { speed: string; location: string } {
    return { speed: NOT_AVAILABLE, location: NOT_AVAILABLE };
  }
}
