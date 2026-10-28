import { Skeleton } from '@iotility/shared-ui';
import { Component, DestroyRef, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { MaintenanceApiService, PredictedMonth } from '../../../shared/services/maintenance-api.service';
import { serviceName, statusLabel, text } from '../maintenance.data';

interface OverviewOrder { id:number;vehicle:string;service:string;workshop:string;status:string; }

@Component({selector:'app-maintenance-overview',imports:[RouterLink,Skeleton],templateUrl:'./maintenance-overview.html',styleUrl:'./maintenance-overview.css'})
export class MaintenanceOverview {
  private readonly api=inject(MaintenanceApiService);
  private readonly destroyRef=inject(DestroyRef);
  protected readonly loading=signal(true);
  protected readonly orders=signal<OverviewOrder[]>([]);
  protected readonly months=signal<PredictedMonth[]>([]);

  constructor(){effect(()=>{this.api.version();untracked(()=>this.load());});}

  protected statusClass(status:string):string{return status.toLowerCase().replaceAll(' ','-');}

  private load():void{
    forkJoin({list:this.api.list({offset:0,limit:20}),months:this.api.predictedByMonth()}).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next:({list,months})=>{
        this.orders.set((list.data?.data??[]).filter(order=>!['Completed','Rejected'].includes(statusLabel(order))).slice(0,5)
          .map(order=>({id:order.id,vehicle:text(order.vehicle_name),service:serviceName(order),workshop:text(order.workshop_name),status:statusLabel(order)})));
        // Latest months first, only the ones with activity.
        this.months.set(months.filter(month=>Number(month.predicted)||Number(month.previous)).reverse().slice(0,5));
        this.loading.set(false);
      },
      error:()=>this.loading.set(false),
    });
  }
}
