import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, input } from '@angular/core';
import { Chart, ChartData, ChartOptions, registerables } from 'chart.js';
import { withFleetChartDefaults } from '../chart-defaults';
Chart.register(...registerables);
@Component({
  selector: 'app-fleet-line-chart',
  templateUrl: '../generic-chart.html',
  styleUrl: '../generic-chart.css',
})
export class FleetLineChart implements AfterViewInit, OnDestroy {
  readonly title = input.required<string>();
  readonly subtitle = input('');
  readonly badge = input('');
  readonly filterLabel = input('');
  readonly height = input(320);
  readonly data = input.required<ChartData<'line', number[], string>>();
  readonly options = input<ChartOptions<'line'>>({});
  @ViewChild('canvas') private canvas!: ElementRef<HTMLCanvasElement>;
  private chart?: Chart<'line', number[], string>;
  ngAfterViewInit(): void {
    this.chart = new Chart(this.canvas.nativeElement, {
      type: 'line',
      data: this.data(),
      options: withFleetChartDefaults(this.options()),
    });
  }
  ngOnDestroy(): void {
    this.chart?.destroy();
  }
}
