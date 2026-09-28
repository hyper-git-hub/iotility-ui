import { Component, computed, signal } from '@angular/core';
import {
  DataTable,
  DataTableBottomPanel,
  DataTableCellTemplate,
  TableColumn,
  TableRow,
} from '@iotility/shared-ui';
import { FeedbackDialogService } from '../../../shared/services/feedback-dialog.service';
import { LoadingService } from '../../../shared/services/loading.service';
import { FLEETPOINT_APP, RecentAppsService } from '../../../shared/services/recent-apps.service';

/** An addon shown in the "Browse IoTility Addon Use Cases" panel. */
interface AddonUseCase {
  id: string;
  name: string;
  tagline: string;
  /** Addons the tenant already owns show "Access" instead of "Buy Now". */
  available: boolean;
  icon: string;
  action: () => void;
}

/** Every activity row belongs to the module that recorded it. */
const FLEETPOINT_USE_CASE = { usecase: 'Fleetpoint', usecaseIcon: 'assets/fleetpoint.svg' };

@Component({
  selector: 'app-home-dashboard',
  imports: [DataTable, DataTableCellTemplate, DataTableBottomPanel],
  templateUrl: './home-dashboard.html',
  styleUrl: './home-dashboard.css',
})
export class HomeDashboardPage {
  protected readonly pageSize = 4;
  protected readonly page = signal(1);
  private readonly searchTerm = signal('');

  protected readonly columns: TableColumn[] = [
    { key: 'user', label: 'User', type: 'user', secondaryKey: 'role', widthClass: 'min-w-52' },
    { key: 'narration', label: 'Narration', widthClass: 'min-w-72' },
    { key: 'usecase', label: 'Usecase', widthClass: 'min-w-40' },
    { key: 'time', label: 'Time', widthClass: 'min-w-32' },
    { key: 'date', label: 'Date', widthClass: 'min-w-36' },
  ];

  protected readonly activities: TableRow[] = [
    {
      user: 'Rayna Vetrovs',
      role: 'Fleet Manager',
      ...FLEETPOINT_USE_CASE,
      narration: 'Has created a new user Moham Farah',
      time: '02:00 pm',
      date: '28/12/2024',
    },
    {
      user: 'Leo Gouse',
      role: 'Fleet Manager',
      ...FLEETPOINT_USE_CASE,
      narration: 'Has created a new user role Fleet Manager',
      time: '02:00 pm',
      date: '28/12/2024',
    },
    {
      user: 'Gustavo Herwitz',
      role: 'Asset Manager',
      ...FLEETPOINT_USE_CASE,
      narration: 'Created a new custom dashboard',
      time: '02:00 pm',
      date: '28/12/2024',
    },
    {
      user: 'Phillip Baptista',
      role: 'Accounts',
      ...FLEETPOINT_USE_CASE,
      narration: 'Updated the monthly billing contact',
      time: '02:00 pm',
      date: '28/12/2024',
    },
    {
      user: 'Talon Levin',
      role: 'ID_03432',
      ...FLEETPOINT_USE_CASE,
      narration: 'Banned a driver Olive Max',
      time: '02:00 pm',
      date: '28/12/2024',
    },
    {
      user: 'Jaxon Arcand',
      role: 'ID_33452',
      ...FLEETPOINT_USE_CASE,
      narration: 'Unbanned a driver Olive Max',
      time: '02:00 pm',
      date: '28/12/2024',
    },
    {
      user: 'Emerson Horwitz',
      role: 'ID_34422',
      ...FLEETPOINT_USE_CASE,
      narration: 'Deleted a user Michael Brown',
      time: '02:00 pm',
      date: '28/12/2024',
    },
    {
      user: 'Alison Stanton',
      role: 'Fleet Manager',
      ...FLEETPOINT_USE_CASE,
      narration: 'Assigned vehicle TRK-204 to Olive Max',
      time: '11:20 am',
      date: '27/12/2024',
    },
    {
      user: 'Marcus Reyes',
      role: 'Fleet Manager',
      ...FLEETPOINT_USE_CASE,
      narration: 'Added a new geozone Depot North',
      time: '10:05 am',
      date: '27/12/2024',
    },
    {
      user: 'Nadia Rahman',
      role: 'Accounts',
      ...FLEETPOINT_USE_CASE,
      narration: 'Exported the weekly fleet cost report',
      time: '09:40 am',
      date: '27/12/2024',
    },
    {
      user: 'Casey Whitfield',
      role: 'ID_34871',
      ...FLEETPOINT_USE_CASE,
      narration: 'Updated the shift schedule for Depot South',
      time: '04:15 pm',
      date: '26/12/2024',
    },
    {
      user: 'Priya Malhotra',
      role: 'Asset Manager',
      ...FLEETPOINT_USE_CASE,
      narration: 'Registered a new asset Forklift FL-08',
      time: '03:05 pm',
      date: '26/12/2024',
    },
    {
      user: 'Diego Marchetti',
      role: 'Fleet Manager',
      ...FLEETPOINT_USE_CASE,
      narration: 'Created an alert rule for harsh braking',
      time: '01:30 pm',
      date: '24/12/2024',
    },
    {
      user: 'Harriet Owens',
      role: 'Fleet Manager',
      ...FLEETPOINT_USE_CASE,
      narration: 'Invited the workshop team to Fleetpoint',
      time: '12:10 pm',
      date: '24/12/2024',
    },
    {
      user: 'Samuel Okafor',
      role: 'ID_35112',
      ...FLEETPOINT_USE_CASE,
      narration: 'Completed the safety training checklist',
      time: '10:45 am',
      date: '22/12/2024',
    },
    {
      user: 'Lena Fischer',
      role: 'Accounts',
      ...FLEETPOINT_USE_CASE,
      narration: 'Renewed the annual subscription plan',
      time: '09:15 am',
      date: '22/12/2024',
    },
    {
      user: 'Oscar Lindqvist',
      role: 'Asset Manager',
      ...FLEETPOINT_USE_CASE,
      narration: 'Moved 12 assets to the London depot',
      time: '05:40 pm',
      date: '20/12/2024',
    },
    {
      user: 'Bianca Moretti',
      role: 'Fleet Manager',
      ...FLEETPOINT_USE_CASE,
      narration: 'Restored a deleted vehicle Van-118',
      time: '02:25 pm',
      date: '20/12/2024',
    },
    {
      user: 'Trevor Nakamura',
      role: 'ID_35708',
      ...FLEETPOINT_USE_CASE,
      narration: 'Banned a driver Ivan Petrov',
      time: '11:55 am',
      date: '19/12/2024',
    },
    {
      user: 'Amara Nwosu',
      role: 'Fleet Manager',
      ...FLEETPOINT_USE_CASE,
      narration: 'Scheduled a service for TRK-301',
      time: '09:30 am',
      date: '19/12/2024',
    },
    {
      user: 'Felix Andersen',
      role: 'Fleet Manager',
      ...FLEETPOINT_USE_CASE,
      narration: 'Created a new custom dashboard',
      time: '04:50 pm',
      date: '18/12/2024',
    },
    {
      user: 'Sofia Delgado',
      role: 'Asset Manager',
      ...FLEETPOINT_USE_CASE,
      narration: 'Uploaded the asset warranty documents',
      time: '03:20 pm',
      date: '18/12/2024',
    },
    {
      user: 'Miles Bennett',
      role: 'ID_36127',
      ...FLEETPOINT_USE_CASE,
      narration: 'Unbanned a driver Ivan Petrov',
      time: '01:00 pm',
      date: '17/12/2024',
    },
    {
      user: 'Yuki Tanaka',
      role: 'Accounts',
      ...FLEETPOINT_USE_CASE,
      narration: 'Updated the fuel card provider list',
      time: '08:45 am',
      date: '17/12/2024',
    },
  ];

  protected readonly addons: AddonUseCase[] = [
    {
      id: 'fleetpoint',
      name: 'Fleetpoint',
      tagline: 'Manage your fleet operations',
      available: true,
      icon: 'assets/fleetpoint.svg',
      action: () => this.openFleetPoint(),
    },
    {
      id: 'assetrack',
      name: 'Assetrack',
      tagline: 'Manage your assets smoothly',
      available: false,
      icon: 'assets/assetrack.svg',
      action: () => this.buyModule('Assetrack'),
    },
    {
      id: 'sustainex',
      name: 'Sustainex',
      tagline: 'Contribute to a sustainable earth',
      available: false,
      icon: 'assets/sustainex.svg',
      action: () => this.buyModule('Sustainex'),
    },
    {
      id: 'twinscape',
      name: 'Twinscape',
      tagline: 'Smarter solution for smarter buildings',
      available: false,
      icon: 'assets/twinscape.svg',
      action: () => this.buyModule('Twinscape'),
    },
    {
      id: 'wasterack',
      name: 'Wasterack',
      tagline: 'Manage your waste, without mess',
      available: false,
      icon: 'assets/wasterack.svg',
      action: () => this.buyModule('Wasterack'),
    },
  ];

  private readonly filteredActivities = computed(() => {
    const query = this.searchTerm().trim().toLowerCase();
    if (!query) return this.activities;
    return this.activities.filter((activity) =>
      ['user', 'role', 'narration'].some((key) =>
        String(activity[key]).toLowerCase().includes(query),
      ),
    );
  });

  protected readonly pageCount = computed(() =>
    Math.max(1, Math.ceil(this.filteredActivities().length / this.pageSize)),
  );

  protected readonly pageNumbers = computed(() =>
    Array.from({ length: this.pageCount() }, (_, index) => index + 1),
  );

  protected readonly visibleActivities = computed(() => {
    const start = (this.page() - 1) * this.pageSize;
    return this.filteredActivities().slice(start, start + this.pageSize);
  });

  constructor(
    private readonly loading: LoadingService,
    private readonly feedbackDialog: FeedbackDialogService,
    private readonly recentApps: RecentAppsService,
  ) {}

  protected updateSearch(value: string): void {
    this.searchTerm.set(value);
    this.page.set(1);
  }

  protected goToPage(page: number): void {
    this.page.set(Math.min(Math.max(page, 1), this.pageCount()));
  }

  protected previousPage(): void {
    this.goToPage(this.page() - 1);
  }

  protected nextPage(): void {
    this.goToPage(this.page() + 1);
  }

  protected pageLabel(page: number): string {
    return String(page).padStart(2, '0');
  }

  protected initials(name: string): string {
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase();
  }

  protected openFleetPoint(): void {
    this.recentApps.register(FLEETPOINT_APP);
    this.loading.navigate(
      '/fleetpoint/dashboard',
      {
        label: 'IoTility',
        title: 'Loading FleetPoint',
        message: 'Preparing your fleet command center...',
        initials: 'FP',
        logoSrc: 'assets/fleetpoint.svg',
        labelLogoSrc: 'assets/iotility-loader-light.svg',
      },
      2000,
    );
  }

  protected buyModule(name: string): void {
    void this.feedbackDialog.open({
      type: 'warning',
      title: 'Coming soon',
      message: `"${name}" isn't available for purchase yet. Please check back later.`,
      confirmText: 'OK',
      showCancel: false,
    });
  }
}
