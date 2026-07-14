import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, signal } from '@angular/core';
import { BlockingLoader } from '@iotility/shared-ui';
import { finalize, forkJoin } from 'rxjs';
import { DashboardGraphComponent } from '../../../shared/charts/dashboard-graph/dashboard-graph';
import { StatCard, StatCardTone } from '../../../shared/stat-card/stat-card';
import {
  DashboardCard,
  DashboardGraph,
  DashcamDevice,
  Fleet,
  FleetDashboardApiService,
  Vehicle,
} from '../../../shared/services/fleet-dashboard-api.service';

@Component({
  selector: 'app-dashboard-overview',
  imports: [BlockingLoader, DashboardGraphComponent, StatCard],
  templateUrl: './overview.html',
  styleUrl: '../dashboard-page.css',
})
export class Overview implements OnInit {
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly cards = signal<DashboardCard[]>([]);
  protected readonly graphs = signal<DashboardGraph[]>([]);
  protected readonly fleets = signal<Fleet[]>([]);
  protected readonly dashcams = signal<DashcamDevice[]>([]);
  protected readonly vehicles = computed(() => this.fleets().flatMap((fleet) => fleet.assigned_vehicles ?? []));
  protected readonly visibleVehicles = computed(() => this.vehicles().slice(0, 6));
  protected readonly onlineVehicles = computed(() => this.vehicles().filter((vehicle) => vehicle.online_status).length);

  constructor(private readonly api: FleetDashboardApiService) {}

  ngOnInit(): void { this.loadDashboard(); }

  protected loadDashboard(): void {
    this.loading.set(true);
    this.error.set('');
    forkJoin({
      cards: this.api.getCards(),
      graphs: this.api.getGraphs(),
      fleets: this.api.getFleets(),
      dashcams: this.api.getDashcams(),
    }).pipe(finalize(() => this.loading.set(false))).subscribe({
      next: ({ cards, graphs, fleets, dashcams }) => {
        this.cards.set(cards.data ?? []);
        this.graphs.set(graphs.data ?? []);
        this.fleets.set(fleets.data?.data ?? []);
        this.dashcams.set(dashcams.data?.data ?? []);
      },
      error: (response: HttpErrorResponse) => {
        this.error.set(response.error?.message || 'Dashboard data could not be loaded. Please try again.');
      },
    });
  }

  protected cardTone(code: string): StatCardTone {
    if (['DVC', 'MOD'].includes(code)) return 'danger';
    if (['MD', 'VIM'].includes(code)) return 'warning';
    if (['VIO', 'TD'].includes(code)) return 'success';
    return 'info';
  }

  protected cardValue(card: DashboardCard): number { return card.data ?? 0; }

  protected vehicleInitial(vehicle: Vehicle): string { return (vehicle.name || '?').charAt(0).toUpperCase(); }
}
