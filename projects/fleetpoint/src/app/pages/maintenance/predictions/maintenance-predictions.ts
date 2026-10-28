import { BarChart, ChartCard, ChartLegendItem, ChartSeries, ChartTheme } from '@iotility/shared-ui';
import { Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MaintenanceApiService, PredictedMonth } from '../../../shared/services/maintenance-api.service';

@Component({selector:'app-maintenance-predictions',imports:[BarChart,ChartCard],templateUrl:'./maintenance-predictions.html',styleUrl:'./maintenance-predictions.css'})
export class MaintenancePredictions {
  private readonly api=inject(MaintenanceApiService);
  private readonly theme=inject(ChartTheme);
  private readonly destroyRef=inject(DestroyRef);
  protected readonly loading=signal(true);
  protected readonly months=signal<PredictedMonth[]>([]);
  protected readonly totals=computed(()=>this.months().reduce((sum,month)=>({predicted:sum.predicted+(Number(month.predicted)||0),previous:sum.previous+(Number(month.previous)||0)}),{predicted:0,previous:0}));
  protected readonly categories=computed(()=>this.months().map(month=>month.month));
  protected readonly series=computed<ChartSeries[]>(()=>{
    const palette=this.theme.palette();
    return [
      {name:'Predicted',data:this.months().map(month=>Number(month.predicted)||0),color:palette.brand},
      {name:'Previous',data:this.months().map(month=>Number(month.previous)||0),color:palette.success},
    ];
  });
  protected readonly legend=computed<ChartLegendItem[]>(()=>this.series().map(item=>({label:item.name,color:item.color!})));

  constructor(){effect(()=>{this.api.version();untracked(()=>this.load());});}

  private load():void{
    this.api.predictedByMonth().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next:months=>{this.months.set(months);this.loading.set(false);},
      error:()=>{this.months.set([]);this.loading.set(false);},
    });
  }
}
