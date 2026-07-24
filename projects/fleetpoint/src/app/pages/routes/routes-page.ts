import { Component, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { StatCard } from '../../shared/stat-card/stat-card';
import { ROUTES, RUNS } from './routes.data';
import { RouteForm, RouteFormValue } from './route-form/route-form';
@Component({selector:'app-routes-page',imports:[RouterLink,RouterLinkActive,RouterOutlet,StatCard,RouteForm],templateUrl:'./routes-page.html',styleUrl:'./routes-page.css'})
export class RoutesPage {
  protected readonly routeFormOpen=signal(false);
  protected readonly total=ROUTES.length;
  protected readonly enRoute=RUNS.filter(r=>r.status==='En Route').length;
  protected readonly scheduled=RUNS.filter(r=>r.status==='Scheduled').length;
  protected readonly completed=RUNS.filter(r=>r.status==='Completed').length;
  protected readonly compliance=Math.round(ROUTES.reduce((sum,r)=>sum+r.compliance,0)/ROUTES.length);
  protected readonly auto=RUNS.filter(r=>r.dispatch==='Auto').length;
  protected createRoute(_:RouteFormValue){this.routeFormOpen.set(false);}
}
