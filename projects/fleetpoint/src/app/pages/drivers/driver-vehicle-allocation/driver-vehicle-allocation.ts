import { Component, OnInit, computed, signal } from '@angular/core';
import { BlockingLoader } from '@iotility/shared-ui';
import { finalize } from 'rxjs';
import {
  DriverApiService,
  DriverVehicleAllocation as AllocationRecord,
} from '../../../shared/services/driver-api.service';
import { FeedbackDialogBridgeService } from '../../../shared/services/feedback-dialog-bridge.service';
import { AllocationForm } from '../allocation-form/allocation-form';

@Component({
  selector: 'app-driver-vehicle-allocation',
  imports: [AllocationForm, BlockingLoader],
  templateUrl: './driver-vehicle-allocation.html',
  styleUrl: '../drivers-page.css',
})
export class DriverVehicleAllocation implements OnInit {
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly allocations = signal<AllocationRecord[]>([]);
  protected readonly total = signal(0);
  protected readonly offset = signal(0);
  protected readonly limit = 10;
  protected readonly start = computed(() => (this.total() ? this.offset() + 1 : 0));
  protected readonly end = computed(() => Math.min(this.offset() + this.limit, this.total()));

  protected readonly actionLoading = signal(false);
  protected readonly formOpen = signal(false);
  protected readonly selectedAllocation = signal<AllocationRecord | null>(null);
  constructor(
    private readonly api: DriverApiService,
    private readonly feedback: FeedbackDialogBridgeService,
  ) {}
  ngOnInit(): void {
    this.load();
  }
  protected driverName(allocation: AllocationRecord): string {
    return Array.isArray(allocation.driver_name)
      ? (allocation.driver_name[0] ?? '')
      : (allocation.driver_name ?? '');
  }
  protected driverLabel(allocation: AllocationRecord): string {
    return allocation.driver?.[0]
      ? `Driver ID ${allocation.driver[0]}`
      : 'Driver details unavailable';
  }
  protected initials(name: string): string {
    return (
      name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0])
        .join('')
        .toUpperCase() || 'DR'
    );
  }
  protected formatDate(value: string): string {
    if (!value) return 'Not set';
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime())
      ? value
      : new Intl.DateTimeFormat('en', { day: '2-digit', month: 'short', year: 'numeric' }).format(
          date,
        );
  }
  protected previous(): void {
    this.offset.update((value) => Math.max(0, value - this.limit));
    this.load();
  }
  protected next(): void {
    if (this.offset() + this.limit < this.total()) {
      this.offset.update((value) => value + this.limit);
      this.load();
    }
  }
  protected create(): void {
    this.selectedAllocation.set(null);
    this.formOpen.set(true);
  }
  protected edit(allocation: AllocationRecord): void {
    this.selectedAllocation.set(allocation);
    this.formOpen.set(true);
  }
  protected closeForm(): void {
    this.formOpen.set(false);
    this.selectedAllocation.set(null);
  }
  protected allocationSaved(): void {
    this.closeForm();
    this.offset.set(0);
    this.load();
  }
  protected async remove(allocation: AllocationRecord): Promise<void> {
    if (
      !(await this.feedback.open({
        type: 'warning',
        title: 'Delete allocation?',
        message: `The allocation for ${allocation.vehicle_name} will be permanently deleted.`,
        confirmText: 'Delete allocation',
        cancelText: 'Keep allocation',
        showCancel: true,
      }))
    )
      return;
    this.actionLoading.set(true);
    this.api
      .deleteDriverVehicleAllocation(allocation.id)
      .pipe(finalize(() => this.actionLoading.set(false)))
      .subscribe({
        next: async (response) => {
          await this.feedback.open({
            type: 'success',
            title: 'Allocation deleted',
            message: response.message || 'The allocation was deleted successfully.',
            confirmText: 'Done',
            showCancel: false,
          });
          this.load();
        },
        error: (response) => {
          const message = response.error?.message || 'The allocation could not be deleted.';
          void this.feedback.open({
            type: 'error',
            title: 'Unable to delete allocation',
            message,
            confirmText: 'Close',
            showCancel: false,
          });
        },
      });
  }
  private load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api
      .getDriverVehicleAllocations(this.limit, this.offset())
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (response) => {
          this.allocations.set(response.data?.data ?? []);
          this.total.set(response.data?.count ?? 0);
        },
        error: (response) => {
          this.allocations.set([]);
          this.total.set(0);
          this.error.set(response.error?.message || 'Driver allocations could not be loaded.');
        },
      });
  }
}
