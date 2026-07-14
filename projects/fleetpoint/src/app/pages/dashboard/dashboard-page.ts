import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-dashboard-page',
  imports: [RouterOutlet],
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-shell.css',
})
export class DashboardPage {
  protected readonly tabs = [
    { label: 'Overview', path: 'overview', exact: false },
    // { label: 'Safety', path: 'safety', exact: false },
    // { label: 'Maintenance', path: 'maintenance', exact: false },
    // { label: 'Jobs', path: 'jobs', exact: false },
    // { label: 'Reports', path: 'reports', exact: false },
  ];
}
