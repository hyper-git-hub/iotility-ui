import { DOCUMENT } from '@angular/common';
import { Component, Inject, input, output } from '@angular/core';
import { Dropdown, DropdownOption } from '../dropdown/dropdown';
import { Tooltip } from '../tooltip/tooltip';
const THEME_KEY = 'iotility-theme';
@Component({
  selector: 'shared-platform-header',
  imports: [Dropdown, Tooltip],
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
  private themeTransitionTimer: number | undefined;
  constructor(@Inject(DOCUMENT) private readonly document: Document) {
    const saved = localStorage.getItem(THEME_KEY);
    this.isDark = saved === null ? true : saved === 'dark';
    this.document.documentElement.classList.toggle('dark', this.isDark);
  }
  protected toggleTheme(): void {
    const root = this.document.documentElement;
    root.classList.add('theme-transition');
    this.isDark = !this.isDark;
    root.classList.toggle('dark', this.isDark);
    localStorage.setItem(THEME_KEY, this.isDark ? 'dark' : 'light');
    if (this.themeTransitionTimer) {
      window.clearTimeout(this.themeTransitionTimer);
    }
    this.themeTransitionTimer = window.setTimeout(() => {
      root.classList.remove('theme-transition');
      this.themeTransitionTimer = undefined;
    }, 400);
  }
  protected selectProfileOption(option: DropdownOption): void {
    this.profileAction.emit(option);
  }
}
