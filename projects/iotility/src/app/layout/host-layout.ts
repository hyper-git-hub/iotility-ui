import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Header } from './header/header';
import { Sidebar } from './sidebar/sidebar';

@Component({
  selector: 'app-host-layout',
  imports: [Header, RouterOutlet, Sidebar],
  templateUrl: './host-layout.html',
})
export class HostLayout {}
