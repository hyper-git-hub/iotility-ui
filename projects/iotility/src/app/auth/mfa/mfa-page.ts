import { HttpErrorResponse } from '@angular/common/http';
import { NgTemplateOutlet } from '@angular/common';
import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { BlockingLoader, SmoothHeight } from '@iotility/shared-ui';
import QRCode from 'qrcode';
import { finalize, interval, Subscription } from 'rxjs';
import {
  AuthApiResponse,
  AuthApiService,
  MfaConfiguration,
  UserProfile,
} from '../../shared/services/auth-api.service';
import { AuthSessionService } from '../../shared/services/auth-session.service';
import { FeedbackDialogService } from '../../shared/services/feedback-dialog.service';

type MfaView = 'loading' | 'choose' | 'setup-code' | 'setup-passkey' | 'verify';
type MfaMode = 'otp' | 'passkey';

@Component({
  selector: 'app-mfa-page',
  imports: [BlockingLoader, NgTemplateOutlet, ReactiveFormsModule, SmoothHeight],
  templateUrl: './mfa-page.html',
  styleUrl: './mfa-page.css',
})
export class MfaPage implements OnInit, OnDestroy {
  protected readonly view = signal<MfaView>('loading');
  protected readonly mode = signal<MfaMode>('otp');
  protected readonly submitting = signal(false);
  protected readonly message = signal('');
  protected readonly error = signal('');
  protected readonly secondsLeft = signal(0);
  protected readonly method = signal('2');
  protected readonly qrCode = signal('');
  protected readonly form;

  private profile: UserProfile | null = null;
  private timer?: Subscription;

  constructor(
    formBuilder: FormBuilder,
    private readonly authApi: AuthApiService,
    private readonly authSession: AuthSessionService,
    private readonly feedbackDialog: FeedbackDialogService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
  ) {
    this.form = formBuilder.nonNullable.group({
      otp: ['', [Validators.required, Validators.pattern(/^\d{4,6}$/)]],
      passkey: ['', [Validators.required, Validators.pattern(/^\d{4}$/)]],
    });
  }

  ngOnInit(): void {
    const rawProfile = sessionStorage.getItem('pendingAuthProfile');
    const token = localStorage.getItem('userMS-token') || localStorage.getItem('token');
    if (!rawProfile || !token) {
      this.cancel();
      return;
    }
    try {
      this.profile = JSON.parse(rawProfile) as UserProfile;
    } catch {
      this.cancel();
      return;
    }
    this.loadConfiguration();
  }

  protected selectMethod(method: '2' | '3'): void {
    this.method.set(method);
    this.resetInputs();
    if (method === '3') {
      void this.prepareAuthenticator();
      this.view.set('setup-code');
      return;
    }
    this.view.set('setup-code');
    this.sendOtp();
  }

  protected verifySetupCode(): void {
    const otp = this.form.controls.otp;
    otp.markAsTouched();
    if (otp.invalid) return;
    if (this.method() === '3') {
      void this.verifyAuthenticator(otp.value).then((valid) => {
        if (!valid) {
          this.error.set('Invalid authenticator code. Please try again.');
          return;
        }
        this.request(
          this.authApi.updateMfa({ email: this.email, save_otp: true, method: '3' }),
          () => this.openPasskeySetup(),
        );
      });
      return;
    }
    this.request(
      this.authApi.updateMfa({ email: this.email, get_otp: true, otp: otp.value }),
      () => this.openPasskeySetup(),
    );
  }

  protected savePasskey(): void {
    const passkey = this.form.controls.passkey;
    passkey.markAsTouched();
    if (passkey.invalid) return;
    this.request(this.authApi.setupPasskey(this.email, passkey.value), () => this.completeLogin());
  }

  protected skipSetup(): void {
    this.request(
      this.authApi.updateMfa({ email: this.email, skip: true, save_otp: true }),
      () => this.completeLogin(),
    );
  }

  protected sendOtp(): void {
    this.request(
      this.authApi.updateMfa({ email: this.email, save_otp: true, method: this.method() }),
      () => {
        this.message.set(`A verification code was sent to your ${this.methodName.toLowerCase()}.`);
        this.startTimer();
      },
    );
  }

  protected verify(): void {
    if (this.mode() === 'passkey') {
      const passkey = this.form.controls.passkey;
      passkey.markAsTouched();
      if (passkey.invalid) return;
      this.request(
        this.authApi.updateMfa({
          email: this.email,
          get_otp: true,
          passkey: passkey.value,
          method: '4',
        }),
        () => this.completeLogin(),
      );
      return;
    }

    const otp = this.form.controls.otp;
    otp.markAsTouched();
    if (otp.invalid) return;
    if (this.method() === '3') {
      void this.verifyAuthenticator(otp.value).then((valid) =>
        valid ? this.completeLogin() : this.error.set('Invalid authenticator code. Please try again.'),
      );
      return;
    }
    this.request(
      this.authApi.updateMfa({ email: this.email, get_otp: true, otp: otp.value }),
      () => this.completeLogin(),
    );
  }

  protected changeMode(): void {
    this.error.set('');
    this.mode.update((mode) => (mode === 'otp' ? 'passkey' : 'otp'));
    if (this.mode() === 'otp' && this.method() !== '3' && this.secondsLeft() === 0) this.sendOtp();
  }

  protected cancel(): void {
    sessionStorage.removeItem('pendingAuthProfile');
    this.authSession.clear();
    void this.router.navigate(['/auth/login']);
  }

  protected get email(): string {
    return typeof this.profile?.email === 'string' ? this.profile.email : '';
  }

  protected get methodName(): string {
    return this.method() === '1' ? 'SMS' : this.method() === '3' ? 'Authenticator app' : 'Email';
  }

  protected get otpLength(): number {
    return this.method() === '3' ? 6 : 4;
  }

  private loadConfiguration(): void {
    this.request(this.authApi.getMfaConfiguration(this.email), (response) => {
      const config = response.data;
      if (response.status === 322 || !config?.authentication_registration) {
        this.view.set('choose');
      } else if (!config.passkey_flag) {
        this.openPasskeySetup();
      } else {
        this.method.set(String(config.method ?? '2'));
        this.view.set('verify');
        if (this.method() !== '3') this.sendOtp();
      }
    });
  }

  private openPasskeySetup(): void {
    this.resetInputs();
    this.view.set('setup-passkey');
  }

  private completeLogin(): void {
    this.request(this.authApi.getRoleAccess(), (response) => {
      if (response.error) throw new Error(response.message || 'Unable to load access permissions.');
      const roleData = (response.data ?? {}) as { features?: Array<string | number> };
      const features = Array.isArray(roleData.features) ? roleData.features : [];
      if (this.profile?.user_type === 5 && !features.some((id) => Number(id) === 70)) features.push(70);
      const user = { ...(this.profile ?? {}), use_cases: 6, menuaccess: features };
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('language', this.profile?.language || 'en');
      localStorage.setItem('menuaccess', JSON.stringify(features));
      localStorage.setItem('roleAccess', JSON.stringify(roleData));
      sessionStorage.removeItem('pendingAuthProfile');
      const returnUrl = this.safeReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl'));
      void this.router.navigateByUrl(returnUrl);
    });
  }

  private request<T>(request: import('rxjs').Observable<AuthApiResponse<T>>, success: (response: AuthApiResponse<T>) => void): void {
    this.submitting.set(true);
    this.error.set('');
    request.pipe(finalize(() => this.submitting.set(false))).subscribe({
      next: (response) => {
        if (response.error && response.status !== 322) {
          this.showError(response.message || 'The request could not be completed.');
          return;
        }
        try { success(response); } catch (error) { this.showError((error as Error).message); }
      },
      error: (response: HttpErrorResponse) => this.showError(this.errorMessage(response)),
    });
  }

  private showError(message: string): void {
    this.error.set(message);
    void this.feedbackDialog.open({
      type: 'error', title: 'Verification unsuccessful', message,
      confirmText: 'Try again', showCancel: false,
    });
  }

  private errorMessage(response: HttpErrorResponse): string {
    const body = response.error as AuthApiResponse | string | null;
    return typeof body === 'string' ? body : body?.message || 'The authentication service is temporarily unavailable.';
  }

  private startTimer(): void {
    this.timer?.unsubscribe();
    this.secondsLeft.set(30);
    this.timer = interval(1000).subscribe(() => {
      this.secondsLeft.update((value) => Math.max(0, value - 1));
      if (this.secondsLeft() === 0) this.timer?.unsubscribe();
    });
  }

  private resetInputs(): void {
    this.form.controls.otp.reset();
    this.form.controls.passkey.reset();
    this.error.set('');
    this.message.set('');
  }

  private async prepareAuthenticator(): Promise<void> {
    const uri = `otpauth://totp/IoTility:${encodeURIComponent(this.email)}?secret=${this.totpSecret()}&issuer=IoTility&algorithm=SHA1&digits=6&period=30`;
    this.qrCode.set(await QRCode.toDataURL(uri, { width: 220, margin: 1 }));
  }

  private async verifyAuthenticator(code: string): Promise<boolean> {
    const counter = Math.floor(Date.now() / 30_000);
    for (let offset = -1; offset <= 1; offset++) {
      if ((await this.totp(counter + offset)) === code) return true;
    }
    return false;
  }

  private async totp(counter: number): Promise<string> {
    const secretBytes = this.base32Bytes(this.totpSecret());
    const secretBuffer = new ArrayBuffer(secretBytes.byteLength);
    new Uint8Array(secretBuffer).set(secretBytes);
    const key = await crypto.subtle.importKey('raw', secretBuffer, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
    const buffer = new ArrayBuffer(8);
    const view = new DataView(buffer);
    view.setUint32(4, counter, false);
    const hash = new Uint8Array(await crypto.subtle.sign('HMAC', key, buffer));
    const offset = hash[hash.length - 1] & 15;
    const value = ((hash[offset] & 127) << 24) | (hash[offset + 1] << 16) | (hash[offset + 2] << 8) | hash[offset + 3];
    return String(value % 1_000_000).padStart(6, '0');
  }

  private totpSecret(): string {
    return String(this.profile?.guid ?? '').toUpperCase().replace(/-/g, '').replace(/0/g, 'O').replace(/1/g, 'I').replace(/[89]/g, '2');
  }

  private base32Bytes(value: string): Uint8Array {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = '';
    for (const character of value) bits += alphabet.indexOf(character).toString(2).padStart(5, '0');
    const bytes: number[] = [];
    for (let index = 0; index + 8 <= bits.length; index += 8) bytes.push(parseInt(bits.slice(index, index + 8), 2));
    return new Uint8Array(bytes);
  }

  private safeReturnUrl(url: string | null): string {
    return url?.startsWith('/') && !url.startsWith('//') && !url.startsWith('/auth') ? url : '/home';
  }

  ngOnDestroy(): void { this.timer?.unsubscribe(); }
}
