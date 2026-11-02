import { Component, DestroyRef, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Dropdown, DropdownOption } from '@iotility/shared-ui';
import { forkJoin, of, switchMap } from 'rxjs';
import { Modal } from '../../../shared/modal/modal';
import { FeedbackDialogBridgeService } from '../../../shared/services/feedback-dialog-bridge.service';
import { FormFlowService } from '../../../shared/services/form-flow.service';
import { GeoPoint, RoutesApiService, SaveRoutePayload } from '../../../shared/services/routes-api.service';
import { encodePolyline } from '../routes.data';
import { RouteBuilderMap, RouteCalculation, RoutePoint } from './route-builder-map';

/**
 * Builds a route on the map and saves it to fms-fleet (POST /api/route). The road path comes from
 * OSRM; description, tolerance and fleet have no API field yet, so they aren't sent.
 */
@Component({selector:'app-route-form',imports:[Dropdown,Modal,ReactiveFormsModule,RouteBuilderMap],templateUrl:'./route-form.html',styleUrl:'./route-form.css'})
export class RouteForm {
  readonly open=input(false);readonly cancelled=output<void>();readonly created=output<void>();private readonly builder=viewChild(RouteBuilderMap);
  private readonly api=inject(RoutesApiService);private readonly feedback=inject(FeedbackDialogBridgeService);private readonly destroyRef=inject(DestroyRef);
  private readonly modal=viewChild.required(Modal);private readonly flow=inject(FormFlowService);
  protected readonly mode=signal<'start'|'stop'|'end'>('start');protected readonly points=signal<RoutePoint[]>([]);protected readonly submitted=signal(false);
  protected readonly calculating=signal(false);protected readonly routeCalculated=signal(false);protected readonly saving=signal(false);
  private readonly fleets=toSignal(this.api.fleets(),{initialValue:[]});
  protected readonly fleetOptions=computed<DropdownOption[]>(()=>[{id:'',label:'Unassigned'},...this.fleets().map(f=>({id:String(f.id),label:f.name}))]);
  protected readonly form=inject(FormBuilder).nonNullable.group({name:['',Validators.required],description:[''],tolerance:[500,[Validators.required,Validators.min(10)]],fleet:['']});
  protected selectFleet(option:DropdownOption){this.form.controls.fleet.setValue(option.id);this.form.controls.fleet.markAsDirty();}protected fleetLabel(){return this.fleetOptions().find(o=>o.id===this.form.controls.fleet.value)?.label??'Unassigned';}
  protected addPoint(point:RoutePoint){this.points.update(points=>[...points,point]);this.routeCalculated.set(false);if(point.type==='start')this.mode.set('stop');if(point.type==='end')this.mode.set('end');}
  protected chooseMode(mode:'start'|'stop'|'end'){if(mode==='end'&&!this.hasStart())return;this.mode.set(mode);}
  protected hasStart(){return this.points().some(point=>point.type==='start');}protected hasEnd(){return this.points().some(point=>point.type==='end');}
  protected resetRoute(){this.points.set([]);this.mode.set('start');this.routeCalculated.set(false);this.builder()?.reset();}
  protected async calculateRoute(){if(!this.hasStart()||!this.hasEnd()||this.calculating())return;this.calculating.set(true);this.routeCalculated.set(await this.builder()?.calculateRoute()===true);this.calculating.set(false);}
  protected async submit(){
    this.submitted.set(true);this.form.markAllAsTouched();if(this.form.invalid||!this.hasStart()||!this.hasEnd()||this.saving())return;
    this.saving.set(true);
    // Saving needs the road legs, so calculate first if the user hasn't.
    if(!this.builder()?.calculation)await this.calculateRoute();
    const calculation=this.builder()?.calculation;
    if(!calculation){this.saving.set(false);void this.feedback.open({type:'error',title:'Route not calculated',message:'The road route could not be calculated. Try moving the points and calculate again.',showCancel:false});return;}
    const geo=(point:RoutePoint):GeoPoint=>({latitude:point.lat,longitude:point.lng});
    const name=this.form.controls.name.value.trim();
    const request=forkJoin(calculation.points.length?calculation.points.map(point=>this.api.placeName(geo(point))):[of(null)]).pipe(switchMap(names=>{
      const nameOf=(index:number)=>names[index]??`${calculation.points[index].lat}, ${calculation.points[index].lng}`;
      return this.api.saveRoute(this.payload(name,calculation,nameOf));
    }));
    const response=await this.flow.submit(this.modal(),request,{
      loading:'Creating route...',
      success:{title:'Route created',message:`${name} was created successfully.`},
      failure:{title:'Unable to create route',message:'The route could not be saved. Please try again.'},
      ok:response=>response.status===1000,
    });
    this.saving.set(false);
    if(!response)return;
    this.reset();this.created.emit();
  }
  protected async cancel(){if(this.saving())return;if(!(await this.flow.close(this.modal(),this.form.dirty)))return;this.reset();this.cancelled.emit();}
  private reset(){this.form.reset({name:'',description:'',tolerance:500,fleet:''});this.resetRoute();this.submitted.set(false);}

  /** Same shape hypernym-fms-fe saves; every leg carries its own polyline, endpoints and arrival time. */
  private payload(name:string,route:RouteCalculation,nameOf:(index:number)=>string):SaveRoutePayload{
    const geo=(point:RoutePoint):GeoPoint=>({latitude:point.lat,longitude:point.lng});
    const stops=route.points.slice(1,-1);
    const minutes=(seconds:number)=>Math.round(seconds/60);
    let elapsed=0;
    return {
      name,origin:geo(route.points[0]),destination:geo(route.points.at(-1)!),no_of_stops:stops.length,stops:stops.map(geo),
      travel_mode:'DRIVE',routing_preference:'TRAFFIC_AWARE',distance:Math.round(route.distance),polyline:encodePolyline(route.path),
      travel_duration:minutes(route.duration),estimated_arrival:minutes(route.duration),
      subroutes:route.legs.map((leg,index)=>{elapsed+=leg.duration;return {origin:geo(route.points[index]),destination:geo(route.points[index+1]),polyline:encodePolyline(leg.path),distance:Math.round(leg.distance),travel_duration:minutes(leg.duration),estimated_arrival:minutes(elapsed),stay_time:0};}),
      origin_name:nameOf(0),destination_name:nameOf(route.points.length-1),stop_names:stops.map((_,index)=>({stop_name:nameOf(index+1)})),
    };
  }
}
