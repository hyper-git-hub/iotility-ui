import { Component, computed, signal } from '@angular/core';
import { SmoothHeight } from '@iotility/shared-ui';
import { FleetMap, TrackedVehicle, VehicleStatus } from '../../shared/fleet-map/fleet-map';
import { StatCard } from '../../shared/stat-card/stat-card';
import { PoiForm, PoiFormValue } from './poi-form/poi-form';

type PoiType = 'depot' | 'customer' | 'fuel' | 'rest' | 'exclusion' | 'unsafe' | 'custom';
interface PoiVisit { vehicle: string; driver: string; time: string; dwell: string; breach?: boolean; }
interface PoiRecord {
  id: string; name: string; address: string; type: PoiType; visitsToday: number; assigned: string;
  radius: number; geozone: boolean; alerts: number; sla?: number; lat: number; lng: number;
  visitsWeek: number; avgDwell: string; contact?: string; phone?: string; visits: PoiVisit[];
}

@Component({
  selector: 'app-poi-page',
  imports: [FleetMap, PoiForm, SmoothHeight, StatCard],
  templateUrl: './poi-page.html',
  styleUrl: './poi-page.css',
})
export class PoiPage {
  protected readonly search = signal('');
  protected readonly typeFilter = signal<'all' | PoiType>('all');
  protected readonly expandedId = signal<string | null>(null);
  protected readonly poiFormOpen = signal(false);
  protected readonly typeTabs: Array<{ id: 'all' | PoiType; label: string }> = [
    { id: 'all', label: 'All POIs' }, { id: 'depot', label: 'Depot' },
    { id: 'customer', label: 'Customer Site' }, { id: 'fuel', label: 'Fuel Station' },
    { id: 'rest', label: 'Rest Stop' }, { id: 'exclusion', label: 'Exclusion Zone' },
    { id: 'unsafe', label: 'Unsafe Area' }, { id: 'custom', label: 'Custom' },
  ];
  private readonly records: PoiRecord[] = [
    { id:'POI01',name:'Stratford Logistics Park — HQ',address:'Stratford Logistics Park, London E15 2NW',type:'depot',visitsToday:8,assigned:'All vehicles',radius:200,geozone:true,alerts:0,lat:51.542,lng:-0.003,visitsWeek:42,avgDwell:'34min',contact:'James Hartley',phone:'+44 7700 100001',visits:[{vehicle:'LP-4821',driver:'James Hartley',time:'06:12 → 06:48',dwell:'36min'},{vehicle:'LP-7734',driver:'Mohammed Al-Rashid',time:'07:05 → 07:31',dwell:'26min'}]},
    { id:'POI02',name:'Trafford Park DC — Manchester',address:'Trafford Park Distribution Centre, Manchester M17',type:'depot',visitsToday:5,assigned:'1 fleet',radius:150,geozone:true,alerts:0,lat:53.467,lng:-2.311,visitsWeek:31,avgDwell:'29min',visits:[{vehicle:'LP-6612',driver:'Thomas Griffiths',time:'07:02 → 07:38',dwell:'36min'}]},
    { id:'POI03',name:'Aston Depot — Birmingham',address:'Aston Industrial Estate, Birmingham B6 4BN',type:'depot',visitsToday:3,assigned:'1 fleet',radius:120,geozone:false,alerts:0,lat:52.501,lng:-1.884,visitsWeek:18,avgDwell:'41min',visits:[]},
    { id:'POI04',name:'Amazon BHX2 Fulfilment Centre',address:'Amazon Fulfilment Centre, Birmingham B26 3QJ',type:'customer',visitsToday:4,assigned:'All vehicles',radius:300,geozone:true,alerts:1,sla:82,lat:52.455,lng:-1.743,visitsWeek:22,avgDwell:'68min',visits:[{vehicle:'LP-4821',driver:'James Hartley',time:'08:51 → 10:08',dwell:'77min',breach:true}]},
    { id:'POI05',name:'Tesco RDC — Daventry',address:'Tesco Regional Distribution Centre, Daventry NN11 8QH',type:'customer',visitsToday:2,assigned:'2 fleets',radius:250,geozone:false,alerts:0,sla:94,lat:52.278,lng:-1.157,visitsWeek:15,avgDwell:'52min',visits:[{vehicle:'LP-3312',driver:'Oliver Pemberton',time:'09:10 → 09:54',dwell:'44min'}]},
    { id:'POI06',name:'M1 Northbound Fuel Station',address:'Watford Gap Services, M1 Northbound',type:'fuel',visitsToday:4,assigned:'All vehicles',radius:100,geozone:false,alerts:0,lat:52.308,lng:-1.122,visitsWeek:27,avgDwell:'18min',visits:[]},
    { id:'POI07',name:'London Low Emission Exclusion',address:'Central London exclusion boundary',type:'exclusion',visitsToday:6,assigned:'All vehicles',radius:500,geozone:true,alerts:1,lat:51.507,lng:-0.128,visitsWeek:36,avgDwell:'12min',visits:[{vehicle:'LP-5531',driver:'Priya Sharma',time:'10:22 → 10:34',dwell:'12min',breach:true}]},
    { id:'POI08',name:'Leicester Driver Rest Area',address:'Leicester Forest East Services',type:'rest',visitsToday:0,assigned:'All vehicles',radius:120,geozone:false,alerts:0,lat:52.618,lng:-1.205,visitsWeek:9,avgDwell:'27min',visits:[]},
    { id:'POI09',name:'Manchester Unsafe Loading Area',address:'Northern Quarter, Manchester',type:'unsafe',visitsToday:0,assigned:'2 vehicles',radius:80,geozone:true,alerts:0,lat:53.484,lng:-2.236,visitsWeek:3,avgDwell:'8min',visits:[]},
    { id:'POI10',name:'Bristol Custom Checkpoint',address:'Avonmouth, Bristol BS11',type:'custom',visitsToday:0,assigned:'1 fleet',radius:90,geozone:false,alerts:0,lat:51.502,lng:-2.699,visitsWeek:6,avgDwell:'14min',visits:[]},
    { id:'POI11',name:'Birmingham Airport Rest Stop',address:'Birmingham Airport, B26',type:'rest',visitsToday:0,assigned:'All vehicles',radius:110,geozone:false,alerts:0,lat:52.452,lng:-1.734,visitsWeek:5,avgDwell:'22min',visits:[]},
  ];
  protected readonly total = this.records.length;
  protected readonly visitsToday = this.records.reduce((sum, poi) => sum + poi.visitsToday, 0);
  protected readonly activeAlerts = this.records.filter((poi) => poi.alerts > 0).length;
  protected readonly slaBreaches = this.records.filter((poi) => poi.sla !== undefined && poi.sla < 100).length;
  protected readonly exclusionViolations = this.records.filter((poi) => poi.type === 'exclusion' && poi.alerts > 0).length;
  protected readonly filtered = computed(() => {
    const query = this.search().trim().toLowerCase();
    return this.records.filter((poi) => (this.typeFilter() === 'all' || poi.type === this.typeFilter())
      && (!query || `${poi.name} ${poi.address}`.toLowerCase().includes(query)));
  });
  protected readonly mapPois = computed<TrackedVehicle[]>(() => this.filtered().map((poi) => ({
    id: poi.id, model: poi.name, driver: this.typeLabel(poi.type), status: this.mapStatus(poi),
    speed: 0, fuel: 0, location: poi.address, updated: `${poi.visitsToday} visits today`, lat: poi.lat, lng: poi.lng,
  })));
  protected updateSearch(event: Event): void { this.search.set((event.target as HTMLInputElement).value); }
  protected selectType(type: 'all' | PoiType): void { this.typeFilter.set(type); this.expandedId.set(null); }
  protected toggle(poi: PoiRecord): void { this.expandedId.update((id) => id === poi.id ? null : poi.id); }
  protected selectFromMap(item: TrackedVehicle): void { this.expandedId.set(item.id); }
  protected openPoiForm(): void { this.poiFormOpen.set(true); }
  protected closePoiForm(): void { this.poiFormOpen.set(false); }
  protected createPoi(_: PoiFormValue): void { this.closePoiForm(); }
  protected count(type: 'all' | PoiType): number { return type === 'all' ? this.total : this.records.filter((poi) => poi.type === type).length; }
  protected typeLabel(type: PoiType): string { return this.typeTabs.find((item) => item.id === type)?.label ?? 'Custom'; }
  protected typeIconPath(type: PoiType): string {
    return ({
      depot: 'M4 20V7l8-4 8 4v13M8 20v-4h8v4M8 9h.01M12 9h.01M16 9h.01M8 12h.01M12 12h.01M16 12h.01',
      customer: 'M3.5 19c.4-3.8 2.2-5.7 5.5-5.7s5.1 1.9 5.5 5.7M6 8a3 3 0 1 0 6 0 3 3 0 0 0-6 0M16 7v5M13.5 9.5h5',
      fuel: 'M5 20V5h9v15M7.5 8h4M3 20h13M14 8l3 3v6a2 2 0 0 0 4 0V9l-2-2',
      rest: 'M5 9h12v4a6 6 0 0 1-12 0V9M17 11h1.5a2.5 2.5 0 0 1 0 5H16M8 5v2m3-3v3m3-2v2',
      exclusion: 'M12 3 5 6v6c0 4 2.8 7 7 9 4.2-2 7-5 7-9V6l-7-3ZM9 9l6 6m0-6-6 6',
      unsafe: 'M10.2 4.7 3.5 17a2 2 0 0 0 1.8 3h13.4a2 2 0 0 0 1.8-3L13.8 4.7a2 2 0 0 0-3.6 0ZM12 9v4m0 3h.01',
      custom: 'M20 10c0 5-5.4 9.1-7.3 10.4a1.2 1.2 0 0 1-1.4 0C9.4 19.1 4 15 4 10a8 8 0 1 1 16 0ZM12 7.5v5M9.5 10h5',
    } as Record<PoiType, string>)[type];
  }
  private mapStatus(poi: PoiRecord): VehicleStatus { return poi.alerts ? 'Alert' : poi.type === 'depot' ? 'Moving' : poi.type === 'customer' ? 'Idling' : 'Offline'; }
}
