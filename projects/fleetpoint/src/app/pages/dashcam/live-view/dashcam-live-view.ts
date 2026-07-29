import { Component, computed, signal } from '@angular/core';
import { DropdownOption } from '@iotility/shared-ui';
import { DASHCAM_EVENTS, DASHCAM_VEHICLES, DashcamVehicle } from '../dashcam.data';
import { DashcamVideoTile } from '../video-tile/video-tile';

@Component({
  selector: 'app-dashcam-live-view',
  imports: [DashcamVideoTile],
  templateUrl: './dashcam-live-view.html',
  styleUrl: './dashcam-live-view.css',
})
export class DashcamLiveView {
  protected readonly vehicles = DASHCAM_VEHICLES;
  protected readonly selected = signal<DashcamVehicle>(
    DASHCAM_VEHICLES.find((vehicle) => vehicle.online)!,
  );
  protected readonly layout = signal<'1' | '2' | '3' | '4'>('2');
  protected readonly layoutOptions: DropdownOption[] = [
    { id: '1', label: '1×1' },
    { id: '2', label: '2×2' },
    { id: '3', label: '3×3' },
    { id: '4', label: '4×4' },
  ];
  protected readonly liveAlerts = DASHCAM_EVENTS.filter(
    (event) => event.review === 'Unreviewed' || event.severity === 'Critical',
  ).slice(0, 6);
  protected readonly recentEvents = computed(() =>
    DASHCAM_EVENTS.filter((event) => event.vehicle === this.selected().plate).slice(0, 3),
  );
  protected readonly displayedCameras = computed(() => {
    const capacity = { '1': 1, '2': 4, '3': 9, '4': 16 }[this.layout()];
    return this.selected().cameras.slice(0, capacity);
  });
  protected hasAlert(vehicle: DashcamVehicle): boolean {
    return DASHCAM_EVENTS.some(
      (event) => event.vehicle === vehicle.plate && event.review === 'Unreviewed',
    );
  }
  protected chooseLayout(option: DropdownOption): void {
    this.layout.set(option.id as '1' | '2' | '3' | '4');
  }
  protected layoutLabel(): string {
    return this.layoutOptions.find((option) => option.id === this.layout())?.label ?? '';
  }
  protected status(): { speed: number; location: string } {
    return (
      {
        'LP-4821': { speed: 74, location: 'M40 Northbound, London' },
        'LP-0392': { speed: 0, location: 'Birmingham Depot — Zone B' },
        'LP-9901': { speed: 52, location: 'M6 Northbound' },
        'LP-2201': { speed: 36, location: 'Birmingham Ring Road' },
        'LP-7734': { speed: 0, location: 'Bicester Depot' },
      }[this.selected().plate] ?? { speed: 0, location: 'Location unavailable' }
    );
  }
  protected videoPath(camera: string): string {
    return `videos/dashcam/live/${this.selected().plate}_${camera.toLowerCase()}.mp4`;
  }
}
