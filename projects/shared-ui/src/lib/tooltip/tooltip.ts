import { DOCUMENT } from '@angular/common';
import {
  Directive,
  ElementRef,
  HostListener,
  Renderer2,
  inject,
  input,
  OnDestroy,
} from '@angular/core';

const TOOLTIP_STYLES_ID = 'shared-tooltip-styles';

const TOOLTIP_STYLES = `
  .shared-tooltip {
    position: fixed;
    z-index: 2147483000;
    max-width: 260px;
    padding: 2px 14px;
    font-size: 13px;
    line-height: 1.5;
    font-weight: 500;
    letter-spacing: 0.01em;
    border-radius: 10px;
    text-align: center;
    background-color: rgba(255, 255, 255, 0.95);
    -webkit-backdrop-filter: blur(8px) saturate(1.2);
    backdrop-filter: blur(8px) saturate(1.2);
    color: var(--color-ink, #1f2430);
    box-shadow:
      0 2px 4px rgba(0, 0, 0, 0.06),
      0 8px 24px rgba(0, 0, 0, 0.12);
    animation: shared-tooltip-in 0.16s ease-out;
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
    -webkit-mask:
      linear-gradient(#fff 0 0) content-box,
      linear-gradient(#fff 0 0);
    mask:
      linear-gradient(#fff 0 0) content-box,
      linear-gradient(#fff 0 0);
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
    box-shadow: inherit;
    border-color: transparent;
    border-style: solid;
    border-width: 1px;
  }
  @keyframes shared-tooltip-in {
    from {
      opacity: 0;
      transform: translateY(2px) scale(0.96);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
  :where(.dark) .shared-tooltip {
    background-color: rgba(30, 34, 48, 0.92);
    color: #f5f6fa;
    box-shadow:
      0 2px 4px rgba(0, 0, 0, 0.3),
      0 8px 24px rgba(0, 0, 0, 0.45);
  }
`;

@Directive({
  selector: '[tooltip]',
  standalone: true,
})
export class Tooltip implements OnDestroy {
  readonly tooltip = input<string>('');
  readonly position = input<'top' | 'bottom' | 'left' | 'right'>('top');
  readonly disabled = input(false);

  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly renderer = inject(Renderer2);
  private readonly document = inject(DOCUMENT);

  private tooltipEl: HTMLElement | null = null;
  private showTimeout: ReturnType<typeof window.setTimeout> | null = null;
  private hideTimeout: ReturnType<typeof window.setTimeout> | null = null;
  private readonly showDelay = 200;
  private readonly hideDelay = 100;
  private readonly offset = 8;

  private ensureStylesInjected(): void {
    const head = this.document.head;
    if (!head) return;
    if (head.querySelector(`#${TOOLTIP_STYLES_ID}`)) return;
    const styleEl = this.renderer.createElement('style');
    styleEl.id = TOOLTIP_STYLES_ID;
    styleEl.textContent = TOOLTIP_STYLES;
    this.renderer.appendChild(head, styleEl);
  }

  @HostListener('mouseenter')
  protected onMouseEnter(): void {
    this.scheduleShow();
  }

  @HostListener('mouseleave')
  protected onMouseLeave(): void {
    this.scheduleHide();
  }

  @HostListener('focus')
  protected onFocus(): void {
    this.scheduleShow();
  }

  @HostListener('blur')
  protected onBlur(): void {
    this.scheduleHide();
  }

  private scheduleShow(): void {
    if (this.disabled() || !this.tooltip()) return;
    if (this.hideTimeout !== null) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }
    if (this.showTimeout === null) {
      this.showTimeout = setTimeout(() => {
        this.show();
        this.showTimeout = null;
      }, this.showDelay);
    }
  }

  private scheduleHide(): void {
    if (this.showTimeout !== null) {
      clearTimeout(this.showTimeout);
      this.showTimeout = null;
    }
    if (this.hideTimeout === null) {
      this.hideTimeout = setTimeout(() => {
        this.hide();
        this.hideTimeout = null;
      }, this.hideDelay);
    }
  }

  private show(): void {
    if (!this.tooltip() || this.tooltipEl) return;
this.ensureStylesInjected();
    this.createTooltip();
    this.positionTooltip();
  }

  private hide(): void {
    if (!this.tooltipEl) return;
    this.removeTooltip();
  }

  private createTooltip(): void {
    const tooltip = this.renderer.createElement('div');
    this.renderer.addClass(tooltip, 'shared-tooltip');

    const content = this.renderer.createElement('span');
    this.renderer.addClass(content, 'shared-tooltip-content');
    this.renderer.appendChild(content, this.renderer.createText(this.tooltip()));
    this.renderer.appendChild(tooltip, content);

    const arrow = this.renderer.createElement('div');
    this.renderer.addClass(arrow, 'shared-tooltip-arrow');
    this.renderer.appendChild(tooltip, arrow);

    this.renderer.appendChild(this.document.body, tooltip);
    this.tooltipEl = tooltip;
  }

private positionTooltip(): void {
    if (!this.tooltipEl) return;

    const hostRect = this.el.nativeElement.getBoundingClientRect();
    const tooltipRect = this.tooltipEl.getBoundingClientRect();
    const pos = this.position();
    const arrow = this.tooltipEl.querySelector('.shared-tooltip-arrow') as HTMLElement;

    let top = 0;
    let left = 0;

    switch (pos) {
      case 'bottom':
        top = hostRect.bottom + this.offset;
        left = hostRect.left + (hostRect.width - tooltipRect.width) / 2;
        if (arrow) {
          arrow.style.top = '-5px';
          arrow.style.left = `${hostRect.left + hostRect.width / 2 - left - 5}px`;
          arrow.style.borderTopColor = '#a678ff';
          arrow.style.borderLeftColor = '#7133dc';
        }
        break;
      case 'left':
        top = hostRect.top + (hostRect.height - tooltipRect.height) / 2;
        left = hostRect.left - tooltipRect.width - this.offset;
        if (arrow) {
          arrow.style.top = `${hostRect.top + hostRect.height / 2 - top - 5}px`;
          arrow.style.right = '-5px';
          arrow.style.borderTopColor = '#a678ff';
          arrow.style.borderRightColor = '#7133dc';
        }
        break;
      case 'right':
        top = hostRect.top + (hostRect.height - tooltipRect.height) / 2;
        left = hostRect.right + this.offset;
        if (arrow) {
          arrow.style.top = `${hostRect.top + hostRect.height / 2 - top - 5}px`;
          arrow.style.left = '-5px';
          arrow.style.borderBottomColor = '#a678ff';
          arrow.style.borderLeftColor = '#7133dc';
        }
        break;
      case 'top':
      default:
        top = hostRect.top - tooltipRect.height - this.offset;
        left = hostRect.left + (hostRect.width - tooltipRect.width) / 2;
        if (arrow) {
          arrow.style.bottom = '-5px';
          arrow.style.left = `${hostRect.left + hostRect.width / 2 - left - 5}px`;
          arrow.style.borderBottomColor = '#a678ff';
          arrow.style.borderRightColor = '#7133dc';
        }
        break;
    }

    left = Math.max(
      4,
      Math.min(left, window.innerWidth - tooltipRect.width - 4),
    );
    top = Math.max(
      4,
      Math.min(top, window.innerHeight - tooltipRect.height - 4),
    );

    this.renderer.setStyle(this.tooltipEl, 'top', `${top}px`);
    this.renderer.setStyle(this.tooltipEl, 'left', `${left}px`);
  }

  private removeTooltip(): void {
    if (this.tooltipEl) {
      this.renderer.removeChild(this.document.body, this.tooltipEl);
      this.tooltipEl = null;
    }
  }

  ngOnDestroy(): void {
    if (this.showTimeout !== null) clearTimeout(this.showTimeout);
    if (this.hideTimeout !== null) clearTimeout(this.hideTimeout);
    this.removeTooltip();
  }
}
