import { Component, inject } from '@angular/core';
import { BarChart, ChartCard, ChartSeries, ChartSlice, ChartTheme, DonutChart, LineChart } from '@iotility/shared-ui';
import { CATEGORY_LABELS, DASHCAM_EVENTS, DashcamCategory } from '../dashcam.data';

@Component({
  selector: 'app-dashcam-analytics',
  imports: [BarChart, ChartCard, DonutChart, LineChart],
  templateUrl: './dashcam-analytics.html',
  styleUrl: './dashcam-analytics.css',
})
export class DashcamAnalytics {
  private readonly palette = inject(ChartTheme).palette();
  protected readonly categoryColors: Record<DashcamCategory, string> = {
    'safety-critical': this.palette.danger,
    fatigue: '#ea580c',
    distraction: this.palette.warning,
    'driving-style': '#2563eb',
    identity: this.palette.brand,
    camera: '#6b7280',
  };
  protected readonly categories = (Object.entries(CATEGORY_LABELS) as [DashcamCategory, string][])
    .map(([id, label]) => ({
      id,
      label,
      value: DASHCAM_EVENTS.filter((event) => event.category === id).length,
      color: this.categoryColors[id],
    }))
    .filter((item) => item.value);
  protected readonly slices: ChartSlice[] = this.categories.map((item) => ({ label: item.label, value: item.value, color: item.color }));
  protected readonly drivers = ['Mohammed', 'Connor', 'Aisha', 'Oliver', 'James'];
  protected readonly driverSeries: ChartSeries[] = [
    { name: 'Total Events', data: [2, 2, 2, 1, 1], color: this.palette.brand },
    { name: 'Critical', data: [2, 1, 0, 1, 0], color: this.palette.danger },
  ];
  protected readonly days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  protected readonly trendSeries: ChartSeries[] = [
    { name: 'Total Events', data: [4, 7, 3, 8, 6, 2, DASHCAM_EVENTS.length], color: this.palette.brand },
    { name: 'Critical', data: [1, 3, 1, 2, 2, 0, 4], color: this.palette.danger },
  ];
  protected readonly falsePositiveRate = Math.round(
    (DASHCAM_EVENTS.filter((event) => event.review === 'False Positive').length /
      DASHCAM_EVENTS.length) *
      100,
  );
}
