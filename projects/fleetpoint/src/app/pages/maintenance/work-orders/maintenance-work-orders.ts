import { lingerWhileClosing } from '@iotility/shared-ui';
import { Component, DestroyRef, ElementRef, HostListener, Injector, afterNextRender, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DataTable, DataTablePaginationConfig, DataTableSkeleton, DropdownOption, FilterBar, FilterChangeEvent, FilterDropdown, TableAction, TableColumn, TableRow } from '@iotility/shared-ui';
import { Subscription } from 'rxjs';
import { FeedbackDialogBridgeService } from '../../../shared/services/feedback-dialog-bridge.service';
import { MaintenanceApiService, MaintenanceRecord } from '../../../shared/services/maintenance-api.service';
import { ADMIN_STATUS, NOT_AVAILABLE, STATUS_OPTIONS, displayDate, money, serviceName, statusLabel, text, workOrderId } from '../maintenance.data';

const PAGE_SIZE=25;
/** Workflow track: raised → workshop pending → approved → in progress → completed. Rejected stops at the workshop step. */
const WORKFLOW_STEP:Record<string,number>={Pending:2,Rejected:2,Approved:3,'In Progress':4,Completed:5};

@Component({selector:'app-maintenance-work-orders',imports:[DataTable,DataTableSkeleton,FilterBar],templateUrl:'./maintenance-work-orders.html',styleUrl:'./maintenance-work-orders.css'})
export class MaintenanceWorkOrders {
  private readonly api=inject(MaintenanceApiService);
  private readonly feedback=inject(FeedbackDialogBridgeService);
  private readonly destroyRef=inject(DestroyRef);
  private request?:Subscription;
  private searchTimer?:ReturnType<typeof setTimeout>;
  protected readonly notAvailable=NOT_AVAILABLE;
  protected readonly workflowSteps=[1,2,3,4,5];
  protected readonly records=signal<MaintenanceRecord[]>([]);
  protected readonly total=signal(0);
  protected readonly page=signal(1);
  protected readonly loading=signal(true);
  protected readonly loaded=signal(false);
  protected readonly selectedOrder=signal<MaintenanceRecord|null>(null);
  protected readonly shownOrder=lingerWhileClosing(this.selectedOrder);
  protected readonly search=signal('');protected readonly status=signal('all');protected readonly serviceType=signal('all');
  protected readonly serviceTypeOptions=signal<DropdownOption[]>([{id:'all',label:'All Services'}]);
  protected readonly actions:TableAction[]=['view','delete'];
  protected readonly columns:TableColumn[]=[{key:'id',label:'Work Order'},{key:'vehicle',label:'Vehicle',clickable:true},{key:'title',label:'Title'},{key:'service',label:'Service'},{key:'priority',label:'Priority'},{key:'status',label:'Status',type:'status'},{key:'workshop',label:'Workshop'},{key:'target',label:'Next Service'},{key:'cost',label:'Est. Cost'},{key:'actions',label:'Actions',type:'actions'}];
  protected readonly rows=computed<TableRow[]>(()=>{
    const currency=this.api.currency();
    return this.records().map(item=>({id:workOrderId(item),recordId:item.id,vehicle:text(item.vehicle_name),title:text(item.name),service:serviceName(item),priority:NOT_AVAILABLE,status:statusLabel(item),workshop:text(item.workshop_name),target:displayDate(item.next_maintenance_date),cost:money(item.estimated_cost,currency),actions:''}));
  });
  protected readonly pagination=computed<DataTablePaginationConfig>(()=>({totalItems:this.total(),pageSize:PAGE_SIZE,page:this.page(),loading:this.loading()}));
  protected readonly columnLabels=this.columns.map(column=>column.label);
  protected readonly subtitle=computed(()=>`${this.total()} work orders · Click a row to view details`);
  protected readonly filterDropdowns=computed<FilterDropdown[]>(()=>[
    {id:'status',label:'Status',ariaLabel:'Filter by status',options:STATUS_OPTIONS,selected:this.status(),placeholder:'All Status'},
    {id:'service',label:'Service',ariaLabel:'Filter by service type',options:this.serviceTypeOptions(),selected:this.serviceType(),placeholder:'All Services'},
  ]);

  /** Drawer height that ends at the bottom of the viewport, so only the drawer scrolls, not the page. */
  protected readonly drawerHeight=signal(580);
  private readonly host=inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector=inject(Injector);

  @HostListener('window:resize')
  protected fitDrawer():void{
    const aside=this.host.nativeElement.querySelector<HTMLElement>('.work-order-details');
    if(!aside)return;
    // Sum the bottom spacing (margin, border, padding) of every ancestor up to the scroll container,
    // so the drawer ends exactly where that container's content ends.
    let trailing=0;let element:HTMLElement|null=aside;let viewportBottom=window.innerHeight;
    let scroller:Element=document.scrollingElement??document.documentElement;
    while(element&&element!==document.body){
      const style=getComputedStyle(element);
      if(element!==aside&&/(auto|scroll)/.test(style.overflowY)){
        viewportBottom=element.getBoundingClientRect().bottom-parseFloat(style.borderBottomWidth);
        trailing+=parseFloat(style.paddingBottom);
        scroller=element;
        break;
      }
      if(element!==aside)trailing+=parseFloat(style.paddingBottom)+parseFloat(style.borderBottomWidth);
      trailing+=parseFloat(style.marginBottom);
      element=element.parentElement;
    }
    // Apply and correct synchronously (before paint) so no intermediate height or scrollbar flashes.
    let height=Math.max(320,Math.floor(viewportBottom-aside.getBoundingClientRect().top-trailing));
    aside.style.setProperty('--drawer-height',`${height}px`);
    // Layout outside this page (host shell, sibling rows) can still add a few pixels: trim any
    // remaining overflow, but only as far as the drawer reaches below the table.
    const overflow=scroller.scrollHeight-scroller.clientHeight;
    const table=this.host.nativeElement.querySelector('.work-orders-list');
    const trim=Math.min(overflow,aside.getBoundingClientRect().bottom-(table?.getBoundingClientRect().bottom??0));
    if(trim>0){height=Math.max(320,height-Math.ceil(trim));aside.style.setProperty('--drawer-height',`${height}px`);}
    this.drawerHeight.set(height);
  }

  constructor(){
    // After the open class renders, measure in the same frame, before the browser paints.
    effect(()=>{if(this.selectedOrder())untracked(()=>afterNextRender(()=>this.fitDrawer(),{injector:this.injector}));});
    this.api.serviceTypes().pipe(takeUntilDestroyed()).subscribe(types=>this.serviceTypeOptions.set([{id:'all',label:'All Services'},...types.map(type=>({id:String(type.id),label:type.name}))]));
    effect(()=>{this.api.version();untracked(()=>this.load());});
    this.destroyRef.onDestroy(()=>clearTimeout(this.searchTimer));
  }

  protected setSearch(value:string):void{
    this.search.set(value);
    clearTimeout(this.searchTimer);
    this.searchTimer=setTimeout(()=>this.reload(),350);
  }
  protected selectFilter(event:FilterChangeEvent):void{
    (event.id==='status'?this.status:this.serviceType).set(event.option.id);
    this.reload();
  }
  protected clearFilters():void{this.status.set('all');this.serviceType.set('all');this.reload();}
  protected changePage(page:number):void{if(page===this.page())return;this.page.set(page);this.selectedOrder.set(null);this.load();}
  protected selectOrder(row:TableRow):void{this.selectedOrder.set(this.records().find(order=>order.id===row['recordId'])??null);}
  protected closeDetails():void{this.selectedOrder.set(null);}
  protected rowAction(event:{action:TableAction;row:TableRow}):void{
    if(event.action==='view')this.selectOrder(event.row);
    if(event.action==='delete')void this.remove(event.row);
  }

  protected readonly statusLabel=statusLabel;
  protected workflowStep(order:MaintenanceRecord):number{return WORKFLOW_STEP[statusLabel(order)]??1;}
  protected approval(order:MaintenanceRecord):string{return ADMIN_STATUS[order.admin_status??-1]??NOT_AVAILABLE;}
  protected vehicle(order:MaintenanceRecord):string{return [order.vehicle_name,order.vehicle_type_name].filter(Boolean).join(' — ')||NOT_AVAILABLE;}
  protected readonly text=text;protected readonly serviceName=serviceName;protected readonly displayDate=displayDate;protected readonly workOrderId=workOrderId;
  protected cost(value:number|null):string{return money(value,this.api.currency());}
  /** Built from the record's own timestamps; the API keeps no per-step history. */
  protected timeline(order:MaintenanceRecord):{status:string;time:string;detail:string}[]{
    return [
      {status:'Raised',time:order.created_at,detail:`Work order raised for ${text(order.vehicle_name)}`},
      {status:'Maintenance started',time:order.maintenance_start_date,detail:text(order.workshop_name)},
      {status:'Maintenance ended',time:order.maintenance_end_date,detail:statusLabel(order)},
      {status:'Last updated',time:order.updated_at,detail:`Status: ${order.maintenance_status_name??statusLabel(order)}`},
    ].filter((item):item is {status:string;time:string;detail:string}=>!!item.time).map(item=>({...item,time:displayDate(item.time)}));
  }

  private reload():void{this.page.set(1);this.selectedOrder.set(null);this.load();}

  private load():void{
    this.request?.unsubscribe();
    this.loading.set(true);
    this.request=this.api.list({
      offset:(this.page()-1)*PAGE_SIZE,limit:PAGE_SIZE,search_text:this.search().trim(),
      maintenance_status:this.status()==='all'?'':this.status(),service_type_id:this.serviceType()==='all'?'':this.serviceType(),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next:response=>{
        const records=response.data?.data??[];const count=response.data?.count??records.length;
        // A delete can empty the last page: step back instead of showing an empty table.
        if(!records.length&&count&&this.page()>1){this.page.set(Math.ceil(count/PAGE_SIZE));this.load();return;}
        this.records.set(records);this.total.set(count);this.loading.set(false);this.loaded.set(true);
        const selected=this.selectedOrder();
        if(selected)this.selectedOrder.set(records.find(order=>order.id===selected.id)??null);
      },
      error:()=>{this.records.set([]);this.total.set(0);this.loading.set(false);this.loaded.set(true);},
    });
  }

  private async remove(row:TableRow):Promise<void>{
    const confirmed=await this.feedback.open({type:'warning',title:'Delete work order?',message:`${row['id']} for ${row['vehicle']} will be permanently deleted.`,confirmText:'Delete',cancelText:'Cancel',showCancel:true});
    if(!confirmed)return;
    this.api.delete(Number(row['recordId'])).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next:response=>{
        if(response.status===1002){void this.feedback.open({type:'error',title:'Unable to delete',message:response.message||'The work order could not be deleted.',showCancel:false});return;}
        if(this.selectedOrder()?.id===Number(row['recordId']))this.selectedOrder.set(null);
        this.api.changed();
      },
      error:()=>void this.feedback.open({type:'error',title:'Unable to delete',message:'The work order could not be deleted. Please try again.',showCancel:false}),
    });
  }
}
