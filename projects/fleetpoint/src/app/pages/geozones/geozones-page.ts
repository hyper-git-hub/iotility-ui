import { PluralPipe } from '@iotility/shared-ui';
import { TabIndicator } from '@iotility/shared-ui';
import { Component,computed,inject,signal } from '@angular/core';
import { RouterLink,RouterLinkActive,RouterOutlet } from '@angular/router';
import { StatCard } from '../../shared/stat-card/stat-card';
import { FeedbackDialogBridgeService } from '../../shared/services/feedback-dialog-bridge.service';
import { GeozonesApiService } from '../../shared/services/geozones-api.service';
import { GeozoneForm,GeozoneFormValue,toCreateGeozonePayload } from './geozone-form/geozone-form';
import { NOT_AVAILABLE } from './geozones.data';
import { GeozonesStore } from './geozones.store';

@Component({
  selector:'app-geozones-page',
  imports:[PluralPipe, TabIndicator, GeozoneForm,RouterLink,RouterLinkActive,RouterOutlet,StatCard],
  templateUrl:'./geozones-page.html',
  styleUrl:'./geozones-page.css',
})
export class GeozonesPage{
  private readonly store=inject(GeozonesStore);
  private readonly api=inject(GeozonesApiService);
  private readonly feedback=inject(FeedbackDialogBridgeService);
  /** False until the first geo-zone response; stat cards show skeletons. */
  protected readonly loaded=this.store.loaded;
  protected readonly formOpen=signal(false);
  protected readonly saving=signal(false);
  protected readonly total=computed(()=>this.store.zones().length);
  protected readonly active=computed(()=>this.store.zones().filter(x=>x.active).length);
  protected readonly restricted=computed(()=>this.store.zones().filter(x=>x.type==='restricted').length);
  /** Occupancy and violations per zone aren't part of the geo-zone API. */
  protected readonly inside=NOT_AVAILABLE;
  protected readonly violations=NOT_AVAILABLE;
  constructor(){this.store.refresh();}
  protected openForm():void{this.formOpen.set(true);}
  protected closeForm():void{this.formOpen.set(false);}
  protected createZone(value:GeozoneFormValue):void{
    if(this.saving())return;
    this.saving.set(true);
    const failed=(message?:string)=>void this.feedback.open({type:'error',title:'Unable to create zone',message:message||'The geozone could not be saved. Please try again.',showCancel:false});
    this.api.create(toCreateGeozonePayload(value)).subscribe({
      next:(response)=>{
        this.saving.set(false);
        if(response.status===1002)return failed(response.message);
        this.closeForm();
        this.store.refresh();
      },
      error:(error)=>{this.saving.set(false);failed(error?.error?.message);},
    });
  }
}
