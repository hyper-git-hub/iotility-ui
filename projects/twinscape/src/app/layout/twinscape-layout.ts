import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TwinscapeHeader } from './header/twinscape-header';

@Component({
  selector: 'app-twinscape-layout',
  imports: [RouterOutlet, TwinscapeHeader],
  templateUrl: './twinscape-layout.html',
  styleUrl: './twinscape-layout.css',
})
export class TwinscapeLayout {}
