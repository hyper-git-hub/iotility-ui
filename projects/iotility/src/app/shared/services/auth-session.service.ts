import { Injectable } from '@angular/core';
import { UserProfile } from './auth-api.service';

@Injectable({ providedIn: 'root' })
export class AuthSessionService {
  private readonly sessionKeys = [
    'token',
    'userMS-token',
    'user',
    'language',
    'configurations',
    'notificationCount',
    'usergroups',
    'menuaccess',
    'roleAccess',
    'vehiclesListing',
    'brandingData',
  ];

  get user(): UserProfile | null {
    const storedUser = localStorage.getItem('user');
    if (!storedUser) return null;
    try {
      return JSON.parse(storedUser) as UserProfile;
    } catch {
      return null;
    }
  }

  get email(): string {
    return typeof this.user?.email === 'string' ? this.user.email : '';
  }

  get isAuthenticated(): boolean {
    const token = localStorage.getItem('userMS-token') || localStorage.getItem('token');
    return Boolean(token && this.user);
  }

  clear(): void {
    this.sessionKeys.forEach((key) => localStorage.removeItem(key));
  }
}
