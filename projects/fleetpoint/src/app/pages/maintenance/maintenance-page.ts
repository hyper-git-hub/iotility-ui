import { Component, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { StatCard } from '../../shared/stat-card/stat-card';
import { PREDICTIONS, VEHICLE_HEALTH, WORK_ORDERS, WORKSHOPS } from './maintenance.data';
import { WorkOrderForm, WorkOrderFormValue } from './work-order-form/work-order-form';

@Component({selector:'app-maintenance-page',imports:[RouterLink,RouterLinkActive,RouterOutlet,StatCard,WorkOrderForm],templateUrl:'./maintenance-page.html',styleUrl:'./maintenance-page.css'})
export class MaintenancePage {
  protected readonly workOrderFormOpen=signal(false);
  protected readonly active=WORK_ORDERS.filter(order=>!['Completed','Cancelled'].includes(order.status)).length;
  protected readonly critical=WORK_ORDERS.filter(order=>order.priority==='Critical'&&order.status!=='Completed').length;
  protected readonly completed=WORK_ORDERS.filter(order=>order.status==='Completed').length;
  protected readonly poorHealth=VEHICLE_HEALTH.filter(vehicle=>vehicle.score<65).length;
  protected readonly predictions=PREDICTIONS.length;
  protected readonly monthlyCost='£3,850';
  protected readonly workshopCount=WORKSHOPS.length;
  protected createWorkOrder(_:WorkOrderFormValue):void{this.workOrderFormOpen.set(false);}
}
