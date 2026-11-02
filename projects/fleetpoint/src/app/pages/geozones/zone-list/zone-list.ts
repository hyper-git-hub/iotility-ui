import { Component, computed, inject, signal } from '@angular/core';
import {
  DropdownOption,
  FilterBar,
  FilterChangeEvent,
  FilterDropdown,
  Skeleton,
  SmoothHeight,
  Tooltip,
} from '@iotility/shared-ui';
import { GeozoneRecord, GeozoneType, NOT_AVAILABLE, ZONE_TYPE_LABELS } from '../geozones.data';
import { GeozonesStore } from '../geozones.store';

@Component({
  selector: 'app-zone-list',
  imports: [FilterBar, Skeleton, SmoothHeight, Tooltip],
  templateUrl: './zone-list.html',
  styleUrl: './zone-list.css',
})
export class ZoneList {
  private readonly store = inject(GeozonesStore);
  protected readonly loaded = this.store.loaded;
  protected readonly notAvailable = NOT_AVAILABLE;
  protected readonly skeletonCards = [0, 1, 2, 3];
  protected readonly search = signal('');
  protected readonly type = signal<'all' | GeozoneType>('all');
  protected readonly expandedId = signal<string | null>(null);
  protected readonly options: DropdownOption[] = [
    { id: 'all', label: 'All Types' },
    ...Object.entries(ZONE_TYPE_LABELS).map(([id, label]) => ({ id, label })),
  ];
  protected readonly filterDropdowns = computed<FilterDropdown[]>(() => [
    {
      id: 'type',
      ariaLabel: 'Filter by geozone type',
      options: this.options,
      selected: this.type(),
      placeholder: 'All Types',
      align: 'left',
    },
  ]);
  protected readonly filtered = computed(() => {
    const query = this.search().trim().toLowerCase();
    return this.store.zones().filter(
      (zone) =>
        (this.type() === 'all' || zone.type === this.type()) &&
        (!query ||
          `${zone.name} ${zone.description} ${zone.assigned}`.toLowerCase().includes(query)),
    );
  });

  protected choose(event: FilterChangeEvent): void {
    this.type.set(event.option.id as 'all' | GeozoneType);
    this.expandedId.set(null);
  }

  protected clearFilters(): void {
    this.search.set('');
    this.type.set('all');
    this.expandedId.set(null);
  }

  protected toggle(zone: GeozoneRecord): void {
    this.expandedId.update((id) => (id === zone.id ? null : zone.id));
  }

  protected async remove(zone: GeozoneRecord): Promise<void> {
    if (await this.store.remove(zone)) this.expandedId.update((id) => (id === zone.id ? null : id));
  }

  protected label(type: GeozoneType): string {
    return ZONE_TYPE_LABELS[type];
  }
}
