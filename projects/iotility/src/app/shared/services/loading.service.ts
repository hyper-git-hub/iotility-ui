import { Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';

export interface LoadingConfig {
  label: string;
  title: string;
  message: string;
  initials: string;
  logoSrc?: string;
  labelLogoSrc?: string;
}

@Injectable({ providedIn: 'root' })
export class LoadingService {
  readonly isVisible = signal(false);
  readonly config = signal<LoadingConfig>({
    label: 'IoTility',
    title: 'Loading',
    message: 'Preparing your experience…',
    initials: 'io',
    logoSrc: undefined,
    labelLogoSrc: undefined,
  });

  private navigationTimer?: ReturnType<typeof setTimeout>;

  constructor(private readonly router: Router) {}

  showFor(config: LoadingConfig, duration = 1200): void {
    if (this.navigationTimer) return;

    this.config.set(config);
    this.isVisible.set(true);
    this.navigationTimer = setTimeout(() => this.reset(), duration);
  }

  navigate(url: string, config: LoadingConfig, duration = 1800): void {
    if (this.navigationTimer) return;

    this.config.set(config);
    this.isVisible.set(true);
    this.navigationTimer = setTimeout(() => {
      void this.router.navigateByUrl(url).finally(() => this.reset());
    }, duration);
  }

  private reset(): void {
    this.isVisible.set(false);
    this.navigationTimer = undefined;
  }
}
