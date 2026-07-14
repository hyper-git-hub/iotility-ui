import { Component, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { DataTable, TableAction, TableColumn, TableRow } from '@iotility/shared-ui';
import { VehicleForm, VehicleFormValue } from './vehicle-form/vehicle-form';

@Component({
  selector: 'app-vehicles-page',
  imports: [DataTable, VehicleForm],
  templateUrl: './vehicles-page.html',
  styleUrl: './vehicles-page.css',
})
export class VehiclesPage {
  protected readonly formOpen = signal(false);
  protected readonly tableActions: TableAction[] = ['map', 'history', 'edit', 'delete'];
  protected readonly columns: TableColumn[] = [
    { key: 'registration', label: 'Vehicle', type: 'vehicle', secondaryKey: 'makeModel' },
    { key: 'fleet', label: 'Fleet', type: 'fleet' },
    { key: 'status', label: 'Status', type: 'status' },
    { key: 'driver', label: 'Driver' },
    { key: 'location', label: 'Location' },
    { key: 'speed', label: 'Speed' },
    { key: 'fuel', label: 'Fuel', type: 'fuel' },
    { key: 'mileage', label: 'Mileage' },
    { key: 'mot', label: 'MOT', type: 'mot' },
    { key: 'alert', label: 'Alerts', type: 'alert' },
    { key: 'actions', label: 'Actions', type: 'actions' },
  ];
  protected readonly vehicles = signal<TableRow[]>([
    this.vehicle('LP-0392', '2022 Volvo FH Reefer', 'Cold Chain', 'var(--color-info)', 'Alert', 'Unassigned', 'A12 Eastbound, London', 32, 58, '41,200 mi', '185d', true),
    this.vehicle('LP-1193', '2020 Volvo FH', 'Manchester Vans', 'var(--color-warning)', 'Moving', 'Unassigned', 'M60 Orbital, Manchester', 61, 54, '156,700 mi', '16d', false),
    this.vehicle('LP-2201', '2022 Ford Transit', 'Birmingham Ops', 'var(--color-success)', 'Alert', 'Aisha Okonkwo', 'Digbeth, Birmingham', 28, 71, '28,900 mi', '249d', true),
    this.vehicle('LP-2244', '2021 Mercedes Sprinter', 'Manchester Vans', 'var(--color-warning)', 'Moving', 'Sarah Whitfield', 'Piccadilly, Manchester', 38, 88, '67,200 mi', '58d', false),
    this.vehicle('LP-3312', '2020 DAF XF', 'London HGV', 'var(--color-brand-600)', 'Moving', 'Oliver Pemberton', 'M25 Westbound, London', 56, 78, '98,400 mi', '129d', false),
    this.vehicle('LP-3388', '2020 DAF XF', 'Leeds Depot', 'var(--color-danger)', 'Moving', 'Unassigned', 'M1 Northbound, Leeds', 52, 67, '134,500 mi', 'Expired', false),
    this.vehicle('LP-4477', '2021 Ford Transit', 'Birmingham Ops', 'var(--color-success)', 'Moving', 'Unassigned', 'A38 Southbound, Birmingham', 42, 48, '51,200 mi', '83d', false),
    this.vehicle('LP-9901', '2021 Volvo FH', 'London HGV', 'var(--color-brand-600)', 'Offline', 'Unassigned', 'Stratford, London', 0, 36, '142,300 mi', '12d', true),
  ]);
  protected readonly moving = computed(() => this.vehicles().filter((v) => v['status'] === 'Moving').length);
  protected readonly alerts = computed(() => this.vehicles().filter((v) => v['status'] === 'Alert').length);
  protected readonly offline = computed(() => this.vehicles().filter((v) => v['status'] === 'Offline').length);

  constructor(private readonly router: Router) {}

  protected addVehicle(value: VehicleFormValue): void {
    this.vehicles.update((rows) => [
      ...rows,
      this.vehicle(value.registration, value.makeModel, value.fleet, 'var(--color-brand-600)', 'Moving', value.driver, value.location, 0, value.fuel, `${value.mileage.toLocaleString()} mi`, '365d', false),
    ]);
    this.formOpen.set(false);
  }

  protected handleRowAction(event: { action: TableAction; row: TableRow }): void {
    if (event.action === 'map') void this.router.navigateByUrl('/fleetpoint/live-tracking');
    else if (event.action === 'history') void this.router.navigateByUrl('/fleetpoint/trip-replay');
    else if (event.action === 'delete') this.vehicles.update((rows) => rows.filter((row) => row['registration'] !== event.row['registration']));
    else this.formOpen.set(true);
  }

  protected openVehicle(row: TableRow): void {
    void this.router.navigate(['/fleetpoint/vehicles', row['registration']]);
  }

  private vehicle(registration: string, makeModel: string, fleet: string, fleetColor: string, status: string, driver: string, location: string, speed: number, fuel: number, mileage: string, mot: string, alert: boolean): TableRow {
    return { registration, makeModel, fleet, fleetColor, status, driver, location, speed: `${speed} mph`, fuel, mileage, mot, alert, actions: '' };
  }
}
