import { ChangeDetectionStrategy, Component, ElementRef, OnDestroy, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { debounceTime, Subject, switchMap, from, of, map, catchError, takeUntil } from 'rxjs';

interface GeocodingResult {
  display_name: string;
  lat: string;
  lon: string;
  type: string;
}

export interface LocationSelect {
  name: string;
  lat: number;
  lng: number;
}

@Component({
  selector: 'app-location-search',
  templateUrl: './location-search.html',
  styleUrl: './location-search.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
})
export class LocationSearch implements OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly searchSubject$ = new Subject<string>();
  private readonly element = inject(ElementRef<HTMLElement>);

  protected readonly query = signal('');
  protected readonly results = signal<GeocodingResult[]>([]);
  protected readonly loading = signal(false);
  protected readonly showResults = signal(false);

  readonly locationSelect = output<LocationSelect>();

  constructor() {
    this.searchSubject$
      .pipe(
        debounceTime(300),
        switchMap((q) => {
          if (!q.trim()) return of([]);
          this.loading.set(true);
          return from(this.searchLocations(q)).pipe(
            catchError(() => of([])),
            map((r) => { this.loading.set(false); return r; }),
          );
        }),
        takeUntil(this.destroy$),
      )
      .subscribe((r) => this.results.set(r));
  }

  protected onInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.query.set(value);
    this.showResults.set(value.trim().length > 0);
    this.searchSubject$.next(value);
  }

  protected onBlur(): void {
    window.setTimeout(() => this.showResults.set(false), 200);
  }

  protected onSelect(result: GeocodingResult): void {
    this.locationSelect.emit({
      name: result.display_name,
      lat: parseFloat(result.lat),
      lng: parseFloat(result.lon),
    });
    this.query.set(result.display_name.split(',')[0]);
    this.showResults.set(false);
    this.results.set([]);
  }

  protected clear(): void {
    this.query.set('');
    this.results.set([]);
    this.showResults.set(false);
  }

  private async searchLocations(q: string): Promise<GeocodingResult[]> {
    try {
      const params = new URLSearchParams({ q, format: 'json', limit: '5' });
      const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
        headers: { 'Accept': 'application/json' },
      });
      if (!res.ok) return [];
      return await res.json();
    } catch {
      return [];
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
