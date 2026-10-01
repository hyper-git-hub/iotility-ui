import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { Chart, ChartData, ChartOptions, registerables } from 'chart.js';
import { DropdownOption } from '@iotility/shared-ui';
import { withFleetChartDefaults } from '../chart-defaults';
import { GraphFilter } from '../graph-filter/graph-filter';
Chart.register(...registerables);
@Component({
  selector: 'app-fleet-bar-chart',
  imports: [GraphFilter],
  templateUrl: '../generic-chart.html',
  styleUrl: '../generic-chart.css',
  // The card header already renders the title, so keep it out of the browser's native tooltip.
  host: { '[attr.title]': 'null' },
})
export class FleetBarChart implements AfterViewInit, OnDestroy {
  readonly title = input.required<string>();
  readonly subtitle = input('');
  readonly badge = input('');
  readonly statusLegend = input(false);
  /** Colored items rendered in the card header (top-right), e.g. jobs graph legends. */
  readonly legendItems = input<{ label: string; color: string }[]>([]);
  readonly filterLabel = input('');

  /** Backend-provided filter options for this graph; empty means no filter. */
  readonly filterOptions = input<DropdownOption[]>([]);
  readonly filterAriaLabel = input('Filter');
  readonly selectedFilterId = input<string | null>(null);
  readonly filterSelected = output<DropdownOption>();
  protected readonly selectedFilterLabel = computed(() =>
    this.labelFor(this.filterOptions(), this.selectedFilterId()),
  );
  private labelFor(options: DropdownOption[], id: string | null): string {
    return options.find((option) => option.id === id)?.label ?? options[0]?.label ?? 'Filter';
  }
  readonly height = input(320);
  readonly data = input.required<ChartData<'bar', number[], string>>();
  readonly options = input<ChartOptions<'bar'>>({});
  @ViewChild('canvas') private canvas!: ElementRef<HTMLCanvasElement>;
  private readonly chartRef = signal<Chart<'bar', number[], string> | null>(null);

  constructor() {
    // The graph's data is replaced wholesale when its filter changes, so the
    // existing instance has to be re-fed; without this the canvas keeps
    // painting the first response. Options are intentionally not tracked:
    // they are rebuilt on every change-detection pass and would loop.
    effect(() => {
      const data = this.data();
      const chart = this.chartRef();
      if (!chart) return;
      chart.data = data;
      chart.update();
    });
  }

  ngAfterViewInit(): void {
    this.chartRef.set(
      new Chart(this.canvas.nativeElement, {
        type: 'bar',
        data: this.data(),
        options: withFleetChartDefaults(this.options()),
      }),
    );
  }

  ngOnDestroy(): void {
    this.chartRef()?.destroy();
  }
}
