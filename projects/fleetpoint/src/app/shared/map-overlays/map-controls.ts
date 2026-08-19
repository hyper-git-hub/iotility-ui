import { AfterViewInit, Component, ElementRef, OnDestroy, inject, input, output, signal } from '@angular/core';
import { attachTooltip } from '@iotility/shared-ui';

@Component({
  selector: 'app-map-controls',
  templateUrl: './map-controls.html',
  styleUrl: './map-controls.css',
})
export class MapControls implements AfterViewInit, OnDestroy {
  private readonly element = inject(ElementRef<HTMLElement>);
  private readonly detachTooltips: Array<() => void> = [];
  readonly fullscreen = input(false);
  readonly zoomIn = output<void>();
  readonly zoomOut = output<void>();
  readonly toggle3D = output<void>();
  readonly resetNorth = output<void>();
  readonly rotate = output<void>();
  readonly geolocate = output<void>();
  readonly fullscreenToggle = output<void>();
  protected readonly is3D = signal(false);
  protected readonly isLocating = signal(false);

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

  protected onRotate(): void {
    this.rotate.emit();
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

  ngAfterViewInit(): void {
    for (const button of (this.element.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('button.map-btn')) {
      const label = button.title;
      if (!label) continue;
      button.removeAttribute('title');
      this.detachTooltips.push(attachTooltip(button, label, 'left'));
    }
  }

  ngOnDestroy(): void {
    for (const detach of this.detachTooltips) detach();
    this.detachTooltips.length = 0;
  }
}
