import { Component, OnInit, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  BlockingLoader,
  DataTable,
  DataTableSkeleton,
  Dropdown,
  DropdownOption,
  Skeleton,
  StatCardSkeleton,
  TableAction,
  TableColumn,
  TableRow,
} from '@iotility/shared-ui';
import { finalize } from 'rxjs';
import { StatCard } from '../../../shared/stat-card/stat-card';
import {
  DriverApiService,
  DriverGroup,
  DriverRecord,
} from '../../../shared/services/driver-api.service';
import { FeedbackDialogBridgeService } from '../../../shared/services/feedback-dialog-bridge.service';
import { DriverForm } from '../driver-form/driver-form';

@Component({
  selector: 'app-driver-list',
  imports: [
    BlockingLoader,
    DataTable,
    DataTableSkeleton,
    DriverForm,
    Dropdown,
    Skeleton,
    StatCard,
    StatCardSkeleton,
  ],
  templateUrl: './driver-list.html',
  styleUrl: '../drivers-page.css',
})
export class DriverList implements OnInit {
  private searchTimer?: ReturnType<typeof setTimeout>;
  protected readonly loading = signal(true);
  protected readonly hasLoaded = signal(false);
  protected readonly initialLoading = computed(() => this.loading() && !this.hasLoaded());
  protected readonly refreshing = computed(() => this.loading() && this.hasLoaded());
  protected readonly actionLoading = signal(false);
  protected readonly formOpen = signal(false);
  protected readonly error = signal('');
  protected readonly records = signal<DriverRecord[]>([]);
  protected readonly groups = signal<DriverGroup[]>([]);
  protected readonly selectedDriver = signal<DriverRecord | null>(null);
  protected readonly total = signal(0);
  protected readonly offset = signal(0);
  protected readonly search = signal('');
  protected readonly groupId = signal('');
  protected readonly driverId = signal('');
  protected readonly cardType = signal('');
  protected readonly limit = 10;
  protected readonly actions: TableAction[] = ['map', 'edit', 'delete'];
  protected readonly columns: TableColumn[] = [
    { key: 'name', label: 'Driver', type: 'user', secondaryKey: 'details', clickable: true },
    { key: 'employeeId', label: 'Employee ID' },
    { key: 'group', label: 'Group' },
    { key: 'shift', label: 'Shift Status', type: 'status' },
    { key: 'phone', label: 'Phone' },
    { key: 'email', label: 'Email' },
    { key: 'salary', label: 'Salary' },
    { key: 'joined', label: 'Date Joined', type: 'date' },
    { key: 'status', label: 'Status', type: 'status' },
    { key: 'actions', label: 'Actions', type: 'actions' },
  ];
  protected readonly columnLabels = this.columns.map((column) => column.label);
  protected readonly groupOptions = computed<DropdownOption[]>(() => [
    { id: '', label: 'All groups' },
    ...this.groups().map((g) => ({ id: String(g.id), label: `${g.name} (${g.driver_count})` })),
  ]);
  protected readonly selectedGroup = computed(() =>
    this.groups().find((g) => String(g.id) === this.groupId()),
  );
  protected readonly visibleRecords = computed(() => {
    const source = this.selectedGroup()?.drivers ?? this.records();
    return this.driverId() ? source.filter((d) => String(d.id) === this.driverId()) : source;
  });
  protected readonly driverOptions = computed<DropdownOption[]>(() => [
    { id: '', label: 'All drivers' },
    ...this.visibleRecords().map((d) => ({ id: String(d.id), label: d.name })),
  ]);
  protected readonly typeOptions: DropdownOption[] = [
    { id: '', label: 'All types' },
    { id: 'free-drivers', label: 'Free Drivers' },
  ];
  protected readonly rows = computed<TableRow[]>(() =>
    this.visibleRecords().map((d) => ({
      id: d.id,
      name: d.name || 'Unnamed driver',
      details: d.email || 'No email',
      employeeId: d.employee_id || 'Not available',
      group: d.group || 'Unallocated',
      shift: this.shiftStatus(d),
      phone: d.phone || 'Not available',
      email: d.email || 'Not available',
      salary: d.salary || 'Not available',
      joined: this.date(d.data_joined),
      status: d.status === 1 || d.status === '1' ? 'Active' : 'Inactive',
      actions: '',
    })),
  );
  protected readonly onShift = computed(
    () => this.visibleRecords().filter((d) => this.hasActiveShift(d)).length,
  );
  protected readonly active = computed(
    () => this.visibleRecords().filter((d) => d.status === 1 || d.status === '1').length,
  );
  protected readonly unallocated = computed(
    () => this.visibleRecords().filter((d) => !d.group && !d.shift_allocated).length,
  );
  protected readonly displayedTotal = computed(() =>
    this.groupId() || this.driverId() ? this.visibleRecords().length : this.total(),
  );
  protected readonly pageStart = computed(() =>
    this.displayedTotal() ? (this.groupId() || this.driverId() ? 1 : this.offset() + 1) : 0,
  );
  protected readonly pageEnd = computed(() =>
    this.groupId() || this.driverId()
      ? this.visibleRecords().length
      : Math.min(this.offset() + this.limit, this.total()),
  );
  constructor(
    private readonly api: DriverApiService,
    private readonly feedback: FeedbackDialogBridgeService,
    private readonly router: Router,
  ) {}
  ngOnInit(): void {
    this.refreshGroups();
    this.loadDrivers();
  }
  protected tableSearchChanged(v: string): void {
    this.search.set(v);
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.offset.set(0);
      this.loadDrivers();
    }, 400);
  }
  protected selectGroup(o: DropdownOption): void {
    this.groupId.set(o.id);
    this.driverId.set('');
  }
  protected selectDriver(o: DropdownOption): void {
    this.driverId.set(o.id);
  }
  protected selectType(o: DropdownOption): void {
    this.cardType.set(o.id);
    this.offset.set(0);
    this.loadDrivers();
  }
  protected resetFilters(): void {
    this.groupId.set('');
    this.driverId.set('');
    this.cardType.set('');
    this.offset.set(0);
    this.loadDrivers();
  }
  protected optionLabel(options: DropdownOption[], id: string, fallback: string): string {
    return options.find((o) => o.id === id)?.label || fallback;
  }
  protected openCreateForm(): void {
    this.selectedDriver.set(null);
    this.formOpen.set(true);
  }
  protected closeForm(): void {
    this.formOpen.set(false);
    this.selectedDriver.set(null);
  }
  protected driverSaved(): void {
    this.closeForm();
    this.offset.set(0);
    this.refreshGroups();
    this.loadDrivers();
  }
  protected handleRowAction(e: { action: TableAction; row: TableRow }): void {
    if (e.action === 'delete') void this.deleteDriver(e.row);
    else if (e.action === 'edit') {
      const d = this.visibleRecords().find((x) => x.id === Number(e.row['id']));
      if (d) {
        this.selectedDriver.set(d);
        this.formOpen.set(true);
      }
    }
  }
  protected openDriver(row: TableRow): void {
    void this.router.navigate(['/fleetpoint/drivers', row['id']]);
  }
  protected previousPage(): void {
    this.offset.update((v) => Math.max(0, v - this.limit));
    this.loadDrivers();
  }
  protected nextPage(): void {
    if (this.offset() + this.limit < this.total()) {
      this.offset.update((v) => v + this.limit);
      this.loadDrivers();
    }
  }
  protected loadDrivers(): void {
    this.loading.set(true);
    this.error.set('');
    this.api
      .getDrivers({
        limit: this.limit,
        offset: this.offset(),
        searchText: this.search().trim(),
        cardType: this.cardType(),
      })
      .pipe(
        finalize(() => {
          this.loading.set(false);
          this.hasLoaded.set(true);
        }),
      )
      .subscribe({
        next: (r) => {
          this.records.set(r.data?.data ?? []);
          this.total.set(r.data?.count ?? 0);
        },
        error: (r) => {
          const message = r.error?.message || 'Drivers could not be loaded.';
          this.error.set(message);
          void this.feedback.open({
            type: 'error',
            title: 'Unable to load drivers',
            message,
            confirmText: 'Close',
            showCancel: false,
          });
        },
      });
  }
  private refreshGroups(): void {
    this.api.getGroups().subscribe({ next: (r) => this.groups.set(r.data?.data ?? []) });
  }
  private date(v: string | null | undefined): string {
    return v ? v.slice(0, 10) : 'Not available';
  }
  private shiftStatus(driver: DriverRecord): string {
    const shifts = Array.isArray(driver.shift_allocated) ? driver.shift_allocated : [];
    if (!shifts.length) return 'Not available';
    if (shifts.some((shift) => shift.shift__status === 1 || shift.shift__status === '1')) {
      return 'Active';
    }
    return 'Inactive';
  }
  private hasActiveShift(driver: DriverRecord): boolean {
    return (
      Array.isArray(driver.shift_allocated) &&
      driver.shift_allocated.some(
        (shift) => shift.shift__status === 1 || shift.shift__status === '1',
      )
    );
  }
  private async deleteDriver(row: TableRow): Promise<void> {
    const name = String(row['name'] || 'this driver');
    if (
      !(await this.feedback.open({
        type: 'warning',
        title: 'Delete driver?',
        message: `${name} will be permanently deleted.`,
        confirmText: 'Delete driver',
        cancelText: 'Keep driver',
        showCancel: true,
      }))
    )
      return;
    this.actionLoading.set(true);
    this.api.deleteDriver(String(row['id'])).subscribe({
      next: async () => {
        this.actionLoading.set(false);
        await this.feedback.open({
          type: 'success',
          title: 'Driver deleted',
          message: `${name} was deleted successfully.`,
          confirmText: 'Done',
          showCancel: false,
        });
        this.refreshGroups();
        this.loadDrivers();
      },
      error: (r) => {
        this.actionLoading.set(false);
        const m = r.error?.message || 'Driver could not be deleted.';
        void this.feedback.open({
          type: 'error',
          title: 'Unable to delete driver',
          message: m,
          confirmText: 'Close',
          showCancel: false,
        });
      },
    });
  }
}
