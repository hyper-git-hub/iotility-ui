import { Component, input } from '@angular/core';

@Component({
  selector: 'app-loading',
  templateUrl: './loading.html',
  styleUrl: './loading.css',
})
export class Loading {
  readonly label = input('IoTility');
  readonly title = input('Loading');
  readonly message = input('Preparing your experience…');
  readonly initials = input('io');
  readonly logoSrc = input<string | null>(null);
  readonly labelLogoSrc = input<string | null>(null);
}
