import { Component, OnDestroy, computed, signal } from '@angular/core';
import { TripPosition, TripReplayEvent, TripReplayMap } from '../../shared/trip-replay-map/trip-replay-map';

interface ReplayTrip {
  id: string; vehicle: string; driver: string; date: string; score: number; start: string; end: string;
  distance: number; duration: string; fuel: number; positions: TripPosition[]; events: TripReplayEvent[];
}

@Component({
  selector: 'app-trip-replay-page',
  imports: [TripReplayMap],
  templateUrl: './trip-replay-page.html',
  styleUrl: './trip-replay-page.css',
})
export class TripReplayPage implements OnDestroy {
  protected readonly playbackStepDuration = 600;
  protected readonly search = signal('');
  protected readonly selectedTripId = signal('trip-1');
  protected readonly positionIndex = signal(0);
  protected readonly playing = signal(false);
  protected readonly speed = signal(1);
  protected readonly activeTab = signal<'events' | 'stops' | 'statistics'>('events');
  private playbackTimer?: ReturnType<typeof setInterval>;

  protected readonly trips: ReplayTrip[] = [
    this.createTrip('trip-1', 'LP-4821', 'Haris Khan', 94, 52.4862, -1.8904),
    this.createTrip('trip-2', 'LP-3312', 'Omar Ali', 87, 53.4808, -2.2426),
    this.createTrip('trip-3', 'LP-7734', 'Ayesha Khan', 76, 51.5074, -0.1278),
  ];
  protected readonly filteredTrips = computed(() => {
    const query = this.search().trim().toLowerCase();
    return this.trips.filter((trip) => `${trip.vehicle} ${trip.driver}`.toLowerCase().includes(query));
  });
  protected readonly selectedTrip = computed(() => this.trips.find(({ id }) => id === this.selectedTripId()) ?? this.trips[0]);
  protected readonly currentPosition = computed(() => this.selectedTrip().positions[this.positionIndex()]);
  protected readonly progress = computed(() => {
    const lastIndex = this.selectedTrip().positions.length - 1;
    return lastIndex ? (this.positionIndex() / lastIndex) * 100 : 0;
  });

  protected updateSearch(event: Event): void { this.search.set((event.target as HTMLInputElement).value); }
  protected selectTrip(id: string): void { this.stop(); this.selectedTripId.set(id); this.positionIndex.set(0); }
  protected togglePlayback(): void { this.playing() ? this.pause() : this.play(); }
  protected play(): void {
    if (this.positionIndex() >= this.selectedTrip().positions.length - 1) this.positionIndex.set(0);
    this.clearTimer(); this.playing.set(true);
    this.playbackTimer = setInterval(() => {
      const next = this.positionIndex() + 1;
      if (next >= this.selectedTrip().positions.length) { this.pause(); return; }
      this.positionIndex.set(next);
    }, this.playbackStepDuration / this.speed());
  }
  protected pause(): void { this.clearTimer(); this.playing.set(false); }
  protected stop(): void { this.pause(); this.positionIndex.set(0); }
  protected setSpeed(value: number): void { this.speed.set(value); if (this.playing()) this.play(); }
  protected scrub(event: Event): void { this.positionIndex.set(Number((event.target as HTMLInputElement).value)); }
  protected jumpToEvent(event: TripReplayEvent): void { this.pause(); this.positionIndex.set(event.positionIndex); this.activeTab.set('events'); }
  private clearTimer(): void { if (this.playbackTimer) clearInterval(this.playbackTimer); this.playbackTimer = undefined; }

  private createTrip(id: string, vehicle: string, driver: string, score: number, baseLat: number, baseLng: number): ReplayTrip {
    const positions = Array.from({ length: 144 }, (_, index): TripPosition => ({
      lat: baseLat + Math.sin(index / 18) * 0.035 + index * 0.0006,
      lng: baseLng + Math.cos(index / 21) * 0.045 + index * 0.00083,
      speed: index < 6 || index > 137 ? 0 : 38 + ((index * 7) % 34),
      heading: 35 + ((index * 4) % 80),
      time: `10:${String(Math.floor(index / 3)).padStart(2, '0')}:${String((index % 3) * 20).padStart(2, '0')}`,
    }));
    return {
      id, vehicle, driver, date: '11 Jul 2026', score, start: 'Central Depot', end: 'Distribution Hub',
      distance: 68 + score % 11, duration: '1h 42m', fuel: 21.4, positions,
      events: [
        { id: `${id}-e1`, label: 'Harsh braking', type: 'violation', positionIndex: 39, detail: '−4 safety points' },
        { id: `${id}-e2`, label: 'DashCam event', type: 'dashcam', positionIndex: 81, detail: 'Footage available' },
        { id: `${id}-e3`, label: 'Delivery stop', type: 'stop', positionIndex: 114, detail: '12 min dwell' },
      ],
    };
  }
  ngOnDestroy(): void { this.clearTimer(); }
}
