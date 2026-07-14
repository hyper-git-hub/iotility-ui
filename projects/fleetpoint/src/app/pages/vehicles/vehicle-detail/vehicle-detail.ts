import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FleetMap, TrackedVehicle } from '../../../shared/fleet-map/fleet-map';
import { StatCard } from '../../../shared/stat-card/stat-card';

interface DetailItem { label: string; value: string; }

@Component({
  selector: 'app-vehicle-detail',
  imports: [FleetMap, StatCard],
  templateUrl: './vehicle-detail.html',
  styleUrl: './vehicle-detail.css',
})
export class VehicleDetail {
  protected readonly registration: string;
  protected readonly vehicle: TrackedVehicle;
  protected readonly details: DetailItem[];
  protected readonly deviceDetails: DetailItem[] = [
    { label: 'Device ID', value: '352592579400094' },
    { label: 'Device Type', value: 'FMC920' },
    { label: 'SIM Number', value: 'SKU094' },
    { label: 'Allocation Date', value: '30 Nov 2025' },
    { label: 'Immobilizer', value: 'Enabled' },
    { label: 'Ignition', value: 'On' },
  ];
  protected readonly monitoring = [
    { label: 'Harsh acceleration', enabled: true },
    { label: 'Harsh braking', enabled: true },
    { label: 'Geo zone', enabled: true },
    { label: 'Sharp turning', enabled: true },
    { label: 'Fuel sensor', enabled: false },
    { label: 'Crash detection', enabled: false },
  ];

  constructor(route: ActivatedRoute, private readonly router: Router) {
    this.registration = route.snapshot.paramMap.get('registration') ?? 'SAM-123';
    this.vehicle = {
      id: this.registration,
      model: '2022 Honda City',
      driver: 'Unassigned',
      status: 'Offline',
      speed: 0,
      fuel: 40,
      location: 'Street 1, I-10/3, Islamabad Capital Territory, Pakistan',
      updated: '17 Feb 2026, 04:13 PM',
      lat: 33.6517983,
      lng: 73.0438133,
    };
    this.details = [
      { label: 'Vehicle Name / ID', value: this.registration },
      { label: 'Record Status', value: 'Active' },
      { label: 'Fleet', value: 'Fleet-2' },
      { label: 'Make', value: 'Honda' },
      { label: 'Model', value: 'City' },
      { label: 'Year', value: '2022' },
      { label: 'Colour', value: 'White' },
      { label: 'Engine Number', value: '123' },
      { label: 'Chassis Number', value: '123' },
      { label: 'Engine', value: 'Petrol · 1,500 CC' },
      { label: 'Fuel Tank Capacity', value: '40 litres' },
      { label: 'Odometer Reading', value: '40,000 km' },
      { label: 'Purchase Type', value: 'Owned' },
      { label: 'Date Commissioned', value: '30 Nov 2025' },
    ];
  }

  protected back(): void { void this.router.navigateByUrl('/fleetpoint/vehicles'); }
  protected tripReplay(): void { void this.router.navigateByUrl('/fleetpoint/trip-replay'); }
}
