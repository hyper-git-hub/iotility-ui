import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, Inject, input, output } from '@angular/core';
import { Dropdown, DropdownOption } from '../dropdown/dropdown';
import { Tooltip } from '../tooltip/tooltip';
import { applyTheme, prefersDarkTheme } from '../theme/theme';

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
    // index.html already applied the theme before first paint; this only reads it back.
    this.isDark = prefersDarkTheme();
  }
  protected toggleTheme(): void {
    const root = this.document.documentElement;
    root.classList.add('theme-transition');
    this.isDark = !this.isDark;
    applyTheme(this.isDark, true, root);
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