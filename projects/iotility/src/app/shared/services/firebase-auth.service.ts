import { Injectable } from '@angular/core';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signOut } from 'firebase/auth';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class FirebaseAuthService {
  async signIn(customToken?: string): Promise<boolean> {
    if (!customToken) return false;
    try {
      const credential = await signInWithCustomToken(this.auth, customToken);
      return Boolean(credential.user);
    } catch (error) {
      console.error('Firebase notification authentication failed.', error);
      return false;
    }
  }

  async signOut(): Promise<void> {
    try {
      await signOut(this.auth);
    } catch {
      // The platform session must still be cleared if Firebase is unavailable.
    }
  }

  private get auth() {
    const app = getApps().length ? getApp() : initializeApp(environment.firebase);
    return getAuth(app);
  }
}
