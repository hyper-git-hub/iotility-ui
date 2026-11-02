import { Component, computed, inject } from '@angular/core';
import { BarChart, ChartCard, ChartSeries, ChartSlice, ChartTheme, DonutChart, LineChart } from '@iotility/shared-ui';
import { CATEGORY_LABELS, DashcamCategory, NOT_AVAILABLE } from '../dashcam.data';
import { DashcamStore } from '../dashcam.store';

const DAY_MS = 24 * 60 * 60 * 1000;

@Component({
  selector: 'app-dashcam-analytics',
  imports: [BarChart, ChartCard, DonutChart, LineChart],
  templateUrl: './dashcam-analytics.html',
  styleUrl: './dashcam-analytics.css',
})
export class DashcamAnalytics {
  private readonly store = inject(DashcamStore);
  private readonly palette = inject(ChartTheme).palette();
  protected readonly categoryColors: Record<DashcamCategory, string> = {
    'safety-critical': this.palette.danger,
    fatigue: '#ea580c',
    distraction: this.palette.warning,
    'driving-style': '#2563eb',
    identity: this.palette.brand,
    camera: '#6b7280',
  };
  protected readonly categories = computed(() =>
    (Object.entries(CATEGORY_LABELS) as [DashcamCategory, string][])
      .map(([id, label]) => ({
        id,
        label,
        value: this.store.events().filter((event) => event.category === id).length,
        color: this.categoryColors[id],
      }))
      .filter((item) => item.value),
  );
  protected readonly slices = computed<ChartSlice[]>(() =>
    this.categories().map((item) => ({ label: item.label, value: item.value, color: item.color })),
  );
  /** Top five drivers by event count; severity isn't sent, so there is no critical series. */
  private readonly driverCounts = computed(() => {
    const counts = new Map<string, number>();
    for (const event of this.store.events()) {
      if (event.driver !== NOT_AVAILABLE) counts.set(event.driver, (counts.get(event.driver) ?? 0) + 1);
    }
    return [...counts].sort((a, b) => b[1] - a[1]).slice(0, 5);
  });
  protected readonly drivers = computed(() => this.driverCounts().map(([name]) => name.split(/\s+/)[0]));
  protected readonly driverSeries = computed<ChartSeries[]>(() => [
    { name: 'Total Events', data: this.driverCounts().map(([, count]) => count), color: this.palette.brand },
  ]);
  /** The last seven days, oldest first, ending today. */
  private readonly week = computed(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, index) => new Date(today.getTime() - (6 - index) * DAY_MS));
  });
  protected readonly days = computed(() =>
    this.week().map((day) => day.toLocaleDateString('en-GB', { weekday: 'short' })),
  );
  protected readonly trendSeries = computed<ChartSeries[]>(() => {
    const starts = this.week().map((day) => day.getTime());
    const data = starts.map(
      (start) => this.store.events().filter((event) => event.time !== null && event.time >= start && event.time < start + DAY_MS).length,
    );
    return [{ name: 'Total Events', data, color: this.palette.brand }];
  });
  /** The API has no review state for DashCam events. */
  protected readonly falsePositiveRate = NOT_AVAILABLE;
}
