import { Component } from '@angular/core';
import { RouterLink,RouterLinkActive,RouterOutlet } from '@angular/router';
import { SmoothHeight } from '@iotility/shared-ui';
import { SettingsStore } from './settings.store';
@Component({selector:'app-settings-page',imports:[RouterLink,RouterLinkActive,RouterOutlet,SmoothHeight],templateUrl:'./settings-page.html',styleUrl:'./settings-page.css'})
export class SettingsPage{protected readonly sections=[
  {path:'organisation',label:'Organisation',icon:'building'},{path:'notifications',label:'Notifications',icon:'bell'},
  {path:'display',label:'Map & Display',icon:'map'},{path:'integrations',label:'Integrations',icon:'plug'},
  {path:'users',label:'Users & Access',icon:'users',tag:'S2'},{path:'mobile',label:'Mobile App',icon:'mobile',tag:'S2'},
];constructor(protected readonly store:SettingsStore){}protected save():void{this.store.save();}}
