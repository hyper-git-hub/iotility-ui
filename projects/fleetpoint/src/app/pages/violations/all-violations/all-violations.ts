import { Component,computed,signal } from '@angular/core';
import { DataTable,DataTableBottomPanel,Dropdown,DropdownOption,TableColumn,TableRow } from '@iotility/shared-ui';
import { CATEGORY_OPTIONS,SEVERITY_OPTIONS,SOURCE_OPTIONS,ViolationRecord,VIOLATIONS } from '../violations.data';
import { ViolationMap } from './violation-map';
@Component({selector:'app-all-violations',imports:[DataTable,DataTableBottomPanel,Dropdown,ViolationMap],templateUrl:'./all-violations.html',styleUrl:'./all-violations.css'})
export class AllViolations {
  protected readonly total=VIOLATIONS.length;
  protected readonly VIOLATIONS=VIOLATIONS;
  protected readonly selected=signal<ViolationRecord|null>(null);protected readonly search=signal('');protected readonly category=signal('all');protected readonly severity=signal('all');protected readonly source=signal('all');
  protected readonly categoryOptions=CATEGORY_OPTIONS;protected readonly severityOptions=SEVERITY_OPTIONS;protected readonly sourceOptions=SOURCE_OPTIONS;
  protected readonly columns:TableColumn[]=[{key:'type',label:'Violation',type:'user',secondaryKey:'id'},{key:'driver',label:'Driver'},{key:'vehicle',label:'Vehicle',clickable:true},{key:'category',label:'Category',type:'status'},{key:'severity',label:'Severity',type:'priority'},{key:'source',label:'Source',type:'status'},{key:'location',label:'Location'},{key:'timestamp',label:'Date & Time'},{key:'review',label:'Review',type:'status'}];
  protected readonly filtered=computed(()=>{const query=this.search().toLowerCase();return VIOLATIONS.filter(item=>(this.category()==='all'||item.category===this.category())&&(this.severity()==='all'||item.severity===this.severity())&&(this.source()==='all'||item.source===this.source())&&(!query||`${item.type} ${item.driver} ${item.vehicle} ${item.location}`.toLowerCase().includes(query)));});
  protected readonly rows=computed<TableRow[]>(()=>this.filtered().map(item=>({...item})));
  protected selectFilter(control:'category'|'severity'|'source',option:DropdownOption):void{({category:this.category,severity:this.severity,source:this.source})[control].set(option.id);}
  protected label(options:DropdownOption[],value:string):string{return options.find(option=>option.id===value)?.label??'All';}
  protected selectRow(row:TableRow):void{this.selected.set(VIOLATIONS.find(item=>item.id===String(row['id']))??null);}
  protected selectViolation(item:ViolationRecord):void{this.selected.set(item);}
}
