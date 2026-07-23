import { Component, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { DataTable, Dropdown, DropdownOption, TableAction, TableColumn, TableRow } from '@iotility/shared-ui';
import { StatCard } from '../../shared/stat-card/stat-card';
import { JobForm, JobFormValue } from './job-form/job-form';

type JobStatus = 'Pending' | 'In Progress' | 'Completed' | 'Failed' | 'Assigned';
type JobPriority = 'High' | 'Normal';

interface JobRecord {
  id: string;
  name: string;
  driver: string;
  vehicle: string;
  type: string;
  priority: JobPriority;
  pickup: string;
  dropoff: string;
  scheduled: string;
  status: JobStatus;
  tasks: string;
}

@Component({
  selector: 'app-jobs-page',
  imports: [DataTable, Dropdown, JobForm, StatCard],
  templateUrl: './jobs-page.html',
  styleUrl: './jobs-page.css',
})
export class JobsPage {
  constructor(private readonly router: Router) {}

  protected readonly search = signal('');
  protected readonly filter = signal('all');
  protected readonly jobTypeFilter = signal('all');
  protected readonly driverFilter = signal('all');
  private readonly appliedStatusFilter = signal('all');
  private readonly appliedJobTypeFilter = signal('all');
  private readonly appliedDriverFilter = signal('all');
  protected readonly selectedJob = signal<JobRecord | null>(null);
  protected readonly activeView = signal<'list' | 'dispatch'>('list');
  protected readonly jobFormOpen = signal(false);
  protected readonly offset = signal(0);
  protected readonly limit = 10;
  protected readonly dispatchHours = Array.from({ length: 14 }, (_, index) => `${String(index + 6).padStart(2, '0')}:00`);
  protected readonly dispatchRows = [
    { jobId: 'JOB001', initials: 'JH', driver: 'James', vehicle: 'LP-4821', title: 'Morning Delivery', time: '06:00 → 09:30', start: 2, span: 7, tone: 'completed' },
    { jobId: 'JOB002', initials: 'OP', driver: 'Oliver', vehicle: 'LP-3312', title: 'Scheduled Delivery', time: '08:00 → 11:00', start: 6, span: 6, tone: 'progress' },
    { jobId: 'JOB007', initials: 'MA', driver: 'Mohammed', vehicle: 'LP-3388', title: 'M1 Northbound Transfer', time: '15:00 → 19:00', start: 20, span: 8, tone: 'assigned' },
    { jobId: 'JOB005', initials: 'SW', driver: 'Sarah', vehicle: 'LP-2244', title: 'Ad Hoc Collection', time: '11:00 → 13:00', start: 12, span: 4, tone: 'pending' },
    { jobId: 'JOB006', initials: 'CM', driver: 'Connor', vehicle: 'LP-9901', title: 'LP-9901', time: '14:00 → 17:00', start: 18, span: 6, tone: 'pending' },
    { jobId: 'JOB008', initials: 'PS', driver: 'Priya', vehicle: 'LP-5531', title: 'Manchester Local Deliveries', time: '09:00 → 12:00', start: 8, span: 6, tone: 'failed' },
    { jobId: 'JOB003', initials: 'TG', driver: 'Thomas', vehicle: 'LP-6612', title: 'Manchester Collection', time: '07:00 → 13:00', start: 4, span: 12, tone: 'progress' },
    { jobId: 'JOB004', initials: 'AO', driver: 'Aisha', vehicle: 'LP-2201', title: 'Urban Delivery Run', time: '10:00 → 15:00', start: 10, span: 10, tone: 'pending' },
  ];

  protected readonly filterOptions: DropdownOption[] = [
    { id: 'all', label: 'All statuses' },
    { id: 'pending', label: 'Pending' },
    { id: 'in-progress', label: 'In progress' },
    { id: 'completed', label: 'Completed' },
    { id: 'failed', label: 'Failed' },
    { id: 'high-priority', label: 'High priority' },
  ];
  protected readonly jobTypeOptions: DropdownOption[] = [
    { id: 'all', label: 'All job types' },
    { id: 'delivery', label: 'Delivery' },
    { id: 'collection', label: 'Collection' },
    { id: 'ad-hoc', label: 'Ad Hoc' },
    { id: 'inspection', label: 'Inspection' },
    { id: 'transfer', label: 'Transfer' },
  ];
  protected readonly driverOptions: DropdownOption[] = [
    { id: 'all', label: 'All drivers' },
    { id: 'james-hartley', label: 'James Hartley' },
    { id: 'thomas-griffiths', label: 'Thomas Griffiths' },
    { id: 'oliver-pemberton', label: 'Oliver Pemberton' },
    { id: 'priya-sharma', label: 'Priya Sharma' },
    { id: 'aisha-okonkwo', label: 'Aisha Okonkwo' },
    { id: 'sarah-whitfield', label: 'Sarah Whitfield' },
    { id: 'connor-mcbride', label: 'Connor McBride' },
    { id: 'mohammed-al-rashid', label: 'Mohammed Al-Rashid' },
  ];

  protected readonly columns: TableColumn[] = [
    { key: 'job', label: 'Job', type: 'user', secondaryKey: 'jobId' },
    { key: 'driver', label: 'Driver' },
    { key: 'vehicle', label: 'Vehicle', clickable: true },
    { key: 'type', label: 'Type' },
    { key: 'priority', label: 'Priority', type: 'priority' },
    { key: 'pickup', label: 'Pickup' },
    { key: 'dropoff', label: 'Dropoff' },
    { key: 'scheduled', label: 'Scheduled' },
    { key: 'status', label: 'Status', type: 'status' },
    { key: 'tasks', label: 'Tasks', type: 'tasks' },
    { key: 'actions', label: 'Actions', type: 'actions' },
  ];
  protected readonly tableActions: TableAction[] = ['view'];

  private readonly jobs: JobRecord[] = [
    { id: 'JOB001', name: 'Amazon BHX2 — Morning Delivery', driver: 'James Hartley', vehicle: 'LP-4821', type: 'Delivery', priority: 'High', pickup: 'Stratford Logistics Park', dropoff: 'Amazon BHX2', scheduled: '06:00 → 09:30', status: 'Completed', tasks: '3/3' },
    { id: 'JOB003', name: 'Cold Chain — Manchester Collection', driver: 'Thomas Griffiths', vehicle: 'LP-6612', type: 'Collection', priority: 'High', pickup: 'Trafford Park DC', dropoff: 'Tilbury Cold Storage', scheduled: '07:00 → 13:00', status: 'In Progress', tasks: '2/4' },
    { id: 'JOB002', name: 'Tesco RDC — Scheduled Delivery', driver: 'Oliver Pemberton', vehicle: 'LP-3312', type: 'Delivery', priority: 'High', pickup: 'Stratford Logistics Park', dropoff: 'Tesco RDC', scheduled: '08:00 → 11:00', status: 'In Progress', tasks: '1/3' },
    { id: 'JOB008', name: 'Priya — Manchester Local Deliveries', driver: 'Priya Sharma', vehicle: 'LP-5531', type: 'Delivery', priority: 'Normal', pickup: 'Trafford Park DC', dropoff: 'Northern Quarter', scheduled: '09:00 → 12:00', status: 'Failed', tasks: '1/2' },
    { id: 'JOB004', name: 'Birmingham Ops — Urban Delivery Run', driver: 'Aisha Okonkwo', vehicle: 'LP-2201', type: 'Delivery', priority: 'Normal', pickup: 'Aston Depot', dropoff: 'Multiple stops — Digbeth', scheduled: '10:00 → 15:00', status: 'Pending', tasks: '0/4' },
    { id: 'JOB005', name: 'Manchester Van — Ad Hoc Collection', driver: 'Sarah Whitfield', vehicle: 'LP-2244', type: 'Ad Hoc', priority: 'High', pickup: 'Salford Business Park', dropoff: 'Trafford Park DC', scheduled: '11:00 → 13:00', status: 'Pending', tasks: '0/2' },
    { id: 'JOB006', name: 'Vehicle Inspection — LP-9901', driver: 'Connor McBride', vehicle: 'LP-9901', type: 'Inspection', priority: 'High', pickup: 'Stratford Depot', dropoff: 'Volvo Truck Centre', scheduled: '14:00 → 17:00', status: 'Pending', tasks: '0/3' },
    { id: 'JOB007', name: 'Leeds — M1 Northbound Transfer', driver: 'Mohammed Al-Rashid', vehicle: 'LP-3388', type: 'Transfer', priority: 'Normal', pickup: 'Stourton Hub', dropoff: 'Stratford Logistics Park', scheduled: '15:00 → 19:00', status: 'Assigned', tasks: '0/2' },
  ];

  protected readonly total = this.jobs.length;
  protected readonly pending = this.countStatus('Pending');
  protected readonly inProgress = this.countStatus('In Progress');
  protected readonly completed = this.countStatus('Completed');
  protected readonly failed = this.countStatus('Failed');
  protected readonly highPriority = this.jobs.filter((job) => job.priority === 'High').length;

  protected readonly filteredRows = computed<TableRow[]>(() => {
    const query = this.search().trim().toLowerCase();
    return this.jobs
      .filter((job) => this.matchesFilter(job))
      .filter((job) => !query || Object.values(job).some((value) => value.toLowerCase().includes(query)))
      .map((job) => ({
        id: job.id,
        job: job.name,
        jobId: job.id,
        driver: job.driver,
        vehicle: job.vehicle,
        type: job.type,
        priority: job.priority,
        pickup: job.pickup,
        dropoff: job.dropoff,
        scheduled: job.scheduled,
        status: job.status,
        tasks: job.tasks,
        actions: '',
      }));
  });
  protected readonly rows = computed(() => this.filteredRows().slice(this.offset(), this.offset() + this.limit));
  protected readonly filteredTotal = computed(() => this.filteredRows().length);
  protected readonly pageStart = computed(() => this.filteredTotal() ? this.offset() + 1 : 0);
  protected readonly pageEnd = computed(() => Math.min(this.offset() + this.limit, this.filteredTotal()));

  protected selectFilter(option: DropdownOption): void { this.filter.set(option.id); }
  protected selectJobType(option: DropdownOption): void { this.jobTypeFilter.set(option.id); }
  protected selectDriver(option: DropdownOption): void { this.driverFilter.set(option.id); }
  protected optionLabel(options: DropdownOption[], selected: string, fallback: string): string {
    return options.find((option) => option.id === selected)?.label ?? fallback;
  }
  protected resetFilters(): void {
    this.filter.set('all');
    this.jobTypeFilter.set('all');
    this.driverFilter.set('all');
    this.appliedStatusFilter.set('all');
    this.appliedJobTypeFilter.set('all');
    this.appliedDriverFilter.set('all');
    this.offset.set(0);
    this.closeJobDetails();
  }
  protected applyFilters(): void {
    this.appliedStatusFilter.set(this.filter());
    this.appliedJobTypeFilter.set(this.jobTypeFilter());
    this.appliedDriverFilter.set(this.driverFilter());
    this.offset.set(0);
    this.closeJobDetails();
  }
  protected tableSearchChanged(value: string): void { this.search.set(value); this.offset.set(0); }
  protected previousPage(): void {
    this.offset.update((value) => Math.max(0, value - this.limit));
    this.closeJobDetails();
  }
  protected nextPage(): void {
    if (this.offset() + this.limit < this.filteredTotal()) {
      this.offset.update((value) => value + this.limit);
      this.closeJobDetails();
    }
  }
  protected selectView(view: 'list' | 'dispatch'): void {
    this.activeView.set(view);
    if (view === 'dispatch') this.closeJobDetails();
  }
  protected openJobForm(): void { this.jobFormOpen.set(true); }
  protected closeJobForm(): void { this.jobFormOpen.set(false); }
  protected createJob(_: JobFormValue): void { this.closeJobForm(); }
  protected selectJob(row: TableRow): void {
    this.selectedJob.set(this.jobs.find((job) => job.id === String(row['id'])) ?? null);
  }
  protected selectDispatchJob(jobId: string): void {
    this.selectedJob.set(this.jobs.find((job) => job.id === jobId) ?? null);
  }
  protected closeJobDetails(): void { this.selectedJob.set(null); }
  protected openVehicle(): void {
    void this.router.navigateByUrl('/fleetpoint/vehicles/vehicle-detail');
  }
  protected completedTasks(job: JobRecord): number { return Number(job.tasks.split('/')[0]) || 0; }
  protected totalTasks(job: JobRecord): number { return Number(job.tasks.split('/')[1]) || 0; }
  protected taskItems(job: JobRecord): string[] {
    const byType: Record<string, string[]> = {
      Collection: ['Confirm collection reference', 'Collect and secure cargo', 'Upload collection receipt', 'Complete delivery handoff'],
      Inspection: ['Check vehicle exterior', 'Complete safety inspection', 'Upload inspection report'],
      Transfer: ['Confirm transfer manifest', 'Complete destination handoff'],
    };
    return byType[job.type] ?? ['Load cargo at pickup point', `Deliver to ${job.dropoff}`, 'Obtain proof of delivery', 'Complete job handoff'];
  }

  private countStatus(status: JobStatus): number { return this.jobs.filter((job) => job.status === status).length; }
  private matchesFilter(job: JobRecord): boolean {
    const status = this.appliedStatusFilter();
    const type = this.appliedJobTypeFilter();
    const driver = this.appliedDriverFilter();
    const statusMatches = status === 'all'
      || (status === 'high-priority' ? job.priority === 'High' : job.status.toLowerCase().replaceAll(' ', '-') === status);
    const typeMatches = type === 'all' || job.type.toLowerCase().replaceAll(' ', '-') === type;
    const driverMatches = driver === 'all' || job.driver.toLowerCase().replaceAll(' ', '-') === driver;
    return statusMatches && typeMatches && driverMatches;
  }
}
