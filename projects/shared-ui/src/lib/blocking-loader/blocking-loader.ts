import { Component, input } from '@angular/core';

@Component({
  selector: 'ui-blocking-loader',
  templateUrl: './blocking-loader.html',
  styleUrl: './blocking-loader.css',
})
export class BlockingLoader {
  readonly visible = input(false);
  readonly label = input('Loading');
  readonly message = input('Please wait while we process your request.');
}
