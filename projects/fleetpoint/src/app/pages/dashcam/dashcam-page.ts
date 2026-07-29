import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { StatCard } from '../../shared/stat-card/stat-card';
import { DASHCAM_EVENTS } from './dashcam.data';

@Component({
  selector: 'app-dashcam-page',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, StatCard],
  templateUrl: './dashcam-page.html',
  styleUrl: './dashcam-page.css',
})
export class DashcamPage {
  protected readonly total = DASHCAM_EVENTS.length;
  protected readonly critical = DASHCAM_EVENTS.filter((event) => event.severity === 'Critical')
    .length;
  protected readonly unreviewed = DASHCAM_EVENTS.filter((event) => event.review === 'Unreviewed')
    .length;
  protected readonly violations = DASHCAM_EVENTS.filter((event) => event.review === 'Violation')
    .length;
  protected readonly falsePositiveRate = Math.round(
    (DASHCAM_EVENTS.filter((event) => event.review === 'False Positive').length /
      DASHCAM_EVENTS.length) *
      100,
  );
}
