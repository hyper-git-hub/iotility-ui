import { Component, computed, input } from '@angular/core';

@Component({
  selector: 'ui-logo',
  templateUrl: './logo.html',
  styleUrl: './logo.css',
})
export class Logo {
  readonly src = input<string>('');
  readonly alt = input<string>('');
  readonly size = input<string | null>(null);
  readonly width = input<string | null>(null);
  readonly height = input<string | null>(null);

  protected readonly style = computed(() => {
    const size = this.size();
    // If only `size` is given, use it as the height (keeps aspect ratio via width:auto)
    const height = this.height() ?? size ?? '1.5rem';
    const width = this.width();
    const style: Record<string, string> = { height };
    if (width) style['width'] = width;
    return style;
  });
}
