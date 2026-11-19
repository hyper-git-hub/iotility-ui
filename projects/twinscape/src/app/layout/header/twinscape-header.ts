import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { DropdownOption, PlatformHeader, secureStorage } from '@iotility/shared-ui';

interface StoredUser {
  username?: string | null;
  first_name?: string;
  last_name?: string;
  email?: string;
  group?: string | null;
  user_type?: number;
}

@Component({
  selector: 'app-twinscape-header',
  imports: [PlatformHeader],
  templateUrl: './twinscape-header.html',
  styleUrl: './twinscape-header.css',
})
export class TwinscapeHeader {
  protected readonly identity = this.readIdentity();

  constructor(private readonly router: Router) {}

  protected handleProfileAction(option: DropdownOption): void {
    if (option.id === 'logout') {
      window.dispatchEvent(new CustomEvent('iotility:logout'));
      return;
    }
    void this.router.navigateByUrl('/home');
  }

  private readIdentity(): { name: string; initials: string; role: string } {
    try {
      const user = JSON.parse(secureStorage.get('user') || '{}') as StoredUser;
      const name =
        user.username?.trim() ||
        [user.first_name, user.last_name].filter(Boolean).join(' ') ||
        user.email ||
        'IoTility User';
      const parts = name.trim().split(/\s+/);
      const initials =
        `${parts[0]?.[0] || 'I'}${parts.length > 1 ? parts.at(-1)?.[0] || '' : ''}`.toUpperCase();
      const role = user.user_type === 1 ? 'Super Admin' : user.group?.trim() || 'Unassigned';
      return { name, initials, role };
    } catch {
      return { name: 'IoTility User', initials: 'IU', role: '' };
    }
  }
}
