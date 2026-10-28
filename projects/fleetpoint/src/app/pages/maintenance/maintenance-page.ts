import { TabIndicator } from '@iotility/shared-ui';
import { Component, DestroyRef, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { forkJoin } from 'rxjs';
import { MaintenanceApiService, PredictedMonth } from '../../shared/services/maintenance-api.service';
import { StatCard } from '../../shared/stat-card/stat-card';
import { NOT_AVAILABLE } from './maintenance.data';
import { WorkOrderForm } from './work-order-form/work-order-form';

/** This month's predicted count from the predictive graph (months come as names, e.g. "Oct" / "October"). */
function predictedThisMonth(months: PredictedMonth[]): number | null {
  const current = new Date().toLocaleString('en-US', { month: 'short' }).toLowerCase();
  const match = months.find((item) => String(item.month).slice(0, 3).toLowerCase() === current);
  return match ? Number(match.predicted) || 0 : null;
}

@Component({selector:'app-maintenance-page',imports:[TabIndicator, RouterLink,RouterLinkActive,RouterOutlet,StatCard,WorkOrderForm],templateUrl:'./maintenance-page.html',styleUrl:'./maintenance-page.css'})
export class MaintenancePage {
  private readonly api=inject(MaintenanceApiService);
  private readonly destroyRef=inject(DestroyRef);
  protected readonly notAvailable=NOT_AVAILABLE;
  protected readonly workOrderFormOpen=signal(false);
  protected readonly loading=signal(true);
  protected readonly total=signal(0);
  protected readonly active=signal(0);
  protected readonly inProgress=signal(0);
  protected readonly completed=signal(0);
  protected readonly predictions=signal<number|string>(NOT_AVAILABLE);
  protected readonly workshopCount=signal<number|null>(null);

  constructor(){
    effect(()=>{this.api.version();untracked(()=>this.load());});
  }

  protected created():void{this.workOrderFormOpen.set(false);this.api.changed();}

  private load():void{
    forkJoin({summary:this.api.summary(),predicted:this.api.predictedByMonth(),workshops:this.api.workshops(0,1)})
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next:({summary,predicted,workshops})=>{
          this.total.set(summary.total);this.completed.set(summary.completed);this.inProgress.set(summary.inProgress);this.active.set(summary.active);
          this.predictions.set(predictedThisMonth(predicted)??NOT_AVAILABLE);
          this.workshopCount.set(workshops.data?.count??null);
          this.loading.set(false);
        },
        error:()=>this.loading.set(false),
      });
  }
}
