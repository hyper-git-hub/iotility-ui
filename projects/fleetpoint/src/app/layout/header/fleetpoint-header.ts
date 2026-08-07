import { Component, output } from '@angular/core';
import { Router } from '@angular/router';
import { DropdownOption, Logo, PlatformHeader } from '@iotility/shared-ui';

@Component({
  selector: 'app-fleetpoint-header',
  imports: [Logo, PlatformHeader],
  templateUrl: './fleetpoint-header.html',
  styleUrl: './fleetpoint-header.css',
})
export class FleetpointHeader {
  readonly menuToggle = output<void>();
  constructor(private readonly router: Router) {}

  protected readonly identity = this.readIdentity();

  protected handleProfileAction(option: DropdownOption): void {
    if (option.id === 'logout') {
      window.dispatchEvent(new CustomEvent('iotility:logout'));
      return;
    }
    const profileUrl = this.router.url.startsWith('/fleetpoint')
      ? '/fleetpoint/profile'
      : '/profile';
    void this.router.navigateByUrl(profileUrl);
  }

  private readIdentity(): { name: string; initials: string } {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}') as {
        username?: string | null;
        first_name?: string;
        last_name?: string;
        email?: string;
      };
      const name =
        user.username?.trim() ||
        [user.first_name, user.last_name].filter(Boolean).join(' ') ||
        user.email ||
        'IoTility User';
      const parts = name.trim().split(/\s+/);
      const initials =
        `${parts[0]?.[0] || 'I'}${parts.length > 1 ? parts.at(-1)?.[0] || '' : ''}`.toUpperCase();
      return { name, initials };
    } catch {
      return { name: 'IoTility User', initials: 'IU' };
    }
  }
}
