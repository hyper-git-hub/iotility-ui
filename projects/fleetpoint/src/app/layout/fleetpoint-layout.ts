import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { FleetpointHeader } from './header/fleetpoint-header';
import { FleetpointSidebar } from './sidebar/fleetpoint-sidebar';

@Component({
  selector: 'app-fleetpoint-layout',
  imports: [FleetpointHeader, FleetpointSidebar, RouterOutlet],
  templateUrl: './fleetpoint-layout.html',
})
export class FleetpointLayout {}
