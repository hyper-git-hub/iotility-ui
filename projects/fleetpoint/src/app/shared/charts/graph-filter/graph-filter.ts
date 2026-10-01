import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Dropdown, DropdownOption } from '@iotility/shared-ui';

/**
 * A single filter dropdown for a dashboard graph.
 *
 * Lives outside the chart components because a graph with no data (or all-zero
 * data) renders the empty state instead of a chart — and that state still has
 * to be filterable, otherwise a graph that starts empty can never be unhidden.
 */
@Component({
  selector: 'app-graph-filter',
  imports: [Dropdown],
  templateUrl: './graph-filter.html',
  styleUrl: './graph-filter.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GraphFilter {
  readonly options = input<DropdownOption[]>([]);
  readonly ariaLabel = input('Filter');
  readonly selectedId = input<string | null>(null);
  readonly selected = output<DropdownOption>();

  /** Defaults to the first option so the trigger always shows a real label. */
  protected readonly activeId = computed(() => this.selectedId() || this.options()[0]?.id || '');
  protected readonly label = computed(
    () => this.options().find((option) => option.id === this.activeId())?.label ?? 'Filter',
  );
}