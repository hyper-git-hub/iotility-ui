import { Skeleton } from '@iotility/shared-ui';
import { Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';
import { FeedbackDialogBridgeService } from '../../../shared/services/feedback-dialog-bridge.service';
import { MaintenanceApiService, WorkshopOwner, WorkshopRecord } from '../../../shared/services/maintenance-api.service';
import { NOT_AVAILABLE, displayDate, text } from '../maintenance.data';
import { WorkshopForm } from '../workshop-form/workshop-form';

interface WorkshopCard { id:number;name:string;location:string;owner:string;phone:string;email:string;added:string; }

@Component({selector:'app-maintenance-workshops',imports:[Skeleton,WorkshopForm],templateUrl:'./maintenance-workshops.html',styleUrl:'./maintenance-workshops.css'})
export class MaintenanceWorkshops {
  private readonly api=inject(MaintenanceApiService);
  private readonly feedback=inject(FeedbackDialogBridgeService);
  private readonly destroyRef=inject(DestroyRef);
  protected readonly notAvailable=NOT_AVAILABLE;
  protected readonly formOpen=signal(false);
  protected readonly loading=signal(true);
  private readonly records=signal<WorkshopRecord[]>([]);
  private readonly owners=signal<WorkshopOwner[]>([]);
  /** The list returns the owner's first name only, so contact details come from the owner lookup. */
  protected readonly workshops=computed<WorkshopCard[]>(()=>this.records().map(item=>{
    const owner=this.owners().find(candidate=>candidate.guid===item.workshop_owner||candidate.first_name===item.workshop_owner);
    return {id:item.id,name:text(item.workshop_name),location:text(item.location),owner:owner?[owner.first_name,owner.last_name].filter(Boolean).join(' '):text(item.workshop_owner),phone:text(owner?.phone),email:text(owner?.email),added:displayDate(item.created_at)};
  }));

  constructor(){effect(()=>{this.api.version();untracked(()=>this.load());});}

  protected created():void{this.formOpen.set(false);this.api.changed();}

  protected async remove(item:WorkshopCard):Promise<void>{
    const confirmed=await this.feedback.open({type:'warning',title:'Delete workshop?',message:`${item.name} will be permanently deleted.`,confirmText:'Delete',cancelText:'Cancel',showCancel:true});
    if(!confirmed)return;
    this.api.deleteWorkshop(item.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next:response=>response.status===1002?void this.feedback.open({type:'error',title:'Unable to delete',message:response.message||'The workshop could not be deleted.',showCancel:false}):this.api.changed(),
      error:()=>void this.feedback.open({type:'error',title:'Unable to delete',message:'The workshop could not be deleted. Please try again.',showCancel:false}),
    });
  }

  private load():void{
    this.loading.set(true);
    forkJoin({workshops:this.api.workshops(),owners:this.api.workshopOwners()}).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next:({workshops,owners})=>{this.records.set(workshops.data?.data??[]);this.owners.set(owners);this.loading.set(false);},
      error:()=>{this.records.set([]);this.loading.set(false);},
    });
  }
}
