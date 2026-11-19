import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { UnderDevelopment } from '../../shared/under-development/under-development';

@Component({
  selector: 'app-home-page',
  imports: [UnderDevelopment],
  templateUrl: './home-page.html',
  styleUrl: './home-page.css',
})
export class HomePage {
  protected readonly appName = 'Twinscape';
  protected readonly description = 'Smarter solutions for smarter buildings.';
  protected readonly logo = 'assets/twinscape.svg';

  private readonly router = inject(Router);

  protected goBack(): void {
    void this.router.navigateByUrl('/home');
  }
}
