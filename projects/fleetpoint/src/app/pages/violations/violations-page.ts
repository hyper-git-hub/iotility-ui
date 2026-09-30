import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Skeleton } from '@iotility/shared-ui';
import { StatCard } from '../../shared/stat-card/stat-card';
import { ManualViolationForm } from './manual-violation-form/manual-violation-form';
import { ViolationsApiService } from '../../shared/services/violations-api.service';

@Component({
  selector: 'app-violations-page',
  imports: [ManualViolationForm, RouterLink, RouterLinkActive, RouterOutlet, Skeleton, StatCard],
  templateUrl: './violations-page.html',
  styleUrl: './violations-page.css',
})
export class ViolationsPage {
  private readonly api = inject(ViolationsApiService);
  protected readonly summary = this.api.pageSummary;
  // True while the All Violations list re-fetches for a date-range/filter change;
  // only the card values become skeletons, all page text stays visible.
  protected readonly summaryLoading = this.api.pageSummaryLoading;
  protected readonly manualViolationOpen = signal(false);
}
