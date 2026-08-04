import { DOCUMENT } from '@angular/common';
import { Component, Inject, input, output } from '@angular/core';
import { Dropdown, DropdownOption } from '../dropdown/dropdown';
const THEME_KEY = 'iotility-theme';
@Component({
  selector: 'shared-platform-header',
  imports: [Dropdown],
  templateUrl: './platform-header.html',
  styleUrl: './platform-header.css',
})
export class PlatformHeader {
  readonly showLive = input(false);
  readonly userName = input('Haris Khan');
  readonly userInitials = input('HK');
  readonly profileAction = output<DropdownOption>();
  protected readonly profileOptions: DropdownOption[] = [
    { id: 'profile', label: 'Profile', description: 'View your account', icon: 'user' },
    { id: 'logout', label: 'Logout', description: 'Return to login', icon: 'logout' },
  ];
  protected isDark = false;
  constructor(@Inject(DOCUMENT) private readonly document: Document) {
    const saved = localStorage.getItem(THEME_KEY);
    this.isDark = saved === null ? true : saved === 'dark';
    this.document.documentElement.classList.toggle('dark', this.isDark);
  }
  protected toggleTheme(): void {
    this.isDark = !this.isDark;
    this.document.documentElement.classList.toggle('dark', this.isDark);
    localStorage.setItem(THEME_KEY, this.isDark ? 'dark' : 'light');
  }
  protected selectProfileOption(option: DropdownOption): void {
    this.profileAction.emit(option);
  }
}
