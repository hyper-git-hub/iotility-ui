import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';
import { Dropdown, DropdownOption } from '../dropdown/dropdown';
import { ExportFormat } from './export-file';

const FORMAT_OPTIONS: Record<ExportFormat, DropdownOption> = {
  xls: { id: 'xls', label: 'Excel', description: 'Spreadsheet (.xlsx)', icon: 'excel' },
  pdf: { id: 'pdf', label: 'PDF', description: 'Print-ready document', icon: 'pdf' },
};

/**
 * The one Export control used on every page: a secondary button that opens a format menu
 * (or exports straight away when only one format is offered). The page owns the request; it passes
 * the format being exported back in `exporting`, which shows a spinner and blocks repeat clicks.
 */
@Component({
  selector: 'shared-export-menu',
  imports: [Dropdown, NgTemplateOutlet],
  templateUrl: './export-menu.html',
  styleUrl: './export-menu.css',
})
export class ExportMenu {
  readonly formats = input<ExportFormat[]>(['xls', 'pdf']);
  /** The format currently downloading, or null. */
  readonly exporting = input<ExportFormat | null>(null);
  /** E.g. while the list is loading or empty. */
  readonly disabled = input(false);
  readonly label = input('Export');
  readonly exportFormat = output<ExportFormat>();

  protected readonly options = computed(() => this.formats().map((format) => FORMAT_OPTIONS[format]));
  protected readonly busy = computed(() => this.exporting() !== null);

  protected choose(option: DropdownOption): void {
    if (!this.busy()) this.exportFormat.emit(option.id as ExportFormat);
  }
}
