import { Component, OnInit, computed, signal } from '@angular/core';
import {
  BlockingLoader,
  DataTable,
  DataTableSkeleton,
  Skeleton,
  TableAction,
  TableColumn,
  TableRow,
} from '@iotility/shared-ui';
import { finalize } from 'rxjs';
import { DriverApiService, DriverGroup } from '../../../shared/services/driver-api.service';
import { FeedbackDialogBridgeService } from '../../../shared/services/feedback-dialog-bridge.service';
import { DriverGroupForm } from '../driver-group-form/driver-group-form';

@Component({
  selector: 'app-group-list',
  imports: [BlockingLoader, DataTable, DataTableSkeleton, DriverGroupForm, Skeleton],
  templateUrl: './group-list.html',
  styleUrl: '../drivers-page.css',
})
export class GroupList implements OnInit {
  private searchTimer?: ReturnType<typeof setTimeout>;
  protected readonly loading = signal(true);
  protected readonly hasLoaded = signal(false);
  protected readonly initialLoading = computed(() => this.loading() && !this.hasLoaded());
  protected readonly refreshing = computed(() => this.loading() && this.hasLoaded());
  protected readonly actionLoading = signal(false);
  protected readonly error = signal('');
  protected readonly records = signal<DriverGroup[]>([]);
  protected readonly total = signal(0);
  protected readonly offset = signal(0);
  protected readonly search = signal('');
  protected readonly formOpen = signal(false);
  protected readonly selectedGroup = signal<DriverGroup | null>(null);
  protected readonly limit = 10;
  protected readonly actions: TableAction[] = ['edit', 'delete'];
  protected readonly columns: TableColumn[] = [
    { key: 'name', label: 'Group' },
    { key: 'driverCount', label: 'Driver Count' },
    { key: 'drivers', label: 'Drivers' },
    { key: 'status', label: 'Status', type: 'status' },
    { key: 'createdAt', label: 'Created Date', type: 'date' },
    { key: 'updatedAt', label: 'Updated Date', type: 'date' },
    { key: 'actions', label: 'Actions', type: 'actions' },
  ];
  protected readonly columnLabels = this.columns.map((column) => column.label);
  protected readonly rows = computed<TableRow[]>(() =>
    this.records().map((group) => ({
      id: group.id,
      name: group.name || 'Unnamed group',
      driverCount: group.driver_count ?? group.drivers?.length ?? 0,
      drivers:
        group.drivers?.map((driver) => `${driver.name} (${driver.employee_id})`).join(', ') ||
        'No drivers assigned',
      status: group.status === '1' ? 'Active' : 'Inactive',
      createdAt: this.date(group.created_at || ''),
      updatedAt: this.date(group.updated_at || ''),
      actions: '',
    })),
  );
  protected readonly start = computed(() => (this.total() ? this.offset() + 1 : 0));
  protected readonly end = computed(() => Math.min(this.offset() + this.limit, this.total()));

  constructor(
    private readonly api: DriverApiService,
    private readonly feedback: FeedbackDialogBridgeService,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  protected searchChanged(value: string): void {
    this.search.set(value);
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.offset.set(0);
      this.load();
    }, 400);
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
  protected openCreate(): void {
    this.selectedGroup.set(null);
    this.formOpen.set(true);
  }
  protected closeForm(): void {
    this.formOpen.set(false);
    this.selectedGroup.set(null);
  }
  protected saved(): void {
    this.closeForm();
    this.offset.set(0);
    this.load();
  }
  protected handleAction(event: { action: TableAction; row: TableRow }): void {
    const group = this.records().find((item) => item.id === Number(event.row['id']));
    if (!group) return;
    if (event.action === 'edit') {
      this.selectedGroup.set(group);
      this.formOpen.set(true);
    } else if (event.action === 'delete') void this.deleteGroup(group);
  }
  protected load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api
      .getDriverGroups(this.limit, this.offset(), this.search().trim())
      .pipe(
        finalize(() => {
          this.loading.set(false);
          this.hasLoaded.set(true);
        }),
      )
      .subscribe({
        next: (response) => {
          this.records.set(response.data?.data ?? []);
          this.total.set(response.data?.count ?? 0);
        },
        error: (response) => {
          const message = response.error?.message || 'Driver groups could not be loaded.';
          void this.feedback.open({
            type: 'error',
            title: 'Unable to load driver groups',
            message,
            confirmText: 'Close',
            showCancel: false,
          });
        },
      });
  }
  private date(value: string): string {
    return value ? value.slice(0, 10) : 'Not available';
  }
  private async deleteGroup(group: DriverGroup): Promise<void> {
    if (
      !(await this.feedback.open({
        type: 'warning',
        title: 'Delete driver group?',
        message: `${group.name} will be permanently deleted.`,
        confirmText: 'Delete group',
        cancelText: 'Keep group',
        showCancel: true,
      }))
    )
      return;
    this.actionLoading.set(true);
    this.api.deleteDriverGroup(group.id).subscribe({
      next: async () => {
        this.actionLoading.set(false);
        await this.feedback.open({
          type: 'success',
          title: 'Driver group deleted',
          message: `${group.name} was deleted successfully.`,
          confirmText: 'Done',
          showCancel: false,
        });
        this.load();
      },
      error: (response) => {
        this.actionLoading.set(false);
        const message = response.error?.message || 'Driver group could not be deleted.';
        void this.feedback.open({
          type: 'error',
          title: 'Unable to delete driver group',
          message,
          confirmText: 'Close',
          showCancel: false,
        });
      },
    });
  }
}
