import { AfterViewInit, Component, ElementRef, OnDestroy, computed, input, output, signal, viewChild } from '@angular/core';
export type TableColumnType = 'text' | 'user' | 'email' | 'date' | 'status' | 'actions' | 'vehicle' | 'fleet' | 'fuel' | 'mot' | 'alert';
export interface TableColumn {
  key: string;
  label: string;
  type?: TableColumnType;
  secondaryKey?: string;
  imageKey?: string;
  widthClass?: string;
}
export type TableRow = Record<string, string | number | boolean>;
export type TableAction = 'view' | 'map' | 'history' | 'edit' | 'delete';
@Component({
  selector: 'shared-data-table',
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
  readonly showToolbar = input(true);
  readonly showExport = input(true);
  readonly showPrimaryAction = input(true);
  readonly clientSideSearch = input(true);
  readonly actions = input<TableAction[]>([]);
  readonly rowsClickable = input(false);
  readonly viewportHeight = input<number | null>(null);
  readonly minTableWidth = input(760);
  readonly bodyBottomPadding = input(0);
  readonly primaryAction = output<void>();
  readonly searchChange = output<string>();
  readonly rowAction = output<{ action: TableAction; row: TableRow }>();
  readonly rowSelected = output<TableRow>();
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
  protected motClass(v: unknown): string {
    const value = String(v).toLowerCase();
    return value === 'expired' || Number.parseInt(value, 10) <= 30 ? 'mot-danger' : Number.parseInt(value, 10) <= 90 ? 'mot-warning' : 'mot-success';
  }
  protected useFallbackImage(event: Event): void {
    const image = event.target as HTMLImageElement;
    image.onerror = null;
    image.src = 'assets/fleetpoint/vehicle.svg';
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
