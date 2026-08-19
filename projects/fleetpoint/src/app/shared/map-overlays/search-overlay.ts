import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TrackedVehicle, VehicleStatus } from '../fleet-map/fleet-map';

export type VehicleFilter = VehicleStatus | 'All';

export interface VehicleSearchResult extends TrackedVehicle {
  image?: string | null;
}

@Component({
  selector: 'app-search-overlay',
  templateUrl: './search-overlay.html',
  styleUrl: './search-overlay.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchOverlay {
  readonly search = input('');
  readonly filterStatus = input<VehicleFilter>('All');
  readonly vehicles = input.required<VehicleSearchResult[]>();
  readonly totalVehicles = input(0);
  readonly searchChange = output<string>();
  readonly filterChange = output<VehicleFilter>();
  readonly selectVehicle = output<VehicleSearchResult>();

  protected readonly filters: VehicleFilter[] = ['All', 'Moving', 'Idling', 'Alert', 'Offline'];
  protected readonly showResults = computed(() => this.search().trim().length > 0);
  protected readonly results = computed(() => this.vehicles().slice(0, 6));
  protected readonly hasResults = computed(() => this.vehicles().length > 0);

  protected onSearch(event: Event): void {
    this.searchChange.emit((event.target as HTMLInputElement).value);
  }

  protected clearSearch(): void {
    this.searchChange.emit('');
  }

  protected onFilter(filter: VehicleFilter): void {
    this.filterChange.emit(filter);
  }

  protected onSelect(vehicle: VehicleSearchResult): void {
    this.selectVehicle.emit(vehicle);
    this.searchChange.emit('');
  }

  protected statusColor(status: string): string {
    switch (status) {
      case 'Moving': return 'var(--color-success)';
      case 'Idling': return 'var(--color-warning)';
      case 'Alert': return 'var(--color-danger)';
      case 'Offline': return 'var(--color-muted)';
      default: return 'var(--color-muted)';
    }
  }

  protected vehicleImage(image: string | null | undefined): string {
    const value = image?.trim();
    return value && !['none', 'null', 'no image', 'n/a'].includes(value.toLowerCase())
      ? value
      : 'assets/fleetpoint/def-car.svg';
  }

  protected useDefaultVehicleImage(event: Event): void {
    const image = event.target as HTMLImageElement;
    image.onerror = null;
    image.src = 'assets/fleetpoint/def-car.svg';
  }
}
