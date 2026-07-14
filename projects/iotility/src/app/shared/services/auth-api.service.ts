import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface AuthApiResponse<T = unknown> {
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
  email?: string;
  first_name?: string;
  last_name?: string;
  username?: string | null;
  group?: string;
  language?: string;
  user_type?: number;
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
