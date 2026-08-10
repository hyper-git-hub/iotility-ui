import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-dashboard-page',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-shell.css',
})
export class DashboardPage {
  protected readonly todayLabel = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  protected readonly tabs = [
    { label: 'Overview', path: 'overview', exact: true },
    { label: 'Safety', path: 'safety', exact: true },
    { label: 'Maintenance', path: 'maintenance', exact: true },
    { label: 'Jobs', path: 'jobs', exact: true },
    { label: 'Reports', path: 'reports', exact: true },
  ];
}
