import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { DateTimePicker, Dropdown, DropdownOption, Skeleton } from '@iotility/shared-ui';
import { catchError, map, of } from 'rxjs';
import { DriverApiService } from '../../../shared/services/driver-api.service';
import { FeedbackDialogBridgeService } from '../../../shared/services/feedback-dialog-bridge.service';
import { JobsApiService } from '../../../shared/services/jobs-api.service';
import { RoutesApiService } from '../../../shared/services/routes-api.service';
import { NOT_AVAILABLE, routeCode, toUtcDateTime } from '../routes.data';

/** Dispatching a route = allocating it to a vehicle from a start time (POST /api/route/allocation). */
@Component({selector:'app-route-dispatch',imports:[DateTimePicker,Dropdown,Skeleton],templateUrl:'./route-dispatch.html',styleUrl:'./route-dispatch.css'})
export class RouteDispatch {
  private readonly activatedRoute=inject(ActivatedRoute);
  private readonly api=inject(RoutesApiService);
  private readonly feedback=inject(FeedbackDialogBridgeService);
  private readonly destroyRef=inject(DestroyRef);
  private readonly fleets=toSignal(this.api.fleets(),{initialValue:null});
  protected readonly mode=signal<'manual'|'suggested'|'auto'>('manual');protected readonly route=signal(this.activatedRoute.snapshot.queryParamMap.get('route')??'');protected readonly driver=signal('');protected readonly vehicle=signal('');protected readonly job=signal('');protected readonly start=signal('');protected readonly end=signal('');
  protected readonly saving=signal(false);
  protected readonly routeOptions=computed<DropdownOption[]>(()=>this.api.routes().map(r=>({id:routeCode(r.id),label:r.name??routeCode(r.id)})));
  /** The allocation API takes a vehicle only; the driver comes from the vehicle's assignment. */
  protected readonly driverOptions=toSignal(inject(DriverApiService).getActiveDrivers().pipe(map(r=>(r.data?.data??[]).map(d=>({id:String(d.id),label:d.name}))),catchError(()=>of([]))),{initialValue:[] as DropdownOption[]});
  protected readonly vehicleOptions=computed<DropdownOption[]>(()=>(this.fleets()??[]).flatMap(f=>f.vehicles).map(v=>({id:String(v.id),label:v.name})));
  /** Not sent: the allocation API has no job link. */
  protected readonly jobOptions=toSignal(inject(JobsApiService).list().pipe(map(jobs=>[{id:'',label:'No job linked'},...jobs.map(j=>({id:String(j.id),label:`JOB${String(j.id).padStart(3,'0')} · ${j.job_name??NOT_AVAILABLE}`}))]),catchError(()=>of([{id:'',label:'No job linked'}]))),{initialValue:[{id:'',label:'No job linked'}] as DropdownOption[]});
  /** Vehicles, busy when one of their runs is scheduled or en route; the API has no driver score. */
  protected readonly availability=computed(()=>{
    const fleets=this.fleets();if(!fleets)return null;
    const busy=new Map<string,string>();
    for(const run of this.api.allocations()){const status=String(run.job_status_display??'').toLowerCase();const id=String(run.vehicle??'');if(status==='en-route')busy.set(id,'En Route');else if(status==='scheduled'&&!busy.has(id))busy.set(id,'Scheduled');}
    return fleets.flatMap(f=>f.vehicles.map(v=>({id:String(v.id),initials:v.name.replace(/[^A-Za-z0-9]/g,'').slice(0,2).toUpperCase(),name:v.name,fleet:f.name,score:NOT_AVAILABLE,status:busy.get(String(v.id))??'Available'})));
  });
  protected readonly skeletonRows=[0,1,2,3,4,5];
  protected select(control:'route'|'driver'|'vehicle'|'job',option:DropdownOption){({route:this.route,driver:this.driver,vehicle:this.vehicle,job:this.job})[control].set(option.id);}
  protected label(options:DropdownOption[],value:string,fallback:string){return options.find(o=>o.id===value)?.label??fallback;}
  protected submit():void{
    const route=this.api.routes().find(r=>routeCode(r.id)===this.route());
    if(!route||!this.vehicle()||!this.start()){void this.feedback.open({type:'warning',title:'Missing details',message:'Select a route, a vehicle and a start date/time to dispatch.',showCancel:false});return;}
    if(this.end()&&this.end()<=this.start()){void this.feedback.open({type:'warning',title:'Check the dates',message:'The end date/time must be after the start.',showCancel:false});return;}
    if(this.saving())return;
    const failed=(message?:string)=>void this.feedback.open({type:'error',title:'Unable to dispatch',message:message||'The route could not be dispatched. Please try again.',showCancel:false});
    this.saving.set(true);
    this.api.dispatch({route_id:route.id,vehicle_id:Number(this.vehicle()),description:null,start_dates:[toUtcDateTime(this.start())]}).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next:response=>{this.saving.set(false);if(response.status!==1000)return failed(response.message);void this.feedback.open({type:'success',title:'Route dispatched',message:`${route.name} is scheduled.`,showCancel:false});this.route.set('');this.driver.set('');this.vehicle.set('');this.job.set('');this.start.set('');this.end.set('');this.api.refresh();},
      error:(error:{error?:{message?:string}})=>{this.saving.set(false);failed(error.error?.message);},
    });
  }
}
