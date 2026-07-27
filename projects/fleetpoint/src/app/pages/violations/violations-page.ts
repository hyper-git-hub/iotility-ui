import { Component, signal } from '@angular/core';
import { RouterLink,RouterLinkActive,RouterOutlet } from '@angular/router';
import { StatCard } from '../../shared/stat-card/stat-card';
import { VIOLATIONS } from './violations.data';
import { ManualViolationForm } from './manual-violation-form/manual-violation-form';
@Component({selector:'app-violations-page',imports:[ManualViolationForm,RouterLink,RouterLinkActive,RouterOutlet,StatCard],templateUrl:'./violations-page.html',styleUrl:'./violations-page.css'})
export class ViolationsPage {
  protected readonly manualViolationOpen=signal(false);
  protected readonly total=VIOLATIONS.length;
  protected readonly critical=VIOLATIONS.filter(item=>item.severity==='Critical').length;
  protected readonly pending=VIOLATIONS.filter(item=>item.review==='Pending').length;
  protected readonly finesPending=VIOLATIONS.filter(item=>item.fineStatus==='Pending').length;
  protected readonly totalFines='£'+VIOLATIONS.reduce((sum,item)=>sum+item.fine,0).toLocaleString();
  protected readonly scoreImpact=VIOLATIONS.reduce((sum,item)=>sum+item.scoreImpact,0);
}
