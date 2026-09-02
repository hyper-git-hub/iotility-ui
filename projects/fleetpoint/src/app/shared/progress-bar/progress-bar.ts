import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-progress-bar',
  standalone: true,
  template: `
    <div
      class="progress-bar"
      [class.shimmer]="shimmer()"
      [attr.aria-label]="label()"
      role="progressbar"
      [attr.aria-busy]="true"
    >
      <i></i>
      @if (label()) {
        <span>{{ label() }}…</span>
      }
    </div>
  `,
  styleUrl: './progress-bar.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProgressBar {
  /** Accessible label shown in `aria-label` and (if non-empty) as a pill over the bar. */
  readonly label = input<string | undefined>(undefined);

  /** When true, shows the shimmer variant (label + bar top-left). */
  readonly shimmer = input(false);
}

