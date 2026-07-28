import { Component, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  DataTable,
  DataTableCellTemplate,
  Dropdown,
  DropdownOption,
  SmoothHeight,
  TableAction,
  TableColumn,
  TableRow,
} from '@iotility/shared-ui';
import { StatCard } from '../../shared/stat-card/stat-card';
import {
  CATEGORY_LABELS,
  DEVICES,
  DeviceCategory,
  DeviceRecord,
  DeviceStatus,
} from './devices.data';
import { DeviceForm, DeviceFormValue } from './device-form/device-form';
@Component({
  selector: 'app-devices-page',
  imports: [DataTable, DataTableCellTemplate, DeviceForm, Dropdown, SmoothHeight, StatCard],
  templateUrl: './devices-page.html',
  styleUrl: './devices-page.css',
})
export class DevicesPage {
  protected readonly CATEGORY_LABELS = CATEGORY_LABELS;
  protected readonly devices = signal(DEVICES);
  protected readonly search = signal('');
  protected readonly status = signal<'all' | DeviceStatus>('all');
  protected readonly category = signal<'all' | DeviceCategory>('all');
  protected readonly view = signal<'list' | 'bundle'>('list');
  protected readonly expanded = signal<string[]>(['LP-4821']);
  protected readonly formOpen = signal(false);
  protected readonly statusOptions: DropdownOption[] = [
    { id: 'all', label: 'All Statuses' },
    ...['active', 'faulty', 'in-stock', 'installed', 'uninstalled'].map((id) => ({
      id,
      label: this.statusLabel(id as DeviceStatus),
    })),
  ];
  protected readonly categoryOptions: DropdownOption[] = [
    { id: 'all', label: 'All Device Types' },
    ...Object.entries(CATEGORY_LABELS).map(([id, label]) => ({ id, label })),
  ];
  protected readonly columns: TableColumn[] = [
    { key: 'device', label: 'Device' },
    { key: 'type', label: 'Type' },
    { key: 'identifier', label: 'IMEI / Serial' },
    { key: 'statusLabel', label: 'Status' },
    {
      key: 'vehicle',
      label: 'Vehicle',
      type: 'user',
      secondaryKey: 'vehicleModel',
      clickable: true,
      clickableWhenKey: 'vehicleAssigned',
    },
    { key: 'signal', label: 'Signal' },
    { key: 'battery', label: 'Battery' },
    { key: 'firmware', label: 'Firmware' },
    { key: 'lastPing', label: 'Last Ping' },
    { key: 'warranty', label: 'Warranty' },
    { key: 'actions', label: 'Actions', type: 'actions' },
  ];
  protected readonly actions: TableAction[] = ['view', 'edit', 'delete'];
  constructor(private readonly router: Router) {}
  protected readonly filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    return this.devices().filter(
      (d) =>
        (this.status() === 'all' || d.status === this.status()) &&
        (this.category() === 'all' || d.category === this.category()) &&
        (!q || `${d.name} ${d.imei} ${d.serial} ${d.model} ${d.vehicle}`.toLowerCase().includes(q)),
    );
  });
  protected readonly rows = computed<TableRow[]>(() =>
    this.filtered().map((d) => ({
      id: d.id,
      device: d.model,
      manufacturer: d.manufacturer,
      category: d.category,
      type: CATEGORY_LABELS[d.category],
      identifier: d.imei,
      serial: d.serial,
      status: d.status,
      statusLabel: this.statusLabel(d.status),
      vehicle: d.vehicle || 'Unassigned',
      vehicleAssigned: Boolean(d.vehicle),
      vehicleModel: d.vehicleModel,
      signal: d.signal,
      battery: d.battery,
      firmware: d.firmware,
      lastPing: d.lastPing,
      pingState: /hour|[3-9]\d min/i.test(d.lastPing)
        ? 'stale'
        : d.lastPing === 'Never'
          ? 'never'
          : 'current',
      warranty: d.warranty,
      warrantyState: /expired/i.test(d.warranty)
        ? 'expired'
        : /^[1-4]\smonth/i.test(d.warranty)
          ? 'warning'
          : 'valid',
      actions: '',
    })),
  );
  protected readonly counts = computed(() => ({
    total: this.devices().length,
    active: this.devices().filter((d) => d.status === 'active').length,
    faulty: this.devices().filter((d) => d.status === 'faulty').length,
    stock: this.devices().filter((d) => d.status === 'in-stock').length,
    unassigned: this.devices().filter((d) => !d.vehicle).length,
  }));
  protected readonly bundles = computed(() => {
    const map = new Map<string, DeviceRecord[]>();
    for (const d of this.filtered().filter((x) => x.vehicle)) {
      map.set(d.vehicle, [...(map.get(d.vehicle) ?? []), d]);
    }
    return [...map].map(([vehicle, devices]) => ({
      vehicle,
      model: devices[0].vehicleModel,
      devices,
      faulty: devices.some((d) => d.status === 'faulty'),
    }));
  });
  protected readonly unassigned = computed(() => this.filtered().filter((d) => !d.vehicle));
  protected select(kind: 'status' | 'category', option: DropdownOption): void {
    if (kind === 'status') this.status.set(option.id as 'all' | DeviceStatus);
    else this.category.set(option.id as 'all' | DeviceCategory);
  }
  protected label(options: DropdownOption[], id: string): string {
    return options.find((o) => o.id === id)?.label ?? '';
  }
  protected toggle(vehicle: string): void {
    this.expanded.update((items) =>
      items.includes(vehicle) ? items.filter((v) => v !== vehicle) : [...items, vehicle],
    );
  }
  protected clear(): void {
    this.search.set('');
    this.status.set('all');
    this.category.set('all');
  }
  protected openVehicle(row: TableRow): void {
    const registration = String(row['vehicle']);
    if (registration !== 'Unassigned') {
      void this.router.navigate(['/fleetpoint/vehicles', registration]);
    }
  }
  protected register(value: DeviceFormValue): void {
    this.devices.update((devices) => [
      {
        id: `D${String(devices.length + 1).padStart(3, '0')}`,
        name: `${value.model} ${value.serial}`,
        ...value,
        status: 'in-stock',
        vehicle: '',
        vehicleModel: '',
        signal: 0,
        battery: 100,
        firmware: '—',
        lastPing: 'Never',
        warranty: '—',
        notes: 'Newly registered',
      },
      ...devices,
    ]);
    this.formOpen.set(false);
  }
  protected statusLabel(value: DeviceStatus): string {
    return {
      active: 'Active',
      faulty: 'Faulty',
      'in-stock': 'In Stock',
      installed: 'Installed',
      uninstalled: 'Uninstalled',
    }[value];
  }
}
