import { NgTemplateOutlet } from '@angular/common';
import { AfterViewInit, Component, Directive, ElementRef, OnDestroy, TemplateRef, computed, contentChild, inject, input, output, signal, viewChild } from '@angular/core';
import { Dropdown, DropdownOption } from '../dropdown/dropdown';
export type TableColumnType = 'text' | 'user' | 'email' | 'date' | 'status' | 'priority' | 'tasks' | 'actions' | 'vehicle' | 'fleet' | 'fuel' | 'mot' | 'alert';
export interface TableColumn {
  key: string;
  label: string;
  type?: TableColumnType;
  secondaryKey?: string;
  imageKey?: string;
  widthClass?: string;
  clickable?: boolean;
}
export type TableRow = Record<string, string | number | boolean>;
export type TableAction = 'view' | 'map' | 'history' | 'edit' | 'delete';
export interface ExpandedRowContext {
  $implicit: TableRow;
  row: TableRow;
}
@Directive({ selector: 'ng-template[tableExpandedRow]' })
export class DataTableExpandedRow {
  readonly template = inject<TemplateRef<ExpandedRowContext>>(TemplateRef);
}
@Component({
  selector: 'shared-data-table',
  imports: [Dropdown, NgTemplateOutlet],
  templateUrl: './data-table.html',
  styleUrl: './data-table.css',
})
export class DataTable implements AfterViewInit, OnDestroy {
  readonly title = input('Data');
  readonly subtitle = input('');
  readonly columns = input.required<TableColumn[]>();
  readonly rows = input.required<TableRow[]>();
  readonly searchPlaceholder = input('Search');
  readonly primaryActionLabel = input('Add new');
  readonly headerActionLabel = input('');
  readonly headerFilterOptions = input<DropdownOption[]>([]);
  readonly headerFilterSelected = input<string[]>([]);
  readonly headerFilterTitle = input('Filter');
  readonly headerFilterLabel = input('Filters');
  readonly showToolbar = input(true);
  readonly showExport = input(true);
  readonly showPrimaryAction = input(true);
  readonly clientSideSearch = input(true);
  readonly actions = input<TableAction[]>([]);
  readonly rowsClickable = input(false);
  readonly expandableRows = input(false);
  readonly selectedRowId = input<string | number | null>(null);
  readonly rowIdentityKey = input('id');
  readonly viewportHeight = input<number | null>(null);
  readonly minTableWidth = input(760);
  readonly bodyBottomPadding = input(0);
  readonly primaryAction = output<void>();
  readonly searchChange = output<string>();
  readonly headerFilterChange = output<DropdownOption>();
  readonly rowAction = output<{ action: TableAction; row: TableRow }>();
  readonly rowSelected = output<TableRow>();
  readonly cellSelected = output<{ column: TableColumn; row: TableRow }>();
  readonly rowExpanded = output<TableRow | null>();
  private readonly expandedTemplate = contentChild(DataTableExpandedRow);
  protected readonly expandedRowIdentity = signal<string | null>(null);
  private readonly tableBody = viewChild.required<ElementRef<HTMLElement>>('tableBody');
  protected readonly searchTerm = signal('');
  protected readonly bodyHeight = signal<number | null>(null);
  protected readonly heightReady = signal(false);
  private resizeObserver?: ResizeObserver;
  protected readonly filteredRows = computed(() => {
    if (!this.clientSideSearch()) return this.rows();
    const q = this.searchTerm().trim().toLowerCase();
    return q
      ? this.rows().filter((r) => Object.values(r).some((v) => String(v).toLowerCase().includes(q)))
      : this.rows();
  });
  protected readonly resolvedBodyHeight = computed(() => this.viewportHeight() ?? this.bodyHeight());
  protected updateSearch(e: Event): void {
    const value = (e.target as HTMLInputElement).value;
    this.searchTerm.set(value);
    this.searchChange.emit(value);
  }
  protected statusClass(v: unknown): string {
    return `status-${String(v).toLowerCase().replaceAll(' ', '-')}`;
  }
  protected priorityClass(v: unknown): string {
    return `priority-${String(v).toLowerCase().replaceAll(' ', '-')}`;
  }
  protected taskProgress(v: unknown): number {
    const [completed, total] = String(v).split('/').map(Number);
    return total > 0 ? Math.min(100, Math.max(0, (completed / total) * 100)) : 0;
  }
  protected motClass(v: unknown): string {
    const value = String(v).toLowerCase();
    return value === 'expired' || Number.parseInt(value, 10) <= 30 ? 'mot-danger' : Number.parseInt(value, 10) <= 90 ? 'mot-warning' : 'mot-success';
  }
  protected useFallbackImage(event: Event): void {
    const image = event.target as HTMLImageElement;
    image.onerror = null;
    image.src = 'assets/fleetpoint/vehicle.svg';
  }
  protected selectCell(event: Event, column: TableColumn, row: TableRow): void {
    if (!column.clickable) return;
    event.stopPropagation();
    this.cellSelected.emit({ column, row });
  }
  protected isSelectedRow(row: TableRow): boolean {
    const selected = this.selectedRowId();
    return selected !== null && String(row[this.rowIdentityKey()]) === String(selected);
  }
  protected isExpandedRow(row: TableRow): boolean {
    return this.expandedRowIdentity() === String(row[this.rowIdentityKey()]);
  }
  protected selectRow(row: TableRow): void {
    if (this.expandableRows()) {
      const next = this.isExpandedRow(row) ? null : String(row[this.rowIdentityKey()]);
      this.expandedRowIdentity.set(next);
      this.rowExpanded.emit(next === null ? null : row);
    }
    if (this.rowsClickable()) this.rowSelected.emit(row);
  }
  protected expandedRowTemplate(): TemplateRef<ExpandedRowContext> | null {
    return this.expandedTemplate()?.template ?? null;
  }
  ngAfterViewInit(): void {
    const element = this.tableBody().nativeElement;
    this.bodyHeight.set(element.getBoundingClientRect().height);
    this.resizeObserver = new ResizeObserver(([entry]) => {
      this.bodyHeight.set(entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height);
    });
    this.resizeObserver.observe(element);
    requestAnimationFrame(() => this.heightReady.set(true));
  }
  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
  }
}
