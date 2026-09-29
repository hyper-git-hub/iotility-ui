import { Component, OnInit, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  DataTable,
  DataTableCellTemplate,
  DataTableSkeleton,
  Dropdown,
  DropdownOption,
  Skeleton,
  SmoothHeight,
  TableAction,
  TableColumn,
  TableRow,
  Tooltip,
} from '@iotility/shared-ui';
import { finalize } from 'rxjs';
import { StatCard } from '../../shared/stat-card/stat-card';
import {
  CustomerHardwareRecord,
  DeviceHardwareApiService,
} from '../../shared/services/device-hardware-api.service';
import {
  CATEGORY_LABELS,
  DEVICES,
  DeviceRecord,
  DeviceStatus,
} from './devices.data';
import { DeviceForm, DeviceFormValue } from './device-form/device-form';
@Component({
  selector: 'app-devices-page',
  imports: [
    DataTable,
    DataTableCellTemplate,
    DataTableSkeleton,
    DeviceForm,
    Dropdown,
    Skeleton,
    SmoothHeight,
    StatCard,
    Tooltip,
  ],
  templateUrl: './devices-page.html',
  styleUrl: './devices-page.css',
})
export class DevicesPage implements OnInit {
  protected readonly CATEGORY_LABELS = CATEGORY_LABELS;
  protected readonly devices = signal(DEVICES);
  protected readonly hardware = signal<CustomerHardwareRecord[]>([]);
  protected readonly hardwareLoading = signal(true);
  protected readonly hardwareTotal = signal(0);
  protected readonly hardwareError = signal('');
  protected readonly hardwareOffset = signal(0);
  protected readonly hardwareLimit = 10;
  protected readonly search = signal('');
  protected readonly status = signal('all');
  protected readonly category = signal('all');
  protected readonly view = signal<'list' | 'bundle'>('list');
  protected readonly expanded = signal<string[]>(['LP-4821']);
  protected readonly formOpen = signal(false);
  protected readonly statusOptions = computed<DropdownOption[]>(() => [
    { id: 'all', label: 'All Statuses' },
    ...[...new Set(this.hardware().map((device) => device.status).filter(Boolean))].map((value) => ({
      id: String(value).toLowerCase(),
      label: String(value),
    })),
  ]);
  protected readonly categoryOptions = computed<DropdownOption[]>(() => [
    { id: 'all', label: 'All Device Types' },
    ...[...new Set(this.hardware().map((device) => device.device_type_name).filter(Boolean))].map((value) => ({
      id: String(value),
      label: String(value),
    })),
  ]);
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
  protected readonly columnLabels = this.columns.map((column) => column.label);
  constructor(
    private readonly router: Router,
    private readonly hardwareApi: DeviceHardwareApiService,
  ) {}
  ngOnInit(): void {
    this.loadHardware();
  }
  protected loadHardware(): void {
    this.hardwareLoading.set(true);
    this.hardwareError.set('');
    this.hardwareApi
      .getHardware(this.hardwareLimit, this.hardwareOffset())
      .pipe(finalize(() => this.hardwareLoading.set(false)))
      .subscribe({
        next: (response) => {
          this.hardware.set(response.data?.data ?? []);
          this.hardwareTotal.set(response.data?.total ?? 0);
        },
        error: (response) => {
          this.hardware.set([]);
          this.hardwareTotal.set(0);
          this.hardwareError.set(response.error?.message || 'Device inventory could not be loaded.');
        },
      });
  }
  protected readonly hardwarePageStart = computed(() =>
    this.hardwareTotal() ? this.hardwareOffset() + 1 : 0,
  );
  protected readonly hardwarePageEnd = computed(() =>
    Math.min(this.hardwareOffset() + this.hardware().length, this.hardwareTotal()),
  );
  protected previousHardwarePage(): void {
    this.hardwareOffset.update((offset) => Math.max(0, offset - this.hardwareLimit));
    this.loadHardware();
  }
  protected nextHardwarePage(): void {
    if (this.hardwareOffset() + this.hardwareLimit >= this.hardwareTotal()) return;
    this.hardwareOffset.update((offset) => offset + this.hardwareLimit);
    this.loadHardware();
  }
  protected readonly filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    return this.devices().filter(
      (d) =>
        (this.status() === 'all' || d.status === this.status()) &&
        (this.category() === 'all' || d.category === this.category()) &&
        (!q || `${d.name} ${d.imei} ${d.serial} ${d.model} ${d.vehicle}`.toLowerCase().includes(q)),
    );
  });
  protected readonly filteredHardware = computed(() => {
    const query = this.search().trim().toLowerCase();
    return this.hardware().filter((device) =>
      (this.status() === 'all' || device.status?.toLowerCase() === this.status()) &&
      (this.category() === 'all' || device.device_type_name === this.category()) &&
      (!query || `${device.device_id ?? ''} ${device.device_type_name ?? ''} ${device.sim_msisdn ?? ''} ${device.customer_name ?? ''}`.toLowerCase().includes(query)),
    );
  });
  protected readonly rows = computed<TableRow[]>(() =>
    this.filteredHardware().map((device) => ({
      id: device.id,
      device: device.device_type_name || '—',
      manufacturer: device.customer_name || '—',
      category: 'hardware',
      type: device.device_type_name || '—',
      identifier: device.device_id || '—',
      serial: device.sim_msisdn || '—',
      status: (device.status || 'unknown').toLowerCase(),
      statusLabel: device.status || '—',
      vehicle: '—',
      vehicleAssigned: false,
      vehicleModel: '',
      signal: 0,
      battery: '—',
      firmware: '—',
      lastPing: '—',
      pingState: 'never',
      warranty: '—',
      warrantyState: 'unknown',
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
    if (kind === 'status') this.status.set(option.id);
    else this.category.set(option.id);
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
