import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { StatCard } from '../../shared/stat-card/stat-card';
import { ManualViolationForm } from './manual-violation-form/manual-violation-form';
import { ViolationsApiService } from '../../shared/services/violations-api.service';

@Component({
  selector: 'app-violations-page',
  imports: [ManualViolationForm, RouterLink, RouterLinkActive, RouterOutlet, StatCard],
  templateUrl: './violations-page.html',
  styleUrl: './violations-page.css',
})
export class ViolationsPage {
  private readonly api = inject(ViolationsApiService);
  protected readonly summary = this.api.pageSummary;
  protected readonly manualViolationOpen = signal(false);
}
