import { Component,signal } from '@angular/core';
import { RouterLink,RouterLinkActive,RouterOutlet } from '@angular/router';
import { StatCard } from '../../shared/stat-card/stat-card';
import { GeozoneForm,GeozoneFormValue } from './geozone-form/geozone-form';
import { GEOZONES } from './geozones.data';

@Component({
  selector:'app-geozones-page',
  imports:[GeozoneForm,RouterLink,RouterLinkActive,RouterOutlet,StatCard],
  templateUrl:'./geozones-page.html',
  styleUrl:'./geozones-page.css',
})
export class GeozonesPage{
  protected readonly formOpen=signal(false);
  protected readonly total=GEOZONES.length;
  protected readonly active=GEOZONES.length;
  protected readonly restricted=GEOZONES.filter(x=>x.type==='restricted').length;
  protected readonly inside=GEOZONES.reduce((n,x)=>n+x.inside,0);
  protected readonly violations=GEOZONES.reduce((n,x)=>n+x.violations,0);
  protected openForm():void{this.formOpen.set(true);}
  protected closeForm():void{this.formOpen.set(false);}
  protected createZone(_:GeozoneFormValue):void{this.closeForm();}
}
