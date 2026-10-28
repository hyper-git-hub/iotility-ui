import { Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DataTable, DataTablePaginationConfig, DataTableSkeleton, TableColumn, TableRow } from '@iotility/shared-ui';
import { Subscription } from 'rxjs';
import { MaintenanceApiService, MaintenanceRecord } from '../../../shared/services/maintenance-api.service';
import { NOT_AVAILABLE, displayDate, money, serviceName, text, workOrderId } from '../maintenance.data';

const PAGE_SIZE=25;

@Component({selector:'app-maintenance-service-log',imports:[DataTable,DataTableSkeleton],templateUrl:'./maintenance-service-log.html',styleUrl:'./maintenance-service-log.css'})
export class MaintenanceServiceLog {
  private readonly api=inject(MaintenanceApiService);
  private readonly destroyRef=inject(DestroyRef);
  private request?:Subscription;
  private readonly records=signal<MaintenanceRecord[]>([]);
  protected readonly total=signal(0);
  protected readonly page=signal(1);
  protected readonly loading=signal(true);
  protected readonly loaded=signal(false);
  protected readonly columns:TableColumn[]=[{key:'id',label:'Work Order'},{key:'vehicle',label:'Vehicle'},{key:'service',label:'Service Completed'},{key:'completed',label:'Completion Date'},{key:'workshop',label:'Workshop'},{key:'technician',label:'Technician'},{key:'mileage',label:'Odometer'},{key:'cost',label:'Cost'}];
  protected readonly rows=computed<TableRow[]>(()=>{
    const currency=this.api.currency();
    return this.records().map(item=>({id:workOrderId(item),vehicle:text(item.vehicle_name),service:serviceName(item),completed:displayDate(item.maintenance_end_date??item.updated_at),workshop:text(item.workshop_name),technician:text(item.technician_name),mileage:NOT_AVAILABLE,cost:money(item.actual_cost??item.estimated_cost,currency)}));
  });
  protected readonly pagination=computed<DataTablePaginationConfig>(()=>({totalItems:this.total(),pageSize:PAGE_SIZE,page:this.page(),loading:this.loading()}));
  protected readonly columnLabels=this.columns.map(column=>column.label);
  protected readonly subtitle=computed(()=>`${this.total()} completed maintenance records`);

  constructor(){effect(()=>{this.api.version();untracked(()=>this.load());});}

  protected changePage(page:number):void{if(page===this.page())return;this.page.set(page);this.load();}

  private load():void{
    this.request?.unsubscribe();
    this.loading.set(true);
    this.request=this.api.log({offset:(this.page()-1)*PAGE_SIZE,limit:PAGE_SIZE}).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next:response=>{const records=response.data?.data??[];this.records.set(records);this.total.set(response.data?.count??records.length);this.loading.set(false);this.loaded.set(true);},
      error:()=>{this.records.set([]);this.total.set(0);this.loading.set(false);this.loaded.set(true);},
    });
  }
}
