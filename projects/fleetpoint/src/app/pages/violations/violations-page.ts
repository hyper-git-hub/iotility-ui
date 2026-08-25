import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Subscription } from 'rxjs';
import { StatCard } from '../../shared/stat-card/stat-card';
import { ManualViolationForm } from './manual-violation-form/manual-violation-form';
import {
  ViolationsApiService,
  ViolationRecord,
  ViolationFilters,
} from '../../shared/services/violations-api.service';

const DEFAULT_FILTERS: ViolationFilters = {
  offset: 0,
  limit: 1000,
  order_by: '',
  order: '',
  search_text: '',
  violation_type: '',
  driver_id: '',
  start_datetime: '',
  end_datetime: '',
  time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  group: '0',
};

@Component({
  selector: 'app-violations-page',
  imports: [ManualViolationForm, RouterLink, RouterLinkActive, RouterOutlet, StatCard],
  templateUrl: './violations-page.html',
  styleUrl: './violations-page.css',
})
export class ViolationsPage implements OnInit, OnDestroy {
  protected readonly manualViolationOpen = signal(false);
  protected readonly total = signal(0);
  protected readonly critical = signal(0);
  protected readonly pending = signal(0);
  protected readonly finesPending = signal(0);
  protected readonly totalFines = signal('£0');
  protected readonly scoreImpact = signal(0);
  protected readonly violations = signal<ViolationRecord[]>([]);
  protected readonly loading = signal(true);
  private readonly subscription = new Subscription();

  constructor(private readonly api: ViolationsApiService) {}

  ngOnInit(): void {
    this.loadViolations();
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  private loadViolations(): void {
    this.loading.set(true);
    this.subscription.add(
      this.api.getViolations(DEFAULT_FILTERS).subscribe({
        next: (response: { data?: { count: number; data: ViolationRecord[] } }) => {
          const data = response.data?.data ?? [];
          this.violations.set(data);
          this.total.set(response.data?.count ?? data.length);
          this.critical.set(
            data.filter((v: ViolationRecord) => v.speed > v.speed_threshold * 1.25 && v.speed_threshold > 0).length,
          );
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
        },
      }),
    );
  }
}
