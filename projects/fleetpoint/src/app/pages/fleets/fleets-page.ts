import { Component, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Dropdown, DropdownOption } from '@iotility/shared-ui';
import { StatCard } from '../../shared/stat-card/stat-card';
import { FleetForm, FleetFormValue } from './fleet-form/fleet-form';

interface FleetSummary extends FleetFormValue {
  id: string;
  vehicles: number;
  drivers: number;
  active: number;
  alerts: number;
  averageFuel: number;
  safetyScore: number;
  fuelEfficiency: number;
  utilisation: number;
  vehicleIds: string[];
}

@Component({
  selector: 'app-fleets-page',
  imports: [Dropdown, FleetForm, StatCard],
  templateUrl: './fleets-page.html',
  styleUrl: './fleets-page.css',
})
export class FleetsPage {
  protected readonly fleetActions: DropdownOption[] = [
    { id: 'view', label: 'View on Map', icon: 'view' },
    { id: 'edit', label: 'Edit Fleet', icon: 'edit' },
    { id: 'delete', label: 'Delete Fleet', icon: 'delete' },
  ];
  protected readonly formOpen = signal(false);
  protected readonly fleets = signal<FleetSummary[]>([
    this.fleet('fleet-1', 'LogisticsPro Core', 'Primary long-haul operations', 'Birmingham Central Depot', 'var(--color-brand-500)', 84, 62, 68, 2, 74, 75, 86, 88, ['LP-4821', 'LP-3312', 'LP-7734', 'LP-9901', 'LP-6612', 'LP-0392']),
    this.fleet('fleet-2', 'London Distribution', 'Urban deliveries and collections', 'London East Hub', 'var(--color-info)', 46, 39, 37, 1, 81, 87, 91, 60, ['LP-2244', 'LP-5531', 'LP-3092', 'LP-7120']),
    this.fleet('fleet-3', 'Cold Chain', 'Temperature-controlled transport', 'Manchester Reefer Depot', 'var(--color-success)', 31, 24, 27, 2, 77, 95, 84, 90, ['LP-6612', 'LP-0392', 'LP-4018']),
    this.fleet('fleet-4', 'Executive Fleet', 'VIP and executive vehicles', 'Leeds Operations Centre', 'var(--color-warning)', 18, 14, 16, 0, 69, 98, 60, 76, ['LP-1104', 'LP-2088']),
  ]);
  protected readonly totalVehicles = computed(() => this.fleets().reduce((total, fleet) => total + fleet.vehicles, 0));
  protected readonly totalDrivers = computed(() => this.fleets().reduce((total, fleet) => total + fleet.drivers, 0));
  protected readonly totalAlerts = computed(() => this.fleets().reduce((total, fleet) => total + fleet.alerts, 0));

  constructor(private readonly router: Router) {}

  protected createFleet(value: FleetFormValue): void {
    const fleet = this.fleet(
      `fleet-${Date.now()}`,
      value.name,
      value.description,
      value.depotLocation,
      value.color,
      0, 0, 0, 0, 0, 100, 0, 0, [],
    );
    this.fleets.update((fleets) => [fleet, ...fleets]);
    this.formOpen.set(false);
  }

  protected trackFleet(): void {
    void this.router.navigateByUrl('/fleetpoint/live-tracking');
  }

  protected handleFleetAction(action: DropdownOption, fleet: FleetSummary): void {
    if (action.id === 'view') {
      this.trackFleet();
      return;
    }
    if (action.id === 'delete') {
      this.fleets.update((fleets) => fleets.filter(({ id }) => id !== fleet.id));
      return;
    }
    if (action.id === 'edit') this.formOpen.set(true);
  }

  protected scoreClass(score: number): string {
    return score >= 85 ? 'score-high' : score >= 70 ? 'score-medium' : 'score-low';
  }

  private fleet(
    id: string, name: string, description: string, depotLocation: string, color: string,
    vehicles: number, drivers: number, active: number, alerts: number, averageFuel: number,
    safetyScore: number, fuelEfficiency: number, utilisation: number, vehicleIds: string[],
  ): FleetSummary {
    return { id, name, description, depotLocation, color, vehicles, drivers, active, alerts, averageFuel, safetyScore, fuelEfficiency, utilisation, vehicleIds };
  }
}
