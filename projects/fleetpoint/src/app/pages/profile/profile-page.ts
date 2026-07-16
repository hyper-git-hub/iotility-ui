import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { BlockingLoader, SmoothHeight } from '@iotility/shared-ui';
import { finalize } from 'rxjs';
import { FeedbackDialogBridgeService } from '../../shared/services/feedback-dialog-bridge.service';
import { ProfileApiService, UserProfile } from '../../shared/services/profile-api.service';

@Component({
  selector: 'app-profile-page',
  imports: [BlockingLoader, DatePipe, ReactiveFormsModule, SmoothHeight],
  templateUrl: './profile-page.html',
  styleUrl: './profile-page.css',
})
export class ProfilePage implements OnInit {
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly profile = signal<UserProfile | null>(null);
  protected readonly editing = signal(false);
  protected readonly saving = signal(false);
  protected readonly changingPassword = signal(false);
  protected readonly showPasswords = signal(false);
  protected readonly selectedImage = signal<File | null>(null);
  protected readonly imagePreview = signal('');
  protected readonly profileForm;
  protected readonly passwordForm;
  protected readonly fullName = computed(() => {
    const user = this.profile();
    return [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.username || 'IoTility User';
  });
  protected readonly initials = computed(() => {
    const parts = this.fullName().trim().split(/\s+/);
    return `${parts[0]?.[0] ?? 'I'}${parts.length > 1 ? parts.at(-1)?.[0] ?? '' : ''}`.toUpperCase();
  });
  protected readonly role = computed(() => {
    const user = this.profile();
    return user?.group || user?.designation || ({ 1: 'Super Admin', 2: 'Admin', 5: 'Maintenance User' } as Record<number, string>)[user?.user_type ?? 0] || 'Platform User';
  });
  protected readonly packageName = computed(() =>
    this.profile()?.customer?.associations?.[0]?.package?.name || 'Not assigned',
  );
  protected readonly imageUrl = computed(() => this.imagePreview() || this.profile()?.user_image || this.profile()?.image || '');

  constructor(
    private readonly authApi: ProfileApiService,
    private readonly feedback: FeedbackDialogBridgeService,
    formBuilder: FormBuilder,
  ) {
    this.profileForm = formBuilder.nonNullable.group({
      firstName: ['', [Validators.required, Validators.pattern(/^[\p{L} ]+$/u)]],
      lastName: ['', [Validators.required, Validators.pattern(/^[\p{L} ]+$/u)]],
      phone: ['', Validators.required],
    });
    this.passwordForm = formBuilder.nonNullable.group({
      currentPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, Validators.pattern(/^(?=[^A-Z]*[A-Z])(?=[^a-z]*[a-z])(?=[^0-9]*[0-9]).{8,15}$/)]],
      confirmPassword: ['', Validators.required],
    });
  }

  ngOnInit(): void { this.loadProfile(); }

  protected loadProfile(): void {
    this.loading.set(true);
    this.error.set('');
    this.authApi.getUserProfile().pipe(finalize(() => this.loading.set(false))).subscribe({
      next: (response) => {
        if (!response.data) { this.error.set(response.message || 'Profile details could not be loaded.'); return; }
        this.profile.set(response.data);
        this.patchProfileForm(response.data);
        localStorage.setItem('user', JSON.stringify(response.data));
      },
      error: (response) => this.error.set(response.error?.message || 'Profile details could not be loaded.'),
    });
  }

  protected startEditing(): void { this.editing.set(true); }

  protected cancelEditing(): void {
    const user = this.profile();
    if (user) this.patchProfileForm(user);
    this.selectedImage.set(null);
    this.imagePreview.set('');
    this.editing.set(false);
  }

  protected chooseImage(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/') || file.size > 1_000_000) {
      input.value = '';
      void this.feedback.open({ type: 'error', title: 'Invalid image', message: 'Choose a JPG or PNG image smaller than 1 MB.', confirmText: 'Close', showCancel: false });
      return;
    }
    this.selectedImage.set(file);
    const reader = new FileReader();
    reader.onload = () => this.imagePreview.set(String(reader.result || ''));
    reader.readAsDataURL(file);
  }

  protected saveProfile(): void {
    this.profileForm.markAllAsTouched();
    const user = this.profile();
    if (this.profileForm.invalid || !user?.guid) return;
    const values = this.profileForm.getRawValue();
    const payload = new FormData();
    payload.append('guid', user.guid);
    payload.append('first_name', values.firstName.trim());
    payload.append('last_name', values.lastName.trim());
    payload.append('phone', values.phone.trim().startsWith('+') ? values.phone.trim() : `+${values.phone.replace(/[-\s]/g, '')}`);
    if (this.selectedImage()) payload.append('image', this.selectedImage()!);
    this.saving.set(true);
    this.authApi.updateUserProfile(payload).pipe(finalize(() => this.saving.set(false))).subscribe({
      next: (response) => {
        const updated = response.data || { ...user, first_name: values.firstName, last_name: values.lastName, phone: values.phone };
        this.profile.set(updated);
        localStorage.setItem('user', JSON.stringify(updated));
        this.selectedImage.set(null);
        this.imagePreview.set('');
        this.editing.set(false);
        void this.feedback.open({ type: 'success', title: 'Profile updated', message: 'Your profile details have been saved successfully.', confirmText: 'Done', showCancel: false });
      },
      error: (response) => void this.feedback.open({ type: 'error', title: 'Profile not updated', message: response.error?.message || 'We could not save your profile changes.', confirmText: 'Close', showCancel: false }),
    });
  }

  protected savePassword(): void {
    this.passwordForm.markAllAsTouched();
    const values = this.passwordForm.getRawValue();
    if (this.passwordForm.invalid) return;
    if (values.newPassword !== values.confirmPassword) {
      this.passwordForm.controls.confirmPassword.setErrors({ mismatch: true });
      return;
    }
    this.changingPassword.set(true);
    this.authApi.changePassword({ current_password: values.currentPassword, email: this.profile()?.email || '', new_password: values.newPassword })
      .pipe(finalize(() => this.changingPassword.set(false)))
      .subscribe({
        next: () => {
          this.passwordForm.reset();
          void this.feedback.open({ type: 'success', title: 'Password changed', message: 'Your password has been updated successfully.', confirmText: 'Done', showCancel: false });
        },
        error: (response) => void this.feedback.open({ type: 'error', title: 'Password not changed', message: response.error?.message || 'Please check your current password and try again.', confirmText: 'Close', showCancel: false }),
      });
  }

  private patchProfileForm(user: UserProfile): void {
    this.profileForm.reset({ firstName: user.first_name || '', lastName: user.last_name || '', phone: user.phone || '' });
  }
}
