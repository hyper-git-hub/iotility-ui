import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { Dropdown, DropdownOption, PlatformHeader } from '@iotility/shared-ui';

@Component({
  selector: 'app-header',
  imports: [Dropdown, PlatformHeader],
  templateUrl: './header.html',
  styleUrl: './header.css',
})
export class Header {
  protected readonly profileOptions: DropdownOption[] = [
    { id: 'profile', label: 'Profile', description: 'View your account', icon: 'user' },
    { id: 'logout', label: 'Logout', description: 'Return to login', icon: 'logout' },
  ];

  constructor(private readonly router: Router) {}

  protected handleProfileAction(option: DropdownOption): void {
    void this.router.navigateByUrl(option.id === 'logout' ? '/auth/login' : '/profile');
  }
}
