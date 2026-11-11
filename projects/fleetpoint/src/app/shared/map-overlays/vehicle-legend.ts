import { Component, input } from '@angular/core';

interface StatusItem {
  key: string;
  label: string;
  color: string;
}

/** A vehicle type in the legend: its name and the icon its markers show. */
export interface VehicleTypeLegendItem {
  label: string;
  image: string;
}

/**
 * Map legend: what the marker ring colours mean (status) and, when given, what the icons
 * inside the markers are (vehicle types), each in its own box side by side.
 */
@Component({
  selector: 'app-vehicle-legend',
  templateUrl: './vehicle-legend.html',
  styleUrl: './vehicle-legend.css',
})
export class VehicleLegend {
  /** Vehicle types on the map; the type box is left out while empty. */
  readonly types = input<VehicleTypeLegendItem[]>([]);

  protected readonly statuses: StatusItem[] = [
    { key: 'moving', label: 'Moving', color: 'var(--color-success)' },
    { key: 'idling', label: 'Idling', color: 'var(--color-warning)' },
    { key: 'stopped', label: 'Stopped', color: 'var(--color-stopped, #94a3b8)' },
    { key: 'alert', label: 'Alert', color: 'var(--color-danger)' },
    { key: 'offline', label: 'Offline', color: 'var(--color-muted)' },
  ];

  /** An icon that will not load is left out rather than shown broken. */
  protected hideIcon(event: Event): void {
    (event.target as HTMLElement).style.display = 'none';
  }
}
