import { lingerWhileClosing } from '@iotility/shared-ui';
import { TabIndicator } from '@iotility/shared-ui';
import { Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import {
  DataTable,
  DataTableCellTemplate,
  DropdownOption,
  FilterBar,
  FilterChangeEvent,
  FilterDropdown,
  TableAction,
  TableColumn,
  TableRow,
} from '@iotility/shared-ui';
import { Subscription } from 'rxjs';
import { DocumentRecord, DocumentsApiService } from '../../shared/services/documents-api.service';
import { FeedbackDialogBridgeService } from '../../shared/services/feedback-dialog-bridge.service';
import { StatCard } from '../../shared/stat-card/stat-card';
import { DocumentCategory, DocumentStatus, FleetDocument, NOT_AVAILABLE, toFleetDocument } from './documents.data';
import { DocumentsCategoryStore } from './documents-category.store';
import { UploadDocumentForm } from './upload-document-form/upload-document-form';

@Component({
  selector: 'app-documents-page',
  imports: [
    TabIndicator,
    DataTable,
    DataTableCellTemplate,
    FilterBar,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    StatCard,
    UploadDocumentForm,
  ],
  templateUrl: './documents-page.html',
  styleUrl: './documents-page.css',
})
export class DocumentsPage {
  private readonly api = inject(DocumentsApiService);
  private readonly feedback = inject(FeedbackDialogBridgeService);
  private readonly destroyRef = inject(DestroyRef);
  private request?: Subscription;
  private readonly records = signal<DocumentRecord[]>([]);
  protected readonly documents = computed(() => this.records().map(toFleetDocument));
  protected readonly category = inject(DocumentsCategoryStore).category;
  protected readonly status = signal<'all' | DocumentStatus>('all');
  protected readonly search = signal('');
  protected readonly selected = signal<FleetDocument | null>(null);
  /** Drawer content stays rendered while the drawer animates shut. */
  protected readonly shownDocument = lingerWhileClosing(this.selected);
  protected readonly uploadOpen = signal(false);
  protected readonly categoryOptions: DropdownOption[] = [
    { id: 'all', label: 'All statuses' },
    { id: 'valid', label: 'Valid' },
    { id: 'expiring', label: 'Expiring soon' },
    { id: 'expired', label: 'Expired' },
    { id: 'missing', label: 'Missing' },
  ];
  protected readonly columns: TableColumn[] = [
    { key: 'document', label: 'Document' },
    { key: 'categoryLabel', label: 'Category' },
    { key: 'linkedTo', label: 'Linked To' },
    { key: 'issuedBy', label: 'Issued By' },
    { key: 'issueDate', label: 'Issue Date' },
    { key: 'expiry', label: 'Expiry' },
    { key: 'statusLabel', label: 'Status' },
    { key: 'actions', label: 'Actions', type: 'actions' },
  ];
  protected readonly actions: TableAction[] = ['view', 'upload', 'edit', 'delete'];
  /** The API has no expiry data, so validity counts are "—". */
  protected readonly counts = computed(() => ({
    total: this.documents().length,
    valid: NOT_AVAILABLE,
    expiring: NOT_AVAILABLE,
    expired: NOT_AVAILABLE,
    vehicle: this.documents().filter((item) => item.category === 'vehicle').length,
    driver: this.documents().filter((item) => item.category === 'driver').length,
    company: this.documents().filter((item) => item.category === 'company').length,
  }));
  protected readonly attention = computed(() =>
    this.documents()
      .filter((item) => item.status === 'expired' || item.status === 'expiring')
      .sort((a, b) => (a.daysUntilExpiry ?? 9999) - (b.daysUntilExpiry ?? 9999)),
  );
  protected readonly filtered = computed(() => {
    const query = this.search().trim().toLowerCase();
    return this.documents().filter(
      (item) =>
        (this.category() === 'all' || item.category === this.category()) &&
        (this.status() === 'all' || item.status === this.status()) &&
        (!query || `${item.name} ${item.linkedTo} ${item.fileName}`.toLowerCase().includes(query)),
    );
  });
  protected readonly rows = computed<TableRow[]>(() =>
    this.filtered().map((item) => ({
      id: item.id,
      document: item.name,
      file: item.fileName,
      size: item.fileSize,
      category: item.category ?? '',
      categoryLabel: this.categoryLabel(item.category),
      linkedTo: item.linkedTo,
      issuedBy: item.issuedBy,
      issueDate: item.issueDate,
      expiry: item.expiryDate || 'No expiry',
      days: item.daysUntilExpiry ?? '',
      status: item.status,
      statusLabel: this.statusLabel(item.status),
      actions: '',
    })),
  );

  constructor() {
    let previous = this.category();
    effect(() => {
      const current = this.category();
      if (current !== previous) {
        this.selected.set(null);
        previous = current;
      }
    });
    effect(() => {
      this.api.version();
      untracked(() => this.load());
    });
  }
  protected setStatus(value: 'all' | DocumentStatus): void {
    this.status.set(value);
  }
  protected readonly filterDropdowns = computed<FilterDropdown[]>(() => [
    {
      id: 'status',
      ariaLabel: 'Filter by status',
      options: this.categoryOptions,
      selected: this.status(),
      placeholder: 'All statuses',
      width: '11.875rem',
    },
  ]);
  protected chooseStatus(event: FilterChangeEvent): void {
    this.setStatus(event.option.id as 'all' | DocumentStatus);
  }
  protected selectRow(row: TableRow): void {
    this.selected.set(this.selected()?.id === row['id'] ? null : this.find(row));
  }
  protected show(item: FleetDocument): void {
    this.selected.set(item);
  }
  protected find(row: TableRow): FleetDocument | null {
    return this.documents().find((item) => item.id === row['id']) ?? null;
  }
  protected tableAction(event: { action: TableAction; row: TableRow }): void {
    if (event.action === 'delete') {
      void this.remove(event.row);
      return;
    }
    if (event.action === 'upload') {
      this.openUpload();
      return;
    }
    if (event.action === 'view') {
      const item = this.find(event.row);
      if (item) this.show(item);
    }
  }
  protected openUpload(): void {
    this.uploadOpen.set(true);
  }
  protected closeUpload(): void {
    this.uploadOpen.set(false);
  }
  protected upload(): void {
    this.closeUpload();
    this.api.changed();
  }
  /** Opens the uploaded file in a new tab. */
  protected viewFile(item: FleetDocument): void {
    if (item.fileUrls[0]) window.open(item.fileUrls[0], '_blank', 'noopener');
  }
  protected statusLabel(value: DocumentStatus): string {
    return { valid: 'Valid', expiring: 'Expiring Soon', expired: 'Expired', missing: 'Missing', unknown: NOT_AVAILABLE }[
      value
    ];
  }
  protected categoryLabel(value: DocumentCategory | null): string {
    return value ? { vehicle: 'Vehicle', driver: 'Driver', company: 'Company' }[value] : NOT_AVAILABLE;
  }
  protected deadline(item: FleetDocument): string {
    if (item.daysUntilExpiry === null) return '';
    return item.daysUntilExpiry < 0
      ? `${Math.abs(item.daysUntilExpiry)}d overdue`
      : `${item.daysUntilExpiry}d left`;
  }

  private load(): void {
    this.request?.unsubscribe();
    this.request = this.api
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (records) => {
          this.records.set(records);
          // Keep the drawer on the refreshed copy, or close it if the document is gone.
          const selected = this.selected();
          if (selected) this.selected.set(this.documents().find((item) => item.id === selected.id) ?? null);
        },
        error: () => this.records.set([]),
      });
  }

  private async remove(row: TableRow): Promise<void> {
    const confirmed = await this.feedback.open({
      type: 'warning',
      title: 'Delete document?',
      message: `${row['document']} for ${row['linkedTo']} will be permanently deleted.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      showCancel: true,
    });
    if (!confirmed) return;
    const failed = (message?: string) =>
      void this.feedback.open({
        type: 'error',
        title: 'Unable to delete',
        message: message || 'The document could not be deleted. Please try again.',
        showCancel: false,
      });
    this.api
      .delete(Number(row['id']))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (response.status === 1002) return failed(response.message);
          if (this.selected()?.id === row['id']) this.selected.set(null);
          this.api.changed();
        },
        error: () => failed(),
      });
  }
}
