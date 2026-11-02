import { TabIndicator } from '@iotility/shared-ui';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { RoutesApiService } from '../../shared/services/routes-api.service';
import { StatCard } from '../../shared/stat-card/stat-card';
import { NOT_AVAILABLE, toRunRecord } from './routes.data';
import { RouteForm } from './route-form/route-form';
@Component({selector:'app-routes-page',imports:[TabIndicator, RouterLink,RouterLinkActive,RouterOutlet,StatCard,RouteForm],templateUrl:'./routes-page.html',styleUrl:'./routes-page.css'})
export class RoutesPage {
  private readonly api=inject(RoutesApiService);
  protected readonly loaded=this.api.loaded;
  protected readonly routeFormOpen=signal(false);
  private readonly runs=computed(()=>this.api.allocations().map(toRunRecord));
  protected readonly total=computed(()=>this.api.routes().length);
  protected readonly enRoute=computed(()=>this.runs().filter(r=>r.status==='En Route').length);
  protected readonly scheduled=computed(()=>this.runs().filter(r=>r.status==='Scheduled').length);
  protected readonly completed=computed(()=>{const today=new Date().toDateString();return this.runs().filter(r=>r.status==='Completed'&&r.startsAt?.toDateString()===today).length;});
  /** The API has no adherence score or dispatch mode. */
  protected readonly compliance=NOT_AVAILABLE;
  protected readonly auto=NOT_AVAILABLE;
  constructor(){this.api.refresh();}
  protected createRoute(){this.routeFormOpen.set(false);this.api.refresh();}
}
