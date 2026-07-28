import { Injectable, signal } from '@angular/core';
@Injectable({providedIn:'root'})
export class SettingsStore{
  readonly changes=signal(0);readonly saved=signal(false);
  mark():void{this.changes.update(value=>value+1);this.saved.set(false);}
  save():void{this.changes.set(0);this.saved.set(true);setTimeout(()=>this.saved.set(false),1800);}
}
