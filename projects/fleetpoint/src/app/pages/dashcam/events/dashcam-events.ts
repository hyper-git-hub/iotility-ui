import { Component, computed, signal } from '@angular/core';
import {
  DataTable,
  DataTableCellTemplate,
  FilterBar,
  FilterChangeEvent,
  FilterDropdown,
  TableColumn,
  TableRow,
  Tooltip,
} from '@iotility/shared-ui';
import {
  CATEGORY_LABELS,
  CATEGORY_OPTIONS,
  DASHCAM_EVENTS,
  DashcamCategory,
  DashcamEvent,
  DashcamReview,
  DashcamSeverity,
  REVIEW_OPTIONS,
  SEVERITY_OPTIONS,
} from '../dashcam.data';
import { DashcamVideoTile } from '../video-tile/video-tile';

@Component({
  selector: 'app-dashcam-events',
  imports: [DashcamVideoTile, DataTable, DataTableCellTemplate, FilterBar, Tooltip],
  templateUrl: './dashcam-events.html',
  styleUrl: './dashcam-events.css',
})
export class DashcamEvents {
  protected readonly categoryLabels = CATEGORY_LABELS;
  protected readonly categoryOptions = CATEGORY_OPTIONS;
  protected readonly severityOptions = SEVERITY_OPTIONS;
  protected readonly reviewOptions = REVIEW_OPTIONS;
  protected readonly search = signal('');
  protected readonly category = signal<'all' | DashcamCategory>('all');
  protected readonly severity = signal<'all' | DashcamSeverity>('all');
  protected readonly review = signal<'all' | DashcamReview>('all');
  protected readonly selected = signal<DashcamEvent | null>(null);
  protected readonly columns: TableColumn[] = [
    { key: 'eventType', label: 'Event', type: 'user', secondaryKey: 'id' },
    { key: 'driver', label: 'Driver' },
    { key: 'vehicle', label: 'Vehicle', clickable: true },
    { key: 'categoryLabel', label: 'Category', type: 'status' },
    { key: 'severity', label: 'Severity', type: 'priority' },
    { key: 'time', label: 'Time' },
    { key: 'location', label: 'Location' },
    { key: 'speedLabel', label: 'Speed' },
    { key: 'jobRoute', label: 'Job/Route' },
    { key: 'review', label: 'Status', type: 'status' },
    { key: 'scoreLabel', label: 'Score' },
  ];
  protected readonly filtered = computed(() => {
    const query = this.search().trim().toLowerCase();
    return DASHCAM_EVENTS.filter(
      (event) =>
        (!query ||
          `${event.eventType} ${event.driver} ${event.vehicle} ${event.location}`
            .toLowerCase()
            .includes(query)) &&
        (this.category() === 'all' || event.category === this.category()) &&
        (this.severity() === 'all' || event.severity === this.severity()) &&
        (this.review() === 'all' || event.review === this.review()),
    );
  });
  protected readonly rows = computed<TableRow[]>(() =>
    this.filtered().map((event) => ({
      id: event.id,
      eventType: event.eventType,
      driver: event.driver,
      driverInitials: this.initials(event.driver),
      vehicle: event.vehicle,
      categoryLabel: CATEGORY_LABELS[event.category],
      severity: event.severity,
      time: event.timestamp.split('·').at(-1)?.trim() ?? event.timestamp,
      location: event.location,
      speed: event.speed,
      speedLabel: `${event.speed} km/h`,
      jobRoute: this.jobRoute(event),
      review: event.review,
      score: event.scoreImpact,
      scoreLabel: event.scoreImpact ? String(event.scoreImpact) : '—',
    })),
  );
  protected readonly filterDropdowns = computed<FilterDropdown[]>(() => [
    {
      id: 'category',
      ariaLabel: 'Filter by category',
      options: this.categoryOptions,
      selected: this.category(),
      placeholder: 'All categories',
      width: '12rem',
    },
    {
      id: 'severity',
      ariaLabel: 'Filter by severity',
      options: this.severityOptions,
      selected: this.severity(),
      placeholder: 'All severities',
      width: '12rem',
    },
    {
      id: 'review',
      ariaLabel: 'Filter by review status',
      options: this.reviewOptions,
      selected: this.review(),
      placeholder: 'All reviews',
      width: '12rem',
    },
  ]);
  protected filter(event: FilterChangeEvent): void {
    if (event.id === 'category') this.category.set(event.option.id as 'all' | DashcamCategory);
    if (event.id === 'severity') this.severity.set(event.option.id as 'all' | DashcamSeverity);
    if (event.id === 'review') this.review.set(event.option.id as 'all' | DashcamReview);
    this.selected.set(null);
  }
  protected clearFilters(): void {
    this.search.set('');
    this.category.set('all');
    this.severity.set('all');
    this.review.set('all');
    this.selected.set(null);
  }
  protected selectRow(row: TableRow): void {
    this.selected.set(DASHCAM_EVENTS.find((event) => event.id === row['id']) ?? null);
  }
  protected closeDetails(): void {
    this.selected.set(null);
  }
  protected footage(event: DashcamEvent, camera: string): string {
    return `videos/dashcam/events/${event.id}_${camera.toLowerCase()}.mp4`;
  }
  private initials(name: string): string {
    return name
      .split(/\s+/)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }
  private jobRoute(event: DashcamEvent): string {
    const routes: Record<string, string> = {
      'LP-4821': 'Amazon BHX2 Morning Delivery',
      'LP-9901': 'Tesco RDC Scheduled Delivery',
      'LP-0392': 'Cold Chain Manchester Collection',
      'LP-2201': 'Birmingham Urban Delivery',
    };
    return routes[event.vehicle] ?? '—';
  }
}
