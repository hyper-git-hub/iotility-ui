import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, Inject, input, output } from '@angular/core';
import { Dropdown, DropdownOption } from '../dropdown/dropdown';
import { Tooltip } from '../tooltip/tooltip';
const THEME_KEY = 'iotility-theme';

@Component({
  selector: 'shared-user-menu',
  imports: [Dropdown, Tooltip],
  templateUrl: './user-menu.html',
  styleUrl: './user-menu.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserMenu {
  readonly userName = input('Haris Khan');
  readonly userInitials = input('HK');
  readonly userRole = input('');
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