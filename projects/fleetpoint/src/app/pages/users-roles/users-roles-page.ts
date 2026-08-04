import { Component, OnInit, computed, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { BlockingLoader, DataTable, DataTableSkeleton, Dropdown, DropdownOption, Skeleton, SmoothHeight, TableAction, TableColumn, TableRow } from '@iotility/shared-ui';
import { finalize, forkJoin } from 'rxjs';
import { Modal } from '../../shared/modal/modal';
import { FeedbackDialogBridgeService } from '../../shared/services/feedback-dialog-bridge.service';
import {
  ListingQuery,
  ManagedUser,
  RoleGroup,
  UserPayload,
  UsersRolesApiService,
  VehicleOptionRecord,
} from '../../shared/services/users-roles-api.service';

interface FeatureOption {
  id: number;
  label: string;
  section: string;
}

@Component({
  selector: 'app-users-roles-page',
  imports: [BlockingLoader, DataTable, DataTableSkeleton, Dropdown, Modal, ReactiveFormsModule, Skeleton, SmoothHeight],
  templateUrl: './users-roles-page.html',
  styleUrl: './users-roles-page.css',
})
export class UsersRolesPage implements OnInit {
  protected readonly activeTab = signal<'users' | 'roles'>('users');
  protected readonly userLoading = signal(false);
  protected readonly roleLoading = signal(false);
  protected readonly usersLoaded = signal(false);
  protected readonly rolesLoaded = signal(false);
  protected readonly usersInitialLoading = computed(() => this.userLoading() && !this.usersLoaded());
  protected readonly rolesInitialLoading = computed(() => this.roleLoading() && !this.rolesLoaded());
  protected readonly usersRefreshing = computed(() => this.userLoading() && this.usersLoaded());
  protected readonly rolesRefreshing = computed(() => this.roleLoading() && this.rolesLoaded());
  protected readonly actionLoading = signal(false);
  protected readonly assignmentOptionsLoading = signal(false);
  protected readonly featuresLoading = signal(false);
  protected readonly error = signal('');
  protected readonly users = signal<ManagedUser[]>([]);
  protected readonly roles = signal<RoleGroup[]>([]);
  protected readonly vehicles = signal<VehicleOptionRecord[]>([]);
  protected readonly unassignedUsers = signal<ManagedUser[]>([]);
  protected readonly userTotal = signal(0);
  protected readonly roleTotal = signal(0);
  protected readonly userOffset = signal(0);
  protected readonly roleOffset = signal(0);
  protected readonly limit = 10;
  protected readonly userSearch = signal('');
  protected readonly roleSearch = signal('');
  protected readonly userStatus = signal('');
  protected readonly userModalOpen = signal(false);
  protected readonly roleModalOpen = signal(false);
  protected readonly assignModalOpen = signal(false);
  protected readonly selectedUser = signal<ManagedUser | null>(null);
  protected readonly selectedRole = signal<RoleGroup | null>(null);
  protected readonly selectedImage = signal<File | null>(null);
  protected readonly userImagePreview = signal('');
  protected readonly selectedFeatures = signal<number[]>([]);
  protected readonly selectedVehicles = signal<number[]>([]);
  protected readonly selectedAssignUsers = signal<string[]>([]);
  protected readonly featuresExpanded = signal(true);
  protected readonly vehiclesExpanded = signal(false);
  protected readonly submitted = signal(false);
  protected readonly featureOptions = signal<FeatureOption[]>([]);
  protected readonly statusFilterOptions: DropdownOption[] = [
    { id: '', label: 'All users' },
    { id: '1', label: 'Active' },
    { id: '2', label: 'Inactive' },
  ];
  protected readonly userStatusOptions: DropdownOption[] = [
    { id: '1', label: 'Active' },
    { id: '2', label: 'Inactive' },
  ];
  protected readonly roleOptions = computed<DropdownOption[]>(() =>
    this.roles().map((role) => ({ id: String(role.id), label: role.name })),
  );
  protected readonly userColumns: TableColumn[] = [
    { key: 'name', label: 'User', type: 'user', secondaryKey: 'email' },
    { key: 'phone', label: 'Phone' },
    { key: 'department', label: 'Department' },
    { key: 'group', label: 'Group' },
    { key: 'access', label: 'Access' },
    { key: 'joined', label: 'Date Joined' },
    { key: 'status', label: 'Status', type: 'status' },
    { key: 'actions', label: '', type: 'actions' },
  ];
  protected readonly roleColumns: TableColumn[] = [
    { key: 'name', label: 'Group' },
    { key: 'description', label: 'Description' },
    { key: 'users', label: 'Users' },
    { key: 'features', label: 'Features' },
    { key: 'updated', label: 'Updated' },
    { key: 'actions', label: '', type: 'actions' },
  ];
  protected readonly userColumnLabels = this.userColumns.map((column) => column.label);
  protected readonly roleColumnLabels = this.roleColumns.map((column) => column.label);
  protected readonly actions: TableAction[] = ['edit', 'delete'];
  protected readonly userRows = computed<TableRow[]>(() =>
    this.users().map((user) => ({
      guid: user.guid,
      name: [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email,
      email: user.email,
      phone: user.phone || '—',
      department: user.department || 'Not assigned',
      group: user.group || 'Unassigned',
      access: user.write ? 'Read & write' : 'Read only',
      joined: this.dateLabel(user.date_joined),
      status: user.is_active === false || user.status === 2 ? 'Inactive' : 'Active',
      actions: '',
    })),
  );
  protected readonly roleRows = computed<TableRow[]>(() =>
    this.roles().map((role) => ({
      id: role.id,
      name: role.name,
      description: role.description || '—',
      users: role.user_count ?? role.group_user?.length ?? 0,
      features: role.group_features?.length ?? 0,
      updated: this.dateLabel(role.updated_at || role.created_at),
      actions: '',
    })),
  );
  protected readonly assignedUserTotal = computed(() =>
    this.roles().reduce(
      (total, role) => total + (role.user_count ?? role.group_user?.length ?? 0),
      0,
    ),
  );
  protected readonly userStart = computed(() => (this.userTotal() ? this.userOffset() + 1 : 0));
  protected readonly userEnd = computed(() => Math.min(this.userOffset() + this.limit, this.userTotal()));
  protected readonly roleStart = computed(() => (this.roleTotal() ? this.roleOffset() + 1 : 0));
  protected readonly roleEnd = computed(() => Math.min(this.roleOffset() + this.limit, this.roleTotal()));
  protected readonly userForm;
  protected readonly roleForm;
  protected readonly assignForm;
  private userSearchTimer?: ReturnType<typeof setTimeout>;
  private roleSearchTimer?: ReturnType<typeof setTimeout>;

  constructor(
    formBuilder: FormBuilder,
    private readonly api: UsersRolesApiService,
    private readonly feedback: FeedbackDialogBridgeService,
  ) {
    this.userForm = formBuilder.nonNullable.group({
      firstName: ['', [Validators.required, Validators.pattern(/^[\p{L} ]+$/u)]],
      lastName: ['', [Validators.required, Validators.pattern(/^[\p{L} ]+$/u)]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['+974', Validators.required],
      department: [''],
      designation: [''],
      workLocation: [''],
      internalRole: [''],
      status: [1],
      write: [false],
    });
    this.roleForm = formBuilder.nonNullable.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      description: ['', [Validators.required, Validators.minLength(2)]],
    });
    this.assignForm = formBuilder.nonNullable.group({ groupId: [0, Validators.min(1)] });
  }

  ngOnInit(): void {
    this.loadUsers();
    this.loadRoles(false);
  }

  protected selectTab(tab: 'users' | 'roles'): void {
    this.activeTab.set(tab);
    this.error.set('');
    if (tab === 'users' && !this.users().length && !this.userLoading()) this.loadUsers();
    if (tab === 'roles' && !this.roles().length && !this.roleLoading()) this.loadRoles();
  }

  protected userSearchChanged(value: string): void {
    this.userSearch.set(value);
    clearTimeout(this.userSearchTimer);
    this.userSearchTimer = setTimeout(() => { this.userOffset.set(0); this.loadUsers(); }, 400);
  }

  protected roleSearchChanged(value: string): void {
    this.roleSearch.set(value);
    clearTimeout(this.roleSearchTimer);
    this.roleSearchTimer = setTimeout(() => { this.roleOffset.set(0); this.loadRoles(); }, 400);
  }

  protected selectStatusFilter(option: DropdownOption): void {
    this.userStatus.set(option.id);
    this.userOffset.set(0);
    this.loadUsers();
  }

  protected selectUserStatus(option: DropdownOption): void {
    this.userForm.controls.status.setValue(Number(option.id));
  }

  protected selectAssignGroup(option: DropdownOption): void {
    this.assignForm.controls.groupId.setValue(Number(option.id));
    this.assignForm.controls.groupId.markAsTouched();
  }

  protected optionLabel(options: DropdownOption[], selected: string, fallback: string): string {
    return options.find((option) => option.id === selected)?.label ?? fallback;
  }

  protected stringValue(value: number): string {
    return String(value);
  }

  protected openCreateUser(): void {
    this.selectedUser.set(null);
    this.userForm.reset({ firstName: '', lastName: '', email: '', phone: '+974', department: '', designation: '', workLocation: '', internalRole: '', status: 1, write: false });
    this.selectedImage.set(null);
    this.userImagePreview.set('');
    this.submitted.set(false);
    this.userModalOpen.set(true);
  }

  protected handleUserAction(event: { action: TableAction; row: TableRow }): void {
    const user = this.users().find((item) => item.guid === String(event.row['guid']));
    if (!user) return;
    if (event.action === 'edit') this.openEditUser(user);
    if (event.action === 'delete') void this.deleteUser(user);
  }

  protected chooseImage(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    if (file && (!file.type.startsWith('image/') || file.size > 5_000_000)) {
      input.value = '';
      void this.feedback.open({ type: 'error', title: 'Invalid image', message: 'Choose a JPG or PNG image smaller than 5 MB.', confirmText: 'Close', showCancel: false });
      return;
    }
    this.selectedImage.set(file);
    this.userImagePreview.set(file ? URL.createObjectURL(file) : '');
  }

  protected saveUser(): void {
    this.submitted.set(true);
    this.userForm.markAllAsTouched();
    if (this.userForm.invalid) return;
    const value = this.userForm.getRawValue();
    const payload: UserPayload = {
      first_name: value.firstName,
      last_name: value.lastName,
      email: value.email,
      phone: value.phone,
      department: value.department,
      designation: value.designation,
      work_location: value.workLocation,
      internal_role: value.internalRole,
      status: value.status,
      write: value.write,
      image: this.selectedImage(),
    };
    const editing = !!this.selectedUser();
    this.actionLoading.set(true);
    (editing ? this.api.updateUser(payload) : this.api.createUser(payload))
      .pipe(finalize(() => this.actionLoading.set(false)))
      .subscribe({
        next: (response) => {
          this.userModalOpen.set(false);
          void this.success(editing ? 'User updated' : 'User created', response.message);
          this.loadUsers();
        },
        error: (response) => this.apiError(response, 'The user could not be saved.'),
      });
  }

  protected openCreateRole(): void {
    this.selectedRole.set(null);
    this.roleForm.reset({ name: '', description: '' });
    this.selectedFeatures.set([]);
    this.selectedVehicles.set([]);
    this.featuresExpanded.set(true);
    this.vehiclesExpanded.set(false);
    this.submitted.set(false);
    this.roleModalOpen.set(true);
    this.loadPackageFeatures();
    this.loadVehicles();
  }

  protected handleRoleAction(event: { action: TableAction; row: TableRow }): void {
    const role = this.roles().find((item) => item.id === Number(event.row['id']));
    if (!role) return;
    if (event.action === 'edit') this.openEditRole(role);
    if (event.action === 'delete') void this.deleteRole(role);
  }

  protected toggleFeature(id: number, checked: boolean): void {
    this.selectedFeatures.update((ids) => checked ? [...new Set([...ids, id])] : ids.filter((value) => value !== id));
  }

  protected toggleVehicle(id: number, checked: boolean): void {
    this.selectedVehicles.update((ids) => checked ? [...new Set([...ids, id])] : ids.filter((value) => value !== id));
  }

  protected saveRole(): void {
    this.submitted.set(true);
    this.roleForm.markAllAsTouched();
    if (this.roleForm.invalid || !this.selectedFeatures().length) return;
    const value = this.roleForm.getRawValue();
    const role = this.selectedRole();
    const payload = { id: role?.id, name: value.name.trim(), description: value.description.trim(), features: this.selectedFeatures(), vehicles: this.selectedVehicles() };
    this.actionLoading.set(true);
    (role ? this.api.updateRole(payload) : this.api.createRole(payload))
      .pipe(finalize(() => this.actionLoading.set(false)))
      .subscribe({
        next: (response) => {
          this.roleModalOpen.set(false);
          void this.success(role ? 'Access group updated' : 'Access group created', response.message);
          this.loadRoles();
        },
        error: (response) => this.apiError(response, 'The access group could not be saved.'),
      });
  }

  protected openAssignUsers(): void {
    this.assignForm.reset({ groupId: 0 });
    this.selectedAssignUsers.set([]);
    this.assignModalOpen.set(true);
    this.assignmentOptionsLoading.set(true);
    forkJoin({ users: this.api.getUnassignedUsers(), roles: this.api.getRoles({ limit: 100, offset: 0, search: '' }) })
      .pipe(finalize(() => this.assignmentOptionsLoading.set(false)))
      .subscribe({
        next: ({ users, roles }) => {
          this.unassignedUsers.set(Array.isArray(users.data) ? users.data : []);
          this.roles.set(roles.data?.data ?? []);
          this.roleTotal.set(roles.data?.count ?? 0);
        },
        error: (response) => this.apiError(response, 'Users and access groups could not be loaded.'),
      });
  }

  protected toggleAssignUser(guid: string, checked: boolean): void {
    this.selectedAssignUsers.update((ids) => checked ? [...new Set([...ids, guid])] : ids.filter((id) => id !== guid));
  }

  protected assignUsers(): void {
    this.submitted.set(true);
    this.assignForm.markAllAsTouched();
    if (this.assignForm.invalid || !this.selectedAssignUsers().length) return;
    this.actionLoading.set(true);
    this.api.assignUsers(this.assignForm.getRawValue().groupId, this.selectedAssignUsers())
      .pipe(finalize(() => this.actionLoading.set(false)))
      .subscribe({
        next: (response) => {
          this.assignModalOpen.set(false);
          void this.success('Users assigned', response.message);
          this.loadRoles();
        },
        error: (response) => this.apiError(response, 'The users could not be assigned.'),
      });
  }

  protected previousUsers(): void { this.userOffset.update((value) => Math.max(0, value - this.limit)); this.loadUsers(); }
  protected nextUsers(): void { if (this.userOffset() + this.limit < this.userTotal()) { this.userOffset.update((value) => value + this.limit); this.loadUsers(); } }
  protected previousRoles(): void { this.roleOffset.update((value) => Math.max(0, value - this.limit)); this.loadRoles(); }
  protected nextRoles(): void { if (this.roleOffset() + this.limit < this.roleTotal()) { this.roleOffset.update((value) => value + this.limit); this.loadRoles(); } }

  private loadUsers(): void {
    this.userLoading.set(true);
    this.error.set('');
    this.api.getUsers(this.query(this.userOffset(), this.userSearch(), this.userStatus()))
      .pipe(finalize(() => {
        this.userLoading.set(false);
        this.usersLoaded.set(true);
      }))
      .subscribe({
        next: (response) => {
          this.users.set(response.data?.data ?? []);
          this.userTotal.set(response.data?.count ?? 0);
        },
        error: (response) => this.apiError(response, 'The users listing could not be loaded.'),
      });
  }

  private loadRoles(showLoading = true): void {
    this.roleLoading.set(true);
    if (showLoading) {
      this.error.set('');
    }
    this.api.getRoles(this.query(this.roleOffset(), this.roleSearch()))
      .pipe(finalize(() => {
        this.roleLoading.set(false);
        this.rolesLoaded.set(true);
      }))
      .subscribe({
        next: (response) => {
          this.roles.set(response.data?.data ?? []);
          this.roleTotal.set(response.data?.count ?? 0);
        },
        error: (response) => {
          if (showLoading) {
            this.apiError(response, 'The roles listing could not be loaded.');
          }
        },
      });
  }

  private openEditUser(user: ManagedUser): void {
    this.selectedUser.set(user);
    this.userForm.reset({ firstName: user.first_name || '', lastName: user.last_name || '', email: user.email, phone: user.phone || '+974', department: user.department || '', designation: user.designation || '', workLocation: user.work_location || '', internalRole: user.internal_role || '', status: user.status ?? (user.is_active === false ? 2 : 1), write: !!user.write });
    this.selectedImage.set(null);
    this.userImagePreview.set(user.user_image || user.image || '');
    this.submitted.set(false);
    this.userModalOpen.set(true);
  }

  private openEditRole(role: RoleGroup): void {
    this.selectedRole.set(role);
    this.roleForm.reset({ name: role.name, description: role.description || '' });
    this.selectedFeatures.set((role.group_features ?? []).map(Number));
    this.selectedVehicles.set((role.group_vehicles ?? []).map(Number));
    this.featuresExpanded.set(true);
    this.vehiclesExpanded.set(false);
    this.submitted.set(false);
    this.roleModalOpen.set(true);
    this.loadPackageFeatures();
    this.loadVehicles();
  }

  private loadVehicles(): void {
    if (this.vehicles().length) return;
    this.api.getVehicles().subscribe({
      next: (response) => this.vehicles.set(response.data?.data ?? []),
      error: (response) => this.apiError(response, 'Vehicles could not be loaded.'),
    });
  }

  private async deleteUser(user: ManagedUser): Promise<void> {
    const confirmed = await this.feedback.open({ type: 'warning', title: 'Delete user?', message: `${user.email} will be permanently deleted.`, confirmText: 'Delete user', cancelText: 'Keep user', showCancel: true });
    if (!confirmed) return;
    this.actionLoading.set(true);
    this.api.deleteUser(user.email).pipe(finalize(() => this.actionLoading.set(false))).subscribe({
      next: (response) => { void this.success('User deleted', response.message); this.loadUsers(); },
      error: (response) => this.apiError(response, 'The user could not be deleted.'),
    });
  }

  private async deleteRole(role: RoleGroup): Promise<void> {
    const confirmed = await this.feedback.open({ type: 'warning', title: 'Delete access group?', message: `${role.name} will be permanently deleted.`, confirmText: 'Delete group', cancelText: 'Keep group', showCancel: true });
    if (!confirmed) return;
    this.actionLoading.set(true);
    this.api.deleteRole(role.id).pipe(finalize(() => this.actionLoading.set(false))).subscribe({
      next: (response) => { void this.success('Access group deleted', response.message); this.loadRoles(); },
      error: (response) => this.apiError(response, 'The access group could not be deleted.'),
    });
  }

  private query(offset: number, search: string, status = ''): ListingQuery {
    return { limit: this.limit, offset, search: search.trim(), status, order: '', orderBy: '' };
  }

  private loadPackageFeatures(): void {
    const context = this.packageContext();
    if (!context) {
      this.featureOptions.set([]);
      this.apiError({}, 'Your customer package information is unavailable.');
      return;
    }
    this.featuresLoading.set(true);
    this.api.getPackageFeatures(context.customerId)
      .pipe(finalize(() => this.featuresLoading.set(false)))
      .subscribe({
        next: (response) => {
          const features = response.data?.data?.features ?? [];
          this.featureOptions.set(
            features
              .filter((feature) =>
                Number(feature.id) !== 135 &&
                feature.packages.some(
                  (item) => Number(item.id) === context.packageId && item.is_selected,
                ),
              )
              .map((feature) => ({
                id: Number(feature.id),
                label: feature.name,
                section: 'Package feature',
              })),
          );
        },
        error: (response) => {
          this.featureOptions.set([]);
          this.apiError(response, 'Package features could not be loaded.');
        },
      });
  }

  private packageContext(): { customerId: number; packageId: number } | null {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}') as {
        customer?: {
          customer_id?: number;
          associations?: {
            usecase?: number;
            package?: { package_id?: number; usecase?: number };
          }[];
        };
      };
      const association = user.customer?.associations?.find(
        (item) => item.usecase === 6 || item.package?.usecase === 6,
      );
      const customerId = Number(user.customer?.customer_id);
      const packageId = Number(association?.package?.package_id);
      return customerId && packageId ? { customerId, packageId } : null;
    } catch {
      return null;
    }
  }

  private dateLabel(value?: string): string {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
  }

  protected userInitials(): string {
    const first = this.userForm.controls.firstName.value.trim();
    const last = this.userForm.controls.lastName.value.trim();
    return `${first[0] || 'U'}${last[0] || ''}`.toUpperCase();
  }

  private success(title: string, message?: string): Promise<boolean> {
    return this.feedback.open({ type: 'success', title, message: message || `${title} successfully.`, confirmText: 'Done', showCancel: false });
  }

  private apiError(response: { error?: { message?: string } }, fallback: string): void {
    void this.feedback.open({ type: 'error', title: 'Request unsuccessful', message: response.error?.message || fallback, confirmText: 'Close', showCancel: false });
  }
}
