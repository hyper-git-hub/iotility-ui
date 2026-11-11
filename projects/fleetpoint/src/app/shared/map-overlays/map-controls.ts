import {
  ChangeDetectionStrategy,
  Component,
  NgZone,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { Map as MapLibreMap } from 'maplibre-gl';
import { Tooltip } from '@iotility/shared-ui';

@Component({
  selector: 'app-map-controls',
  imports: [Tooltip],
  templateUrl: './map-controls.html',
  styleUrl: './map-controls.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MapControls {
  readonly fullscreen = input(false);
  readonly zoomOnly = input(false);
  /** The map these controls drive. Given, the compass turns with it and appears once it is rotated. */
  readonly map = input<MapLibreMap | undefined>();
  /** Adds a button that frames every vehicle on the map. */
  readonly showFitAll = input(false);
  /** Unfolds a button under the zoom buttons that puts the camera back on what the map follows. */
  readonly showRecenter = input(false);
  readonly zoomIn = output<void>();
  readonly zoomOut = output<void>();
  readonly toggle3D = output<void>();
  readonly resetNorth = output<void>();
  readonly geolocate = output<void>();
  readonly fullscreenToggle = output<void>();
  readonly fitAll = output<void>();
  readonly recenter = output<void>();
  protected readonly is3D = signal(false);
  protected readonly isLocating = signal(false);
  protected readonly bearing = signal(0);
  protected readonly rotated = computed(() => Math.abs(this.bearing()) > 0.5);

  constructor() {
    const zone = inject(NgZone);
    // Listening here rather than in each map keeps the per-frame rotate events to
    // this small view instead of re-rendering the page around the map.
    effect((onCleanup) => {
      const map = this.map();
      if (!map) return;
      const update = () => this.bearing.set(map.getBearing());
      update();
      zone.runOutsideAngular(() => map.on('rotate', update));
      onCleanup(() => map.off('rotate', update));
    });
  }

  protected onZoomIn(): void {
    this.zoomIn.emit();
  }

  protected onZoomOut(): void {
    this.zoomOut.emit();
  }

  protected onToggle3D(): void {
    this.is3D.update((value) => !value);
    this.toggle3D.emit();
  }

  protected onResetNorth(): void {
    this.resetNorth.emit();
  }

  protected onFitAll(): void {
    this.fitAll.emit();
  }

  protected onRecenter(): void {
    this.recenter.emit();
  }

  protected onGeolocate(): void {
    if (this.isLocating()) return;
    this.isLocating.set(true);
    this.geolocate.emit();
  }

  onGeolocateDone(): void {
    this.isLocating.set(false);
  }

  protected onFullscreen(): void {
    this.fullscreenToggle.emit();
  }
}
