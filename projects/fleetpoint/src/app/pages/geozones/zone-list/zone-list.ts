import { Component, computed, signal } from '@angular/core';
import {
  DropdownOption,
  FilterBar,
  FilterChangeEvent,
  FilterDropdown,
  SmoothHeight,
  Tooltip,
} from '@iotility/shared-ui';
import { GEOZONES, GeozoneRecord, GeozoneType, ZONE_TYPE_LABELS } from '../geozones.data';

@Component({
  selector: 'app-zone-list',
  imports: [FilterBar, SmoothHeight, Tooltip],
  templateUrl: './zone-list.html',
  styleUrl: './zone-list.css',
})
export class ZoneList {
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
    return GEOZONES.filter(
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

  protected label(type: GeozoneType): string {
    return ZONE_TYPE_LABELS[type];
  }
}
