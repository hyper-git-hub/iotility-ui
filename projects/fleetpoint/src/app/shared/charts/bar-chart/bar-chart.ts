import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, input } from '@angular/core';
import { Chart, ChartData, ChartOptions, registerables } from 'chart.js';
import { withFleetChartDefaults } from '../chart-defaults';
Chart.register(...registerables);
@Component({
  selector: 'app-fleet-bar-chart',
  templateUrl: '../generic-chart.html',
  styleUrl: '../generic-chart.css',
})
export class FleetBarChart implements AfterViewInit, OnDestroy {
  readonly title = input.required<string>();
  readonly subtitle = input('');
  readonly badge = input('');
  readonly filterLabel = input('');
  readonly data = input.required<ChartData<'bar', number[], string>>();
  readonly options = input<ChartOptions<'bar'>>({});
  @ViewChild('canvas') private canvas!: ElementRef<HTMLCanvasElement>;
  private chart?: Chart<'bar', number[], string>;
  ngAfterViewInit(): void {
    this.chart = new Chart(this.canvas.nativeElement, {
      type: 'bar',
      data: this.data(),
      options: withFleetChartDefaults(this.options()),
    });
  }
  ngOnDestroy(): void {
    this.chart?.destroy();
  }
}
