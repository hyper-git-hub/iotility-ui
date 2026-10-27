import { Component, signal } from '@angular/core';

@Component({
  selector: 'app-settings-page',
  templateUrl: './settings-page.html',
  styleUrl: './settings-page.css',
})
export class SettingsPage {
  // Local UI state only; there is no settings API yet.
  protected readonly emailNotifications = signal(true);
  protected readonly weeklyReports = signal(true);
  protected readonly compactTables = signal(false);
}
