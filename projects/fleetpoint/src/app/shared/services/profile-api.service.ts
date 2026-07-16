import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../../iotility/src/environments/environment';

export interface ProfileApiResponse<T = unknown> {
  error?: boolean;
  message?: string;
  data?: T;
}

export interface UserProfile {
  guid?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  username?: string | null;
  phone?: string | null;
  department?: string | null;
  designation?: string | null;
  group?: string | null;
  user_type?: number;
  is_active?: boolean;
  date_joined?: string;
  image?: string | null;
  user_image?: string | null;
  permissions?: { code: string }[];
  customer?: {
    name?: string;
    timezone?: string;
    subscription_is_valid?: boolean;
    associations?: {
      package?: { name?: string };
    }[];
  } | null;
}

@Injectable({ providedIn: 'root' })
export class ProfileApiService {
  private readonly profileUrl = `${environment.userMsBaseUrl}/users/user-profile`;
  private readonly passwordUrl = `${environment.userMsBaseUrl}/users/authentication/password`;

  constructor(private readonly http: HttpClient) {}

  getUserProfile(): Observable<ProfileApiResponse<UserProfile>> {
    return this.http.get<ProfileApiResponse<UserProfile>>(this.profileUrl);
  }

  updateUserProfile(payload: FormData): Observable<ProfileApiResponse<UserProfile>> {
    return this.http.patch<ProfileApiResponse<UserProfile>>(this.profileUrl, payload);
  }

  changePassword(payload: {
    current_password: string;
    email: string;
    new_password: string;
  }): Observable<ProfileApiResponse> {
    return this.http.post<ProfileApiResponse>(this.passwordUrl, payload);
  }
}
