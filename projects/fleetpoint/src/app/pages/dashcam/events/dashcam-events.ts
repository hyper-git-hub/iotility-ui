import { lingerWhileClosing } from '@iotility/shared-ui';
import { Component, computed, inject, signal } from '@angular/core';
import {
  DataTable,
  DataTableCellTemplate,
  DataTableSkeleton,
  FilterBar,
  FilterChangeEvent,
  FilterDropdown,
  TableColumn,
  TableRow,
  Tooltip,
} from '@iotility/shared-ui';
import {
  CATEGORY_OPTIONS,
  DashcamCategory,
  DashcamEvent,
  DashcamReview,
  DashcamSeverity,
  NOT_AVAILABLE,
  REVIEW_OPTIONS,
  SEVERITY_OPTIONS,
  categoryLabel,
  initials,
} from '../dashcam.data';
import { DashcamStore } from '../dashcam.store';
import { DashcamVideoTile } from '../video-tile/video-tile';

@Component({
  selector: 'app-dashcam-events',
  imports: [DashcamVideoTile, DataTable, DataTableCellTemplate, DataTableSkeleton, FilterBar, Tooltip],
  templateUrl: './dashcam-events.html',
  styleUrl: './dashcam-events.css',
})
export class DashcamEvents {
  private readonly store = inject(DashcamStore);
  protected readonly loaded = this.store.loaded;
  protected readonly categoryLabel = categoryLabel;
  protected readonly notAvailable = NOT_AVAILABLE;
  protected readonly categoryOptions = CATEGORY_OPTIONS;
  protected readonly severityOptions = SEVERITY_OPTIONS;
  protected readonly reviewOptions = REVIEW_OPTIONS;
  protected readonly search = signal('');
  protected readonly category = signal<'all' | DashcamCategory>('all');
  protected readonly severity = signal<'all' | DashcamSeverity>('all');
  protected readonly review = signal<'all' | DashcamReview>('all');
  protected readonly selected = signal<DashcamEvent | null>(null);
  /** Drawer content stays rendered while the drawer animates shut. */
  protected readonly shownEvent = lingerWhileClosing(this.selected);
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
  protected readonly columnLabels = this.columns.map((column) => column.label);
  protected readonly filtered = computed(() => {
    const query = this.search().trim().toLowerCase();
    return this.store.events().filter(
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
      driverInitials: initials(event.driver),
      vehicle: event.vehicle,
      categoryLabel: categoryLabel(event.category),
      severity: event.severity ?? NOT_AVAILABLE,
      time: event.timestamp.split('·').at(-1)?.trim() ?? event.timestamp,
      location: event.location,
      speed: event.speed ?? 0,
      speedLabel: event.speed === null ? NOT_AVAILABLE : `${event.speed} km/h`,
      jobRoute: NOT_AVAILABLE,
      review: event.review ?? NOT_AVAILABLE,
      score: event.scoreImpact ?? 0,
      scoreLabel: event.scoreImpact ? String(event.scoreImpact) : NOT_AVAILABLE,
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
    this.selected.set(this.store.events().find((event) => event.id === row['id']) ?? null);
  }
  protected closeDetails(): void {
    this.selected.set(null);
  }
  /** The event's evidence clip plays in the front view, as the FMS playback does; other views have none. */
  protected footage(event: DashcamEvent, camera: string): string {
    return camera === 'Front' ? event.mediaUrl : '';
  }
}
