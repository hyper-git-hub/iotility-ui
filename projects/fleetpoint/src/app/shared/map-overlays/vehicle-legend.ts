import { Component } from '@angular/core';

interface StatusItem {
  key: string;
  label: string;
  color: string;
}

@Component({
  selector: 'app-vehicle-legend',
  templateUrl: './vehicle-legend.html',
  styleUrl: './vehicle-legend.css',
})
export class VehicleLegend {
  protected readonly statuses: StatusItem[] = [
    { key: 'moving', label: 'Moving', color: 'var(--color-success)' },
    { key: 'idling', label: 'Idling', color: 'var(--color-warning)' },
    { key: 'alert', label: 'Alert', color: 'var(--color-danger)' },
    { key: 'offline', label: 'Offline', color: 'var(--color-muted)' },
  ];
}