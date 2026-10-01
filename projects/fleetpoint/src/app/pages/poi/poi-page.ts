import { Component, computed, signal } from '@angular/core';
import { SmoothHeight, Tooltip } from '@iotility/shared-ui';
import { FleetMap, TrackedVehicle, VehicleStatus } from '../../shared/fleet-map/fleet-map';
import { StatCard } from '../../shared/stat-card/stat-card';
import { PoiForm, PoiFormValue } from './poi-form/poi-form';

type PoiType =
  | 'depot' | 'customer' | 'fuel' | 'rest' | 'exclusion'
  | 'unsafe' | 'competitor' | 'route' | 'custom';

/**
 * Type vocabulary and icons from the `main` branch POI_TYPE_CONFIG
 * (Building2, Users, Fuel, Coffee, Shield, AlertOctagon, Zap, MapPin).
 * Inlined rather than <img> so `currentColor` applies and the chips follow the
 * app theme instead of a baked-in stroke colour.
 */
const POI_TYPE_CONFIG: Array<{ id: PoiType; label: string; paths: string[] }> = [
  { id: 'depot', label: 'Depot', paths: [
      'M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z',
      'M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2',
      'M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2',
      'M10 6h4',
      'M10 10h4',
      'M10 14h4',
      'M10 18h4',
    ] },
  { id: 'customer', label: 'Customer Site', paths: [
      'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
      'M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8',
      'M22 21v-2a4 4 0 0 0-3-3.87',
      'M16 3.13a4 4 0 0 1 0 7.75',
    ] },
  { id: 'fuel', label: 'Fuel Station', paths: [
      'M3 22h12',
      'M4 9h10',
      'M14 22V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18',
      'M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2a2 2 0 0 0 2-2V9.83a2 2 0 0 0-.59-1.42L18 5',
    ] },
  { id: 'rest', label: 'Rest Stop', paths: [
      'M10 2v2',
      'M14 2v2',
      'M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1',
    ] },
  { id: 'exclusion', label: 'Exclusion Zone', paths: [
      'M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z',
    ] },
  { id: 'unsafe', label: 'Unsafe Area', paths: [
      'M8.7 3.7 2.4 10a2 2 0 0 0 0 2.8l6.3 6.3a2 2 0 0 0 2.8 0l6.3-6.3a2 2 0 0 0 0-2.8l-6.3-6.3a2 2 0 0 0-2.8 0',
      'M12 8v4',
      'M12 16h.01',
    ] },
  { id: 'competitor', label: 'Competitor', paths: [
      'M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z',
    ] },
  { id: 'route', label: 'Route', paths: [
      'M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0',
      'M12 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
    ] },
  { id: 'custom', label: 'Custom', paths: [
      'M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0',
      'M12 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
    ] },
];

interface PoiVisit { vehicle: string; driver: string; time: string; dwell: string; breach?: boolean; }
interface PoiRecord {
  id: string; name: string; address: string; type: PoiType; visitsToday: number; assigned: string;
  radius: number; geozone: boolean; alerts: number; sla?: number; lat: number; lng: number;
  visitsWeek: number; avgDwell: string; contact?: string; phone?: string; visits: PoiVisit[];
}

/** Lucide icon paths from the `main` branch POI card (Clock, Users, MapPin, ShieldCheck, ChevronDown). */
const ICONS: Record<string, string[]> = {
  clock: ['M12 6v6l4 2', 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20'],
  users: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8', 'M22 21v-2a4 4 0 0 0-3-3.87'],
  pin: ['M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0', 'M12 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6'],
  shield: ['M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z', 'm9 12 2 2 4-4'],
  chevron: ['m6 9 6 6 6-6'],
  eye: ['M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7', 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6'],
  pencil: ['M12 20h9', 'M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z'],
  trash: ['M3 6h18', 'M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2', 'M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6', 'M10 11v6', 'M14 11v6'],
};

@Component({
  selector: 'app-poi-page',
  imports: [FleetMap, PoiForm, SmoothHeight, StatCard, Tooltip],
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
    { id: 'unsafe', label: 'Unsafe Area' }, { id: 'competitor', label: 'Competitor' },
    { id: 'route', label: 'Route' }, { id: 'custom', label: 'Custom' },
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
    { id:'POI11',name:'Birmingham Airport Fuel Station',address:'Birmingham Airport, B26',type:'fuel',visitsToday:0,assigned:'All vehicles',radius:110,geozone:false,alerts:0,lat:52.452,lng:-1.734,visitsWeek:5,avgDwell:'22min',visits:[]},
  ];
  protected readonly visibleTabs = computed(() => this.typeTabs
    .filter((tab) => tab.id === 'all' || this.count(tab.id) > 0));
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
  /**
   * Filter signature handed to the fleet map. The type tabs and the search box
   * reshape the visible POI set, so the map must re-frame on them — without
   * this the camera stays parked on whichever POI was last focused and a
   * filtered set that does not contain it renders off-screen. Static data, so
   * the key is stable between edits and never re-fits on its own.
   */
  protected readonly mapFilterKey = computed(
    () => `${this.typeFilter()}|${this.search().trim().toLowerCase()}`,
  );
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
  protected typeIconPaths(type: PoiType): string[] {
    return POI_TYPE_CONFIG.find((config) => config.id === type)?.paths ?? POI_TYPE_CONFIG[8].paths;
  }

  protected typeLabel(type: PoiType): string { return this.typeTabs.find((item) => item.id === type)?.label ?? 'Custom'; }
  protected icon(name: keyof typeof ICONS): string[] { return ICONS[name]; }
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
