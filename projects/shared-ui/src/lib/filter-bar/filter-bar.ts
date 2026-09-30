import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { Dropdown, DropdownMode, DropdownOption } from '../dropdown/dropdown';
import { Skeleton } from '../skeleton/skeleton';
import { SmoothHeight } from '../smooth-height/smooth-height';

/** One configurable dropdown rendered inside the filter bar. */
export interface FilterDropdown {
  /** Stable key echoed back with the change events so hosts can map the dropdown to a filter. */
  id: string;
  options: DropdownOption[];
  /** Selected option id (or ids for `multi`). */
  selected?: string | string[];
  /** Optional visible caption rendered above the trigger. */
  label?: string;
  /** Label shown when the selected id is not present in `options`. */
  placeholder?: string;
  ariaLabel?: string;
  mode?: DropdownMode;
  /** Trigger width override, e.g. `13rem`. Defaults to the bar's own width. */
  width?: string;
  align?: 'left' | 'right';
  placement?: 'bottom' | 'top';
  density?: 'default' | 'compact';
  searchable?: boolean;
  searchPlaceholder?: string;
  showOptionIcons?: boolean;
  matchTriggerWidth?: boolean;
  /** Disables the trigger. */
  disabled?: boolean;
  /** Replaces the trigger label with a shimmering skeleton. */
  loading?: boolean;
  skeletonWidth?: string;
}

export interface FilterChangeEvent {
  id: string;
  option: DropdownOption;
}

export interface FilterSelectionEvent {
  id: string;
  selected: string[];
}

/**
 * Generic filter bar: search box + collapse toggle + any number/kind of
 * config-driven dropdowns. Arbitrary extra filters can be projected as
 * content, e.g. `<shared-filter-bar ...><shared-date-range /></shared-filter-bar>`.
 * Always-visible extra controls (segmented ranges, chips, view switches, ...)
 * slot into the search row via `filter-leading` / `filter-trailing`, and the
 * collapsible row renders each dropdown's optional `label` above its trigger.
 */
@Component({
  selector: 'shared-filter-bar',
  imports: [Dropdown, Skeleton, SmoothHeight],
  templateUrl: './filter-bar.html',
  styleUrl: './filter-bar.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FilterBar {
  readonly search = input('');
  readonly searchPlaceholder = input('Search...');
  readonly searchAriaLabel = input('Search');
  readonly searchDisabled = input(false);
  readonly showSearch = input(true);
  readonly dropdowns = input<FilterDropdown[]>([]);
  /** Renders the collapse toggle; when false the filters are always visible. */
  readonly collapsible = input(true);
  readonly toggleLabel = input('Filters');
  readonly showClear = input(true);
  readonly clearLabel = input('Clear all filters');
  readonly ariaLabel = input('Filters');

  readonly searchChange = output<string>();
  readonly filterChange = output<FilterChangeEvent>();
  readonly filterSelectionChange = output<FilterSelectionEvent>();
  readonly cleared = output<void>();

  /** The filter row starts collapsed, so the bar reads as a single search row. */
  protected readonly expanded = signal(false);
  protected readonly expandedState = computed(() => !this.collapsible() || this.expanded());

  protected selectedIds(dropdown: FilterDropdown): string[] {
    const selected = dropdown.selected;
    if (Array.isArray(selected)) return selected;
    return selected ? [selected] : [];
  }

  protected label(dropdown: FilterDropdown): string {
    const [id] = this.selectedIds(dropdown);
    const match = id ? dropdown.options.find((option) => option.id === id) : undefined;
    return match?.label ?? dropdown.placeholder ?? '';
  }

  protected toggleSearch(event: Event): void {
    this.searchChange.emit((event.target as HTMLInputElement).value);
  }

  protected select(dropdown: FilterDropdown, option: DropdownOption): void {
    this.filterChange.emit({ id: dropdown.id, option });
  }

  protected selectionChanged(dropdown: FilterDropdown, selected: string[]): void {
    this.filterSelectionChange.emit({ id: dropdown.id, selected });
  }

  protected clear(): void {
    this.cleared.emit();
  }
}
