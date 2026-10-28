import { Skeleton } from '@iotility/shared-ui';
import { Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MaintenanceApiService, PredictedMonth } from '../../../shared/services/maintenance-api.service';

@Component({selector:'app-maintenance-predictions',imports:[Skeleton],templateUrl:'./maintenance-predictions.html',styleUrl:'./maintenance-predictions.css'})
export class MaintenancePredictions {
  private readonly api=inject(MaintenanceApiService);
  private readonly destroyRef=inject(DestroyRef);
  protected readonly loading=signal(true);
  protected readonly months=signal<PredictedMonth[]>([]);
  /** Shared scale so bars compare across months. */
  protected readonly max=computed(()=>Math.max(1,...this.months().flatMap(month=>[Number(month.predicted)||0,Number(month.previous)||0])));
  protected readonly totals=computed(()=>this.months().reduce((sum,month)=>({predicted:sum.predicted+(Number(month.predicted)||0),previous:sum.previous+(Number(month.previous)||0)}),{predicted:0,previous:0}));

  constructor(){effect(()=>{this.api.version();untracked(()=>this.load());});}

  protected width(value:number):number{return (Number(value)||0)/this.max()*100;}

  private load():void{
    this.api.predictedByMonth().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next:months=>{this.months.set(months);this.loading.set(false);},
      error:()=>{this.months.set([]);this.loading.set(false);},
    });
  }
}
