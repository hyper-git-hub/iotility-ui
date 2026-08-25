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
  limit: 20,
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
  // Static fallbacks until review, fine, and score fields are provided by the endpoint.
  protected readonly pending = signal(5);
  protected readonly finesPending = signal(2);
  protected readonly totalFines = signal('£1,300');
  protected readonly scoreImpact = signal(-130);
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
            data.filter((violation: ViolationRecord) => {
              const speed = Number(violation.speed) || 0;
              const threshold = Number(violation.threshold ?? violation.speed_threshold) || 0;
              return threshold > 0 && speed > threshold * 1.25;
            }).length,
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
