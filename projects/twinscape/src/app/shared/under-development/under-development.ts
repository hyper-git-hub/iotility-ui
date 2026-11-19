import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Logo } from '@iotility/shared-ui';

@Component({
  selector: 'app-under-development',
  imports: [Logo],
  templateUrl: './under-development.html',
  styleUrl: './under-development.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UnderDevelopment {
  readonly appName = input.required<string>();
  readonly description = input('');
  readonly logo = input('');
  readonly back = output<void>();
}
