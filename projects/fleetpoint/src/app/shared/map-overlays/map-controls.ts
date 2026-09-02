import { AfterViewInit, Component, ElementRef, OnDestroy, inject, input, output, signal } from '@angular/core';

@Component({
  selector: 'app-map-controls',
  templateUrl: './map-controls.html',
  styleUrl: './map-controls.css',
})
export class MapControls implements AfterViewInit, OnDestroy {
  private readonly element = inject(ElementRef<HTMLElement>);
  private readonly detachTooltips: Array<() => void> = [];
  readonly fullscreen = input(false);
  readonly zoomOnly = input(false);
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
      this.detachTooltips.push(this.attachHoverTooltip(button, label));
    }
  }

  private attachHoverTooltip(host: HTMLElement, text: string): () => void {
    let tooltipEl: HTMLElement | null = null;
    let showTimeout: ReturnType<typeof window.setTimeout> | null = null;
    let hideTimeout: ReturnType<typeof window.setTimeout> | null = null;
    const showDelay = 200;
    const hideDelay = 100;
    const offset = 8;

    const ensureStylesInjected = () => {
      const head = host.ownerDocument?.head;
      if (!head || head.querySelector('#shared-tooltip-styles')) return;
      const styleEl = host.ownerDocument?.createElement('style');
      if (!styleEl) return;
      styleEl.id = 'shared-tooltip-styles';
      styleEl.textContent = `
        .shared-tooltip {
          position: fixed;
          z-index: 2147483000;
          max-width: 260px;
          padding: 2px 14px;
          font-size: 13px;
          line-height: 1.5;
          font-weight: 500;
          letter-spacing: 0.01em;
          border-radius: 8px;
          text-align: center;
          background-color: rgba(255, 255, 255, 0.95);
          -webkit-backdrop-filter: blur(8px) saturate(1.2);
          backdrop-filter: blur(8px) saturate(1.2);
          color: var(--color-ink, #1f2430);
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.06), 0 8px 24px rgba(0, 0, 0, 0.12);
          animation: shared-tooltip-in 0.16s ease-out;
          will-change: transform;
          pointer-events: none;
          box-sizing: border-box;
        }
        .shared-tooltip::before {
          content: '';
          position: absolute;
          inset: -1px;
          border-radius: inherit;
          padding: 1px;
          background: linear-gradient(135deg, #a678ff, #8347f5, #7133dc);
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
        }
        .shared-tooltip-arrow {
          position: absolute;
          width: 10px;
          height: 10px;
          background-color: inherit;
          transform: rotate(45deg);
          border-color: transparent;
          border-style: solid;
          border-width: 1px;
        }
        @keyframes shared-tooltip-in {
          from { opacity: 0; transform: translateY(2px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        :where(.dark) .shared-tooltip {
          background-color: rgba(30, 34, 48, 0.92);
          color: #f5f6fa;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3), 0 8px 24px rgba(0, 0, 0, 0.45);
        }
      `;
      head.appendChild(styleEl);
    };

    const createTooltip = () => {
      const tooltip = host.ownerDocument?.createElement('div');
      if (!tooltip) return;
      tooltip.className = 'shared-tooltip';
      const content = host.ownerDocument?.createElement('span');
      if (content) {
        content.className = 'shared-tooltip-content';
        content.textContent = text;
        tooltip.appendChild(content);
      }
      const arrow = host.ownerDocument?.createElement('div');
      if (arrow) {
        arrow.className = 'shared-tooltip-arrow';
        tooltip.appendChild(arrow);
      }
      host.ownerDocument?.body.appendChild(tooltip);
      tooltipEl = tooltip;
    };

    const positionTooltip = () => {
      if (!tooltipEl || !host) return;
      const hostRect = host.getBoundingClientRect();
      const tooltipRect = tooltipEl.getBoundingClientRect();
      const arrow = tooltipEl.querySelector('.shared-tooltip-arrow') as HTMLElement | null;
      let top = hostRect.top + (hostRect.height - tooltipRect.height) / 2;
      let left = hostRect.left - tooltipRect.width - offset;
      if (arrow) {
        arrow.style.top = `${hostRect.top + hostRect.height / 2 - top - 5}px`;
        arrow.style.right = '-5px';
        arrow.style.borderTopColor = '#a678ff';
        arrow.style.borderRightColor = '#7133dc';
      }
      left = Math.max(4, Math.min(left, window.innerWidth - tooltipRect.width - 4));
      top = Math.max(4, Math.min(top, window.innerHeight - tooltipRect.height - 4));
      tooltipEl.style.top = `${top}px`;
      tooltipEl.style.left = `${left}px`;
    };

    const show = () => {
      if (!text || tooltipEl) return;
      ensureStylesInjected();
      createTooltip();
      positionTooltip();
    };

    const hide = () => {
      if (!tooltipEl) return;
      tooltipEl.remove();
      tooltipEl = null;
    };

    const scheduleShow = () => {
      if (hideTimeout !== null) {
        clearTimeout(hideTimeout);
        hideTimeout = null;
      }
      if (showTimeout === null) {
        showTimeout = setTimeout(() => {
          show();
          showTimeout = null;
        }, showDelay);
      }
    };

    const scheduleHide = () => {
      if (showTimeout !== null) {
        clearTimeout(showTimeout);
        showTimeout = null;
      }
      if (hideTimeout === null) {
        hideTimeout = setTimeout(() => {
          hide();
          hideTimeout = null;
        }, hideDelay);
      }
    };

    host.addEventListener('mouseenter', scheduleShow);
    host.addEventListener('mouseleave', scheduleHide);

    return () => {
      host.removeEventListener('mouseenter', scheduleShow);
      host.removeEventListener('mouseleave', scheduleHide);
      if (showTimeout !== null) clearTimeout(showTimeout);
      if (hideTimeout !== null) clearTimeout(hideTimeout);
      hide();
    };
  }

  ngOnDestroy(): void {
    for (const detach of this.detachTooltips) detach();
    this.detachTooltips.length = 0;
  }
}
