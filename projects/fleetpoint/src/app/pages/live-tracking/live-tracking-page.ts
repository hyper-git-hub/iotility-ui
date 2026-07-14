import { Component, computed, signal } from '@angular/core';
import { FleetMap, TrackedVehicle, VehicleStatus } from '../../shared/fleet-map/fleet-map';
import { Dropdown, DropdownOption } from '@iotility/shared-ui';

@Component({
  selector: 'app-live-tracking-page',
  imports: [FleetMap, Dropdown],
  templateUrl: './live-tracking-page.html',
  styleUrl: './live-tracking-page.css',
})
export class LiveTrackingPage {
  protected readonly search = signal('');
  protected readonly statusFilter = signal<VehicleStatus | 'All'>('All');
  protected readonly locationFilter = signal('all');
  protected readonly selectedVehicle = signal<TrackedVehicle | null>(null);
  protected readonly filters: Array<VehicleStatus | 'All'> = [
    'All',
    'Moving',
    'Idling',
    'Alert',
    'Offline',
  ];
  protected readonly locationOptions: DropdownOption[] = [
    { id: 'all', label: 'All locations', description: 'Every connected vehicle' },
    { id: 'london', label: 'London', description: 'London and surrounding routes' },
    { id: 'birmingham', label: 'Birmingham', description: 'Birmingham fleet area' },
    { id: 'manchester', label: 'Manchester', description: 'Manchester fleet area' },
  ];
  protected readonly vehicles: TrackedVehicle[] = [
    {
      id: 'LP-4821',
      model: 'Volvo FH',
      driver: 'Haris Khan',
      status: 'Moving',
      speed: 74,
      fuel: 68,
      location: 'A1 Northbound, London',
      updated: 'Just now',
      lat: 51.72,
      lng: -0.22,
    },
    {
      id: 'LP-3312',
      model: 'DAF XF',
      driver: 'Omar Ali',
      status: 'Moving',
      speed: 56,
      fuel: 74,
      location: 'M25 Westbound, London',
      updated: '1 min ago',
      lat: 51.52,
      lng: -0.48,
    },
    {
      id: 'LP-7734',
      model: 'DAF XF',
      driver: 'Unassigned',
      status: 'Alert',
      speed: 0,
      fuel: 31,
      location: 'Birmingham Depot — Zone B',
      updated: '2 mins ago',
      lat: 52.486,
      lng: -1.89,
    },
    {
      id: 'LP-9901',
      model: 'Volvo FH',
      driver: 'Sara Ahmed',
      status: 'Offline',
      speed: 0,
      fuel: 22,
      location: 'Stratford, London',
      updated: '47 mins ago',
      lat: 51.54,
      lng: -0.01,
    },
    {
      id: 'LP-6612',
      model: 'Volvo FH Reefer',
      driver: 'Ayesha Khan',
      status: 'Moving',
      speed: 48,
      fuel: 81,
      location: 'M4 Eastbound, London',
      updated: '3 mins ago',
      lat: 51.46,
      lng: -0.93,
    },
    {
      id: 'LP-0392',
      model: 'Volvo FH Reefer',
      driver: 'Bilal Raza',
      status: 'Alert',
      speed: 32,
      fuel: 48,
      location: 'A12 Eastbound, London',
      updated: '4 mins ago',
      lat: 51.61,
      lng: 0.12,
    },
    {
      id: 'LP-2244',
      model: 'Mercedes Sprinter',
      driver: 'Hanna Madsen',
      status: 'Moving',
      speed: 38,
      fuel: 65,
      location: 'Piccadilly, Manchester',
      updated: '2 mins ago',
      lat: 53.48,
      lng: -2.24,
    },
    {
      id: 'LP-5531',
      model: 'Mercedes Sprinter',
      driver: 'Angel Dokidis',
      status: 'Idling',
      speed: 0,
      fuel: 53,
      location: 'Manchester Depot',
      updated: '6 mins ago',
      lat: 53.46,
      lng: -2.19,
    },
  ];
  protected readonly filteredVehicles = computed(() => {
    const query = this.search().trim().toLowerCase();
    return this.vehicles.filter(
      (vehicle) =>
        (this.statusFilter() === 'All' || vehicle.status === this.statusFilter()) &&
        (this.locationFilter() === 'all' ||
          vehicle.location.toLowerCase().includes(this.locationFilter())) &&
        (!query ||
          `${vehicle.id} ${vehicle.model} ${vehicle.location}`.toLowerCase().includes(query)),
    );
  });

  protected updateSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }
  protected updateLocation(ids: string[]): void {
    this.locationFilter.set(ids[0] ?? 'all');
  }
  protected locationLabel(): string {
    return (
      this.locationOptions.find(({ id }) => id === this.locationFilter())?.label ?? 'All locations'
    );
  }
  protected selectVehicle(vehicle: TrackedVehicle): void {
    this.selectedVehicle.set(vehicle);
  }
}
