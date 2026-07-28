import { Component, computed, effect, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import {
  DataTable,
  DataTableCellTemplate,
  DateTimePicker,
  Dropdown,
  DropdownOption,
  TableAction,
  TableColumn,
  TableRow,
} from '@iotility/shared-ui';
import { Modal } from '../../shared/modal/modal';
import { StatCard } from '../../shared/stat-card/stat-card';
import { DocumentCategory, DocumentStatus, FLEET_DOCUMENTS, FleetDocument } from './documents.data';
import { DocumentsCategoryStore } from './documents-category.store';
import { UploadDocumentForm, UploadDocumentValue } from './upload-document-form/upload-document-form';

@Component({
  selector: 'app-documents-page',
  imports: [
    DataTable,
    DataTableCellTemplate,
    DateTimePicker,
    Dropdown,
    Modal,
    ReactiveFormsModule,
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
  protected readonly documents = signal<FleetDocument[]>(FLEET_DOCUMENTS);
  protected readonly category;
  protected readonly status = signal<'all' | DocumentStatus>('all');
  protected readonly search = signal('');
  protected readonly selected = signal<FleetDocument | null>(null);
  protected readonly uploadOpen = signal(false);
  protected readonly submitted = signal(false);
  protected readonly selectedFile = signal('');
  protected readonly categoryOptions: DropdownOption[] = [
    { id: 'all', label: 'All statuses' },
    { id: 'valid', label: 'Valid' },
    { id: 'expiring', label: 'Expiring soon' },
    { id: 'expired', label: 'Expired' },
    { id: 'missing', label: 'Missing' },
  ];
  protected readonly typeOptions:DropdownOption[]=['MOT Certificate','Vehicle Insurance','Road Tax'].map(label=>({id:label,label}));
  protected readonly linkedOptions:DropdownOption[]=['LogisticsPro','LP-7734','LP-4821'].map(label=>({id:label,label}));
  protected readonly form;
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
  protected readonly counts = computed(() => ({
    total: this.documents().length,
    valid: this.documents().filter((item) => item.status === 'valid').length,
    expiring: this.documents().filter((item) => item.status === 'expiring').length,
    expired: this.documents().filter((item) => item.status === 'expired').length,
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
        (!query || `${item.name} ${item.linkedTo} ${item.issuedBy}`.toLowerCase().includes(query)),
    );
  });
  protected readonly rows = computed<TableRow[]>(() =>
    this.filtered().map((item) => ({
      id: item.id,
      document: item.name,
      file: item.fileName,
      size: item.fileSize,
      category: item.category,
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

  constructor(private readonly categoryStore: DocumentsCategoryStore,formBuilder:FormBuilder) {
    this.form=formBuilder.nonNullable.group({type:['',Validators.required],linkedTo:['',Validators.required],issueDate:[''],expiryDate:[''],issuedBy:[''],documentNumber:['']});
    this.category = this.categoryStore.category;
    let previous = this.category();
    effect(() => {
      const current = this.category();
      if (current !== previous) {
        this.selected.set(null);
        previous = current;
      }
    });
  }
  protected setStatus(value: 'all' | DocumentStatus): void {
    this.status.set(value);
  }
  protected chooseStatus(option: DropdownOption): void {
    this.setStatus(option.id as 'all' | DocumentStatus);
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
  protected remove(row: TableRow): void {
    const id = String(row['id']);
    this.documents.update((items) => items.filter((item) => item.id !== id));
    if (this.selected()?.id === id) this.selected.set(null);
  }
  protected tableAction(event: { action: TableAction; row: TableRow }): void {
    if (event.action === 'delete') {
      this.remove(event.row);
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
  protected choose(control:'type'|'linkedTo',option:DropdownOption):void{this.form.controls[control].setValue(option.id);}
  protected pickFile(event:Event):void{this.selectedFile.set((event.target as HTMLInputElement).files?.[0]?.name??'');}
  protected upload(value?: UploadDocumentValue): void {
    if(!value)return;
    this.documents.update((items) => [
      ...items,
      {
        id: `DOC-${String(items.length + 1).padStart(3, '0')}`,
        name: value.type,
        fileName: value.fileName,
        fileSize: '—',
        category: this.inferCategory(value.type),
        linkedTo: value.linkedTo,
        issuedBy: value.issuedBy || '—',
        issueDate: value.issueDate || '—',
        expiryDate: value.expiryDate,
        daysUntilExpiry: null,
        status: 'valid',
        documentNumber: value.documentNumber,
        uploadedBy: 'Mona Lisa',
      },
    ]);
    this.closeUpload();
  }
  protected statusLabel(value: DocumentStatus): string {
    return { valid: 'Valid', expiring: 'Expiring Soon', expired: 'Expired', missing: 'Missing' }[
      value
    ];
  }
  protected categoryLabel(value: DocumentCategory): string {
    return { vehicle: 'Vehicle', driver: 'Driver', company: 'Company' }[value];
  }
  protected selectedStatusLabel(): string {
    return this.categoryOptions.find((item) => item.id === this.status())?.label ?? 'All statuses';
  }
  protected deadline(item: FleetDocument): string {
    if (item.daysUntilExpiry === null) return '';
    return item.daysUntilExpiry < 0
      ? `${Math.abs(item.daysUntilExpiry)}d overdue`
      : `${item.daysUntilExpiry}d left`;
  }
  private inferCategory(type: string): DocumentCategory {
    if (/licence|cpc|medical/i.test(type)) return 'driver';
    if (/operator|fleet|fors/i.test(type)) return 'company';
    return 'vehicle';
  }
}
