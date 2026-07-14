import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { LoadingService } from '../../shared/services/loading.service';

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css',
})
export class Sidebar {
  constructor(private readonly loading: LoadingService) {}

  protected openFleetPoint(): void {
    this.loading.navigate(
      '/fleetpoint/dashboard',
      {
        label: 'IoTility',
        title: 'Loading FleetPoint',
        message: 'Preparing your fleet command center…',
        initials: 'FP',
      },
      3000,
    );
  }
}
