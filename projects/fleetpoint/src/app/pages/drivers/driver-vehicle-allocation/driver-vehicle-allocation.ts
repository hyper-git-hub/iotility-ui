import { Component, OnChanges, OnInit, SimpleChanges, computed, input, output, signal } from '@angular/core';
import { BlockingLoader } from '@iotility/shared-ui';
import { finalize } from 'rxjs';
import { DriverApiService, DriverVehicleAllocation as AllocationRecord } from '../../../shared/services/driver-api.service';
import { FeedbackDialogBridgeService } from '../../../shared/services/feedback-dialog-bridge.service';

@Component({
  selector: 'app-driver-vehicle-allocation',
  imports: [BlockingLoader],
  templateUrl: './driver-vehicle-allocation.html',
  styleUrl: '../drivers-page.css',
})
export class DriverVehicleAllocation implements OnInit, OnChanges {
  readonly refreshToken=input(0);
  readonly editRequested=output<AllocationRecord>();
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly allocations = signal<AllocationRecord[]>([]);
  protected readonly total = signal(0);
  protected readonly offset = signal(0);
  protected readonly limit = 10;
  protected readonly start = computed(() => this.total() ? this.offset() + 1 : 0);
  protected readonly end = computed(() => Math.min(this.offset() + this.limit, this.total()));

  protected readonly actionLoading=signal(false);
  constructor(private readonly api: DriverApiService,private readonly feedback:FeedbackDialogBridgeService) {}
  ngOnInit(): void { this.load(); }
  ngOnChanges(changes:SimpleChanges):void{if(!changes['refreshToken']?.firstChange)this.load();}
  protected names(allocation: AllocationRecord): string[] { return Array.isArray(allocation.driver_name) ? allocation.driver_name : allocation.driver_name ? [allocation.driver_name] : []; }
  protected driverId(allocation: AllocationRecord, index: number): string { return allocation.driver?.[index] ? `ID ${allocation.driver[index]}` : 'Assigned driver'; }
  protected initials(name: string): string { return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'DR'; }
  protected previous(): void { this.offset.update(value => Math.max(0, value - this.limit)); this.load(); }
  protected next(): void { if (this.offset() + this.limit < this.total()) { this.offset.update(value => value + this.limit); this.load(); } }
  protected edit(allocation:AllocationRecord):void{this.editRequested.emit(allocation);}
  protected async remove(allocation:AllocationRecord):Promise<void>{if(!await this.feedback.open({type:'warning',title:'Delete allocation?',message:`The allocation for ${allocation.vehicle_name} will be permanently deleted.`,confirmText:'Delete allocation',cancelText:'Keep allocation',showCancel:true}))return;this.actionLoading.set(true);this.api.deleteDriverVehicleAllocation(allocation.vehicle_id).pipe(finalize(()=>this.actionLoading.set(false))).subscribe({next:async response=>{await this.feedback.open({type:'success',title:'Allocation deleted',message:response.message||'The allocation was deleted successfully.',confirmText:'Done',showCancel:false});this.load();},error:response=>{const message=response.error?.message||'The allocation could not be deleted.';void this.feedback.open({type:'error',title:'Unable to delete allocation',message,confirmText:'Close',showCancel:false});}});}
  private load(): void {
    this.loading.set(true); this.error.set('');
    this.api.getDriverVehicleAllocations(this.limit, this.offset()).pipe(finalize(() => this.loading.set(false))).subscribe({
      next: response => { this.allocations.set(response.data?.data ?? []); this.total.set(response.data?.count ?? 0); },
      error: response => { this.allocations.set([]); this.total.set(0); this.error.set(response.error?.message || 'Driver allocations could not be loaded.'); },
    });
  }
}
