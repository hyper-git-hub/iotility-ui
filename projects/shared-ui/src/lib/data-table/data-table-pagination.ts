import { Component, computed, input, output } from '@angular/core';

interface PageItem {
  key: string;
  page: number | null;
}

@Component({
  selector: 'shared-data-table-pagination',
  templateUrl: './data-table-pagination.html',
  styleUrl: './data-table-pagination.css',
})
export class DataTablePagination {
  readonly totalItems = input.required<number>();
  readonly pageSize = input.required<number>();
  readonly currentPage = input.required<number>();
  readonly loading = input(false);
  readonly pageChange = output<number>();

  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.totalItems() / Math.max(1, this.pageSize()))),
  );
  protected readonly normalizedPage = computed(() =>
    Math.min(Math.max(this.currentPage(), 1), this.totalPages()),
  );
  protected readonly rangeStart = computed(() =>
    this.totalItems() > 0 ? (this.normalizedPage() - 1) * this.pageSize() + 1 : 0,
  );
  protected readonly rangeEnd = computed(() =>
    Math.min(this.normalizedPage() * this.pageSize(), this.totalItems()),
  );
  protected readonly pageItems = computed<PageItem[]>(() => {
    const last = this.totalPages();
    const current = this.normalizedPage();
    const items: PageItem[] = [];
    const addPage = (page: number) => items.push({ key: `page-${page}`, page });
    const addGap = (key: string) => items.push({ key, page: null });

    if (this.totalItems() === 0) return items;
    if (last <= 7) {
      for (let page = 1; page <= last; page += 1) addPage(page);
    } else if (current <= 3) {
      [1, 2, 3].forEach(addPage);
      addGap('gap-end');
      addPage(last - 1);
      addPage(last);
    } else if (current >= last - 2) {
      addPage(1);
      addGap('gap-start');
      [last - 2, last - 1, last].forEach(addPage);
    } else {
      addPage(1);
      addGap('gap-start');
      [current - 1, current, current + 1].forEach(addPage);
      addGap('gap-end');
      addPage(last);
    }
    return items;
  });

  protected goTo(page: number): void {
    if (this.loading() || page < 1 || page > this.totalPages() || page === this.normalizedPage()) return;
    this.pageChange.emit(page);
  }

  protected pageLabel(page: number): string {
    return String(page).padStart(2, '0');
  }
}