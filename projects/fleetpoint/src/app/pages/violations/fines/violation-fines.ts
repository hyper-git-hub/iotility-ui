import { Component, computed, signal } from '@angular/core';
import { DataTable, DataTableCellTemplate, TableColumn, TableRow } from '@iotility/shared-ui';
import { ViolationRecord, VIOLATIONS } from '../violations.data';

@Component({
  selector: 'app-violation-fines',
  imports: [DataTable, DataTableCellTemplate],
  templateUrl: './violation-fines.html',
  styleUrl: './violation-fines.css',
})
export class ViolationFines {
  protected readonly search = signal('');
  protected readonly fines = signal<ViolationRecord[]>(
    VIOLATIONS.filter((item) => item.fine > 0).map((item) => ({ ...item })),
  );
  protected readonly columns: TableColumn[] = [
    { key: 'id', label: 'Reference' },
    { key: 'type', label: 'Violation' },
    { key: 'driver', label: 'Driver' },
    { key: 'vehicle', label: 'Vehicle', clickable: true },
    { key: 'timestamp', label: 'Date' },
    { key: 'fine', label: 'Fine Amount' },
    { key: 'fineStatus', label: 'Status', type: 'status' },
    { key: 'actions', label: 'Actions' },
  ];
  protected readonly rows = computed<TableRow[]>(() => {
    const query = this.search().toLowerCase();
    return this.fines()
      .filter((item) => !query || `${item.type} ${item.driver} ${item.vehicle}`.toLowerCase().includes(query))
      .map((item) => ({ ...item, fine: `£${item.fine}`, actions: '' }));
  });

  protected markPaid(row: TableRow): void {
    this.updateStatus(String(row['id']), 'Paid');
  }

  protected dispute(row: TableRow): void {
    this.updateStatus(String(row['id']), 'Disputed');
  }

  private updateStatus(id: string, fineStatus: string): void {
    this.fines.update((items) =>
      items.map((item) => item.id === id ? { ...item, fineStatus } : item),
    );
  }
}
