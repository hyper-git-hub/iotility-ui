import { TabIndicator } from '@iotility/shared-ui';
import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { StatCard } from '../../shared/stat-card/stat-card';
import { NOT_AVAILABLE } from './dashcam.data';
import { DashcamStore } from './dashcam.store';

@Component({
  selector: 'app-dashcam-page',
  imports: [TabIndicator, RouterLink, RouterLinkActive, RouterOutlet, StatCard],
  templateUrl: './dashcam-page.html',
  styleUrl: './dashcam-page.css',
})
export class DashcamPage {
  private readonly store = inject(DashcamStore);
  /** False until the first devices/events response; stat cards show skeletons. */
  protected readonly loaded = this.store.loaded;
  protected readonly total = computed(() => this.store.events().length);
  protected readonly today = computed(() => {
    const day = new Date().toDateString();
    return this.store.events().filter((event) => event.time !== null && new Date(event.time).toDateString() === day)
      .length;
  });
  /** The API has no severity or review state for DashCam events. */
  protected readonly critical = NOT_AVAILABLE;
  protected readonly unreviewed = NOT_AVAILABLE;
  protected readonly violations = NOT_AVAILABLE;
  protected readonly falsePositiveRate = NOT_AVAILABLE;

  constructor() {
    this.store.refresh();
  }
}
