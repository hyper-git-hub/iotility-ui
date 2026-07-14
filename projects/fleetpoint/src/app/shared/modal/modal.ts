import { Component, HostListener, OnDestroy, effect, input, output, signal } from '@angular/core';

@Component({
  selector: 'app-modal',
  templateUrl: './modal.html',
  styleUrl: './modal.css',
})
export class Modal implements OnDestroy {
  readonly open = input(false);
  readonly labelledBy = input('modal-title');
  readonly size = input<'sm' | 'md' | 'lg' | 'xl'>('md');
  readonly closed = output<void>();
  protected readonly rendered = signal(false);
  protected readonly closing = signal(false);
  private closeTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    effect(() => {
      if (this.open()) {
        this.clearCloseTimer();
        this.closing.set(false);
        this.rendered.set(true);
      } else if (this.rendered() && !this.closing()) {
        this.closing.set(true);
        this.closeTimer = setTimeout(() => {
          this.rendered.set(false);
          this.closing.set(false);
        }, 300);
      }
    });
  }

  protected closeFromBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.closed.emit();
  }

  @HostListener('document:keydown.escape')
  protected closeFromKeyboard(): void {
    if (this.open()) this.closed.emit();
  }

  private clearCloseTimer(): void {
    if (this.closeTimer) clearTimeout(this.closeTimer);
    this.closeTimer = undefined;
  }

  ngOnDestroy(): void {
    this.clearCloseTimer();
  }
}
