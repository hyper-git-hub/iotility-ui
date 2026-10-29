import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/** One module on the platform diagram. Coordinates are in the diagram's 1000 × 460 space. */
interface PlatformModule {
  id: string;
  name: string;
  rest: string;
  tagline: string;
  icon: string;
  /** Chip centre. */
  x: number;
  y: number;
  /** Connector from the hub edge to the chip, drawn outward. */
  path: string;
}

/** Seconds a data pulse takes to cycle: travel out, light the chip, rest. */
const PULSE_SECONDS = 6;

@Component({
  selector: 'app-auth-layout',
  imports: [RouterOutlet],
  templateUrl: './auth-layout.html',
  styleUrl: './auth-layout.css',
})
export class AuthLayout {
  protected readonly pulseSeconds = PULSE_SECONDS;
  /** Hovering a module lights its connector and the hub. */
  protected readonly hovered = signal<string | null>(null);

  protected readonly modules: PlatformModule[] = [
    {
      id: 'fleet', name: 'Fleet', rest: 'Management', tagline: 'Every vehicle, live on the map',
      icon: 'M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2M15 18H9M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14M7 18a2 2 0 1 0 0-.01M17 18a2 2 0 1 0 0-.01',
      x: 500, y: 42, path: 'M500 162 V66',
    },
    {
      id: 'genset', name: 'GenSet', rest: 'Monitoring', tagline: 'Fuel, runtime and health',
      icon: 'M13 2 3 14h9l-1 8 10-12h-9l1-8Z',
      x: 180, y: 128, path: 'M432 230 H330 V128 H305',
    },
    {
      id: 'building', name: 'Smart Building', rest: 'Management', tagline: 'Energy, comfort and access',
      icon: 'M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18ZM6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2M10 6h4M10 10h4M10 14h4M10 18h4',
      x: 180, y: 340, path: 'M432 230 H330 V340 H305',
    },
    {
      id: 'waste', name: 'Waste', rest: 'Management', tagline: 'Smarter collection routes',
      icon: 'M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6',
      x: 820, y: 128, path: 'M568 230 H670 V128 H695',
    },
    {
      id: 'asset', name: 'Asset', rest: 'Management', tagline: 'Know where every asset is',
      icon: 'M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16ZM3.3 7 12 12l8.7-5M12 22V12',
      x: 820, y: 340, path: 'M568 230 H670 V340 H695',
    },
  ];

  protected readonly modulesLabel = `IoTility modules: ${this.modules.map((item) => `${item.name} ${item.rest}`).join(', ')}`;

  /** Each module's pulse starts after the entrance and is staggered around the hub. */
  protected pulseDelay(index: number): number {
    return 1.4 + index * (PULSE_SECONDS / this.modules.length);
  }
}
