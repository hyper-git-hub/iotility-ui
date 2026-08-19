import { Component, computed, HostListener, isDevMode, output, signal } from '@angular/core';
import { Router } from '@angular/router';
import { DropdownOption, PlatformHeader, SmoothHeight } from '@iotility/shared-ui';
import { FeatureAccessService } from '../../shared/services/feature-access.service';
import { FleetNotification, NotificationService } from '../../shared/services/notification.service';
import { SIDEBAR_MENU } from '../sidebar/menu.config';

interface SearchDestination {
  id: string;
  label: string;
  description: string;
  route: string;
  icon: string;
  featureId: number;
  keywords?: string;
}

@Component({
  selector: 'app-fleetpoint-header',
  imports: [PlatformHeader, SmoothHeight],
  templateUrl: './fleetpoint-header.html',
  styleUrl: './fleetpoint-header.css',
})
export class FleetpointHeader {
  readonly menuToggle = output<void>();
  protected readonly searchOpen = signal(false);
  protected readonly searchVisible = signal(false);
  protected readonly searchQuery = signal('');
  protected readonly activeResult = signal(0);
  protected readonly notificationsOpen = signal(false);
  private readonly recentIds = signal<string[]>(this.readRecentIds());
  private readonly showAllDevelopmentItems = isDevMode();
  private searchCloseTimer?: number;

  constructor(
    private readonly router: Router,
    private readonly features: FeatureAccessService,
    protected readonly notificationService: NotificationService,
  ) {}

  protected toggleNotifications(event: MouseEvent): void {
    event.stopPropagation();
    const opening = !this.notificationsOpen();
    this.notificationsOpen.set(opening);
    if (opening) this.notificationService.load(true);
  }

  protected refreshNotifications(event: MouseEvent): void {
    event.stopPropagation();
    this.notificationService.load();
  }

  protected notificationTitle(notification: FleetNotification): string {
    return notification.notf_title || 'Fleet notification';
  }

  protected notificationBody(notification: FleetNotification): string {
    return notification.notf_body || notification.description || 'A new fleet event was received.';
  }

  protected notificationCount(): string {
    const count = this.notificationService.unreadCount();
    return count > 99 ? '99+' : String(count);
  }

  protected openNotification(notification: FleetNotification): void {
    if (notification.vehicle == null) return;
    this.notificationsOpen.set(false);
    const prefix = this.router.url.startsWith('/fleetpoint') ? '/fleetpoint' : '';
    void this.router.navigate([`${prefix}/live-tracking`], {
      queryParams: { vehicle_id: notification.vehicle },
    });
  }

  protected isSpeedNotification(notification: FleetNotification): boolean {
    return Number(notification.notf_type) === 1 && notification.threshold_value != null;
  }

  @HostListener('document:click')
  protected closeNotifications(): void {
    this.notificationsOpen.set(false);
  }

  protected readonly identity = this.readIdentity();
  private readonly destinations: SearchDestination[] = [
    ...SIDEBAR_MENU.flatMap((group) => group.items.map((item) => ({
      id: item.route.slice(1), label: item.label, description: group.title,
      route: item.route, icon: item.icon, featureId: item.featureId,
    }))),
    { id: 'dashboard-safety', label: 'Safety Dashboard', description: 'Dashboard', route: '/dashboard/safety', icon: 'assets/fleetpoint/sidebar-icons/dashboard.svg', featureId: 2, keywords: 'risk score violations' },
    { id: 'dashboard-maintenance', label: 'Maintenance Dashboard', description: 'Dashboard', route: '/dashboard/maintenance', icon: 'assets/fleetpoint/sidebar-icons/dashboard.svg', featureId: 2 },
    { id: 'dashboard-jobs', label: 'Jobs Dashboard', description: 'Dashboard', route: '/dashboard/jobs', icon: 'assets/fleetpoint/sidebar-icons/dashboard.svg', featureId: 2 },
    { id: 'driver-allocations', label: 'Driver Allocations', description: 'Drivers', route: '/drivers/allocations', icon: 'assets/fleetpoint/sidebar-icons/drivers.svg', featureId: 11, keywords: 'vehicle assignment' },
    { id: 'driver-groups', label: 'Driver Groups', description: 'Drivers', route: '/drivers/groups', icon: 'assets/fleetpoint/sidebar-icons/drivers.svg', featureId: 11 },
    { id: 'driver-managers', label: 'Driver Managers', description: 'Drivers', route: '/drivers/managers', icon: 'assets/fleetpoint/sidebar-icons/drivers.svg', featureId: 11 },
    { id: 'route-active', label: 'Active Route Runs', description: 'Routes', route: '/routes/active-runs', icon: 'assets/fleetpoint/sidebar-icons/routes.svg', featureId: 50 },
    { id: 'route-dispatch', label: 'Route Dispatch', description: 'Routes', route: '/routes/dispatch', icon: 'assets/fleetpoint/sidebar-icons/routes.svg', featureId: 50 },
    { id: 'route-adherence', label: 'Route Adherence', description: 'Routes', route: '/routes/adherence', icon: 'assets/fleetpoint/sidebar-icons/routes.svg', featureId: 50 },
    { id: 'dashcam-events', label: 'DashCam Events', description: 'DashCam', route: '/dashcam/events', icon: 'assets/fleetpoint/sidebar-icons/dashcam.svg', featureId: 151 },
    { id: 'dashcam-review', label: 'DashCam Review Queue', description: 'DashCam', route: '/dashcam/review', icon: 'assets/fleetpoint/sidebar-icons/dashcam.svg', featureId: 151 },
    { id: 'dashcam-analytics', label: 'DashCam Analytics', description: 'DashCam', route: '/dashcam/analytics', icon: 'assets/fleetpoint/sidebar-icons/dashcam.svg', featureId: 151 },
    { id: 'maintenance-work-orders', label: 'Work Orders', description: 'Maintenance', route: '/maintenance/work-orders', icon: 'assets/fleetpoint/sidebar-icons/maintenance.svg', featureId: 70 },
    { id: 'maintenance-workshops', label: 'Workshops', description: 'Maintenance', route: '/maintenance/workshops', icon: 'assets/fleetpoint/sidebar-icons/maintenance.svg', featureId: 70 },
    { id: 'maintenance-service-log', label: 'Service Log', description: 'Maintenance', route: '/maintenance/service-log', icon: 'assets/fleetpoint/sidebar-icons/maintenance.svg', featureId: 70 },
    { id: 'maintenance-predictions', label: 'Maintenance Predictions', description: 'Maintenance', route: '/maintenance/predictions', icon: 'assets/fleetpoint/sidebar-icons/maintenance.svg', featureId: 70, keywords: 'ai predictive' },
    { id: 'violation-fines', label: 'Violation Fines', description: 'Violations', route: '/violations/fines', icon: 'assets/fleetpoint/sidebar-icons/violations.svg', featureId: 21 },
    { id: 'violation-configuration', label: 'Violation Configuration', description: 'Violations', route: '/violations/configuration', icon: 'assets/fleetpoint/sidebar-icons/violations.svg', featureId: 21, keywords: 'rules settings' },
    { id: 'geozone-list', label: 'Geozone List', description: 'Geozones', route: '/geozones/list', icon: 'assets/fleetpoint/sidebar-icons/geozones.svg', featureId: 46 },
    { id: 'geozone-analytics', label: 'Geozone Analytics', description: 'Geozones', route: '/geozones/analytics', icon: 'assets/fleetpoint/sidebar-icons/geozones.svg', featureId: 46 },
    { id: 'document-vehicles', label: 'Vehicle Documents', description: 'Documents', route: '/documents/vehicle', icon: 'assets/fleetpoint/sidebar-icons/documents.svg', featureId: 114 },
    { id: 'document-drivers', label: 'Driver Documents', description: 'Documents', route: '/documents/driver', icon: 'assets/fleetpoint/sidebar-icons/documents.svg', featureId: 114 },
    { id: 'document-company', label: 'Company Documents', description: 'Documents', route: '/documents/company', icon: 'assets/fleetpoint/sidebar-icons/documents.svg', featureId: 114 },
    { id: 'settings-notifications', label: 'Notification Settings', description: 'Settings', route: '/settings/notifications', icon: 'assets/fleetpoint/sidebar-icons/settings.svg', featureId: 110 },
    { id: 'settings-display', label: 'Display Settings', description: 'Settings', route: '/settings/display', icon: 'assets/fleetpoint/sidebar-icons/settings.svg', featureId: 110 },
    { id: 'settings-integrations', label: 'Integrations', description: 'Settings', route: '/settings/integrations', icon: 'assets/fleetpoint/sidebar-icons/settings.svg', featureId: 110 },
    { id: 'profile', label: 'My Profile', description: 'Account', route: '/profile', icon: 'assets/fleetpoint/sidebar-icons/users-roles.svg', featureId: 0, keywords: 'account user' },
  ];
  protected readonly searchResults = computed(() => {
    const available = this.destinations.filter((item) => item.featureId === 0 || this.showAllDevelopmentItems || this.features.has(item.featureId));
    const query = this.normalize(this.searchQuery());
    if (!query) {
      const recent = this.recentIds().map((id) => available.find((item) => item.id === id)).filter((item): item is SearchDestination => !!item);
      const fallback = available.filter((item) => !recent.includes(item));
      return [...recent, ...fallback].slice(0, 8);
    }
    const terms = query.split(' ').filter(Boolean);
    return available
      .map((item) => {
        const label = this.normalize(item.label);
        const haystack = this.normalize(`${item.label} ${item.description} ${item.keywords ?? ''}`);
        if (!terms.every((term) => haystack.includes(term))) return { item, score: -1 };
        const score = label === query ? 100 : label.startsWith(query) ? 80 : label.includes(query) ? 60 : 30;
        return { item, score };
      })
      .filter((result) => result.score >= 0)
      .sort((a, b) => b.score - a.score || a.item.label.localeCompare(b.item.label))
      .slice(0, 8)
      .map((result) => result.item);
  });

  protected openSearch(): void {
    if (this.searchCloseTimer) window.clearTimeout(this.searchCloseTimer);
    this.searchVisible.set(true);
    this.searchOpen.set(true);
    this.activeResult.set(0);
  }

  protected closeSearch(): void {
    this.searchOpen.set(false);
    if (this.searchCloseTimer) window.clearTimeout(this.searchCloseTimer);
    this.searchCloseTimer = window.setTimeout(() => {
      this.searchVisible.set(false);
      this.searchQuery.set('');
      this.activeResult.set(0);
      this.searchCloseTimer = undefined;
    }, 150);
  }

  protected updateSearch(value: string): void {
    this.searchQuery.set(value);
    this.activeResult.set(0);
  }

  protected handleSearchKey(event: KeyboardEvent): void {
    const results = this.searchResults();
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.activeResult.update((index) => results.length ? (index + 1) % results.length : 0);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.activeResult.update((index) => results.length ? (index - 1 + results.length) % results.length : 0);
    } else if (event.key === 'Enter' && results[this.activeResult()]) {
      event.preventDefault();
      this.selectDestination(results[this.activeResult()]);
    } else if (event.key === 'Escape') {
      this.closeSearch();
    }
  }

  protected selectDestination(destination: SearchDestination): void {
    const recent = [destination.id, ...this.recentIds().filter((id) => id !== destination.id)].slice(0, 5);
    this.recentIds.set(recent);
    try { localStorage.setItem('fleetpoint:search-recents', JSON.stringify(recent)); } catch { /* ignore */ }
    this.closeSearch();
    const prefix = this.router.url.startsWith('/fleetpoint') ? '/fleetpoint' : '';
    void this.router.navigateByUrl(`${prefix}${destination.route}`);
  }

  @HostListener('document:keydown', ['$event'])
  protected globalShortcut(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.openSearch();
      window.setTimeout(() => document.querySelector<HTMLInputElement>('.global-search-input')?.focus());
    }
  }

  protected handleProfileAction(option: DropdownOption): void {
    if (option.id === 'logout') {
      window.dispatchEvent(new CustomEvent('iotility:logout'));
      return;
    }
    const profileUrl = this.router.url.startsWith('/fleetpoint')
      ? '/fleetpoint/profile'
      : '/profile';
    void this.router.navigateByUrl(profileUrl);
  }

  private readIdentity(): { name: string; initials: string } {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}') as {
        username?: string | null;
        first_name?: string;
        last_name?: string;
        email?: string;
      };
      const name =
        user.username?.trim() ||
        [user.first_name, user.last_name].filter(Boolean).join(' ') ||
        user.email ||
        'IoTility User';
      const parts = name.trim().split(/\s+/);
      const initials =
        `${parts[0]?.[0] || 'I'}${parts.length > 1 ? parts.at(-1)?.[0] || '' : ''}`.toUpperCase();
      return { name, initials };
    } catch {
      return { name: 'IoTility User', initials: 'IU' };
    }
  }

  private normalize(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }

  private readRecentIds(): string[] {
    try {
      const stored = JSON.parse(localStorage.getItem('fleetpoint:search-recents') || '[]');
      return Array.isArray(stored) ? stored.filter((id): id is string => typeof id === 'string').slice(0, 5) : [];
    } catch {
      return [];
    }
  }
}
