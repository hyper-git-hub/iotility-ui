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
import { DriverApiService, DriverManager } from '../../../shared/services/driver-api.service';
import { FeedbackDialogBridgeService } from '../../../shared/services/feedback-dialog-bridge.service';
import { ManagerForm } from '../manager-form/manager-form';

@Component({
  selector: 'app-manager-list',
  imports: [BlockingLoader, DataTable, DataTableSkeleton, ManagerForm, Skeleton],
  templateUrl: './manager-list.html',
  styleUrl: '../drivers-page.css',
})
export class ManagerList implements OnInit {
  private searchTimer?: ReturnType<typeof setTimeout>;
  protected readonly loading = signal(true);
  protected readonly hasLoaded = signal(false);
  protected readonly initialLoading = computed(() => this.loading() && !this.hasLoaded());
  protected readonly refreshing = computed(() => this.loading() && this.hasLoaded());
  protected readonly actionLoading = signal(false);
  protected readonly error = signal('');
  protected readonly records = signal<DriverManager[]>([]);
  protected readonly total = signal(0);
  protected readonly offset = signal(0);
  protected readonly search = signal('');
  protected readonly limit = 10;
  protected readonly formOpen = signal(false);
  protected readonly selected = signal<DriverManager | null>(null);
  protected readonly actions: TableAction[] = ['edit', 'delete'];
  protected readonly columns: TableColumn[] = [
    { key: 'name', label: 'Manager', type: 'user', secondaryKey: 'employeeId' },
    { key: 'rfidTag', label: 'Tag ID' },
    { key: 'modifiedBy', label: 'Modified By' },
    { key: 'updatedAt', label: 'Modified Date', type: 'date' },
    { key: 'createdAt', label: 'Created Date', type: 'date' },
    { key: 'actions', label: 'Actions', type: 'actions' },
  ];
  protected readonly columnLabels = this.columns.map((column) => column.label);
  protected readonly rows = computed<TableRow[]>(() =>
    this.records().map((manager) => ({
      id: manager.id,
      name: manager.name || 'Unnamed manager',
      employeeId: manager.employee_id || 'No employee ID',
      rfidTag: manager.rfid_tag || 'Not assigned',
      modifiedBy: manager.modified_by || 'Not available',
      updatedAt: this.date(manager.updated_at),
      createdAt: this.date(manager.created_at),
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
    this.selected.set(null);
    this.formOpen.set(true);
  }
  protected close(): void {
    this.formOpen.set(false);
    this.selected.set(null);
  }
  protected saved(): void {
    this.close();
    this.offset.set(0);
    this.load();
  }
  protected action(event: { action: TableAction; row: TableRow }): void {
    const manager = this.records().find((item) => item.id === Number(event.row['id']));
    if (!manager) return;
    if (event.action === 'edit') {
      this.selected.set(manager);
      this.formOpen.set(true);
    } else if (event.action === 'delete') void this.remove(manager);
  }
  protected load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api
      .getManagers(this.limit, this.offset(), this.search().trim())
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
          const message = response.error?.message || 'Managers could not be loaded.';
          void this.feedback.open({
            type: 'error',
            title: 'Unable to load managers',
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
  private async remove(manager: DriverManager): Promise<void> {
    if (
      !(await this.feedback.open({
        type: 'warning',
        title: 'Delete manager?',
        message: `${manager.name} will be permanently deleted.`,
        confirmText: 'Delete manager',
        cancelText: 'Keep manager',
        showCancel: true,
      }))
    )
      return;
    this.actionLoading.set(true);
    this.api.deleteManager(manager.id).subscribe({
      next: async () => {
        this.actionLoading.set(false);
        await this.feedback.open({
          type: 'success',
          title: 'Manager deleted',
          message: `${manager.name} was deleted successfully.`,
          confirmText: 'Done',
          showCancel: false,
        });
        this.load();
      },
      error: (response) => {
        this.actionLoading.set(false);
        const message = response.error?.message || 'Manager could not be deleted.';
        void this.feedback.open({
          type: 'error',
          title: 'Unable to delete manager',
          message,
          confirmText: 'Close',
          showCancel: false,
        });
      },
    });
  }
}
