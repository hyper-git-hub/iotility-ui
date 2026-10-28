import { DropdownOption } from '@iotility/shared-ui';
import { MaintenanceRecord } from '../../shared/services/maintenance-api.service';

/** Shown for values the maintenance API doesn't provide (same placeholder as the rest of the app). */
export const NOT_AVAILABLE = '—';

/** maintenance_status ids used by fms-maintenance; labels are short forms of maintenance_status_name. */
export const MAINTENANCE_STATUS: Record<number, string> = { 6: 'Pending', 4: 'Approved', 8: 'In Progress', 7: 'Completed', 5: 'Rejected' };
export const ADMIN_STATUS: Record<number, string> = { 1: 'Approved', 2: 'Rejected', 3: 'Pending' };
export const STATUS_OPTIONS: DropdownOption[] = [
  { id: 'all', label: 'All Status' },
  ...Object.entries(MAINTENANCE_STATUS).map(([id, label]) => ({ id, label })),
];

export function statusLabel(record: MaintenanceRecord): string {
  return MAINTENANCE_STATUS[record.maintenance_status ?? -1] ?? record.maintenance_status_name ?? NOT_AVAILABLE;
}

export function workOrderId(record: MaintenanceRecord): string {
  return `WO-${record.id}`;
}

export function text(value: string | null | undefined): string {
  return value?.trim() || NOT_AVAILABLE;
}

export function serviceName(record: MaintenanceRecord): string {
  return text(record.service_type_name ?? record.other_service_type);
}

export function money(value: number | string | null | undefined, currency: string): string {
  if (value === null || value === undefined || value === '' || Number.isNaN(Number(value))) return NOT_AVAILABLE;
  return `${currency} ${Number(value).toLocaleString()}`.trim();
}

/** created_at/updated_at arrive already formatted for time_zone; plain ISO dates are shortened to "12 Oct 2026". */
export function displayDate(value: string | null | undefined): string {
  if (!value) return NOT_AVAILABLE;
  if (!/^\d{4}-\d{2}-\d{2}/.test(value)) return value;
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
