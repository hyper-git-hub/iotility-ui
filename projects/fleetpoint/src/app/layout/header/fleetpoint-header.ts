import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { DropdownOption, PlatformHeader } from '@iotility/shared-ui';

@Component({
  selector: 'app-fleetpoint-header',
  imports: [PlatformHeader],
  templateUrl: './fleetpoint-header.html',
  styleUrl: './fleetpoint-header.css',
})
export class FleetpointHeader {
  constructor(private readonly router: Router) {}

  protected readonly identity = this.readIdentity();

  protected handleProfileAction(option: DropdownOption): void {
    if (option.id === 'logout') {
      window.dispatchEvent(new CustomEvent('iotility:logout'));
      return;
    }
    void this.router.navigateByUrl('/profile');
  }

  private readIdentity(): { name: string; role: string; initials: string } {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}') as {
        username?: string | null; first_name?: string; last_name?: string;
        email?: string; group?: string; user_type?: number;
      };
      const name = user.username?.trim() || [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email || 'IoTility User';
      const parts = name.trim().split(/\s+/);
      const initials = `${parts[0]?.[0] || 'I'}${parts.length > 1 ? parts.at(-1)?.[0] || '' : ''}`.toUpperCase();
      const role = user.group || ({ 1: 'Super Admin', 2: 'Admin', 5: 'Maintenance User' } as Record<number, string>)[user.user_type ?? 0] || 'Platform User';
      return { name, role, initials };
    } catch {
      return { name: 'IoTility User', role: 'Platform User', initials: 'IU' };
    }
  }
}
