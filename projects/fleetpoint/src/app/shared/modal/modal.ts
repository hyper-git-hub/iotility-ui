import { Component, ElementRef, HostListener, Injector, OnDestroy, afterNextRender, effect, inject, input, output, signal, untracked } from '@angular/core';

/** Elements that animate as one block; everything else is walked into to find its parts. */
const BUILD_LEAF = 'label, button, input, textarea, select, p, h1, h2, h3, h4, small, img, svg, canvas, fieldset, .shared-form-field';
/** Custom elements the walk passes through (pure wrappers); any other custom element builds as one block. */
const BUILD_WRAPPERS = new Set(['SHARED-SMOOTH-HEIGHT']);
const BUILD_MAX_DEPTH = 4;
const FOCUSABLE_FIELD = 'input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=file]):not([disabled]), textarea:not([disabled])';
const EASE = 'cubic-bezier(0.32, 0.72, 0, 1)'; // --ease-dialog
const EASE_OUT = 'cubic-bezier(0.4, 0, 1, 1)'; // --ease-dialog-out

/**
 * Open: the backdrop dims, the panel rises in, the body unfolds and the first few fields build in, then the rest.
 * Quick forms settle in ~300ms, step wizards (a step rail) in ~450ms. Typing works from the first frame.
 */
const QUICK = { backdrop: 150, panel: 220, unfoldAt: 40, unfold: 200, buildAt: 110, build: 240, stagger: 22, staggered: 6 };
const WIZARD = { backdrop: 160, panel: 240, unfoldAt: 50, unfold: 260, buildAt: 150, build: 280, stagger: 28, staggered: 8 };
/** Close is quicker than open: the panel simply drops away. */
const CLOSE = { panel: 170, backdrop: 200 };

@Component({
  selector: 'app-modal',
  templateUrl: './modal.html',
  styleUrl: './modal.css',
})
export class Modal implements OnDestroy {
  readonly open = input(false);
  readonly labelledBy = input('modal-title');
  readonly size = input<'sm' | 'md' | 'lg' | 'xl'>('md');
  readonly busy = input(false);
  readonly closed = output<void>();
  protected readonly rendered = signal(false);
  /** Closed by collapse() but kept alive until the page drops it. */
  protected readonly collapsed = signal(false);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private running: Animation[] = [];
  private collapsing?: Promise<void>;
  private nudgeTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    effect(() => {
      const open = this.open();
      untracked(() => {
        if (open) {
          if (!this.rendered()) {
            this.rendered.set(true);
            afterNextRender(() => void this.expand(), { injector: this.injector });
          } else if (this.collapsed() || this.collapsing) {
            void this.expand();
          }
        } else if (this.rendered()) {
          void this.collapse().then(() => {
            if (!this.open()) {
              this.rendered.set(false);
              this.collapsed.set(false);
            }
          });
        }
      });
    });
  }

  protected closeFromBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.closed.emit();
  }

  @HostListener('document:keydown.escape')
  protected closeFromKeyboard(): void {
    if (this.open() && !this.collapsed()) this.closed.emit();
  }

  /** Submit or Next pressed: if validation messages are showing, bring the first one into view and nudge it. */
  @HostListener('submit')
  @HostListener('click', ['$event'])
  protected checkValidation(event?: Event): void {
    const button = (event?.target as HTMLElement | null)?.closest?.('.modal-footer button') as HTMLButtonElement | null;
    if (event?.type === 'click' && !(button && (button.type === 'submit' || /next/i.test(button.textContent ?? '')))) return;
    clearTimeout(this.nudgeTimer);
    // Wait a beat for the form to render its messages.
    this.nudgeTimer = setTimeout(() => this.nudgeFirstInvalid(), 60);
  }

  /** Opens (also reopens a collapsed dialog). */
  expand(): Promise<void> {
    this.collapsing = undefined;
    this.stop();
    this.collapsed.set(false);
    const parts = this.parts();
    if (!parts) return Promise.resolve();
    const { backdrop, panel, content, footer } = parts;
    backdrop.classList.remove('modal-collapsed');
    this.focusFirstField(content);
    if (this.reducedMotion()) {
      this.play(backdrop, [{ opacity: 0 }, { opacity: 1 }], { duration: 160 });
      return this.finished(this.play(panel, [{ opacity: 0 }, { opacity: 1 }], { duration: 160 }));
    }
    const wizard = !!content?.querySelector('app-stepper');
    const t = wizard ? WIZARD : QUICK;
    const rise = (distance: number): Keyframe[] => [{ opacity: 0, transform: `translateY(${distance}px)` }, { opacity: 1, transform: 'none' }];

    this.play(backdrop, [{ opacity: 0 }, { opacity: 1 }], { duration: t.backdrop, easing: 'ease-out' });
    const panelIn = this.play(panel, [{ opacity: 0, transform: 'translateY(8px) scale(0.98)' }, { opacity: 1, transform: 'none' }], { duration: t.panel });
    if (content) {
      const style = getComputedStyle(content);
      const height = content.getBoundingClientRect().height;
      this.play(
        content,
        [
          { height: `${Math.round(height * 0.6)}px`, paddingTop: style.paddingTop, paddingBottom: style.paddingBottom, overflow: 'hidden' },
          { height: `${height}px`, paddingTop: style.paddingTop, paddingBottom: style.paddingBottom, overflow: 'hidden' },
        ],
        { duration: t.unfold, delay: t.unfoldAt },
      );
      // The first few blocks build in one after another; the rest arrive together with the last of them.
      this.buildItems(content, 0).forEach((item, index) =>
        this.play(item, rise(6), { duration: t.build, delay: t.buildAt + Math.min(index, t.staggered) * t.stagger }),
      );
    }
    if (footer) this.play(footer, rise(4), { duration: t.build, delay: t.buildAt + t.staggered * t.stagger });
    return this.finished(panelIn);
  }

  /** Closes quickly and leaves the dialog hidden but alive. Safe to call twice. */
  collapse(): Promise<void> {
    if (!this.rendered() || this.collapsed()) return Promise.resolve();
    if (this.collapsing) return this.collapsing;
    const parts = this.parts();
    if (!parts) return Promise.resolve();
    const { backdrop, panel } = parts;
    this.stop();
    const reduce = this.reducedMotion();
    this.play(panel, reduce ? [{ opacity: 1 }, { opacity: 0 }] : [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(6px) scale(0.985)' }], {
      duration: CLOSE.panel,
      easing: EASE_OUT,
      fill: 'forwards',
    });
    const end = this.play(backdrop, [{ opacity: 1 }, { opacity: 0 }], { duration: CLOSE.backdrop, easing: 'ease-out', fill: 'forwards' });
    return (this.collapsing = this.finished(end).then(() => {
      // Hide in the same frame the fill-forwards animations are dropped, so nothing flashes back.
      backdrop.classList.add('modal-collapsed');
      this.collapsed.set(true);
      this.collapsing = undefined;
      this.stop();
    }));
  }

  private nudgeFirstInvalid(): void {
    const content = this.parts()?.content;
    const message = Array.from(content?.querySelectorAll<HTMLElement>('.shared-form-error') ?? []).find((element) => element.getClientRects().length);
    if (!message) return;
    const field = (message.closest('.shared-form-field, label, fieldset') as HTMLElement | null) ?? message.parentElement ?? message;
    field.scrollIntoView({ block: 'nearest', behavior: this.reducedMotion() ? 'auto' : 'smooth' });
    field.querySelector<HTMLElement>(FOCUSABLE_FIELD)?.focus({ preventScroll: true });
    if (this.reducedMotion()) return;
    field.animate(
      [{ transform: 'none' }, { transform: 'translateX(-5px)' }, { transform: 'translateX(5px)' }, { transform: 'translateX(-3px)' }, { transform: 'translateX(3px)' }, { transform: 'none' }],
      { duration: 320, easing: 'ease-out' },
    );
  }

  private focusFirstField(content: HTMLElement | null): void {
    const field = content?.querySelector<HTMLElement>(FOCUSABLE_FIELD);
    if (field && !field.closest('[readonly]')) field.focus({ preventScroll: true });
  }

  private parts() {
    const root = this.host.nativeElement;
    const backdrop = root.querySelector<HTMLElement>('.modal-backdrop');
    const panel = root.querySelector<HTMLElement>('.modal-panel');
    if (!backdrop || !panel || typeof panel.animate !== 'function') return null;
    return {
      backdrop,
      panel,
      content: panel.querySelector<HTMLElement>('.modal-content'),
      footer: panel.querySelector<HTMLElement>('.modal-footer'),
    };
  }

  private play(element: HTMLElement, keyframes: Keyframe[], options: KeyframeAnimationOptions): Animation {
    const animation = element.animate(keyframes, { easing: EASE, fill: 'backwards', ...options });
    this.running.push(animation);
    return animation;
  }

  private finished(animation: Animation | undefined): Promise<void> {
    return animation ? animation.finished.then(() => undefined, () => undefined) : Promise.resolve();
  }

  private stop(): void {
    this.running.forEach((animation) => animation.cancel());
    this.running = [];
  }

  private reducedMotion(): boolean {
    return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  }

  /** Walks layout containers down to their blocks: a grid/flex row of fields yields each field. */
  private buildItems(element: HTMLElement, depth: number): HTMLElement[] {
    const children = Array.from(element.children).filter(
      (child): child is HTMLElement => child instanceof HTMLElement && child.getClientRects().length > 0,
    );
    if (!children.length) return depth ? [element] : [];
    return children.flatMap((child) => {
      const custom = child.tagName.includes('-') && !BUILD_WRAPPERS.has(child.tagName);
      if (depth >= BUILD_MAX_DEPTH || custom || child.matches(BUILD_LEAF)) return [child];
      const display = getComputedStyle(child).display;
      const container = child.children.length > 1 && /grid|flex/.test(display);
      const wrapper = child.children.length === 1;
      return container || wrapper ? this.buildItems(child, depth + 1) : [child];
    });
  }

  ngOnDestroy(): void {
    clearTimeout(this.nudgeTimer);
    this.stop();
  }
}
