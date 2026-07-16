import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface AuthApiResponse<T = unknown> {
  status?: number;
  error?: boolean;
  message?: string;
  data?: T;
}

export interface LoginResponseData {
  Token: string;
  fb_auth_token?: string;
  is_first_time_login?: boolean;
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
  work_location?: string | null;
  internal_role?: string | null;
  group?: string | null;
  language?: string;
  user_type?: number;
  is_active?: boolean;
  date_joined?: string;
  image?: string | null;
  user_image?: string | null;
  permissions?: { code: string }[];
  customer?: {
    customer_id?: number;
    name?: string;
    timezone?: string;
    subscription_is_valid?: boolean;
    associations?: {
      package?: { package_id?: number; name?: string; no_of_users?: number; usecase?: number };
    }[];
  } | null;
  [key: string]: unknown;
}

@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private readonly authenticationUrl = `${environment.userMsBaseUrl}/users/authentication`;

  constructor(private readonly http: HttpClient) {}

  login(email: string, password: string, remember: boolean): Observable<AuthApiResponse<LoginResponseData>> {
    return this.http.post<AuthApiResponse<LoginResponseData>>(`${this.authenticationUrl}/login`, {
      email: email.trim().toLowerCase(),
      password,
      remember,
      platform: 'WEB',
      usecase: environment.useCaseId,
    });
  }

  getUserProfile(): Observable<AuthApiResponse<UserProfile>> {
    return this.http.get<AuthApiResponse<UserProfile>>(`${environment.userMsBaseUrl}/users/user-profile`);
  }

  updateUserProfile(payload: FormData): Observable<AuthApiResponse<UserProfile>> {
    return this.http.patch<AuthApiResponse<UserProfile>>(
      `${environment.userMsBaseUrl}/users/user-profile`,
      payload,
    );
  }

  changePassword(payload: {
    current_password: string;
    email: string;
    new_password: string;
  }): Observable<AuthApiResponse> {
    return this.http.post<AuthApiResponse>(
      `${this.authenticationUrl}/password`,
      payload,
    );
  }

  getRoleAccess(): Observable<AuthApiResponse> {
    return this.http.get<AuthApiResponse>(`${environment.fleetBaseUrl}/api/role-access/feature`, {
      params: { usecase_id: environment.useCaseId },
    });
  }

  logout(email: string): Observable<AuthApiResponse> {
    return this.http.post<AuthApiResponse>(`${this.authenticationUrl}/logout`, { email });
  }

  requestPasswordReset(email: string): Observable<AuthApiResponse> {
    return this.http.post<AuthApiResponse>(`${this.authenticationUrl}/forgot`, {
      email: email.toLowerCase(),
      usecase_id: environment.useCaseId,
    });
  }

  verifyPasswordResetCode(email: string, otp: string): Observable<AuthApiResponse> {
    return this.http.post<AuthApiResponse>(`${this.authenticationUrl}/v2/mfa/verificationTwo`, {
      email: email.toLowerCase(),
      email_mfa_code: otp,
    });
  }

  resetPassword(email: string, otp: string, password: string): Observable<AuthApiResponse> {
    return this.http.post<AuthApiResponse>(`${this.authenticationUrl}/mfa/password`, {
      email: email.toLowerCase(),
      token: otp,
      password,
    });
  }

  resendPasswordResetCode(email: string): Observable<AuthApiResponse> {
    return this.http.post<AuthApiResponse>(`${this.authenticationUrl}/mfa`, {
      email: email.toLowerCase(),
      usecase_id: environment.useCaseId,
    });
  }
}
