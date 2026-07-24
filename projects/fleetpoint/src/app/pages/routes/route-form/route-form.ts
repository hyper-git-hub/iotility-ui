import { Component, input, output, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Dropdown, DropdownOption } from '@iotility/shared-ui';
import { Modal } from '../../../shared/modal/modal';
import { RouteBuilderMap, RoutePoint } from './route-builder-map';
export interface RouteFormValue {name:string;description:string;tolerance:number;fleet:string;points:RoutePoint[];}
@Component({selector:'app-route-form',imports:[Dropdown,Modal,ReactiveFormsModule,RouteBuilderMap],templateUrl:'./route-form.html',styleUrl:'./route-form.css'})
export class RouteForm {
  readonly open=input(false);readonly cancelled=output<void>();readonly created=output<RouteFormValue>();private readonly builder=viewChild(RouteBuilderMap);
  protected readonly mode=signal<'start'|'stop'|'end'>('start');protected readonly points=signal<RoutePoint[]>([]);protected readonly submitted=signal(false);
  protected readonly calculating=signal(false);protected readonly routeCalculated=signal(false);
  protected readonly fleetOptions:DropdownOption[]=[{id:'',label:'Unassigned'},{id:'London Delivery Fleet',label:'London Delivery Fleet'},{id:'Northern Distribution',label:'Northern Distribution'},{id:'Midlands Operations',label:'Midlands Operations'}];
  protected readonly form;
  constructor(fb:FormBuilder){this.form=fb.nonNullable.group({name:['',Validators.required],description:[''],tolerance:[500,[Validators.required,Validators.min(10)]],fleet:['']});}
  protected selectFleet(option:DropdownOption){this.form.controls.fleet.setValue(option.id);}protected fleetLabel(){return this.fleetOptions.find(o=>o.id===this.form.controls.fleet.value)?.label??'Unassigned';}
  protected addPoint(point:RoutePoint){this.points.update(points=>[...points,point]);this.routeCalculated.set(false);if(point.type==='start')this.mode.set('stop');if(point.type==='end')this.mode.set('end');}
  protected chooseMode(mode:'start'|'stop'|'end'){if(mode==='end'&&!this.hasStart())return;this.mode.set(mode);}
  protected hasStart(){return this.points().some(point=>point.type==='start');}protected hasEnd(){return this.points().some(point=>point.type==='end');}
  protected resetRoute(){this.points.set([]);this.mode.set('start');this.routeCalculated.set(false);this.builder()?.reset();}
  protected async calculateRoute(){if(!this.hasStart()||!this.hasEnd()||this.calculating())return;this.calculating.set(true);this.routeCalculated.set(await this.builder()?.calculateRoute()===true);this.calculating.set(false);}
  protected submit(){this.submitted.set(true);this.form.markAllAsTouched();if(this.form.invalid||!this.hasStart()||!this.hasEnd())return;this.created.emit({...this.form.getRawValue(),points:this.points()});this.reset();}
  protected cancel(){this.reset();this.cancelled.emit();}
  private reset(){this.form.reset({name:'',description:'',tolerance:500,fleet:''});this.resetRoute();this.submitted.set(false);}
}
