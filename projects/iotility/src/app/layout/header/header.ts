import { Component, output } from '@angular/core';
import { Router } from '@angular/router';
import { DropdownOption, PlatformHeader } from '@iotility/shared-ui';
import { AuthLogoutService } from '../../shared/services/auth-logout.service';
import { AuthSessionService } from '../../shared/services/auth-session.service';

@Component({
  selector: 'app-header',
  imports: [PlatformHeader],
  templateUrl: './header.html',
  styleUrl: './header.css',
})
export class Header {
  readonly menuToggle = output<void>();
  constructor(
    private readonly logout: AuthLogoutService,
    private readonly session: AuthSessionService,
    private readonly router: Router,
  ) {}
  protected get userName(): string {
    const user = this.session.user;
    return (
      user?.username?.trim() ||
      [user?.first_name, user?.last_name].filter(Boolean).join(' ') ||
      user?.email ||
      'IoTility User'
    );
  }
  protected get userInitials(): string {
    const parts = this.userName.trim().split(/\s+/);
    return `${parts[0]?.[0] || 'I'}${parts.length > 1 ? parts.at(-1)?.[0] || '' : ''}`.toUpperCase();
  }
  protected handleProfileAction(option: DropdownOption): void {
    if (option.id === 'logout') {
      void this.logout.request();
      return;
    }
    void this.router.navigateByUrl('/fleetpoint/profile');
  }
}
