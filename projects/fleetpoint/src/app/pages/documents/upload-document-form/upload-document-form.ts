import { Component, DestroyRef, effect, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DateTimePicker, Dropdown, DropdownOption } from '@iotility/shared-ui';
import { catchError, forkJoin, of } from 'rxjs';
import { Modal } from '../../../shared/modal/modal';
import { FormFlowService } from '../../../shared/services/form-flow.service';
import { DOCUMENT_TYPES, DocumentEntityType, DocumentsApiService } from '../../../shared/services/documents-api.service';

/** A "Linked To" choice: a vehicle (grouped by fleet) or a driver (grouped by driver group). */
interface LinkedRecord {
  entity: DocumentEntityType;
  id: number;
  name: string;
  groupId: number;
}

@Component({
  selector:'app-upload-document-form',
  imports:[DateTimePicker,Dropdown,Modal,ReactiveFormsModule],
  templateUrl:'./upload-document-form.html',
  styleUrl:'./upload-document-form.css',
})
export class UploadDocumentForm {
  readonly open=input(false);
  readonly cancelled=output<void>();
  readonly created=output<void>();
  private readonly api=inject(DocumentsApiService);
  private readonly modal = viewChild.required(Modal);
  private readonly flow = inject(FormFlowService);
  private readonly destroyRef=inject(DestroyRef);
  protected readonly submitted=signal(false);
  protected readonly fileName=signal('');
  private file:File|null=null;
  private saving=false;
  /** The document type decides whether the record is a vehicle (F) or a driver (D). */
  private readonly entityByType=new Map<string,DocumentEntityType>(
    (Object.keys(DOCUMENT_TYPES) as DocumentEntityType[]).flatMap(entity=>DOCUMENT_TYPES[entity].map(type=>[String(type.id),entity] as const)),
  );
  protected readonly typeOptions:DropdownOption[]=[...DOCUMENT_TYPES.F,...DOCUMENT_TYPES.D].map(type=>({id:String(type.id),label:type.name}));
  private readonly records=signal<LinkedRecord[]>([]);
  private readonly entity=signal<DocumentEntityType|null>(null);
  protected readonly form=inject(FormBuilder).nonNullable.group({
    type:['',Validators.required],linkedTo:['',Validators.required],issueDate:[''],expiryDate:[''],
    issuedBy:[''],documentNumber:[''],
  });

  /** Vehicles and drivers, narrowed to the chosen document type's entity. */
  protected get linkedOptions():DropdownOption[]{
    const entity=this.entity();
    return this.records().filter(record=>!entity||record.entity===entity).map(record=>({id:key(record),label:record.name}));
  }

  constructor(){
    // Lookups load the first time the modal opens rather than with the page.
    let fetched=false;
    effect(()=>{
      if(!this.open()||fetched)return;
      fetched=true;
      untracked(()=>forkJoin({
        vehicles:this.api.fleetVehicles().pipe(catchError(()=>of([]))),
        groups:this.api.driverGroups().pipe(catchError(()=>of([]))),
      }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(({vehicles,groups})=>this.records.set([
        ...vehicles.map(vehicle=>({entity:'F' as const,id:vehicle.id,name:vehicle.name,groupId:vehicle.fleetId})),
        ...groups.flatMap(group=>(group.drivers??[]).map(driver=>({entity:'D' as const,id:driver.id,name:driver.name,groupId:group.id}))),
      ])));
    });
  }

  protected select(control:'type'|'linkedTo',option:DropdownOption):void{
    this.form.controls[control].setValue(option.id);this.form.controls[control].markAsDirty();this.form.controls[control].markAsTouched();
    if(control==='type'){
      const entity=this.entityByType.get(option.id)??null;
      this.entity.set(entity);
      if(entity&&!this.form.controls.linkedTo.value.startsWith(`${entity}:`))this.form.controls.linkedTo.setValue('');
    }
  }
  protected label(options:DropdownOption[],value:string,fallback:string):string{
    return options.find(option=>option.id===value)?.label??fallback;
  }
  protected pickFile(event:Event):void{this.file=(event.target as HTMLInputElement).files?.[0]??null;this.fileName.set(this.file?.name??'');}
  protected invalid(control:'type'|'linkedTo'):boolean{return this.submitted()&&this.form.controls[control].invalid;}
  /** Sends what fms-fleet accepts; issue/expiry date, issuer and number have no API field yet. */
  protected submit():void{
    this.submitted.set(true);this.form.markAllAsTouched();
    if(this.form.invalid||!this.file||this.saving)return;
    const value=this.form.getRawValue();
    const record=this.records().find(item=>key(item)===value.linkedTo);
    if(!record)return;
    const body=new FormData();
    body.append('files',this.file);
    body.append('type',record.entity);
    body.append('entity_group_id',String(record.groupId));
    body.append(record.entity==='D'?'driver':'vehicle',String(record.id));
    body.append('entity_name',record.name);
    body.append('document_type',value.type);
    this.saving=true;
    void this.flow.submit(this.modal(),this.api.create(body),{
      loading:'Uploading document...',
      success:{title:'Document uploaded',message:`${value.type} for ${record.name} was uploaded successfully.`},
      failure:{title:'Unable to upload',message:'The document could not be uploaded. Please try again.'},
    }).then(response=>{this.saving=false;if(!response)return;this.reset();this.created.emit();});
  }
  protected async cancel():Promise<void>{if(this.saving)return;if(!(await this.flow.close(this.modal(),this.form.dirty)))return;this.reset();this.cancelled.emit();}
  private reset():void{
    this.form.reset({type:'',linkedTo:'',issueDate:'',expiryDate:'',issuedBy:'',documentNumber:''});
    this.entity.set(null);this.file=null;this.fileName.set('');this.submitted.set(false);
  }
}

function key(record:LinkedRecord):string{return `${record.entity}:${record.id}`;}
