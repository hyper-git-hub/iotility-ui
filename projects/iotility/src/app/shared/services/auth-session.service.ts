import { Injectable } from '@angular/core';
import { UserProfile } from './auth-api.service';
import { FirebaseAuthService } from './firebase-auth.service';

@Injectable({ providedIn: 'root' })
export class AuthSessionService {
  constructor(private readonly firebaseAuth: FirebaseAuthService) {}

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
    return Boolean(token && this.user && !this.isTokenExpired(token));
  }

  clear(): void {
    this.sessionKeys.forEach((key) => localStorage.removeItem(key));
    void this.firebaseAuth.signOut();
  }

  private isTokenExpired(token: string): boolean {
    const parts = token.split('.');
    if (parts.length !== 3) return false;

    try {
      const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const decoded = JSON.parse(atob(payload)) as { exp?: unknown };
      return typeof decoded.exp === 'number' && Date.now() >= decoded.exp * 1000;
    } catch {
      return true;
    }
  }
}
