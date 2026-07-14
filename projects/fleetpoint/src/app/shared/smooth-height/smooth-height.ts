import { AfterViewInit, Component, ElementRef, OnDestroy, signal, viewChild } from '@angular/core';

@Component({
  selector: 'app-smooth-height',
  templateUrl: './smooth-height.html',
  styleUrl: './smooth-height.css',
})
export class SmoothHeight implements AfterViewInit, OnDestroy {
  private readonly content = viewChild.required<ElementRef<HTMLElement>>('content');
  protected readonly height = signal<number | null>(null);
  protected readonly ready = signal(false);
  private observer?: ResizeObserver;

  ngAfterViewInit(): void {
    const content = this.content().nativeElement;
    this.height.set(content.getBoundingClientRect().height);
    this.observer = new ResizeObserver(([entry]) => {
      this.height.set(entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height);
    });
    this.observer.observe(content);
    requestAnimationFrame(() => this.ready.set(true));
  }

  ngOnDestroy(): void { this.observer?.disconnect(); }
}
