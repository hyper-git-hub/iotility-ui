import { Component, input } from '@angular/core';
import { Skeleton, SpotlightBorder } from '@iotility/shared-ui';

export type StatCardTone = 'brand' | 'info' | 'success' | 'warning' | 'danger' | 'priority' | 'neutral';

/**
 * The FleetPoint metric card (vehicle-detail style): small uppercase label, tone-tinted icon chip,
 * bold value with an optional unit suffix. Icon is either an image (`icon`) or a projected
 * `<svg stat-card-icon>` that inherits the tone colour.
 * On hover, a tone-coloured gradient lights up the border nearest the cursor ([sharedSpotlightBorder]).
 */
@Component({
  selector: 'app-stat-card',
  imports: [Skeleton, SpotlightBorder],
  templateUrl: './stat-card.html',
  styleUrl: './stat-card.css',
})
export class StatCard {
  readonly label = input.required<string>();
  readonly value = input.required<string | number>();
  readonly tone = input<StatCardTone>('brand');
  /** Unit shown after the value, e.g. "km", "km/h", "total". */
  readonly suffix = input('');
  /** Image icon; when empty, a projected `[stat-card-icon]` element is used instead. */
  readonly icon = input('');
  readonly compact = input(false);
  readonly showIcon = input(true);
  /** Custom tone colour (any CSS colour), overriding `tone`. */
  readonly accent = input('');
  /** Swaps only the value for a skeleton, keeping the icon, label and card chrome. */
  readonly loading = input(false);
  /** Skeleton width while loading. */
  readonly skeletonWidth = input('');
}
