// src/data/fleetData.ts
// Core fleet data for IoTility Fleetpoint — LogisticsPro demo
// TODO: replace all with real API calls:
// GET /api/fleetpoint/fleets
// GET /api/fleetpoint/vehicles
// GET /api/fleetpoint/drivers
// GET /api/fleetpoint/alerts
// GET /api/fleetpoint/devices
// GET /api/fleetpoint/poi
// GET /api/fleetpoint/geozones
// WS  /api/fleetpoint/live-positions

// ─── TYPES ──────────────────────────────────────────────────────────────────

export type VehicleStatus = 'moving' | 'idle' | 'stopped' | 'alert' | 'offline'
export type DriverStatus = 'on-duty' | 'off-duty' | 'on-break'
export type DeviceStatus = 'active' | 'inactive' | 'fault' | 'unassigned'
export type AlertType = 'speeding' | 'temperature' | 'geofence' | 'dashcam' | 'offline' | 'fuel' | 'fatigue' | 'corridor' | 'device'
export type AlertSeverity = 'high' | 'medium' | 'low'

// ─── FLEETS ─────────────────────────────────────────────────────────────────

export interface Fleet {
  id: string
  name: string
  description: string
  color: string
  managerId: string
  managerName: string
  vehicleIds: string[]
  depotLocation: string
  createdAt: string
  // Computed KPIs — TODO: fetch from GET /api/fleetpoint/fleets/:id/kpis
  safetyScore: number
  fuelEfficiency: number
  utilisation: number
  activeVehicles: number
  totalVehicles: number
}

export const fleets: Fleet[] = [
  {
    id: 'F001',
    name: 'London HGV',
    description: 'Long haul heavy goods vehicles operating from London depot',
    color: '#7c3aed',
    managerId: 'D001',
    managerName: 'James Hartley',
    vehicleIds: ['V001', 'V002', 'V003', 'V004'],
    depotLocation: 'Stratford Logistics Park, London E15',
    createdAt: '2024-01-15',
    safetyScore: 78,
    fuelEfficiency: 72,
    utilisation: 85,
    activeVehicles: 3,
    totalVehicles: 4,
  },
  {
    id: 'F002',
    name: 'Cold Chain',
    description: 'Refrigerated fleet for temperature-sensitive B2B deliveries',
    color: '#0284c7',
    managerId: 'D007',
    managerName: 'Thomas Griffiths',
    vehicleIds: ['V005', 'V006'],
    depotLocation: 'Tilbury Cold Storage, Essex',
    createdAt: '2024-02-01',
    safetyScore: 91,
    fuelEfficiency: 65,
    utilisation: 78,
    activeVehicles: 2,
    totalVehicles: 2,
  },
  {
    id: 'F003',
    name: 'Manchester Vans',
    description: 'Last mile delivery vans across Greater Manchester',
    color: '#f59e0b',
    managerId: 'D004',
    managerName: 'Sarah Whitfield',
    vehicleIds: ['V007', 'V008', 'V009', 'V010'],
    depotLocation: 'Trafford Park Distribution Centre, Manchester',
    createdAt: '2024-01-20',
    safetyScore: 88,
    fuelEfficiency: 81,
    utilisation: 74,
    activeVehicles: 3,
    totalVehicles: 4,
  },
  {
    id: 'F004',
    name: 'Birmingham Ops',
    description: 'Urban delivery and transit fleet for Birmingham operations',
    color: '#16a34a',
    managerId: 'D008',
    managerName: 'Aisha Okonkwo',
    vehicleIds: ['V011', 'V012', 'V013'],
    depotLocation: 'Aston Industrial Estate, Birmingham B6',
    createdAt: '2024-03-01',
    safetyScore: 82,
    fuelEfficiency: 77,
    utilisation: 91,
    activeVehicles: 2,
    totalVehicles: 3,
  },
  {
    id: 'F005',
    name: 'Leeds Depot',
    description: 'Northern operations fleet based out of Leeds',
    color: '#dc2626',
    managerId: '',
    managerName: 'Unassigned',
    vehicleIds: ['V014', 'V015'],
    depotLocation: 'Stourton Logistics Hub, Leeds LS10',
    createdAt: '2024-04-10',
    safetyScore: 74,
    fuelEfficiency: 69,
    utilisation: 68,
    activeVehicles: 1,
    totalVehicles: 2,
  },
]

// ─── VEHICLES ────────────────────────────────────────────────────────────────

export interface Vehicle {
  id: string
  plate: string
  type: 'HGV' | 'Van' | 'Refrigerated HGV' | 'Transit' | 'Car' | 'Bike'
  make: string
  model: string
  year: number
  colour: string
  fuelType: 'diesel' | 'petrol' | 'electric' | 'hybrid'
  fleetId: string
  driver: string
  driverId: string
  status: VehicleStatus
  speed: number
  fuel: number
  mileage: number
  lat: number
  lng: number
  location: string
  heading: number
  temp?: number
  tempAlert?: boolean
  dashcamAlert?: boolean
  geofenceAlert?: boolean
  corridorAlert?: boolean
  lastUpdate: string
  deviceId: string
  mot?: string
  insurance?: string
  nextService?: string
}

export const vehicles: Vehicle[] = [
  // ── London HGV Fleet (F001) ──
  {
    id: 'V001', plate: 'LP-4821', type: 'HGV', make: 'Volvo', model: 'FH', year: 2021,
    colour: 'White', fuelType: 'diesel', fleetId: 'F001',
    driver: 'James Hartley', driverId: 'D001',
    status: 'alert', speed: 74, fuel: 62, mileage: 142300,
    lat: 51.5074, lng: -0.1278, location: 'A1(M) Northbound, London', heading: 45,
    lastUpdate: '2 mins ago', deviceId: 'DEV001',
    mot: '2026-08-14', insurance: '2026-12-01', nextService: '2025-06-01',
  },
  {
    id: 'V002', plate: 'LP-3312', type: 'HGV', make: 'DAF', model: 'XF', year: 2020,
    colour: 'Silver', fuelType: 'diesel', fleetId: 'F001',
    driver: 'Oliver Pemberton', driverId: 'D002',
    status: 'moving', speed: 56, fuel: 78, mileage: 98400,
    lat: 51.4900, lng: -0.1500, location: 'M25 Westbound, London', heading: 270,
    lastUpdate: '1 min ago', deviceId: 'DEV002',
    mot: '2026-11-20', insurance: '2026-12-01', nextService: '2025-09-15',
  },
  {
    id: 'V003', plate: 'LP-7734', type: 'HGV', make: 'DAF', model: 'XF', year: 2019,
    colour: 'Blue', fuelType: 'diesel', fleetId: 'F001',
    driver: 'Mohammed Al-Rashid', driverId: 'D003',
    status: 'alert', speed: 0, fuel: 45, mileage: 201500,
    lat: 51.5200, lng: -0.1000, location: 'Birmingham Depot — Zone B', heading: 0,
    geofenceAlert: true, lastUpdate: '5 mins ago', deviceId: 'DEV003',
    mot: '2025-07-08', insurance: '2026-12-01', nextService: '2025-05-28',
  },
  {
    id: 'V004', plate: 'LP-9901', type: 'HGV', make: 'Volvo', model: 'FH', year: 2018,
    colour: 'White', fuelType: 'diesel', fleetId: 'F001',
    driver: 'Connor McBride', driverId: 'D005',
    status: 'offline', speed: 0, fuel: 34, mileage: 312800,
    lat: 51.5400, lng: -0.0800, location: 'Last seen: Stratford, London', heading: 0,
    lastUpdate: '47 mins ago', deviceId: 'DEV004',
    mot: '2025-06-30', insurance: '2026-12-01', nextService: '2025-05-15',
  },

  // ── Cold Chain Fleet (F002) ──
  {
    id: 'V005', plate: 'LP-6612', type: 'Refrigerated HGV', make: 'Volvo', model: 'FH Reefer', year: 2022,
    colour: 'White', fuelType: 'diesel', fleetId: 'F002',
    driver: 'Thomas Griffiths', driverId: 'D007',
    status: 'moving', speed: 48, fuel: 71, mileage: 54700,
    lat: 51.4800, lng: -0.2000, location: 'M4 Eastbound, London', heading: 90,
    temp: 4.1, lastUpdate: '1 min ago', deviceId: 'DEV005',
    mot: '2027-01-15', insurance: '2026-12-01', nextService: '2025-12-01',
  },
  {
    id: 'V006', plate: 'LP-0392', type: 'Refrigerated HGV', make: 'Volvo', model: 'FH Reefer', year: 2022,
    colour: 'White', fuelType: 'diesel', fleetId: 'F002',
    driver: 'Unassigned', driverId: '',
    status: 'alert', speed: 32, fuel: 58, mileage: 41200,
    lat: 51.5100, lng: -0.0600, location: 'A12 Eastbound, London', heading: 90,
    temp: 12.4, tempAlert: true, lastUpdate: '3 mins ago', deviceId: 'DEV006',
    mot: '2027-01-15', insurance: '2026-12-01', nextService: '2025-12-01',
  },

  // ── Manchester Vans Fleet (F003) ──
  {
    id: 'V007', plate: 'LP-2244', type: 'Van', make: 'Mercedes', model: 'Sprinter', year: 2021,
    colour: 'White', fuelType: 'diesel', fleetId: 'F003',
    driver: 'Sarah Whitfield', driverId: 'D004',
    status: 'moving', speed: 38, fuel: 88, mileage: 67200,
    lat: 53.4808, lng: -2.2426, location: 'Piccadilly, Manchester', heading: 180,
    lastUpdate: '1 min ago', deviceId: 'DEV007',
    mot: '2026-09-10', insurance: '2026-12-01', nextService: '2025-11-01',
  },
  {
    id: 'V008', plate: 'LP-5531', type: 'Van', make: 'Mercedes', model: 'Sprinter', year: 2020,
    colour: 'Grey', fuelType: 'diesel', fleetId: 'F003',
    driver: 'Priya Sharma', driverId: 'D006',
    status: 'idle', speed: 0, fuel: 65, mileage: 88900,
    lat: 53.4700, lng: -2.2600, location: 'Manchester Depot', heading: 0,
    lastUpdate: '8 mins ago', deviceId: 'DEV008',
    mot: '2026-05-22', insurance: '2026-12-01', nextService: '2025-08-01',
  },
  {
    id: 'V009', plate: 'LP-8821', type: 'Van', make: 'Mercedes', model: 'Sprinter', year: 2021,
    colour: 'White', fuelType: 'diesel', fleetId: 'F003',
    driver: 'Unassigned', driverId: '',
    status: 'stopped', speed: 0, fuel: 92, mileage: 34500,
    lat: 53.4900, lng: -2.2300, location: 'Salford, Manchester', heading: 0,
    lastUpdate: '15 mins ago', deviceId: 'DEV009',
    mot: '2027-02-14', insurance: '2026-12-01', nextService: '2026-01-01',
  },
  {
    id: 'V010', plate: 'LP-1193', type: 'HGV', make: 'Volvo', model: 'FH', year: 2020,
    colour: 'Red', fuelType: 'diesel', fleetId: 'F003',
    driver: 'Unassigned', driverId: '',
    status: 'moving', speed: 61, fuel: 54, mileage: 156700,
    lat: 53.5000, lng: -2.2000, location: 'M60 Orbital, Manchester', heading: 135,
    lastUpdate: '2 mins ago', deviceId: 'DEV010',
    mot: '2026-07-30', insurance: '2026-12-01', nextService: '2025-10-01',
  },

  // ── Birmingham Ops Fleet (F004) ──
  {
    id: 'V011', plate: 'LP-2201', type: 'Transit', make: 'Ford', model: 'Transit', year: 2022,
    colour: 'White', fuelType: 'diesel', fleetId: 'F004',
    driver: 'Aisha Okonkwo', driverId: 'D008',
    status: 'alert', speed: 28, fuel: 71, mileage: 28900,
    lat: 52.4862, lng: -1.8904, location: 'Digbeth, Birmingham', heading: 225,
    dashcamAlert: true, lastUpdate: '4 mins ago', deviceId: 'DEV011',
    mot: '2027-03-20', insurance: '2026-12-01', nextService: '2026-02-01',
  },
  {
    id: 'V012', plate: 'LP-4477', type: 'Transit', make: 'Ford', model: 'Transit', year: 2021,
    colour: 'Blue', fuelType: 'diesel', fleetId: 'F004',
    driver: 'Unassigned', driverId: '',
    status: 'moving', speed: 42, fuel: 48, mileage: 51200,
    lat: 52.4700, lng: -1.9100, location: 'A38 Southbound, Birmingham', heading: 180,
    lastUpdate: '2 mins ago', deviceId: 'DEV012',
    mot: '2026-10-05', insurance: '2026-12-01', nextService: '2025-09-01',
  },
  {
    id: 'V013', plate: 'LP-6690', type: 'HGV', make: 'DAF', model: 'XF', year: 2019,
    colour: 'White', fuelType: 'diesel', fleetId: 'F004',
    driver: 'Unassigned', driverId: '',
    status: 'idle', speed: 0, fuel: 83, mileage: 178400,
    lat: 52.5000, lng: -1.8700, location: 'Birmingham NEC, Solihull', heading: 0,
    lastUpdate: '12 mins ago', deviceId: 'DEV013',
    mot: '2025-08-12', insurance: '2026-12-01', nextService: '2025-07-01',
  },

  // ── Leeds Depot Fleet (F005) ──
  {
    id: 'V014', plate: 'LP-3388', type: 'HGV', make: 'DAF', model: 'XF', year: 2020,
    colour: 'White', fuelType: 'diesel', fleetId: 'F005',
    driver: 'Unassigned', driverId: '',
    status: 'moving', speed: 52, fuel: 67, mileage: 134500,
    lat: 53.8008, lng: -1.5491, location: 'M1 Northbound, Leeds', heading: 0,
    lastUpdate: '1 min ago', deviceId: 'DEV014',
    mot: '2026-06-18', insurance: '2026-12-01', nextService: '2025-08-01',
  },
  {
    id: 'V015', plate: 'LP-7712', type: 'Van', make: 'Mercedes', model: 'Sprinter', year: 2020,
    colour: 'White', fuelType: 'diesel', fleetId: 'F005',
    driver: 'Unassigned', driverId: '',
    status: 'stopped', speed: 0, fuel: 39, mileage: 92100,
    lat: 53.7900, lng: -1.5600, location: 'Leeds Depot', heading: 0,
    lastUpdate: '22 mins ago', deviceId: 'DEV015',
    mot: '2026-04-08', insurance: '2026-12-01', nextService: '2025-06-15',
  },
]

// ─── DRIVERS ─────────────────────────────────────────────────────────────────

export interface Driver {
  id: string
  name: string
  role: string
  fleetId: string
  score: number
  trips: number
  distance: number
  avatar: string
  vehicleId: string
  status: DriverStatus
  phone: string
  email: string
  licence: string
  licenceExpiry: string
  licenceCategories: string[]
  joinedDate: string
  totalMileage: number
  violations: number
  finesPending: number
}

export const drivers: Driver[] = [
  {
    id: 'D001', name: 'James Hartley', role: 'Senior Driver', fleetId: 'F001',
    score: 94, trips: 8, distance: 312, avatar: 'JH', vehicleId: 'V001',
    status: 'on-duty', phone: '+44 7700 100001', email: 'j.hartley@logisticspro.co.uk',
    licence: 'HARTL801142JA9KH', licenceExpiry: '2028-04-14',
    licenceCategories: ['B', 'C', 'C+E', 'CPC'],
    joinedDate: '2019-03-01', totalMileage: 284500, violations: 3, finesPending: 0,
  },
  {
    id: 'D002', name: 'Oliver Pemberton', role: 'HGV Driver', fleetId: 'F001',
    score: 87, trips: 6, distance: 248, avatar: 'OP', vehicleId: 'V002',
    status: 'on-duty', phone: '+44 7700 100002', email: 'o.pemberton@logisticspro.co.uk',
    licence: 'PEMBE901124OA9KH', licenceExpiry: '2027-09-20',
    licenceCategories: ['B', 'C', 'C+E'],
    joinedDate: '2020-06-15', totalMileage: 198200, violations: 8, finesPending: 1,
  },
  {
    id: 'D003', name: 'Mohammed Al-Rashid', role: 'HGV Driver', fleetId: 'F001',
    score: 91, trips: 7, distance: 289, avatar: 'MA', vehicleId: 'V003',
    status: 'on-duty', phone: '+44 7700 100003', email: 'm.alrashid@logisticspro.co.uk',
    licence: 'ALRAS851203MA9KH', licenceExpiry: '2026-12-03',
    licenceCategories: ['B', 'C', 'C+E', 'CPC'],
    joinedDate: '2021-01-10', totalMileage: 156800, violations: 5, finesPending: 0,
  },
  {
    id: 'D004', name: 'Sarah Whitfield', role: 'Fleet Manager / Driver', fleetId: 'F003',
    score: 96, trips: 12, distance: 187, avatar: 'SW', vehicleId: 'V007',
    status: 'on-duty', phone: '+44 7700 100004', email: 's.whitfield@logisticspro.co.uk',
    licence: 'WHITF901215SA9KH', licenceExpiry: '2029-12-15',
    licenceCategories: ['B', 'C', 'CPC'],
    joinedDate: '2018-09-01', totalMileage: 312400, violations: 1, finesPending: 0,
  },
  {
    id: 'D005', name: 'Connor McBride', role: 'HGV Driver', fleetId: 'F001',
    score: 72, trips: 5, distance: 198, avatar: 'CM', vehicleId: 'V004',
    status: 'on-duty', phone: '+44 7700 100005', email: 'c.mcbride@logisticspro.co.uk',
    licence: 'MCBRI931108CA9KH', licenceExpiry: '2025-11-08',
    licenceCategories: ['B', 'C'],
    joinedDate: '2022-04-01', totalMileage: 87600, violations: 18, finesPending: 3,
  },
  {
    id: 'D006', name: 'Priya Sharma', role: 'Van Driver', fleetId: 'F003',
    score: 89, trips: 11, distance: 156, avatar: 'PS', vehicleId: 'V008',
    status: 'on-break', phone: '+44 7700 100006', email: 'p.sharma@logisticspro.co.uk',
    licence: 'SHARM951220PA9KH', licenceExpiry: '2030-01-20',
    licenceCategories: ['B'],
    joinedDate: '2021-07-01', totalMileage: 64200, violations: 4, finesPending: 0,
  },
  {
    id: 'D007', name: 'Thomas Griffiths', role: 'Cold Chain Driver', fleetId: 'F002',
    score: 83, trips: 6, distance: 267, avatar: 'TG', vehicleId: 'V005',
    status: 'on-duty', phone: '+44 7700 100007', email: 't.griffiths@logisticspro.co.uk',
    licence: 'GRIFF881004TA9KH', licenceExpiry: '2027-10-04',
    licenceCategories: ['B', 'C', 'C+E', 'CPC', 'ADR'],
    joinedDate: '2020-02-15', totalMileage: 198700, violations: 7, finesPending: 1,
  },
  {
    id: 'D008', name: 'Aisha Okonkwo', role: 'Transit Driver', fleetId: 'F004',
    score: 98, trips: 14, distance: 143, avatar: 'AO', vehicleId: 'V011',
    status: 'on-duty', phone: '+44 7700 100008', email: 'a.okonkwo@logisticspro.co.uk',
    licence: 'OKONK961114AA9KH', licenceExpiry: '2031-11-14',
    licenceCategories: ['B', 'C'],
    joinedDate: '2022-08-01', totalMileage: 48900, violations: 0, finesPending: 0,
  },
]

// ─── DEVICES ─────────────────────────────────────────────────────────────────

export interface Device {
  id: string
  imei: string
  model: string
  manufacturer: string
  type: 'gps-tracker' | 'dashcam' | 'temp-sensor' | 'fuel-sensor'
  status: DeviceStatus
  vehicleId: string
  vehiclePlate: string
  firmwareVersion: string
  lastPing: string
  signalStrength: number
  battery?: number
  installedDate: string
  installHistory: { vehicleId: string; vehiclePlate: string; from: string; to: string }[]
}

export const devices: Device[] = [
  {
    id: 'DEV001', imei: '352099001761481', model: 'FMC920', manufacturer: 'Teltonika',
    type: 'gps-tracker', status: 'active', vehicleId: 'V001', vehiclePlate: 'LP-4821',
    firmwareVersion: '03.27.07', lastPing: '2 mins ago', signalStrength: 92,
    installedDate: '2021-06-01',
    installHistory: [{ vehicleId: 'V001', vehiclePlate: 'LP-4821', from: '2021-06-01', to: 'present' }],
  },
  {
    id: 'DEV002', imei: '352099001761482', model: 'FMC920', manufacturer: 'Teltonika',
    type: 'gps-tracker', status: 'active', vehicleId: 'V002', vehiclePlate: 'LP-3312',
    firmwareVersion: '03.27.07', lastPing: '1 min ago', signalStrength: 88,
    installedDate: '2020-08-15',
    installHistory: [{ vehicleId: 'V002', vehiclePlate: 'LP-3312', from: '2020-08-15', to: 'present' }],
  },
  {
    id: 'DEV003', imei: '352099001761483', model: 'TR3120', manufacturer: 'BSJIOT',
    type: 'gps-tracker', status: 'active', vehicleId: 'V003', vehiclePlate: 'LP-7734',
    firmwareVersion: '2.1.4', lastPing: '5 mins ago', signalStrength: 71,
    installedDate: '2019-11-01',
    installHistory: [{ vehicleId: 'V003', vehiclePlate: 'LP-7734', from: '2019-11-01', to: 'present' }],
  },
  {
    id: 'DEV004', imei: '352099001761484', model: 'TR3120', manufacturer: 'BSJIOT',
    type: 'gps-tracker', status: 'fault', vehicleId: 'V004', vehiclePlate: 'LP-9901',
    firmwareVersion: '2.0.8', lastPing: '47 mins ago', signalStrength: 0,
    installedDate: '2018-05-20',
    installHistory: [{ vehicleId: 'V004', vehiclePlate: 'LP-9901', from: '2018-05-20', to: 'present' }],
  },
  {
    id: 'DEV005', imei: '352099001761485', model: 'FMC920', manufacturer: 'Teltonika',
    type: 'gps-tracker', status: 'active', vehicleId: 'V005', vehiclePlate: 'LP-6612',
    firmwareVersion: '03.27.07', lastPing: '1 min ago', signalStrength: 95,
    installedDate: '2022-02-01',
    installHistory: [{ vehicleId: 'V005', vehiclePlate: 'LP-6612', from: '2022-02-01', to: 'present' }],
  },
  {
    id: 'DEV006', imei: '352099001761486', model: 'FMC920', manufacturer: 'Teltonika',
    type: 'temp-sensor', status: 'fault', vehicleId: 'V006', vehiclePlate: 'LP-0392',
    firmwareVersion: '03.25.01', lastPing: '3 mins ago', signalStrength: 84,
    installedDate: '2022-02-01',
    installHistory: [{ vehicleId: 'V006', vehiclePlate: 'LP-0392', from: '2022-02-01', to: 'present' }],
  },
  {
    id: 'DEV007', imei: '352099001761487', model: 'TR3120', manufacturer: 'BSJIOT',
    type: 'gps-tracker', status: 'active', vehicleId: 'V007', vehiclePlate: 'LP-2244',
    firmwareVersion: '2.1.4', lastPing: '1 min ago', signalStrength: 91,
    installedDate: '2021-09-01',
    installHistory: [{ vehicleId: 'V007', vehiclePlate: 'LP-2244', from: '2021-09-01', to: 'present' }],
  },
  {
    id: 'DEV016', imei: '352099001761496', model: 'FMC920', manufacturer: 'Teltonika',
    type: 'dashcam', status: 'unassigned', vehicleId: '', vehiclePlate: '',
    firmwareVersion: '03.27.07', lastPing: 'Never', signalStrength: 0,
    installedDate: '',
    installHistory: [],
  },
]

// ─── POI ─────────────────────────────────────────────────────────────────────

export interface POI {
  id: string
  name: string
  type: POIType
  lat: number
  lng: number
  radius: number
  address: string
  assignedTo: 'all' | string[]
  alertOnEntry: boolean
  alertOnExit: boolean
  dwellTimeLimit?: number
  notes: string
}

export const pois: POI[] = [
  {
    id: 'POI001', name: 'Stratford Logistics Park', type: 'depot',
    lat: 51.5400, lng: -0.0800, radius: 200,
    address: 'Stratford Logistics Park, London E15 2NW',
    assignedTo: 'all', alertOnEntry: false, alertOnExit: true,
    notes: 'London HQ depot — main loading bay',
  },
  {
    id: 'POI002', name: 'Trafford Park DC', type: 'depot',
    lat: 53.4650, lng: -2.2900, radius: 150,
    address: 'Trafford Park Distribution Centre, Manchester M17',
    assignedTo: ['F003'], alertOnEntry: false, alertOnExit: true,
    notes: 'Manchester depot for van fleet',
  },
  {
    id: 'POI003', name: 'Amazon BHX2 — Customer Site', type: 'customer',
    lat: 52.4550, lng: -1.7300, radius: 300,
    address: 'Amazon Fulfilment Centre, Birmingham B26 3QJ',
    assignedTo: 'all', alertOnEntry: true, alertOnExit: true,
    dwellTimeLimit: 120,
    notes: 'Max 2hr dwell — book slot in advance',
  },
  {
    id: 'POI004', name: 'Motorway Services — M1 J29', type: 'rest',
    lat: 53.1800, lng: -1.2700, radius: 100,
    address: 'Tibshelf Services, M1 Junction 29',
    assignedTo: 'all', alertOnEntry: false, alertOnExit: false,
    notes: 'Approved rest stop for long haul drivers',
  },
  {
    id: 'POI005', name: 'Shell Truck Stop — Dartford', type: 'fuel',
    lat: 51.4400, lng: 0.2200, radius: 80,
    address: 'Shell Truck Stop, A2 Dartford, Kent',
    assignedTo: ['F001', 'F002'], alertOnEntry: false, alertOnExit: false,
    notes: 'Contracted fuel stop — use fleet card only',
  },
]

// ─── GEOZONES ────────────────────────────────────────────────────────────────

export interface Geozone {
  id: string
  name: string
  type: GeozoneType
  color: string
  coordinates: [number, number][]
  assignedTo: 'all' | string[]
  speedLimit?: number
  curfewStart?: string
  curfewEnd?: string
  dwellLimit?: number
  active: boolean
  alertCount: number
}


export interface Alert {
  id: string
  type: AlertType
  severity: AlertSeverity
  vehicleId: string
  plate: string
  fleetId: string
  message: string
  location: string
  time: string
  driverName: string
  acknowledged: boolean
}

export const alerts: Alert[] = [
  {
    id: 'A001', type: 'speeding', severity: 'high', vehicleId: 'V001', plate: 'LP-4821',
    fleetId: 'F001', message: 'Speeding 74mph in 60mph zone',
    location: 'A1(M) Northbound, London', time: '2 mins ago',
    driverName: 'James Hartley', acknowledged: false,
  },
  {
    id: 'A002', type: 'temperature', severity: 'high', vehicleId: 'V006', plate: 'LP-0392',
    fleetId: 'F002', message: 'Cabin temp 12.4°C — exceeds 4°C limit',
    location: 'A12 Eastbound, London', time: '3 mins ago',
    driverName: 'Unassigned', acknowledged: false,
  },
  {
    id: 'A003', type: 'geofence', severity: 'medium', vehicleId: 'V003', plate: 'LP-7734',
    fleetId: 'F001', message: 'Unauthorised entry — Birmingham Depot Zone B',
    location: 'Birmingham Depot', time: '5 mins ago',
    driverName: 'Mohammed Al-Rashid', acknowledged: false,
  },
  {
    id: 'A004', type: 'dashcam', severity: 'medium', vehicleId: 'V011', plate: 'LP-2201',
    fleetId: 'F004', message: 'Harsh braking event detected by DashCam',
    location: 'Digbeth, Birmingham', time: '4 mins ago',
    driverName: 'Aisha Okonkwo', acknowledged: false,
  },
  {
    id: 'A005', type: 'offline', severity: 'high', vehicleId: 'V004', plate: 'LP-9901',
    fleetId: 'F001', message: 'Vehicle offline for 47 minutes',
    location: 'Last seen: Stratford, London', time: '47 mins ago',
    driverName: 'Connor McBride', acknowledged: false,
  },
  {
    id: 'A006', type: 'fuel', severity: 'low', vehicleId: 'V015', plate: 'LP-7712',
    fleetId: 'F005', message: 'Fuel level low — 39%',
    location: 'Leeds Depot', time: '22 mins ago',
    driverName: 'Unassigned', acknowledged: false,
  },
]

// ─── FLEET KPIs ──────────────────────────────────────────────────────────────

export const fleetKPIs = {
  totalVehicles: 15,
  activeVehicles: 9,
  idleVehicles: 3,
  alertVehicles: 3,
  offlineVehicles: 1,
  driversOnDuty: 7,
  avgFuelLevel: 63,
  co2Today: 847,
  tempAlerts: 1,
  avgDriverScore: 88,
  dashcamEvents: 3,
  totalFleets: 5,
}

// ─── VEHICLE TYPE ICONS ───────────────────────────────────────────────────────

export const vehicleTypeIcons: Record<string, string> = {
  'HGV': '🚛',
  'Van': '🚐',
  'Refrigerated HGV': '❄️',
  'Transit': '🚌',
  'Car': '🚗',
  'Bike': '🏍️',
  'Bus': '🚌',
  'Ambulance': '🚑',
  'Security': '🚔',
}

// ─── VEHICLE TRAILS ──────────────────────────────────────────────────────────

export const vehicleTrails: Record<string, [number, number][]> = {
  'V001': [[51.490, -0.145], [51.495, -0.140], [51.498, -0.135], [51.502, -0.132], [51.505, -0.130], [51.507, -0.128]],
  'V002': [[51.475, -0.165], [51.478, -0.160], [51.482, -0.158], [51.485, -0.155], [51.488, -0.152], [51.490, -0.150]],
  'V003': [[51.508, -0.115], [51.510, -0.112], [51.514, -0.108], [51.516, -0.105], [51.518, -0.103], [51.520, -0.100]],
  'V005': [[51.465, -0.215], [51.468, -0.210], [51.471, -0.208], [51.474, -0.205], [51.477, -0.203], [51.480, -0.200]],
  'V006': [[51.495, -0.075], [51.498, -0.072], [51.500, -0.068], [51.503, -0.065], [51.506, -0.063], [51.510, -0.060]],
  'V007': [[53.465, -2.258], [53.468, -2.255], [53.471, -2.252], [53.474, -2.249], [53.477, -2.246], [53.480, -2.243]],
  'V010': [[53.485, -2.215], [53.488, -2.212], [53.491, -2.209], [53.494, -2.206], [53.497, -2.203], [53.500, -2.200]],
  'V011': [[52.471, -1.905], [52.474, -1.902], [52.477, -1.899], [52.480, -1.896], [52.483, -1.893], [52.486, -1.890]],
  'V012': [[52.455, -1.925], [52.458, -1.922], [52.461, -1.919], [52.464, -1.916], [52.467, -1.913], [52.470, -1.910]],
  'V014': [[53.785, -1.564], [53.788, -1.561], [53.791, -1.558], [53.794, -1.555], [53.797, -1.552], [53.800, -1.549]],
}

// ─── EXTENDED DEVICES ────────────────────────────────────────────────────────
// NOTE TO DEVELOPERS:
// This dummy data represents the device inventory for demo purposes.
// In production, replace with:
// GET /api/fleetpoint/devices — full device list
// GET /api/fleetpoint/devices/:id — single device detail
// GET /api/fleetpoint/vehicles/:id/devices — all devices on a vehicle
// PATCH /api/fleetpoint/devices/:id/assign — reassign device to vehicle
// PATCH /api/fleetpoint/devices/:id/uninstall — remove from vehicle
// Device pairing (bundle) is managed via vehicle-device relationship in DB

export type ExtendedDeviceStatus = 'active' | 'installed' | 'uninstalled' | 'faulty' | 'in-stock' | 'issued'
export type DeviceCategory = 'gps-tracker' | 'dashcam' | 'temp-sensor' | 'fuel-sensor' | 'rfid-reader' | 'eye-sensor' | 'access-card'

export interface ExtendedDevice {
  id: string
  imei: string
  serial: string
  model: string
  manufacturer: string
  category: DeviceCategory
  status: ExtendedDeviceStatus
  vehicleId: string
  vehiclePlate: string
  firmwareVersion: string
  lastPing: string
  signalStrength: number
  battery?: number
  powerSource: 'vehicle' | 'battery' | 'hardwired' | 'na'
  installedDate: string
  warrantyExpiry: string
  notes: string
  // Pairing — which devices are bundled together on same vehicle
  bundleId: string
}

export const extendedDevices: ExtendedDevice[] = [
  // ── LP-4821 Bundle (B001) ──────────────────────────────────────────────────
  {
    id: 'ED001', imei: '352099001761481', serial: 'TLT-FMC920-001',
    model: 'FMC920', manufacturer: 'Teltonika', category: 'gps-tracker',
    status: 'active', vehicleId: 'V001', vehiclePlate: 'LP-4821',
    firmwareVersion: '03.27.07', lastPing: '2 mins ago', signalStrength: 92,
    powerSource: 'hardwired', installedDate: '2021-06-01', warrantyExpiry: '2026-06-01',
    notes: 'Primary GPS tracker — main unit', bundleId: 'B001',
  },
  {
    id: 'ED002', imei: '352099001761501', serial: 'CAM-FRONT-001',
    model: 'DC-200 Pro', manufacturer: 'BlackVue', category: 'dashcam',
    status: 'active', vehicleId: 'V001', vehiclePlate: 'LP-4821',
    firmwareVersion: '1.012', lastPing: '2 mins ago', signalStrength: 88,
    powerSource: 'hardwired', installedDate: '2021-06-01', warrantyExpiry: '2025-06-01',
    notes: 'Front facing dashcam — road view', bundleId: 'B001',
  },
  {
    id: 'ED003', imei: '352099001761502', serial: 'RFID-001',
    model: 'RDR-400', manufacturer: 'HID Global', category: 'rfid-reader',
    status: 'active', vehicleId: 'V001', vehiclePlate: 'LP-4821',
    firmwareVersion: '2.1.0', lastPing: '2 mins ago', signalStrength: 95,
    powerSource: 'hardwired', installedDate: '2021-06-01', warrantyExpiry: '2027-06-01',
    notes: 'Driver authentication RFID reader', bundleId: 'B001',
  },

  // ── LP-0392 Bundle (B002) — Cold Chain ────────────────────────────────────
  {
    id: 'ED004', imei: '352099001761486', serial: 'TLT-FMC920-006',
    model: 'FMC920', manufacturer: 'Teltonika', category: 'gps-tracker',
    status: 'active', vehicleId: 'V006', vehiclePlate: 'LP-0392',
    firmwareVersion: '03.27.07', lastPing: '3 mins ago', signalStrength: 84,
    powerSource: 'hardwired', installedDate: '2022-02-01', warrantyExpiry: '2027-02-01',
    notes: 'Primary GPS — cold chain vehicle', bundleId: 'B002',
  },
  {
    id: 'ED005', imei: '352099001761503', serial: 'TEMP-001',
    model: 'RuuviTag Pro', manufacturer: 'Ruuvi', category: 'temp-sensor',
    status: 'faulty', vehicleId: 'V006', vehiclePlate: 'LP-0392',
    firmwareVersion: '3.31.1', lastPing: '3 mins ago', signalStrength: 61,
    battery: 34, powerSource: 'battery',
    installedDate: '2022-02-01', warrantyExpiry: '2025-02-01',
    notes: '⚠️ Faulty — reporting temp 12.4°C, calibration needed', bundleId: 'B002',
  },
  {
    id: 'ED006', imei: '352099001761504', serial: 'CAM-CABIN-001',
    model: 'DC-200 Cabin', manufacturer: 'BlackVue', category: 'dashcam',
    status: 'active', vehicleId: 'V006', vehiclePlate: 'LP-0392',
    firmwareVersion: '1.012', lastPing: '3 mins ago', signalStrength: 79,
    powerSource: 'hardwired', installedDate: '2022-02-01', warrantyExpiry: '2025-02-01',
    notes: 'Cabin facing camera — cargo monitoring', bundleId: 'B002',
  },

  // ── LP-2201 Bundle (B003) — Birmingham Transit ────────────────────────────
  {
    id: 'ED007', imei: '352099001761487', serial: 'BSJ-TR3120-007',
    model: 'TR3120', manufacturer: 'BSJIOT', category: 'gps-tracker',
    status: 'active', vehicleId: 'V011', vehiclePlate: 'LP-2201',
    firmwareVersion: '2.1.4', lastPing: '4 mins ago', signalStrength: 91,
    powerSource: 'hardwired', installedDate: '2022-08-01', warrantyExpiry: '2027-08-01',
    notes: 'Primary GPS tracker', bundleId: 'B003',
  },
  {
    id: 'ED008', imei: '352099001761505', serial: 'EYE-001',
    model: 'DSM-300', manufacturer: 'Seeing Machines', category: 'eye-sensor',
    status: 'active', vehicleId: 'V011', vehiclePlate: 'LP-2201',
    firmwareVersion: '4.2.1', lastPing: '4 mins ago', signalStrength: 88,
    powerSource: 'hardwired', installedDate: '2022-08-01', warrantyExpiry: '2025-08-01',
    notes: 'Driver fatigue and distraction monitoring', bundleId: 'B003',
  },
  {
    id: 'ED009', imei: '352099001761506', serial: 'CAM-FRONT-003',
    model: 'DC-200 Pro', manufacturer: 'BlackVue', category: 'dashcam',
    status: 'active', vehicleId: 'V011', vehiclePlate: 'LP-2201',
    firmwareVersion: '1.012', lastPing: '4 mins ago', signalStrength: 85,
    powerSource: 'hardwired', installedDate: '2022-08-01', warrantyExpiry: '2025-08-01',
    notes: 'Front dashcam — event triggered', bundleId: 'B003',
  },

  // ── LP-9901 Bundle (B004) — Offline/Faulty ───────────────────────────────
  {
    id: 'ED010', imei: '352099001761484', serial: 'BSJ-TR3120-004',
    model: 'TR3120', manufacturer: 'BSJIOT', category: 'gps-tracker',
    status: 'faulty', vehicleId: 'V004', vehiclePlate: 'LP-9901',
    firmwareVersion: '2.0.8', lastPing: '47 mins ago', signalStrength: 0,
    powerSource: 'hardwired', installedDate: '2018-05-20', warrantyExpiry: '2023-05-20',
    notes: '⚠️ Device offline — warranty expired, firmware outdated', bundleId: 'B004',
  },

  // ── In Stock — not assigned ───────────────────────────────────────────────
  {
    id: 'ED011', imei: '352099001761496', serial: 'TLT-FMC920-NEW-001',
    model: 'FMC920', manufacturer: 'Teltonika', category: 'gps-tracker',
    status: 'in-stock', vehicleId: '', vehiclePlate: '',
    firmwareVersion: '03.27.07', lastPing: 'Never', signalStrength: 0,
    powerSource: 'na', installedDate: '', warrantyExpiry: '2028-01-01',
    notes: 'New unit — ready for installation', bundleId: '',
  },
  {
    id: 'ED012', imei: '352099001761497', serial: 'CAM-FRONT-NEW-001',
    model: 'DC-200 Pro', manufacturer: 'BlackVue', category: 'dashcam',
    status: 'in-stock', vehicleId: '', vehiclePlate: '',
    firmwareVersion: '1.012', lastPing: 'Never', signalStrength: 0,
    powerSource: 'na', installedDate: '', warrantyExpiry: '2028-01-01',
    notes: 'New unit — ready for installation', bundleId: '',
  },
  {
    id: 'ED013', imei: '352099001761498', serial: 'TEMP-NEW-001',
    model: 'RuuviTag Pro', manufacturer: 'Ruuvi', category: 'temp-sensor',
    status: 'in-stock', vehicleId: '', vehiclePlate: '',
    firmwareVersion: '3.31.1', lastPing: 'Never', signalStrength: 0,
    battery: 100, powerSource: 'battery',
    installedDate: '', warrantyExpiry: '2028-01-01',
    notes: 'New unit — for cold chain expansion', bundleId: '',
  },
  {
    id: 'ED014', imei: '352099001761499', serial: 'RFID-NEW-001',
    model: 'RDR-400', manufacturer: 'HID Global', category: 'rfid-reader',
    status: 'in-stock', vehicleId: '', vehiclePlate: '',
    firmwareVersion: '2.1.0', lastPing: 'Never', signalStrength: 0,
    powerSource: 'na', installedDate: '', warrantyExpiry: '2028-01-01',
    notes: 'New unit — driver authentication expansion', bundleId: '',
  },
  {
    id: 'ED015', imei: '', serial: 'ACC-CARD-001',
    model: 'HID Prox Card', manufacturer: 'HID Global', category: 'access-card',
    status: 'issued', vehicleId: '', vehiclePlate: '',
    firmwareVersion: 'N/A', lastPing: 'N/A', signalStrength: 0,
    powerSource: 'na', installedDate: '2024-01-01', warrantyExpiry: '2027-01-01',
    notes: 'Issued to James Hartley — D001', bundleId: '',
  },
]

// ─── POI DATA ─────────────────────────────────────────────────────────────────
// DEVELOPER NOTES:
// ─────────────────────────────────────────────────────────────────────────────
// POI = Any named point of interest in the IoTility ecosystem
// A POI can be a location, route, driver watch, vehicle watch, or customer site
// A POI can optionally link to a Geozone (geozoneId FK)
// A POI can optionally link to a Route (routeId FK)
//
// Database schema (suggested):
// Table: poi
//   id, name, type, lat, lng, radius, address
//   assignedTo: 'all' | 'fleet' | 'vehicle' | 'driver'
//   assignedIds: string[] (fleetIds, vehicleIds, driverIds)
//   geozoneId: FK → geozones.id (nullable)
//   routeId: FK → routes.id (nullable)
//   alertOnEntry: boolean
//   alertOnExit: boolean
//   dwellTimeLimit: number (minutes, nullable)
//   curfewStart: string (HH:MM, nullable)
//   curfewEnd: string (HH:MM, nullable)
//   contactName: string (nullable)
//   contactPhone: string (nullable)
//   slaMinutes: number (nullable — for customer sites)
//   notes: string
//   active: boolean
//   createdAt: timestamp
//   updatedAt: timestamp
//
// API endpoints:
// GET    /api/fleetpoint/poi                  — all POIs (paginated)
// GET    /api/fleetpoint/poi/:id              — single POI
// GET    /api/fleetpoint/poi/:id/visits       — visit history (paginated)
// GET    /api/fleetpoint/poi/:id/analytics    — dwell time, SLA, compliance
// GET    /api/fleetpoint/poi/:id/geozone      — linked geozone if any
// POST   /api/fleetpoint/poi                  — create POI
// PATCH  /api/fleetpoint/poi/:id              — update POI
// DELETE /api/fleetpoint/poi/:id              — delete POI
//
// POI entry/exit events come via WebSocket — server does radius check on GPS ping
// WS /api/fleetpoint/live-positions emits { type: 'poi-entry' | 'poi-exit', poiId, vehicleId }
// Frontend just receives events — no geofence math on client side
// ─────────────────────────────────────────────────────────────────────────────

export type POIType =
  | 'depot'
  | 'customer'
  | 'fuel'
  | 'rest'
  | 'exclusion'
  | 'unsafe'
  | 'competitor'
  | 'route'
  | 'custom'

export interface POIVisit {
  vehicleId: string
  vehiclePlate: string
  driverName: string
  entryTime: string
  exitTime: string
  dwellMinutes: number
  slaBreach: boolean
}

export interface EnhancedPOI {
  id: string
  name: string
  type: POIType
  lat: number
  lng: number
  radius: number
  address: string
  // Assignment
  assignedTo: 'all' | 'fleet' | 'vehicle'
  assignedIds: string[]
  // Geozone link — if set, this POI has an associated geozone
  // TODO: resolve via GET /api/fleetpoint/poi/:id/geozone
  geozoneId: string
  // Alert rules
  alertOnEntry: boolean
  alertOnExit: boolean
  dwellTimeLimit: number | null
  curfewStart: string | null
  curfewEnd: string | null
  // Customer site SLA
  slaMinutes: number | null
  contactName: string | null
  contactPhone: string | null
  // Status
  active: boolean
  notes: string
  // Live analytics — TODO: fetch from GET /api/fleetpoint/poi/:id/analytics
  visitsToday: number
  visitsThisWeek: number
  avgDwellMinutes: number
  activeAlerts: number
  slaComplianceRate: number
  // Recent visits — TODO: fetch from GET /api/fleetpoint/poi/:id/visits
  recentVisits: POIVisit[]
}

export const enhancedPOIs: EnhancedPOI[] = [
  // ── DEPOTS ──────────────────────────────────────────────────────────────────
  {
    id: 'EPOI001',
    name: 'Stratford Logistics Park — HQ',
    type: 'depot',
    lat: 51.5400, lng: -0.0800, radius: 200,
    address: 'Stratford Logistics Park, London E15 2NW',
    assignedTo: 'all', assignedIds: [],
    geozoneId: 'GZ001',
    alertOnEntry: false, alertOnExit: true,
    dwellTimeLimit: null, curfewStart: null, curfewEnd: null,
    slaMinutes: null, contactName: 'James Hartley', contactPhone: '+44 7700 100001',
    active: true, notes: 'London HQ — main loading bay. Gate closes at 22:00.',
    visitsToday: 8, visitsThisWeek: 42, avgDwellMinutes: 34,
    activeAlerts: 0, slaComplianceRate: 100,
    recentVisits: [
      { vehicleId: 'V001', vehiclePlate: 'LP-4821', driverName: 'James Hartley', entryTime: '06:12', exitTime: '06:48', dwellMinutes: 36, slaBreach: false },
      { vehicleId: 'V003', vehiclePlate: 'LP-7734', driverName: 'Mohammed Al-Rashid', entryTime: '07:05', exitTime: '07:31', dwellMinutes: 26, slaBreach: false },
    ],
  },
  {
    id: 'EPOI002',
    name: 'Trafford Park DC — Manchester',
    type: 'depot',
    lat: 53.4650, lng: -2.2900, radius: 150,
    address: 'Trafford Park Distribution Centre, Manchester M17',
    assignedTo: 'fleet', assignedIds: ['F003'],
    geozoneId: 'GZ003',
    alertOnEntry: false, alertOnExit: true,
    dwellTimeLimit: null, curfewStart: '22:00', curfewEnd: '06:00',
    slaMinutes: null, contactName: 'Sarah Whitfield', contactPhone: '+44 7700 100004',
    active: true, notes: 'Manchester depot — van fleet only. Night curfew active.',
    visitsToday: 5, visitsThisWeek: 28, avgDwellMinutes: 22,
    activeAlerts: 0, slaComplianceRate: 98,
    recentVisits: [
      { vehicleId: 'V007', vehiclePlate: 'LP-2244', driverName: 'Sarah Whitfield', entryTime: '07:30', exitTime: '07:52', dwellMinutes: 22, slaBreach: false },
    ],
  },
  {
    id: 'EPOI003',
    name: 'Aston Depot — Birmingham',
    type: 'depot',
    lat: 52.5000, lng: -1.8700, radius: 120,
    address: 'Aston Industrial Estate, Birmingham B6 4BN',
    assignedTo: 'fleet', assignedIds: ['F004'],
    geozoneId: '',
    alertOnEntry: false, alertOnExit: true,
    dwellTimeLimit: null, curfewStart: null, curfewEnd: null,
    slaMinutes: null, contactName: 'Aisha Okonkwo', contactPhone: '+44 7700 100008',
    active: true, notes: 'Birmingham ops depot.',
    visitsToday: 3, visitsThisWeek: 18, avgDwellMinutes: 28,
    activeAlerts: 0, slaComplianceRate: 100,
    recentVisits: [],
  },

  // ── CUSTOMER SITES ───────────────────────────────────────────────────────────
  {
    id: 'EPOI004',
    name: 'Amazon BHX2 Fulfilment Centre',
    type: 'customer',
    lat: 52.4550, lng: -1.7300, radius: 300,
    address: 'Amazon Fulfilment Centre, Birmingham B26 3QJ',
    assignedTo: 'all', assignedIds: [],
    geozoneId: 'GZ002',
    alertOnEntry: true, alertOnExit: true,
    dwellTimeLimit: 120, curfewStart: null, curfewEnd: null,
    slaMinutes: 90, contactName: 'Amazon Logistics', contactPhone: '+44 800 279 7234',
    active: true, notes: 'Max 2hr dwell — book delivery slot in advance. SLA: 90 min unload.',
    visitsToday: 4, visitsThisWeek: 21, avgDwellMinutes: 78,
    activeAlerts: 1, slaComplianceRate: 82,
    recentVisits: [
      { vehicleId: 'V002', vehiclePlate: 'LP-3312', driverName: 'Oliver Pemberton', entryTime: '09:15', exitTime: '10:48', dwellMinutes: 93, slaBreach: true },
      { vehicleId: 'V005', vehiclePlate: 'LP-6612', driverName: 'Thomas Griffiths', entryTime: '11:02', exitTime: '12:14', dwellMinutes: 72, slaBreach: false },
    ],
  },
  {
    id: 'EPOI005',
    name: 'Tesco RDC — Daventry',
    type: 'customer',
    lat: 52.2600, lng: -1.1600, radius: 250,
    address: 'Tesco Regional Distribution Centre, Daventry NN11 8QH',
    assignedTo: 'fleet', assignedIds: ['F001', 'F002'],
    geozoneId: '',
    alertOnEntry: true, alertOnExit: true,
    dwellTimeLimit: 60, curfewStart: null, curfewEnd: null,
    slaMinutes: 60, contactName: 'Tesco Logistics', contactPhone: '+44 800 505 555',
    active: true, notes: 'Strict 60min dwell limit. Advance booking required.',
    visitsToday: 2, visitsThisWeek: 14, avgDwellMinutes: 52,
    activeAlerts: 0, slaComplianceRate: 94,
    recentVisits: [
      { vehicleId: 'V001', vehiclePlate: 'LP-4821', driverName: 'James Hartley', entryTime: '13:30', exitTime: '14:22', dwellMinutes: 52, slaBreach: false },
    ],
  },

  // ── FUEL STATIONS ────────────────────────────────────────────────────────────
  {
    id: 'EPOI006',
    name: 'Shell Truck Stop — Dartford',
    type: 'fuel',
    lat: 51.4400, lng: 0.2200, radius: 80,
    address: 'Shell Truck Stop, A2 Dartford, Kent DA1 5NL',
    assignedTo: 'fleet', assignedIds: ['F001', 'F002'],
    geozoneId: '',
    alertOnEntry: false, alertOnExit: false,
    dwellTimeLimit: 45, curfewStart: null, curfewEnd: null,
    slaMinutes: null, contactName: null, contactPhone: null,
    active: true, notes: 'Contracted fuel stop — fleet card only. Alert if dwell >45min.',
    visitsToday: 1, visitsThisWeek: 9, avgDwellMinutes: 18,
    activeAlerts: 0, slaComplianceRate: 100,
    recentVisits: [
      { vehicleId: 'V005', vehiclePlate: 'LP-6612', driverName: 'Thomas Griffiths', entryTime: '08:44', exitTime: '09:02', dwellMinutes: 18, slaBreach: false },
    ],
  },
  {
    id: 'EPOI007',
    name: 'BP Truck Stop — M6 J21A',
    type: 'fuel',
    lat: 53.3800, lng: -2.5800, radius: 80,
    address: 'BP Truck Stop, M6 Junction 21A, Warrington WA3',
    assignedTo: 'fleet', assignedIds: ['F003'],
    geozoneId: '',
    alertOnEntry: false, alertOnExit: false,
    dwellTimeLimit: 45, curfewStart: null, curfewEnd: null,
    slaMinutes: null, contactName: null, contactPhone: null,
    active: true, notes: 'Manchester fleet preferred fuel stop.',
    visitsToday: 0, visitsThisWeek: 6, avgDwellMinutes: 21,
    activeAlerts: 0, slaComplianceRate: 100,
    recentVisits: [],
  },

  // ── REST STOPS ───────────────────────────────────────────────────────────────
  {
    id: 'EPOI008',
    name: 'Tibshelf Services — M1 J29',
    type: 'rest',
    lat: 53.1800, lng: -1.2700, radius: 100,
    address: 'Tibshelf Services, M1 Junction 29, Derbyshire DE55',
    assignedTo: 'all', assignedIds: [],
    geozoneId: '',
    alertOnEntry: false, alertOnExit: false,
    dwellTimeLimit: null, curfewStart: null, curfewEnd: null,
    slaMinutes: null, contactName: null, contactPhone: null,
    active: true, notes: 'Approved mandatory rest stop for long haul drivers. Min 45min rest.',
    visitsToday: 2, visitsThisWeek: 11, avgDwellMinutes: 48,
    activeAlerts: 0, slaComplianceRate: 100,
    recentVisits: [],
  },

  // ── EXCLUSION ZONES ──────────────────────────────────────────────────────────
  {
    id: 'EPOI009',
    name: 'Birmingham Depot Zone B — Restricted',
    type: 'exclusion',
    lat: 52.5200, lng: -1.0000, radius: 150,
    address: 'Zone B — Restricted Area, Birmingham Depot',
    assignedTo: 'fleet', assignedIds: ['F001'],
    geozoneId: 'GZ002',
    alertOnEntry: true, alertOnExit: false,
    dwellTimeLimit: null, curfewStart: null, curfewEnd: null,
    slaMinutes: null, contactName: null, contactPhone: null,
    active: true, notes: 'Unauthorised access zone — London HGV fleet must not enter. Immediate alert on breach.',
    visitsToday: 1, visitsThisWeek: 3, avgDwellMinutes: 12,
    activeAlerts: 1, slaComplianceRate: 0,
    recentVisits: [
      { vehicleId: 'V003', vehiclePlate: 'LP-7734', driverName: 'Mohammed Al-Rashid', entryTime: '14:22', exitTime: '14:34', dwellMinutes: 12, slaBreach: true },
    ],
  },

  // ── UNSAFE LOCATIONS ─────────────────────────────────────────────────────────
  {
    id: 'EPOI010',
    name: 'High Risk Zone — East London',
    type: 'unsafe',
    lat: 51.5250, lng: -0.0450, radius: 200,
    address: 'High crime area, East London E6',
    assignedTo: 'all', assignedIds: [],
    geozoneId: '',
    alertOnEntry: true, alertOnExit: false,
    dwellTimeLimit: 15, curfewStart: '20:00', curfewEnd: '06:00',
    slaMinutes: null, contactName: null, contactPhone: null,
    active: true, notes: 'High crime area. Alert if any vehicle stops here after 20:00 or dwell >15min.',
    visitsToday: 0, visitsThisWeek: 1, avgDwellMinutes: 8,
    activeAlerts: 0, slaComplianceRate: 100,
    recentVisits: [],
  },

  // ── CUSTOM ───────────────────────────────────────────────────────────────────
  {
    id: 'EPOI011',
    name: 'ULEZ Boundary — London',
    type: 'custom',
    lat: 51.5100, lng: -0.1200, radius: 5000,
    address: 'Ultra Low Emission Zone boundary, Central London',
    assignedTo: 'all', assignedIds: [],
    geozoneId: 'GZ001',
    alertOnEntry: true, alertOnExit: false,
    dwellTimeLimit: null, curfewStart: null, curfewEnd: null,
    slaMinutes: null, contactName: null, contactPhone: null,
    active: true, notes: 'ULEZ compliance zone. Non-compliant vehicles incur daily charge. Alert fleet manager on entry.',
    visitsToday: 6, visitsThisWeek: 31, avgDwellMinutes: 142,
    activeAlerts: 0, slaComplianceRate: 100,
    recentVisits: [],
  },
]

// ─── JOBS DATA ────────────────────────────────────────────────────────────────
// DEVELOPER NOTES:
// ─────────────────────────────────────────────────────────────────────────────
// Jobs are person-centric — assigned to a driver first, vehicle optional
// Same job system works for: delivery drivers, field technicians, waste collectors
//
// DB Schema:
// Table: jobs
//   id, name, type, status, priority
//   driverId FK → drivers.id
//   vehicleId FK → vehicles.id (nullable — some jobs don't need a vehicle)
//   pickupPoiId FK → poi.id (nullable)
//   dropoffPoiId FK → poi.id (nullable)
//   pickupAddress: string
//   dropoffAddress: string
//   scheduledStart: timestamp
//   scheduledEnd: timestamp
//   actualStart: timestamp (nullable)
//   actualEnd: timestamp (nullable)
//   notes: string
//   createdBy: userId FK
//   createdAt: timestamp
//   updatedAt: timestamp
//
// Table: job_tasks (one job = many tasks)
//   id, jobId FK, description, status ('pending'|'done'), order
//
// API endpoints:
// GET    /api/fleetpoint/jobs                — list (paginated, filterable)
// GET    /api/fleetpoint/jobs/:id            — single job detail
// GET    /api/fleetpoint/jobs/calendar       — calendar view (by driver, date range)
// POST   /api/fleetpoint/jobs                — create job
// PATCH  /api/fleetpoint/jobs/:id            — update/reassign
// PATCH  /api/fleetpoint/jobs/:id/status     — update status only
// DELETE /api/fleetpoint/jobs/:id            — delete
//
// Mobile driver app endpoints (future sprint):
// GET  /api/fleetpoint/jobs/my-jobs          — driver's own jobs for today
// POST /api/fleetpoint/jobs/:id/checkin      — driver arrives at pickup
// POST /api/fleetpoint/jobs/:id/checkout     — driver leaves dropoff
// POST /api/fleetpoint/jobs/:id/complete     — mark complete + photo upload
//
// POI Integration:
// When driver arrives at pickupPoiId location, GPS ping triggers job status → 'in-progress'
// When driver arrives at dropoffPoiId location, GPS ping triggers job status → 'completed'
// No manual check-in needed if POI radius is configured correctly
// ─────────────────────────────────────────────────────────────────────────────

export type JobStatus = 'pending' | 'assigned' | 'in-progress' | 'completed' | 'failed' | 'cancelled'
export type JobType = 'delivery' | 'collection' | 'transfer' | 'inspection' | 'ad-hoc'
export type JobPriority = 'high' | 'normal' | 'low'

export interface JobTask {
  id: string
  description: string
  status: 'pending' | 'done'
  order: number
}

export interface Job {
  id: string
  name: string
  type: JobType
  status: JobStatus
  priority: JobPriority
  driverId: string
  driverName: string
  vehicleId: string
  vehiclePlate: string
  pickupAddress: string
  pickupPoiId: string
  dropoffAddress: string
  dropoffPoiId: string
  scheduledStart: string
  scheduledEnd: string
  actualStart: string
  actualEnd: string
  tasks: JobTask[]
  notes: string
  createdBy: string
  createdAt: string
  distanceMiles: number
  estimatedMinutes: number
}

export const jobs: Job[] = [
  {
    id: 'JOB001',
    name: 'Amazon BHX2 — Morning Delivery',
    type: 'delivery',
    status: 'completed',
    priority: 'high',
    driverId: 'D001', driverName: 'James Hartley',
    vehicleId: 'V001', vehiclePlate: 'LP-4821',
    pickupAddress: 'Stratford Logistics Park, London E15',
    pickupPoiId: 'EPOI001',
    dropoffAddress: 'Amazon BHX2, Birmingham B26',
    dropoffPoiId: 'EPOI004',
    scheduledStart: '2026-05-21T06:00:00',
    scheduledEnd: '2026-05-21T09:30:00',
    actualStart: '2026-05-21T06:12:00',
    actualEnd: '2026-05-21T09:18:00',
    tasks: [
      { id: 'T001', description: 'Load cargo at Stratford depot', status: 'done', order: 1 },
      { id: 'T002', description: 'Deliver to Amazon BHX2 bay 14', status: 'done', order: 2 },
      { id: 'T003', description: 'Obtain POD signature', status: 'done', order: 3 },
    ],
    notes: 'Priority delivery — time sensitive. Call site manager on arrival.',
    createdBy: 'Ali Mujtaba',
    createdAt: '2026-05-20T18:00:00',
    distanceMiles: 118,
    estimatedMinutes: 134,
  },
  {
    id: 'JOB002',
    name: 'Tesco RDC — Scheduled Delivery',
    type: 'delivery',
    status: 'in-progress',
    priority: 'high',
    driverId: 'D002', driverName: 'Oliver Pemberton',
    vehicleId: 'V002', vehiclePlate: 'LP-3312',
    pickupAddress: 'Stratford Logistics Park, London E15',
    pickupPoiId: 'EPOI001',
    dropoffAddress: 'Tesco RDC, Daventry NN11',
    dropoffPoiId: 'EPOI005',
    scheduledStart: '2026-05-21T08:00:00',
    scheduledEnd: '2026-05-21T11:00:00',
    actualStart: '2026-05-21T08:05:00',
    actualEnd: '',
    tasks: [
      { id: 'T004', description: 'Load 24 pallets at depot', status: 'done', order: 1 },
      { id: 'T005', description: 'Deliver to Tesco RDC loading bay', status: 'pending', order: 2 },
      { id: 'T006', description: 'Unload and obtain GRN', status: 'pending', order: 3 },
    ],
    notes: 'Booked delivery slot 10:00-11:00. Do not be late.',
    createdBy: 'Ali Mujtaba',
    createdAt: '2026-05-20T17:00:00',
    distanceMiles: 87,
    estimatedMinutes: 112,
  },
  {
    id: 'JOB003',
    name: 'Cold Chain — Manchester Collection',
    type: 'collection',
    status: 'in-progress',
    priority: 'high',
    driverId: 'D007', driverName: 'Thomas Griffiths',
    vehicleId: 'V005', vehiclePlate: 'LP-6612',
    pickupAddress: 'Trafford Park DC, Manchester M17',
    pickupPoiId: 'EPOI002',
    dropoffAddress: 'Tilbury Cold Storage, Essex',
    dropoffPoiId: '',
    scheduledStart: '2026-05-21T07:00:00',
    scheduledEnd: '2026-05-21T13:00:00',
    actualStart: '2026-05-21T07:15:00',
    actualEnd: '',
    tasks: [
      { id: 'T007', description: 'Verify reefer temperature — must be 2°C', status: 'done', order: 1 },
      { id: 'T008', description: 'Collect frozen goods from Manchester DC', status: 'done', order: 2 },
      { id: 'T009', description: 'Deliver to Tilbury Cold Storage', status: 'pending', order: 3 },
      { id: 'T010', description: 'Temperature log sign-off', status: 'pending', order: 4 },
    ],
    notes: '⚠️ Temperature alert — check sensor on arrival. Keep cargo below 4°C.',
    createdBy: 'Ali Mujtaba',
    createdAt: '2026-05-20T16:00:00',
    distanceMiles: 201,
    estimatedMinutes: 248,
  },
  {
    id: 'JOB004',
    name: 'Birmingham Ops — Urban Delivery Run',
    type: 'delivery',
    status: 'pending',
    priority: 'normal',
    driverId: 'D008', driverName: 'Aisha Okonkwo',
    vehicleId: 'V011', vehiclePlate: 'LP-2201',
    pickupAddress: 'Aston Depot, Birmingham B6',
    pickupPoiId: 'EPOI003',
    dropoffAddress: 'Multiple stops — Digbeth, Sparkbrook, Bordesley',
    dropoffPoiId: '',
    scheduledStart: '2026-05-21T10:00:00',
    scheduledEnd: '2026-05-21T15:00:00',
    actualStart: '',
    actualEnd: '',
    tasks: [
      { id: 'T011', description: 'Load van at Aston depot', status: 'pending', order: 1 },
      { id: 'T012', description: 'Stop 1 — Digbeth Industrial, 3 pallets', status: 'pending', order: 2 },
      { id: 'T013', description: 'Stop 2 — Sparkbrook warehouse, 2 pallets', status: 'pending', order: 3 },
      { id: 'T014', description: 'Stop 3 — Bordesley retail, 1 pallet', status: 'pending', order: 4 },
    ],
    notes: 'Multi-drop run. Collect POD at each stop.',
    createdBy: 'Sarah Whitfield',
    createdAt: '2026-05-21T07:00:00',
    distanceMiles: 24,
    estimatedMinutes: 180,
  },
  {
    id: 'JOB005',
    name: 'Manchester Van — Ad Hoc Collection',
    type: 'ad-hoc',
    status: 'pending',
    priority: 'high',
    driverId: 'D004', driverName: 'Sarah Whitfield',
    vehicleId: 'V007', vehiclePlate: 'LP-2244',
    pickupAddress: 'Salford Business Park, Manchester M50',
    pickupPoiId: '',
    dropoffAddress: 'Trafford Park DC, Manchester M17',
    dropoffPoiId: 'EPOI002',
    scheduledStart: '2026-05-21T11:00:00',
    scheduledEnd: '2026-05-21T13:00:00',
    actualStart: '',
    actualEnd: '',
    tasks: [
      { id: 'T015', description: 'Collect urgent parcel from Salford', status: 'pending', order: 1 },
      { id: 'T016', description: 'Return to Trafford depot', status: 'pending', order: 2 },
    ],
    notes: 'Urgent — client requested same day collection.',
    createdBy: 'Sarah Whitfield',
    createdAt: '2026-05-21T09:30:00',
    distanceMiles: 8,
    estimatedMinutes: 45,
  },
  {
    id: 'JOB006',
    name: 'Vehicle Inspection — LP-9901',
    type: 'inspection',
    status: 'pending',
    priority: 'high',
    driverId: 'D005', driverName: 'Connor McBride',
    vehicleId: 'V004', vehiclePlate: 'LP-9901',
    pickupAddress: 'Stratford Depot, London E15',
    pickupPoiId: 'EPOI001',
    dropoffAddress: 'Volvo Truck Centre, Dartford DA1',
    dropoffPoiId: '',
    scheduledStart: '2026-05-21T14:00:00',
    scheduledEnd: '2026-05-21T17:00:00',
    actualStart: '',
    actualEnd: '',
    tasks: [
      { id: 'T017', description: 'Drive LP-9901 to Volvo service centre', status: 'pending', order: 1 },
      { id: 'T018', description: 'Hand over for full service inspection', status: 'pending', order: 2 },
      { id: 'T019', description: 'Collect service report', status: 'pending', order: 3 },
    ],
    notes: '⚠️ Vehicle offline — possible device fault. Needs full inspection.',
    createdBy: 'Ali Mujtaba',
    createdAt: '2026-05-21T08:00:00',
    distanceMiles: 18,
    estimatedMinutes: 35,
  },
  {
    id: 'JOB007',
    name: 'Leeds — M1 Northbound Transfer',
    type: 'transfer',
    status: 'assigned',
    priority: 'normal',
    driverId: 'D003', driverName: 'Mohammed Al-Rashid',
    vehicleId: 'V014', vehiclePlate: 'LP-3388',
    pickupAddress: 'Stourton Hub, Leeds LS10',
    pickupPoiId: '',
    dropoffAddress: 'Stratford Logistics Park, London E15',
    dropoffPoiId: 'EPOI001',
    scheduledStart: '2026-05-21T15:00:00',
    scheduledEnd: '2026-05-21T19:00:00',
    actualStart: '',
    actualEnd: '',
    tasks: [
      { id: 'T020', description: 'Pick up empty trailer from Leeds', status: 'pending', order: 1 },
      { id: 'T021', description: 'Transfer to London HQ depot', status: 'pending', order: 2 },
    ],
    notes: 'Empty trailer repositioning run.',
    createdBy: 'Ali Mujtaba',
    createdAt: '2026-05-21T10:00:00',
    distanceMiles: 201,
    estimatedMinutes: 210,
  },
  {
    id: 'JOB008',
    name: 'Priya — Manchester Local Deliveries',
    type: 'delivery',
    status: 'failed',
    priority: 'normal',
    driverId: 'D006', driverName: 'Priya Sharma',
    vehicleId: 'V008', vehiclePlate: 'LP-5531',
    pickupAddress: 'Trafford Park DC, Manchester M17',
    pickupPoiId: 'EPOI002',
    dropoffAddress: 'Northern Quarter, Manchester M4',
    dropoffPoiId: '',
    scheduledStart: '2026-05-21T09:00:00',
    scheduledEnd: '2026-05-21T12:00:00',
    actualStart: '2026-05-21T09:22:00',
    actualEnd: '2026-05-21T10:45:00',
    tasks: [
      { id: 'T022', description: 'Load 6 parcels at Trafford DC', status: 'done', order: 1 },
      { id: 'T023', description: 'Deliver to Northern Quarter addresses', status: 'pending', order: 2 },
    ],
    notes: 'Failed — driver on break, vehicle returned to depot.',
    createdBy: 'Sarah Whitfield',
    createdAt: '2026-05-21T08:00:00',
    distanceMiles: 5,
    estimatedMinutes: 60,
  },
]

// ─── ROUTES DATA ──────────────────────────────────────────────────────────────
// DEVELOPER NOTES:
// ─────────────────────────────────────────────────────────────────────────────
// Routes = defined paths from A to B with waypoints/stops
// A route can be assigned to: vehicle, driver, or fleet
// A route run = one execution of a route (linked to a job optionally)
//
// DB Schema:
// Table: routes
//   id, name, description, startAddress, endAddress
//   startLat, startLng, endLat, endLng
//   waypoints: JSON array of { lat, lng, address, stopName }
//   distanceMiles, estimatedMinutes
//   toleranceMeters (deviation threshold — server checks GPS ping)
//   assignedTo: 'fleet' | 'vehicle' | 'driver' | 'all'
//   assignedIds: string[]
//   isTemplate: boolean (recurring route)
//   recurringDays: string[] (for templates e.g. ['MON','WED','FRI'])
//   active: boolean
//   createdBy: userId FK
//   createdAt, updatedAt: timestamps
//
// Table: route_runs (one route = many runs)
//   id, routeId FK, jobId FK (nullable)
//   vehicleId FK, driverId FK
//   status: 'scheduled'|'en-route'|'completed'|'cancelled'
//   scheduledStart, scheduledEnd: timestamps
//   actualStart, actualEnd: timestamps
//   complianceScore: number (0-100, calculated server-side)
//   deviationEvents: number
//   avgDeviationMeters: number
//   stopsCompleted: number, stopsTotal: number
//   dispatchMode: 'manual'|'suggested'|'auto'
//   createdAt: timestamp
//
// Table: route_stops (one route = many stops)
//   id, routeId FK, order: number
//   stopName, address, lat, lng
//   expectedDwellMinutes, poiId FK (nullable)
//
// API endpoints:
// GET    /api/fleetpoint/routes                    — all routes
// GET    /api/fleetpoint/routes/:id                — single route
// GET    /api/fleetpoint/routes/:id/runs           — run history
// GET    /api/fleetpoint/routes/:id/stops          — stops list
// GET    /api/fleetpoint/routes/runs/active        — all active runs right now
// GET    /api/fleetpoint/routes/runs/:id/adherence — planned vs actual GPS trail
// POST   /api/fleetpoint/routes                    — create route
// POST   /api/fleetpoint/routes/:id/dispatch       — dispatch route run
// PATCH  /api/fleetpoint/routes/:id                — update route
// DELETE /api/fleetpoint/routes/:id                — delete route
//
// Auto-dispatch:
// POST /api/fleetpoint/jobs/:id/auto-dispatch
//   → Algorithm runs server-side
//   → Returns { driverId, vehicleId, reasoning, confidence }
//   → Frontend receives 'job.auto-assigned' via WebSocket
//
// Deviation detection:
// Server checks every GPS ping against route polyline + toleranceMeters
// If outside tolerance → fires alert via WebSocket
// WS event: { type: 'route-deviation', runId, vehicleId, deviationMeters, location }
//
// Adherence map data:
// GET /api/fleetpoint/routes/runs/:id/adherence
//   Returns: {
//     planned: [{ lat, lng }],     ← original route polyline
//     actual: [{ lat, lng }],      ← actual GPS trail
//     deviated: [{ lat, lng }]     ← segments where vehicle was off route
//   }
// ─────────────────────────────────────────────────────────────────────────────

export type RouteStatus = 'scheduled' | 'en-route' | 'completed' | 'cancelled'
export type DispatchMode = 'manual' | 'suggested' | 'auto'

export interface RouteStop {
  id: string
  order: number
  stopName: string
  address: string
  lat: number
  lng: number
  expectedDwellMinutes: number
  poiId: string
  // Run-time fields (populated on active run)
  actualArrival?: string
  actualDeparture?: string
  status?: 'pending' | 'visited' | 'skipped' | 'delayed'
}

export interface Route {
  id: string
  name: string
  description: string
  startAddress: string
  endAddress: string
  startLat: number
  startLng: number
  endLat: number
  endLng: number
  distanceMiles: number
  estimatedMinutes: number
  toleranceMeters: number
  stops: RouteStop[]
  assignedTo: 'fleet' | 'vehicle' | 'driver' | 'all'
  assignedIds: string[]
  isTemplate: boolean
  recurringDays: string[]
  active: boolean
  createdBy: string
  createdAt: string
  // Analytics — TODO: GET /api/fleetpoint/routes/:id/analytics
  totalRuns: number
  avgComplianceScore: number
  lastRunDate: string
}

export interface RouteRun {
  id: string
  routeId: string
  routeName: string
  jobId: string
  vehicleId: string
  vehiclePlate: string
  driverId: string
  driverName: string
  status: RouteStatus
  scheduledStart: string
  scheduledEnd: string
  actualStart: string
  actualEnd: string
  complianceScore: number
  deviationEvents: number
  avgDeviationMeters: number
  stopsCompleted: number
  stopsTotal: number
  dispatchMode: DispatchMode
  // Auto-dispatch reasoning — shown in UI
  // TODO: populated by POST /api/fleetpoint/jobs/:id/auto-dispatch
  autoDispatchReason?: string
}

export const routes: Route[] = [
  {
    id: 'RT001',
    name: 'London → Birmingham Express',
    description: 'Daily HGV run from London HQ to Birmingham NEC via M40',
    startAddress: 'Stratford Logistics Park, London E15',
    endAddress: 'Amazon BHX2, Birmingham B26',
    startLat: 51.5400, startLng: -0.0800,
    endLat: 52.4550, endLng: -1.7300,
    distanceMiles: 118, estimatedMinutes: 134,
    toleranceMeters: 500,
    stops: [
      { id: 'S001', order: 1, stopName: 'Stratford Depot — Load', address: 'Stratford Logistics Park, London E15', lat: 51.5400, lng: -0.0800, expectedDwellMinutes: 30, poiId: 'EPOI001' },
      { id: 'S002', order: 2, stopName: 'Tibshelf Services — Driver Break', address: 'Tibshelf Services, M1 J29', lat: 53.1800, lng: -1.2700, expectedDwellMinutes: 45, poiId: 'EPOI008' },
      { id: 'S003', order: 3, stopName: 'Amazon BHX2 — Delivery', address: 'Amazon BHX2, Birmingham B26', lat: 52.4550, lng: -1.7300, expectedDwellMinutes: 90, poiId: 'EPOI004' },
    ],
    assignedTo: 'fleet', assignedIds: ['F001'],
    isTemplate: true, recurringDays: ['MON', 'WED', 'FRI'],
    active: true, createdBy: 'Ali Mujtaba', createdAt: '2026-01-15',
    totalRuns: 48, avgComplianceScore: 91, lastRunDate: '2026-05-21',
  },
  {
    id: 'RT002',
    name: 'Cold Chain — London to Tilbury',
    description: 'Refrigerated delivery run — temperature critical',
    startAddress: 'Trafford Park DC, Manchester M17',
    endAddress: 'Tilbury Cold Storage, Essex',
    startLat: 53.4650, startLng: -2.2900,
    endLat: 51.4600, endLng: 0.3600,
    distanceMiles: 201, estimatedMinutes: 248,
    toleranceMeters: 300,
    stops: [
      { id: 'S004', order: 1, stopName: 'Manchester DC — Load', address: 'Trafford Park DC, Manchester M17', lat: 53.4650, lng: -2.2900, expectedDwellMinutes: 45, poiId: 'EPOI002' },
      { id: 'S005', order: 2, stopName: 'Shell Dartford — Fuel', address: 'Shell Truck Stop, Dartford', lat: 51.4400, lng: 0.2200, expectedDwellMinutes: 20, poiId: 'EPOI006' },
      { id: 'S006', order: 3, stopName: 'Tilbury Cold Storage — Dropoff', address: 'Tilbury Cold Storage, Essex SS17', lat: 51.4600, lng: 0.3600, expectedDwellMinutes: 60, poiId: '' },
    ],
    assignedTo: 'fleet', assignedIds: ['F002'],
    isTemplate: true, recurringDays: ['TUE', 'THU'],
    active: true, createdBy: 'Ali Mujtaba', createdAt: '2026-02-01',
    totalRuns: 32, avgComplianceScore: 88, lastRunDate: '2026-05-20',
  },
  {
    id: 'RT003',
    name: 'Manchester Urban Van Loop',
    description: 'Last mile delivery loop across Greater Manchester',
    startAddress: 'Trafford Park DC, Manchester M17',
    endAddress: 'Trafford Park DC, Manchester M17',
    startLat: 53.4650, startLng: -2.2900,
    endLat: 53.4650, endLng: -2.2900,
    distanceMiles: 42, estimatedMinutes: 180,
    toleranceMeters: 200,
    stops: [
      { id: 'S007', order: 1, stopName: 'Trafford Park — Load', address: 'Trafford Park DC, Manchester M17', lat: 53.4650, lng: -2.2900, expectedDwellMinutes: 20, poiId: 'EPOI002' },
      { id: 'S008', order: 2, stopName: 'Piccadilly — Stop 1', address: 'Piccadilly, Manchester M1', lat: 53.4808, lng: -2.2426, expectedDwellMinutes: 15, poiId: '' },
      { id: 'S009', order: 3, stopName: 'Salford — Stop 2', address: 'Salford Business Park, M50', lat: 53.4900, lng: -2.2300, expectedDwellMinutes: 15, poiId: '' },
      { id: 'S010', order: 4, stopName: 'Trafford Park — Return', address: 'Trafford Park DC, Manchester M17', lat: 53.4650, lng: -2.2900, expectedDwellMinutes: 10, poiId: 'EPOI002' },
    ],
    assignedTo: 'fleet', assignedIds: ['F003'],
    isTemplate: true, recurringDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
    active: true, createdBy: 'Sarah Whitfield', createdAt: '2026-01-20',
    totalRuns: 94, avgComplianceScore: 96, lastRunDate: '2026-05-21',
  },
  {
    id: 'RT004',
    name: 'Birmingham Multi-Drop',
    description: 'Urban delivery run across Birmingham depots',
    startAddress: 'Aston Depot, Birmingham B6',
    endAddress: 'Aston Depot, Birmingham B6',
    startLat: 52.5000, startLng: -1.8700,
    endLat: 52.5000, endLng: -1.8700,
    distanceMiles: 24, estimatedMinutes: 150,
    toleranceMeters: 300,
    stops: [
      { id: 'S011', order: 1, stopName: 'Aston Depot — Load', address: 'Aston Industrial Estate, Birmingham B6', lat: 52.5000, lng: -1.8700, expectedDwellMinutes: 20, poiId: 'EPOI003' },
      { id: 'S012', order: 2, stopName: 'Digbeth — Stop 1', address: 'Digbeth Industrial, Birmingham B5', lat: 52.4862, lng: -1.8904, expectedDwellMinutes: 20, poiId: '' },
      { id: 'S013', order: 3, stopName: 'Sparkbrook — Stop 2', address: 'Sparkbrook, Birmingham B11', lat: 52.4700, lng: -1.8600, expectedDwellMinutes: 20, poiId: '' },
      { id: 'S014', order: 4, stopName: 'Bordesley — Stop 3', address: 'Bordesley, Birmingham B9', lat: 52.4750, lng: -1.8500, expectedDwellMinutes: 20, poiId: '' },
      { id: 'S015', order: 5, stopName: 'Aston Depot — Return', address: 'Aston Industrial Estate, Birmingham B6', lat: 52.5000, lng: -1.8700, expectedDwellMinutes: 10, poiId: 'EPOI003' },
    ],
    assignedTo: 'fleet', assignedIds: ['F004'],
    isTemplate: false, recurringDays: [],
    active: true, createdBy: 'Aisha Okonkwo', createdAt: '2026-03-01',
    totalRuns: 28, avgComplianceScore: 94, lastRunDate: '2026-05-21',
  },
  {
    id: 'RT005',
    name: 'Leeds → London Trunk Run',
    description: 'Overnight trunk run from Leeds to London HQ',
    startAddress: 'Stourton Hub, Leeds LS10',
    endAddress: 'Stratford Logistics Park, London E15',
    startLat: 53.7900, startLng: -1.5600,
    endLat: 51.5400, endLng: -0.0800,
    distanceMiles: 201, estimatedMinutes: 210,
    toleranceMeters: 800,
    stops: [
      { id: 'S016', order: 1, stopName: 'Leeds Depot — Load', address: 'Stourton Hub, Leeds LS10', lat: 53.7900, lng: -1.5600, expectedDwellMinutes: 30, poiId: '' },
      { id: 'S017', order: 2, stopName: 'Tibshelf Services — Break', address: 'Tibshelf Services, M1 J29', lat: 53.1800, lng: -1.2700, expectedDwellMinutes: 45, poiId: 'EPOI008' },
      { id: 'S018', order: 3, stopName: 'London HQ — Dropoff', address: 'Stratford Logistics Park, London E15', lat: 51.5400, lng: -0.0800, expectedDwellMinutes: 30, poiId: 'EPOI001' },
    ],
    assignedTo: 'fleet', assignedIds: ['F005'],
    isTemplate: true, recurringDays: ['MON', 'THU'],
    active: true, createdBy: 'Ali Mujtaba', createdAt: '2026-04-10',
    totalRuns: 18, avgComplianceScore: 79, lastRunDate: '2026-05-19',
  },
]

export const routeRuns: RouteRun[] = [
  {
    id: 'RR001',
    routeId: 'RT001', routeName: 'London → Birmingham Express',
    jobId: 'JOB001',
    vehicleId: 'V001', vehiclePlate: 'LP-4821',
    driverId: 'D001', driverName: 'James Hartley',
    status: 'completed',
    scheduledStart: '2026-05-21T06:00:00', scheduledEnd: '2026-05-21T09:30:00',
    actualStart: '2026-05-21T06:12:00', actualEnd: '2026-05-21T09:18:00',
    complianceScore: 94, deviationEvents: 1, avgDeviationMeters: 180,
    stopsCompleted: 3, stopsTotal: 3,
    dispatchMode: 'manual',
  },
  {
    id: 'RR002',
    routeId: 'RT002', routeName: 'Cold Chain — London to Tilbury',
    jobId: 'JOB003',
    vehicleId: 'V005', vehiclePlate: 'LP-6612',
    driverId: 'D007', driverName: 'Thomas Griffiths',
    status: 'en-route',
    scheduledStart: '2026-05-21T07:00:00', scheduledEnd: '2026-05-21T13:00:00',
    actualStart: '2026-05-21T07:15:00', actualEnd: '',
    complianceScore: 88, deviationEvents: 0, avgDeviationMeters: 0,
    stopsCompleted: 2, stopsTotal: 3,
    dispatchMode: 'manual',
  },
  {
    id: 'RR003',
    routeId: 'RT003', routeName: 'Manchester Urban Van Loop',
    jobId: '',
    vehicleId: 'V007', vehiclePlate: 'LP-2244',
    driverId: 'D004', driverName: 'Sarah Whitfield',
    status: 'en-route',
    scheduledStart: '2026-05-21T08:00:00', scheduledEnd: '2026-05-21T12:00:00',
    actualStart: '2026-05-21T08:05:00', actualEnd: '',
    complianceScore: 97, deviationEvents: 0, avgDeviationMeters: 0,
    stopsCompleted: 2, stopsTotal: 4,
    dispatchMode: 'auto',
    autoDispatchReason: 'Closest driver (0.8km) · Available · Score 96 · Manchester Vans fleet',
  },
  {
    id: 'RR004',
    routeId: 'RT004', routeName: 'Birmingham Multi-Drop',
    jobId: 'JOB004',
    vehicleId: 'V011', vehiclePlate: 'LP-2201',
    driverId: 'D008', driverName: 'Aisha Okonkwo',
    status: 'scheduled',
    scheduledStart: '2026-05-21T10:00:00', scheduledEnd: '2026-05-21T15:00:00',
    actualStart: '', actualEnd: '',
    complianceScore: 0, deviationEvents: 0, avgDeviationMeters: 0,
    stopsCompleted: 0, stopsTotal: 5,
    dispatchMode: 'suggested',
    autoDispatchReason: 'Suggested: Nearest available driver · Score 98 · Birmingham Ops fleet',
  },
  {
    id: 'RR005',
    routeId: 'RT001', routeName: 'London → Birmingham Express',
    jobId: '',
    vehicleId: 'V003', vehiclePlate: 'LP-7734',
    driverId: 'D003', driverName: 'Mohammed Al-Rashid',
    status: 'completed',
    scheduledStart: '2026-05-20T06:00:00', scheduledEnd: '2026-05-20T09:30:00',
    actualStart: '2026-05-20T06:08:00', actualEnd: '2026-05-20T09:45:00',
    complianceScore: 72, deviationEvents: 4, avgDeviationMeters: 620,
    stopsCompleted: 2, stopsTotal: 3,
    dispatchMode: 'manual',
  },
  {
    id: 'RR006',
    routeId: 'RT005', routeName: 'Leeds → London Trunk Run',
    jobId: 'JOB007',
    vehicleId: 'V014', vehiclePlate: 'LP-3388',
    driverId: 'D003', driverName: 'Mohammed Al-Rashid',
    status: 'scheduled',
    scheduledStart: '2026-05-21T15:00:00', scheduledEnd: '2026-05-21T19:00:00',
    actualStart: '', actualEnd: '',
    complianceScore: 0, deviationEvents: 0, avgDeviationMeters: 0,
    stopsCompleted: 0, stopsTotal: 3,
    dispatchMode: 'manual',
  },
]

// ─── MAINTENANCE DATA ─────────────────────────────────────────────────────────
// DEVELOPER NOTES:
// ─────────────────────────────────────────────────────────────────────────────
// ARCHITECTURE OVERVIEW:
// Maintenance module has 3 data layers:
//
// 1. SCHEDULED MAINTENANCE
//    Based on: mileage intervals, time intervals, manufacturer specs
//    Source: manually configured + auto-triggered by telematics
//    DB Table: maintenance_schedules
//
// 2. WORK ORDERS
//    Raised manually OR auto from predictions OR from driver reports
//    Has full workflow: raised → assigned → accepted → in-progress → complete
//    DB Table: work_orders, work_order_timeline
//
// 3. PREDICTIONS (AI/ML Layer)
//    Input: mileage, service history, driving behaviour scores, CAN bus data
//    Output: health score per component, predicted failure date, confidence %
//    DB Table: vehicle_health_scores, maintenance_predictions
//    NOTE: ML model runs server-side (Python/FastAPI microservice)
//    Frontend just consumes predictions — no ML logic on frontend
//
// ─── DATABASE SCHEMA ──────────────────────────────────────────────────────────
//
// Table: workshops
//   id, name, type: 'internal'|'vendor', location, address
//   lat, lng, ownerId FK → users.id
//   phone, email, specialisations: string[]
//   capacity (number of bays), active: boolean
//   createdAt, updatedAt
//
// Table: work_orders
//   id, vehicleId FK, driverId FK (who reported, nullable)
//   workshopId FK (nullable until assigned)
//   type: 'scheduled'|'corrective'|'predictive'|'driver-reported'
//   status: 'raised'|'assigned'|'accepted'|'diagnosing'|'awaiting-parts'
//          |'in-progress'|'quality-check'|'completed'|'cancelled'
//   priority: 'critical'|'high'|'normal'|'low'
//   serviceType: string (Oil Change, Brake Pads, etc.)
//   description, diagnosis (filled by workshop)
//   estimatedCost, actualCost
//   estimatedCompletionDate, actualCompletionDate
//   mileageAtService: number
//   nextServiceMileage: number (calculated on completion)
//   nextServiceDate: date (calculated on completion)
//   parts: JSON array of { name, quantity, unitCost }
//   attachments: string[] (photo URLs)
//   raisedBy: userId FK
//   createdAt, updatedAt
//
// Table: work_order_timeline (audit trail)
//   id, workOrderId FK, status, note, userId FK, createdAt
//
// Table: vehicle_health_scores
//   id, vehicleId FK (unique)
//   overallScore: number (0-100)
//   engineScore, brakeScore, tyreScore, batteryScore, transmissionScore
//   lastCalculatedAt: timestamp
//   NOTE: Recalculated by ML microservice on every telematics ping
//         and after every completed work order
//   TODO: POST /api/ml/vehicle-health/:vehicleId/recalculate
//
// Table: maintenance_predictions
//   id, vehicleId FK
//   component: string (engine, brakes, tyres, battery, etc.)
//   predictedFailureDate: date
//   confidence: number (0-100)
//   urgency: 'critical'|'high'|'medium'|'low'
//   reasoning: string (human-readable explanation)
//   dataPoints: JSON (what data was used)
//   actionRequired: string
//   estimatedCost: number
//   createdAt: timestamp (when prediction was made)
//
// ─── API ENDPOINTS ────────────────────────────────────────────────────────────
//
// Workshops:
// GET    /api/fleetpoint/workshops                    — list all workshops
// POST   /api/fleetpoint/workshops                    — create workshop
// PATCH  /api/fleetpoint/workshops/:id               — update workshop
// DELETE /api/fleetpoint/workshops/:id               — delete workshop
//
// Work Orders:
// GET    /api/fleetpoint/work-orders                  — list (paginated, filterable)
// GET    /api/fleetpoint/work-orders/:id              — single work order
// GET    /api/fleetpoint/work-orders/:id/timeline     — status timeline
// POST   /api/fleetpoint/work-orders                  — raise work order
// PATCH  /api/fleetpoint/work-orders/:id/status       — update status + note
// PATCH  /api/fleetpoint/work-orders/:id/assign       — assign to workshop
// PATCH  /api/fleetpoint/work-orders/:id/cost         — update cost estimate/actual
// POST   /api/fleetpoint/work-orders/:id/complete     — complete + attach photos
//
// Vehicle Health:
// GET    /api/fleetpoint/vehicles/:id/health          — health scores + predictions
// GET    /api/fleetpoint/vehicles/health-summary      — all vehicles health overview
// POST   /api/ml/vehicle-health/:id/recalculate       — trigger ML recalculation
//        NOTE: This calls Python ML microservice
//        ML inputs: telematics history, service history, driving scores, CAN bus
//        ML outputs: component scores + predictions
//
// Predictions:
// GET    /api/fleetpoint/maintenance/predictions      — all active predictions
// GET    /api/fleetpoint/maintenance/predictions/:vehicleId — per vehicle
// POST   /api/fleetpoint/work-orders/from-prediction/:predictionId — raise WO from prediction
//
// Maintenance Log:
// GET    /api/fleetpoint/maintenance/log              — completed service history
// GET    /api/fleetpoint/maintenance/log/:vehicleId   — per vehicle history
//
// Schedule:
// GET    /api/fleetpoint/maintenance/schedule         — upcoming services (next 90 days)
// POST   /api/fleetpoint/maintenance/schedule         — create scheduled service
//
// ─── ML MICROSERVICE NOTES ───────────────────────────────────────────────────
//
// The predictive maintenance ML model is a separate Python/FastAPI microservice
// It should be called by the backend — NOT directly from frontend
//
// ML Model inputs per vehicle:
// - Current mileage + mileage rate (km/day avg from telematics)
// - Last service date + mileage for each component
// - Manufacturer service intervals (from vehicle model config table)
// - Driving behaviour score (harsh braking → accelerated brake wear)
// - CAN bus data if available: fault codes, oil pressure, coolant temp,
//   battery voltage, tyre pressure sensors
// - Historical failure patterns (learned from fleet-wide data)
//
// ML Model outputs:
// - Health score 0-100 per component
// - Predicted days until maintenance needed (with confidence interval)
// - Recommended action: monitor/schedule/urgent/critical
//
// CAN Bus integration:
// - CAN bus data arrives via MQTT or direct socket from vehicle gateway
// - Parser microservice decodes OBD-II PIDs into readable values
// - Fault codes (DTCs) trigger immediate maintenance alerts
// TODO: Build CAN bus parser microservice (Python)
// TODO: Map OBD-II PID list to readable maintenance triggers
// ─────────────────────────────────────────────────────────────────────────────

export type WorkOrderStatus =
  | 'raised'
  | 'assigned'
  | 'accepted'
  | 'diagnosing'
  | 'awaiting-parts'
  | 'in-progress'
  | 'quality-check'
  | 'completed'
  | 'cancelled'

export type WorkOrderType = 'scheduled' | 'corrective' | 'predictive' | 'driver-reported'
export type WorkOrderPriority = 'critical' | 'high' | 'normal' | 'low'
export type MaintenanceUrgency = 'critical' | 'high' | 'medium' | 'low'

export interface Workshop {
  id: string
  name: string
  type: 'internal' | 'vendor'
  location: string
  address: string
  lat: number
  lng: number
  phone: string
  email: string
  specialisations: string[]
  capacity: number
  currentLoad: number
  active: boolean
  ownerId: string
  ownerName: string
}

export interface WorkOrderTimelineEntry {
  status: WorkOrderStatus
  note: string
  by: string
  at: string
}

export interface WorkOrderPart {
  name: string
  quantity: number
  unitCost: number
}

export interface WorkOrder {
  id: string
  vehicleId: string
  vehiclePlate: string
  vehicleMake: string
  driverId: string
  driverName: string
  workshopId: string
  workshopName: string
  type: WorkOrderType
  status: WorkOrderStatus
  priority: WorkOrderPriority
  serviceType: string
  description: string
  diagnosis: string
  estimatedCost: number
  actualCost: number
  estimatedCompletionDate: string
  actualCompletionDate: string
  mileageAtService: number
  nextServiceMileage: number
  nextServiceDate: string
  parts: WorkOrderPart[]
  timeline: WorkOrderTimelineEntry[]
  raisedBy: string
  createdAt: string
  // Predictive link
  // TODO: if raisedFromPredictionId is set, show prediction context
  raisedFromPredictionId?: string
}

export interface VehicleHealthScore {
  vehicleId: string
  vehiclePlate: string
  vehicleMake: string
  // Overall health 0-100
  // TODO: calculated by ML microservice
  // POST /api/ml/vehicle-health/:vehicleId/recalculate
  overallScore: number
  engineScore: number
  brakeScore: number
  tyreScore: number
  batteryScore: number
  transmissionScore: number
  lastCalculatedAt: string
  // CAN bus live data — nullable if no CAN bus device
  // TODO: parse from MQTT stream via CAN bus parser microservice
  canBusFaultCodes: string[]
  oilPressure?: number
  coolantTemp?: number
  batteryVoltage?: number
  tyrePressureFl?: number
  tyrePressureFr?: number
  tyrePressureRl?: number
  tyrePressureRr?: number
}

export interface MaintenancePrediction {
  id: string
  vehicleId: string
  vehiclePlate: string
  component: string
  predictedFailureDate: string
  daysUntilFailure: number
  confidence: number
  urgency: MaintenanceUrgency
  reasoning: string
  // Data points used by ML model
  // TODO: populated by ML microservice
  dataPoints: {
    mileageSinceLastService?: number
    drivingBehaviourScore?: number
    canBusFaultCode?: string
    daysSinceLastService?: number
  }
  actionRequired: string
  estimatedCost: number
  workOrderRaised: boolean
}

// ─── DUMMY DATA ───────────────────────────────────────────────────────────────

export const workshops: Workshop[] = [
  {
    id: 'WS001',
    name: 'Stratford Internal Workshop',
    type: 'internal',
    location: 'London',
    address: 'Stratford Logistics Park, London E15 2NW',
    lat: 51.5400, lng: -0.0800,
    phone: '+44 20 7946 0100',
    email: 'workshop@logisticspro.co.uk',
    specialisations: ['HGV Service', 'Tyres', 'Brake Systems', 'Electrical'],
    capacity: 6, currentLoad: 3,
    active: true, ownerId: 'U001', ownerName: 'Ali Mujtaba',
  },
  {
    id: 'WS002',
    name: 'Volvo Truck Centre — Dartford',
    type: 'vendor',
    location: 'Kent',
    address: 'Volvo Truck Centre, Thames Road, Dartford DA1 5NL',
    lat: 51.4400, lng: 0.2200,
    phone: '+44 1322 287000',
    email: 'service@dartford.volvo.com',
    specialisations: ['Volvo FH', 'Volvo FM', 'Warranty Work', 'Engine Diagnostics'],
    capacity: 12, currentLoad: 7,
    active: true, ownerId: '', ownerName: 'Volvo Trucks UK',
  },
  {
    id: 'WS003',
    name: 'DAF Trucks Manchester',
    type: 'vendor',
    location: 'Manchester',
    address: 'DAF Trucks, Trafford Park, Manchester M17 1EH',
    lat: 53.4650, lng: -2.2900,
    phone: '+44 161 872 3000',
    email: 'service@manchester.daf.com',
    specialisations: ['DAF XF', 'DAF CF', 'Transmission', 'Tachograph'],
    capacity: 8, currentLoad: 4,
    active: true, ownerId: '', ownerName: 'DAF Trucks UK',
  },
  {
    id: 'WS004',
    name: 'Mercedes-Benz Vans Birmingham',
    type: 'vendor',
    location: 'Birmingham',
    address: 'Mercedes-Benz Vans, Aston, Birmingham B6 7SY',
    lat: 52.5000, lng: -1.8700,
    phone: '+44 121 523 4000',
    email: 'vans@mercedes-birmingham.co.uk',
    specialisations: ['Sprinter', 'Vito', 'Transit Van', 'Electric Vans'],
    capacity: 10, currentLoad: 5,
    active: true, ownerId: '', ownerName: 'Mercedes-Benz UK',
  },
]

export const workOrders: WorkOrder[] = [
  {
    id: 'WO001',
    vehicleId: 'V004', vehiclePlate: 'LP-9901', vehicleMake: 'Volvo FH',
    driverId: 'D005', driverName: 'Connor McBride',
    workshopId: 'WS002', workshopName: 'Volvo Truck Centre — Dartford',
    type: 'corrective', status: 'in-progress',
    priority: 'critical',
    serviceType: 'Full Inspection + Device Fault',
    description: 'Vehicle offline 47 mins — GPS device fault + full inspection required',
    diagnosis: 'GPS tracker firmware corrupted. Engine mounts worn. Brake pads at 18%.',
    estimatedCost: 1240, actualCost: 0,
    estimatedCompletionDate: '2026-05-22',
    actualCompletionDate: '',
    mileageAtService: 312800,
    nextServiceMileage: 322800,
    nextServiceDate: '2026-08-22',
    parts: [
      { name: 'BSJIOT TR3120 GPS Tracker', quantity: 1, unitCost: 180 },
      { name: 'Engine Mount Set', quantity: 1, unitCost: 320 },
      { name: 'Brake Pad Set (Front)', quantity: 1, unitCost: 145 },
    ],
    timeline: [
      { status: 'raised', note: 'Vehicle offline alert triggered auto work order', by: 'System', at: '2026-05-21T08:00:00' },
      { status: 'assigned', note: 'Assigned to Volvo Dartford — nearest authorised centre', by: 'Ali Mujtaba', at: '2026-05-21T08:15:00' },
      { status: 'accepted', note: 'Workshop confirmed slot at 14:00 today', by: 'Volvo Dartford', at: '2026-05-21T09:00:00' },
      { status: 'in-progress', note: 'Vehicle received, inspection started', by: 'Volvo Dartford', at: '2026-05-21T14:15:00' },
    ],
    raisedBy: 'System (Auto)',
    createdAt: '2026-05-21T08:00:00',
  },
  {
    id: 'WO002',
    vehicleId: 'V003', vehiclePlate: 'LP-7734', vehicleMake: 'DAF XF',
    driverId: 'D003', driverName: 'Mohammed Al-Rashid',
    workshopId: 'WS001', workshopName: 'Stratford Internal Workshop',
    type: 'scheduled', status: 'raised',
    priority: 'high',
    serviceType: 'Full Service + MOT Prep',
    description: 'MOT due 2025-07-08 — overdue. Full service + MOT preparation required.',
    diagnosis: '',
    estimatedCost: 680, actualCost: 0,
    estimatedCompletionDate: '2026-05-23',
    actualCompletionDate: '',
    mileageAtService: 201500,
    nextServiceMileage: 211500,
    nextServiceDate: '2026-08-23',
    parts: [],
    timeline: [
      { status: 'raised', note: 'MOT overdue alert — auto work order raised', by: 'System', at: '2026-05-21T06:00:00' },
    ],
    raisedBy: 'System (Auto)',
    createdAt: '2026-05-21T06:00:00',
  },
  {
    id: 'WO003',
    vehicleId: 'V006', vehiclePlate: 'LP-0392', vehicleMake: 'Volvo FH Reefer',
    driverId: '', driverName: 'Unassigned',
    workshopId: 'WS002', workshopName: 'Volvo Truck Centre — Dartford',
    type: 'predictive', status: 'assigned',
    priority: 'critical',
    serviceType: 'Temperature Sensor Calibration + Reefer Unit',
    description: 'Temp sensor reporting 12.4°C — cold chain breach. Predictive model flagged reefer unit degradation.',
    diagnosis: '',
    estimatedCost: 890, actualCost: 0,
    estimatedCompletionDate: '2026-05-22',
    actualCompletionDate: '',
    mileageAtService: 41200,
    nextServiceMileage: 51200,
    nextServiceDate: '',
    parts: [
      { name: 'RuuviTag Pro Temp Sensor', quantity: 2, unitCost: 89 },
    ],
    timeline: [
      { status: 'raised', note: 'Cold chain breach detected — ML model predicted reefer failure within 7 days', by: 'System (ML)', at: '2026-05-21T03:00:00' },
      { status: 'assigned', note: 'Assigned to Volvo Dartford for reefer specialist', by: 'Ali Mujtaba', at: '2026-05-21T08:30:00' },
    ],
    raisedBy: 'System (ML Prediction)',
    createdAt: '2026-05-21T03:00:00',
    raisedFromPredictionId: 'PRED003',
  },
  {
    id: 'WO004',
    vehicleId: 'V001', vehiclePlate: 'LP-4821', vehicleMake: 'Volvo FH',
    driverId: 'D001', driverName: 'James Hartley',
    workshopId: 'WS001', workshopName: 'Stratford Internal Workshop',
    type: 'scheduled', status: 'completed',
    priority: 'normal',
    serviceType: 'Oil Change + Filter',
    description: 'Routine oil change — 10,000 mile interval',
    diagnosis: 'Oil degraded — replaced. Air filter also replaced as preventive measure.',
    estimatedCost: 280, actualCost: 310,
    estimatedCompletionDate: '2026-05-18',
    actualCompletionDate: '2026-05-18',
    mileageAtService: 138200,
    nextServiceMileage: 148200,
    nextServiceDate: '2026-08-18',
    parts: [
      { name: 'Volvo Engine Oil 10W-40 (20L)', quantity: 2, unitCost: 65 },
      { name: 'Oil Filter', quantity: 1, unitCost: 28 },
      { name: 'Air Filter', quantity: 1, unitCost: 42 },
    ],
    timeline: [
      { status: 'raised', note: '10,000 mile service due', by: 'System', at: '2026-05-15T09:00:00' },
      { status: 'assigned', note: 'Booked into Stratford internal workshop', by: 'Ali Mujtaba', at: '2026-05-15T09:30:00' },
      { status: 'accepted', note: 'Slot confirmed 18 May 08:00', by: 'Stratford Workshop', at: '2026-05-15T10:00:00' },
      { status: 'in-progress', note: 'Service started', by: 'Stratford Workshop', at: '2026-05-18T08:00:00' },
      { status: 'quality-check', note: 'Service complete, road test passed', by: 'Stratford Workshop', at: '2026-05-18T11:30:00' },
      { status: 'completed', note: 'Vehicle returned to fleet. Next service 148,200 miles.', by: 'Stratford Workshop', at: '2026-05-18T12:00:00' },
    ],
    raisedBy: 'System (Auto)',
    createdAt: '2026-05-15T09:00:00',
  },
  {
    id: 'WO005',
    vehicleId: 'V008', vehiclePlate: 'LP-5531', vehicleMake: 'Mercedes Sprinter',
    driverId: 'D006', driverName: 'Priya Sharma',
    workshopId: 'WS004', workshopName: 'Mercedes-Benz Vans Birmingham',
    type: 'driver-reported', status: 'diagnosing',
    priority: 'high',
    serviceType: 'Steering Investigation',
    description: 'Driver reported: steering wheel vibration at 50mph+. Possible wheel balance or steering rack issue.',
    diagnosis: 'Wheel balance on all 4 wheels required. Front nearside tyre showing abnormal wear.',
    estimatedCost: 420, actualCost: 0,
    estimatedCompletionDate: '2026-05-22',
    actualCompletionDate: '',
    mileageAtService: 88900,
    nextServiceMileage: 93900,
    nextServiceDate: '',
    parts: [
      { name: 'Front Nearside Tyre 225/75 R16C', quantity: 1, unitCost: 145 },
    ],
    timeline: [
      { status: 'raised', note: 'Driver reported steering vibration via mobile app', by: 'Priya Sharma (Driver App)', at: '2026-05-20T17:30:00' },
      { status: 'assigned', note: 'Assigned to Mercedes Birmingham — Sprinter specialist', by: 'Sarah Whitfield', at: '2026-05-20T18:00:00' },
      { status: 'accepted', note: 'Workshop confirmed drop-off 21 May morning', by: 'Mercedes Birmingham', at: '2026-05-20T18:30:00' },
      { status: 'diagnosing', note: 'Vehicle on ramp — diagnostics in progress', by: 'Mercedes Birmingham', at: '2026-05-21T09:00:00' },
    ],
    raisedBy: 'Priya Sharma',
    createdAt: '2026-05-20T17:30:00',
  },
]

export const vehicleHealthScores: VehicleHealthScore[] = [
  // NOTE: These scores are dummy data
  // In production: calculated by ML microservice
  // POST /api/ml/vehicle-health/:vehicleId/recalculate
  // Triggered on: telematics ping, completed work order, CAN bus fault
  {
    vehicleId: 'V001', vehiclePlate: 'LP-4821', vehicleMake: 'Volvo FH',
    overallScore: 82, engineScore: 88, brakeScore: 91, tyreScore: 78,
    batteryScore: 85, transmissionScore: 84,
    lastCalculatedAt: '2026-05-21T10:00:00',
    canBusFaultCodes: [],
    oilPressure: 4.2, coolantTemp: 88, batteryVoltage: 27.8,
    tyrePressureFl: 7.8, tyrePressureFr: 7.9, tyrePressureRl: 8.1, tyrePressureRr: 7.7,
  },
  {
    vehicleId: 'V002', vehiclePlate: 'LP-3312', vehicleMake: 'DAF XF',
    overallScore: 91, engineScore: 94, brakeScore: 88, tyreScore: 92,
    batteryScore: 90, transmissionScore: 91,
    lastCalculatedAt: '2026-05-21T10:00:00',
    canBusFaultCodes: [],
    oilPressure: 4.5, coolantTemp: 85, batteryVoltage: 28.1,
    tyrePressureFl: 8.0, tyrePressureFr: 8.0, tyrePressureRl: 8.2, tyrePressureRr: 8.1,
  },
  {
    vehicleId: 'V003', vehiclePlate: 'LP-7734', vehicleMake: 'DAF XF',
    overallScore: 58, engineScore: 62, brakeScore: 71, tyreScore: 55,
    batteryScore: 48, transmissionScore: 60,
    lastCalculatedAt: '2026-05-21T10:00:00',
    canBusFaultCodes: ['P0171', 'P0300'],
    // P0171 = System Too Lean (Bank 1) — fuel/air mixture issue
    // P0300 = Random/Multiple Cylinder Misfire Detected
    oilPressure: 3.1, coolantTemp: 97, batteryVoltage: 24.2,
    tyrePressureFl: 6.8, tyrePressureFr: 7.1, tyrePressureRl: 6.9, tyrePressureRr: 7.0,
  },
  {
    vehicleId: 'V004', vehiclePlate: 'LP-9901', vehicleMake: 'Volvo FH',
    overallScore: 31, engineScore: 45, brakeScore: 28, tyreScore: 38,
    batteryScore: 22, transmissionScore: 41,
    lastCalculatedAt: '2026-05-21T10:00:00',
    canBusFaultCodes: ['P0562', 'C0035', 'U0100'],
    // P0562 = System Voltage Low
    // C0035 = Left Front Wheel Speed Sensor Circuit
    // U0100 = Lost Communication With ECM/PCM
    oilPressure: 2.4, coolantTemp: 102, batteryVoltage: 21.8,
    tyrePressureFl: 5.9, tyrePressureFr: 6.1, tyrePressureRl: 5.8, tyrePressureRr: 6.0,
  },
  {
    vehicleId: 'V005', vehiclePlate: 'LP-6612', vehicleMake: 'Volvo FH Reefer',
    overallScore: 87, engineScore: 91, brakeScore: 89, tyreScore: 88,
    batteryScore: 86, transmissionScore: 90,
    lastCalculatedAt: '2026-05-21T10:00:00',
    canBusFaultCodes: [],
    oilPressure: 4.4, coolantTemp: 87, batteryVoltage: 27.9,
    tyrePressureFl: 8.0, tyrePressureFr: 8.1, tyrePressureRl: 8.0, tyrePressureRr: 8.2,
  },
  {
    vehicleId: 'V006', vehiclePlate: 'LP-0392', vehicleMake: 'Volvo FH Reefer',
    overallScore: 64, engineScore: 78, brakeScore: 82, tyreScore: 75,
    batteryScore: 71, transmissionScore: 80,
    lastCalculatedAt: '2026-05-21T10:00:00',
    canBusFaultCodes: ['B1234'],
    // B1234 = Refrigeration Unit Sensor Fault (custom code)
    oilPressure: 4.1, coolantTemp: 89, batteryVoltage: 26.8,
    tyrePressureFl: 7.8, tyrePressureFr: 7.9, tyrePressureRl: 7.8, tyrePressureRr: 7.9,
  },
  {
    vehicleId: 'V007', vehiclePlate: 'LP-2244', vehicleMake: 'Mercedes Sprinter',
    overallScore: 93, engineScore: 95, brakeScore: 94, tyreScore: 91,
    batteryScore: 92, transmissionScore: 93,
    lastCalculatedAt: '2026-05-21T10:00:00',
    canBusFaultCodes: [],
    batteryVoltage: 13.8,
    tyrePressureFl: 3.2, tyrePressureFr: 3.2, tyrePressureRl: 3.3, tyrePressureRr: 3.3,
  },
  {
    vehicleId: 'V008', vehiclePlate: 'LP-5531', vehicleMake: 'Mercedes Sprinter',
    overallScore: 71, engineScore: 79, brakeScore: 74, tyreScore: 62,
    batteryScore: 81, transmissionScore: 78,
    lastCalculatedAt: '2026-05-21T10:00:00',
    canBusFaultCodes: ['C1234'],
    // C1234 = Wheel Speed Sensor — abnormal wear pattern detected
    batteryVoltage: 13.6,
    tyrePressureFl: 2.8, tyrePressureFr: 2.9, tyrePressureRl: 3.1, tyrePressureRr: 3.0,
  },
]

export const maintenancePredictions: MaintenancePrediction[] = [
  // NOTE: All predictions are dummy data
  // In production: generated by ML microservice
  // ML model runs on Python/FastAPI, called by backend
  // Frontend consumes via GET /api/fleetpoint/maintenance/predictions
  {
    id: 'PRED001',
    vehicleId: 'V004', vehiclePlate: 'LP-9901',
    component: 'Brake System',
    predictedFailureDate: '2026-06-02',
    daysUntilFailure: 12,
    confidence: 91,
    urgency: 'critical',
    reasoning: 'Brake pads at 18% remaining. Connor McBride has 18 harsh braking violations this month — 3x fleet average. CAN bus fault C0035 (wheel speed sensor) detected. Estimated failure within 12 days.',
    dataPoints: {
      mileageSinceLastService: 28400,
      drivingBehaviourScore: 72,
      canBusFaultCode: 'C0035',
      daysSinceLastService: 142,
    },
    actionRequired: 'Replace brake pads immediately. Inspect rotors. Investigate C0035 fault.',
    estimatedCost: 420,
    workOrderRaised: true,
  },
  {
    id: 'PRED002',
    vehicleId: 'V003', vehiclePlate: 'LP-7734',
    component: 'Engine',
    predictedFailureDate: '2026-06-08',
    daysUntilFailure: 18,
    confidence: 84,
    urgency: 'critical',
    reasoning: 'CAN bus fault P0171 (lean mixture) and P0300 (cylinder misfire) active. Coolant temperature 97°C — above normal range. Oil pressure 3.1 bar — low. MOT overdue by 43 days. Immediate attention required.',
    dataPoints: {
      mileageSinceLastService: 42800,
      drivingBehaviourScore: 91,
      canBusFaultCode: 'P0171, P0300',
      daysSinceLastService: 198,
    },
    actionRequired: 'Urgent: investigate engine fault codes. Check fuel injectors. Possible head gasket issue. Do not dispatch until inspected.',
    estimatedCost: 1800,
    workOrderRaised: true,
  },
  {
    id: 'PRED003',
    vehicleId: 'V006', vehiclePlate: 'LP-0392',
    component: 'Reefer Unit + Temperature Sensor',
    predictedFailureDate: '2026-05-28',
    daysUntilFailure: 7,
    confidence: 96,
    urgency: 'critical',
    reasoning: 'Temperature sensor reporting 12.4°C vs 4°C limit — cold chain breach active. CAN bus code B1234 (reefer sensor fault). Battery voltage 26.8V — reefer compressor drawing excess current. Reefer unit predicted to fail within 7 days.',
    dataPoints: {
      mileageSinceLastService: 12400,
      drivingBehaviourScore: 83,
      canBusFaultCode: 'B1234',
      daysSinceLastService: 45,
    },
    actionRequired: 'Critical: Cold chain at risk. Replace temperature sensor. Full reefer unit inspection. Do not load temperature-sensitive cargo.',
    estimatedCost: 890,
    workOrderRaised: true,
  },
  {
    id: 'PRED004',
    vehicleId: 'V008', vehiclePlate: 'LP-5531',
    component: 'Tyres + Wheel Alignment',
    predictedFailureDate: '2026-06-15',
    daysUntilFailure: 25,
    confidence: 78,
    urgency: 'high',
    reasoning: 'Driver reported steering vibration. CAN bus C1234 (wheel speed sensor abnormal wear). Front nearside tyre pressure 2.8 bar vs 3.2 recommended. Abnormal wear pattern suggests wheel alignment issue.',
    dataPoints: {
      mileageSinceLastService: 18400,
      drivingBehaviourScore: 89,
      canBusFaultCode: 'C1234',
      daysSinceLastService: 88,
    },
    actionRequired: 'Replace front nearside tyre. Full wheel alignment. Inspect steering rack.',
    estimatedCost: 420,
    workOrderRaised: true,
  },
  {
    id: 'PRED005',
    vehicleId: 'V001', vehiclePlate: 'LP-4821',
    component: 'Tyres',
    predictedFailureDate: '2026-07-10',
    daysUntilFailure: 50,
    confidence: 72,
    urgency: 'medium',
    reasoning: 'Rear tyre tread approaching minimum legal limit based on mileage rate (avg 180 miles/day). Tyre pressure slightly low at 7.7/8.1 bar front/rear. James Hartley speeding violation today may accelerate tyre wear.',
    dataPoints: {
      mileageSinceLastService: 8200,
      drivingBehaviourScore: 94,
      daysSinceLastService: 3,
    },
    actionRequired: 'Monitor tyre pressure weekly. Schedule tyre replacement within 50 days.',
    estimatedCost: 580,
    workOrderRaised: false,
  },
  {
    id: 'PRED006',
    vehicleId: 'V015', vehiclePlate: 'LP-7712',
    component: 'Full Service',
    predictedFailureDate: '2026-06-01',
    daysUntilFailure: 11,
    confidence: 95,
    urgency: 'high',
    reasoning: 'Next service overdue by 12 days based on mileage interval. Fuel level at 39% — possible fuel contamination risk if vehicle sits idle. Last service 92,100 miles — 10,000 mile interval exceeded.',
    dataPoints: {
      mileageSinceLastService: 12100,
      drivingBehaviourScore: 0,
      daysSinceLastService: 168,
    },
    actionRequired: 'Schedule full service immediately. Oil + filter + brake inspection.',
    estimatedCost: 380,
    workOrderRaised: false,
  },
]

// ─── DASHCAM EVENTS DATA ──────────────────────────────────────────────────────
// DEVELOPER NOTES:
// ─────────────────────────────────────────────────────────────────────────────
// ARCHITECTURE:
// BSJ IOT cameras send events via their cloud API/MQTT
// IoTility backend adapter maps BSJ device_id → vehicleId → driverId
// Backend enriches events with: job context, route context, score impact
// Frontend receives pre-enriched events — no direct BSJ API calls
//
// VIDEO FILES:
// Upload dashcam footage to: public/videos/dashcam/events/
// Naming convention: {eventId}_{camera}.mp4
// Cameras: front, rear, cabin, side
// Example: EVT001_front.mp4, EVT001_cabin.mp4
// When files exist in public/videos/dashcam/events/ they auto-play in demo
// Live feed files: public/videos/dashcam/live/{vehiclePlate}_{camera}.mp4
// Example: LP-4821_front.mp4, LP-4821_cabin.mp4
//
// DB Schema:
// Table: dashcam_events
//   id, deviceId (BSJ device ID), vehicleId FK, driverId FK
//   jobId FK (nullable), routeRunId FK (nullable)
//   category: 'safety-critical'|'fatigue'|'distraction'|'driving-style'|'identity'|'camera'
//   eventType: string (Forward Collision, Closed Eyes, etc.)
//   severity: 'critical'|'warning'|'info'
//   timestamp, lat, lng, speedKph
//   thumbnailUrls: string[] (BSJ CDN or local /videos/dashcam/events/)
//   videoUrls: JSON { front, rear, cabin, side } (nullable per camera)
//   reviewStatus: 'unreviewed'|'acknowledged'|'violation'|'false-positive'
//   reviewedBy: userId FK, reviewedAt: timestamp
//   reviewNote: string
//   scoreImpact: number (negative points deducted from driver safety score)
//   createdAt: timestamp
//
// API endpoints:
// GET    /api/fleetpoint/dashcam/events              — list (paginated, filterable)
// GET    /api/fleetpoint/dashcam/events/:id          — single event detail
// PATCH  /api/fleetpoint/dashcam/events/:id/review   — review event
// GET    /api/fleetpoint/dashcam/live/:vehicleId      — live stream URLs
// GET    /api/fleetpoint/dashcam/analytics            — event analytics
//
// BSJ IOT Integration (backend adapter service):
// GET  https://bsj-api.com/v1/events                 — fetch raw events
// GET  https://bsj-api.com/v1/devices/:id/stream     — live RTSP/HLS stream URL
// GET  https://bsj-api.com/v1/events/:id/playback    — recorded video URL
// POST https://bsj-api.com/v1/devices/:id/command    — capture photo / speak to driver
// TODO: Build BSJ IOT adapter service (Node.js/TypeScript)
//       Map BSJ device IDs to IoTility vehicleId/driverId
//       Normalise BSJ event types → IoTility categories
//       Store enriched events in IoTility DB
//
// WebSocket events (real-time):
// WS /api/fleetpoint/live-positions emits:
//   { type: 'dashcam-event', eventId, vehicleId, driverId, category, severity }
// Frontend shows toast + updates event counter on sidebar badge
// ─────────────────────────────────────────────────────────────────────────────

export type DashcamEventCategory =
  | 'safety-critical'
  | 'fatigue'
  | 'distraction'
  | 'driving-style'
  | 'identity'
  | 'camera'

export type DashcamEventSeverity = 'critical' | 'warning' | 'info'
export type DashcamReviewStatus = 'unreviewed' | 'acknowledged' | 'violation' | 'false-positive'

export interface DashcamEvent {
  id: string
  // BSJ IOT device ID — maps to vehicleId via adapter service
  // TODO: adapter service maps this to vehicleId/driverId
  bsjDeviceId: string
  vehicleId: string
  vehiclePlate: string
  driverId: string
  driverName: string
  fleetId: string
  fleetName: string
  // Context — enriched by backend adapter
  jobId: string       // empty if not on a job
  jobName: string
  routeRunId: string  // empty if not on a route
  routeName: string
  // Event details
  category: DashcamEventCategory
  eventType: string
  severity: DashcamEventSeverity
  timestamp: string
  lat: number
  lng: number
  speedKph: number
  location: string
  // Video files
  // Naming: public/videos/dashcam/events/{id}_{camera}.mp4
  // Upload files here for demo to work automatically
  videoFiles: {
    front: string   // e.g. /videos/dashcam/events/EVT001_front.mp4
    rear: string
    cabin: string
    side: string
  }
  // Review workflow
  reviewStatus: DashcamReviewStatus
  reviewedBy: string
  reviewedAt: string
  reviewNote: string
  // Driver score impact — calculated by backend
  // TODO: PATCH /api/fleetpoint/drivers/:id/score after review
  scoreImpact: number
}

export const dashcamEvents: DashcamEvent[] = [
  {
    id: 'EVT001',
    bsjDeviceId: 'DR03_LP4821',
    vehicleId: 'V001', vehiclePlate: 'LP-4821',
    driverId: 'D001', driverName: 'James Hartley',
    fleetId: 'F001', fleetName: 'London HGV',
    jobId: 'JOB001', jobName: 'Amazon BHX2 Morning Delivery',
    routeRunId: 'RR001', routeName: 'London → Birmingham Express',
    category: 'safety-critical',
    eventType: 'Forward Collision Warning',
    severity: 'critical',
    timestamp: '2026-05-21T07:34:22',
    lat: 51.8200, lng: -1.1400,
    speedKph: 98, location: 'M40 Northbound, Oxfordshire',
    videoFiles: {
      front: '/videos/dashcam/events/EVT001_front.mp4',
      rear:  '/videos/dashcam/events/EVT001_rear.mp4',
      cabin: '/videos/dashcam/events/EVT001_cabin.mp4',
      side:  '/videos/dashcam/events/EVT001_side.mp4',
    },
    reviewStatus: 'unreviewed',
    reviewedBy: '', reviewedAt: '', reviewNote: '',
    scoreImpact: -12,
  },
  {
    id: 'EVT002',
    bsjDeviceId: 'DR03_LP4821',
    vehicleId: 'V001', vehiclePlate: 'LP-4821',
    driverId: 'D001', driverName: 'James Hartley',
    fleetId: 'F001', fleetName: 'London HGV',
    jobId: 'JOB001', jobName: 'Amazon BHX2 Morning Delivery',
    routeRunId: 'RR001', routeName: 'London → Birmingham Express',
    category: 'driving-style',
    eventType: 'Speeding',
    severity: 'warning',
    timestamp: '2026-05-21T07:18:45',
    lat: 51.7500, lng: -1.0800,
    speedKph: 119, location: 'M40 Northbound, Junction 8',
    videoFiles: {
      front: '/videos/dashcam/events/EVT002_front.mp4',
      rear:  '/videos/dashcam/events/EVT002_rear.mp4',
      cabin: '/videos/dashcam/events/EVT002_cabin.mp4',
      side:  '/videos/dashcam/events/EVT002_side.mp4',
    },
    reviewStatus: 'acknowledged',
    reviewedBy: 'Ali Mujtaba', reviewedAt: '2026-05-21T09:00:00',
    reviewNote: 'Warned driver. Monitoring.',
    scoreImpact: -8,
  },
  {
    id: 'EVT003',
    bsjDeviceId: 'MR01_LP9901',
    vehicleId: 'V004', vehiclePlate: 'LP-9901',
    driverId: 'D005', driverName: 'Connor McBride',
    fleetId: 'F001', fleetName: 'London HGV',
    jobId: '', jobName: '',
    routeRunId: '', routeName: '',
    category: 'fatigue',
    eventType: 'Closed Eyes Detected',
    severity: 'critical',
    timestamp: '2026-05-21T06:48:12',
    lat: 51.5800, lng: -0.1200,
    speedKph: 64, location: 'A1(M) Southbound, London',
    videoFiles: {
      front: '/videos/dashcam/events/EVT003_front.mp4',
      rear:  '/videos/dashcam/events/EVT003_rear.mp4',
      cabin: '/videos/dashcam/events/EVT003_cabin.mp4',
      side:  '/videos/dashcam/events/EVT003_side.mp4',
    },
    reviewStatus: 'violation',
    reviewedBy: 'Ali Mujtaba', reviewedAt: '2026-05-21T08:30:00',
    reviewNote: 'Fatigue event — violation raised. Driver counselled. Mandatory rest enforced.',
    scoreImpact: -18,
  },
  {
    id: 'EVT004',
    bsjDeviceId: 'MR01_LP9901',
    vehicleId: 'V004', vehiclePlate: 'LP-9901',
    driverId: 'D005', driverName: 'Connor McBride',
    fleetId: 'F001', fleetName: 'London HGV',
    jobId: '', jobName: '',
    routeRunId: '', routeName: '',
    category: 'distraction',
    eventType: 'Phone Use While Driving',
    severity: 'critical',
    timestamp: '2026-05-21T06:52:33',
    lat: 51.5700, lng: -0.1100,
    speedKph: 58, location: 'A1(M) Southbound, Finchley',
    videoFiles: {
      front: '/videos/dashcam/events/EVT004_front.mp4',
      rear:  '/videos/dashcam/events/EVT004_rear.mp4',
      cabin: '/videos/dashcam/events/EVT004_cabin.mp4',
      side:  '/videos/dashcam/events/EVT004_side.mp4',
    },
    reviewStatus: 'violation',
    reviewedBy: 'Ali Mujtaba', reviewedAt: '2026-05-21T08:31:00',
    reviewNote: 'Phone use confirmed from cabin footage. Formal warning issued.',
    scoreImpact: -20,
  },
  {
    id: 'EVT005',
    bsjDeviceId: 'EG03_LP3312',
    vehicleId: 'V002', vehiclePlate: 'LP-3312',
    driverId: 'D002', driverName: 'Oliver Pemberton',
    fleetId: 'F001', fleetName: 'London HGV',
    jobId: 'JOB002', jobName: 'Tesco RDC Scheduled Delivery',
    routeRunId: '', routeName: '',
    category: 'driving-style',
    eventType: 'Harsh Braking',
    severity: 'warning',
    timestamp: '2026-05-21T09:14:08',
    lat: 52.2500, lng: -1.1400,
    speedKph: 72, location: 'M45 Junction, Northamptonshire',
    videoFiles: {
      front: '/videos/dashcam/events/EVT005_front.mp4',
      rear:  '/videos/dashcam/events/EVT005_rear.mp4',
      cabin: '/videos/dashcam/events/EVT005_cabin.mp4',
      side:  '/videos/dashcam/events/EVT005_side.mp4',
    },
    reviewStatus: 'unreviewed',
    reviewedBy: '', reviewedAt: '', reviewNote: '',
    scoreImpact: -6,
  },
  {
    id: 'EVT006',
    bsjDeviceId: 'DR03_LP0392',
    vehicleId: 'V006', vehiclePlate: 'LP-0392',
    driverId: 'D007', driverName: 'Thomas Griffiths',
    fleetId: 'F002', fleetName: 'Cold Chain',
    jobId: 'JOB003', jobName: 'Cold Chain Manchester Collection',
    routeRunId: 'RR002', routeName: 'Cold Chain London to Tilbury',
    category: 'fatigue',
    eventType: 'Yawn Detected',
    severity: 'warning',
    timestamp: '2026-05-21T10:22:44',
    lat: 53.2100, lng: -1.3800,
    speedKph: 85, location: 'M1 Northbound, Nottinghamshire',
    videoFiles: {
      front: '/videos/dashcam/events/EVT006_front.mp4',
      rear:  '/videos/dashcam/events/EVT006_rear.mp4',
      cabin: '/videos/dashcam/events/EVT006_cabin.mp4',
      side:  '/videos/dashcam/events/EVT006_side.mp4',
    },
    reviewStatus: 'false-positive',
    reviewedBy: 'Sarah Whitfield', reviewedAt: '2026-05-21T11:00:00',
    reviewNote: 'Reviewed footage — driver was speaking, not yawning. False positive.',
    scoreImpact: 0,
  },
  {
    id: 'EVT007',
    bsjDeviceId: 'EG05_LP7734',
    vehicleId: 'V003', vehiclePlate: 'LP-7734',
    driverId: 'D003', driverName: 'Mohammed Al-Rashid',
    fleetId: 'F001', fleetName: 'London HGV',
    jobId: '', jobName: '',
    routeRunId: '', routeName: '',
    category: 'safety-critical',
    eventType: 'Road Departure Warning',
    severity: 'critical',
    timestamp: '2026-05-21T14:38:19',
    lat: 52.1800, lng: -0.9800,
    speedKph: 88, location: 'M40 Southbound, Bicester',
    videoFiles: {
      front: '/videos/dashcam/events/EVT007_front.mp4',
      rear:  '/videos/dashcam/events/EVT007_rear.mp4',
      cabin: '/videos/dashcam/events/EVT007_cabin.mp4',
      side:  '/videos/dashcam/events/EVT007_side.mp4',
    },
    reviewStatus: 'unreviewed',
    reviewedBy: '', reviewedAt: '', reviewNote: '',
    scoreImpact: -15,
  },
  {
    id: 'EVT008',
    bsjDeviceId: 'DR03_LP2244',
    vehicleId: 'V007', vehiclePlate: 'LP-2244',
    driverId: 'D004', driverName: 'Sarah Whitfield',
    fleetId: 'F003', fleetName: 'Manchester Vans',
    jobId: '', jobName: '',
    routeRunId: 'RR003', routeName: 'Manchester Urban Van Loop',
    category: 'identity',
    eventType: 'Abnormal Driver ID',
    severity: 'warning',
    timestamp: '2026-05-21T08:02:11',
    lat: 53.4750, lng: -2.2500,
    speedKph: 0, location: 'Trafford Park, Manchester',
    videoFiles: {
      front: '/videos/dashcam/events/EVT008_front.mp4',
      rear:  '/videos/dashcam/events/EVT008_rear.mp4',
      cabin: '/videos/dashcam/events/EVT008_cabin.mp4',
      side:  '/videos/dashcam/events/EVT008_side.mp4',
    },
    reviewStatus: 'false-positive',
    reviewedBy: 'Sarah Whitfield', reviewedAt: '2026-05-21T08:30:00',
    reviewNote: 'RFID card reader delay at start of shift. Driver confirmed as Sarah Whitfield.',
    scoreImpact: 0,
  },
  {
    id: 'EVT009',
    bsjDeviceId: 'MR01_LP2201',
    vehicleId: 'V011', vehiclePlate: 'LP-2201',
    driverId: 'D008', driverName: 'Aisha Okonkwo',
    fleetId: 'F004', fleetName: 'Birmingham Ops',
    jobId: 'JOB004', jobName: 'Birmingham Ops Urban Delivery',
    routeRunId: '', routeName: '',
    category: 'driving-style',
    eventType: 'Harsh Acceleration',
    severity: 'info',
    timestamp: '2026-05-21T10:45:33',
    lat: 52.4860, lng: -1.8900,
    speedKph: 42, location: 'Digbeth, Birmingham',
    videoFiles: {
      front: '/videos/dashcam/events/EVT009_front.mp4',
      rear:  '/videos/dashcam/events/EVT009_rear.mp4',
      cabin: '/videos/dashcam/events/EVT009_cabin.mp4',
      side:  '/videos/dashcam/events/EVT009_side.mp4',
    },
    reviewStatus: 'acknowledged',
    reviewedBy: 'Ali Mujtaba', reviewedAt: '2026-05-21T12:00:00',
    reviewNote: 'Minor event. Driver score updated.',
    scoreImpact: -3,
  },
  {
    id: 'EVT010',
    bsjDeviceId: 'EG03_LP6612',
    vehicleId: 'V005', vehiclePlate: 'LP-6612',
    driverId: 'D007', driverName: 'Thomas Griffiths',
    fleetId: 'F002', fleetName: 'Cold Chain',
    jobId: 'JOB003', jobName: 'Cold Chain Manchester Collection',
    routeRunId: 'RR002', routeName: 'Cold Chain London to Tilbury',
    category: 'camera',
    eventType: 'Infrared Blocking Detected',
    severity: 'warning',
    timestamp: '2026-05-21T11:12:08',
    lat: 52.8500, lng: -1.1500,
    speedKph: 92, location: 'M1 Northbound, Leicestershire',
    videoFiles: {
      front: '/videos/dashcam/events/EVT010_front.mp4',
      rear:  '/videos/dashcam/events/EVT010_rear.mp4',
      cabin: '/videos/dashcam/events/EVT010_cabin.mp4',
      side:  '/videos/dashcam/events/EVT010_side.mp4',
    },
    reviewStatus: 'unreviewed',
    reviewedBy: '', reviewedAt: '', reviewNote: '',
    scoreImpact: -5,
  },
]

// ─── VIOLATIONS DATA ──────────────────────────────────────────────────────────
// DEVELOPER NOTES:
// ─────────────────────────────────────────────────────────────────────────────
// ARCHITECTURE — Violations come from THREE sources:
//
// Source 1: TELEMATICS (GPS/speed data — auto-generated)
//   Server checks GPS pings against configured thresholds
//   Thresholds stored in violation_config table per fleet/vehicle
//   TODO: Build threshold checker in telematics processing service
//   When GPS ping received: if speed > threshold → create violation record
//
// Source 2: DASHCAM (BSJ IOT AI events — auto-generated)
//   When fleet manager marks dashcam event as 'violation' in DashCam module
//   PATCH /api/fleetpoint/dashcam/events/:id/review → { status: 'violation' }
//   Backend auto-creates violation record linked to dashcam event
//   dashcamEventId FK links back to original footage
//
// Source 3: MANUAL (fleet manager raises)
//   POST /api/fleetpoint/violations with source: 'manual'
//   Used for: authority fines, licence issues, unauthorised use, reports
//
// DB Schema:
// Table: violations
//   id, vehicleId FK, driverId FK, fleetId FK
//   source: 'telematics' | 'dashcam' | 'manual'
//   type: string (Speeding, Harsh Braking, etc.)
//   category: 'speed' | 'behaviour' | 'safety' | 'compliance' | 'geozone'
//   severity: 'critical' | 'high' | 'medium' | 'low'
//   speedKph: number (0 if not speed related)
//   thresholdKph: number (configured limit that was exceeded)
//   lat, lng, location: string
//   description: string
//   dashcamEventId FK → dashcam_events.id (nullable)
//   fineAmount: number (0 if no fine)
//   fineCurrency: string (GBP default)
//   fineStatus: 'none' | 'pending' | 'paid' | 'disputed' | 'appealed'
//   fineDueDate: date (nullable)
//   reviewStatus: 'pending' | 'reviewed' | 'closed'
//   reviewedBy: userId FK, reviewNote: string
//   scoreImpact: number (negative points)
//   timestamp: datetime
//   createdAt: datetime
//
// Table: violation_config (thresholds per fleet)
//   id, fleetId FK (nullable = applies to all)
//   configKey: string (e.g. 'speed_alert_kph', 'speed_violation_kph')
//   configValue: number
//   active: boolean
//   NOTE: Fleet-level config overrides global config
//   TODO: Build config management UI in Configuration tab
//
// API endpoints:
// GET    /api/fleetpoint/violations                  — list (paginated, filterable)
// GET    /api/fleetpoint/violations/:id              — single violation
// POST   /api/fleetpoint/violations                  — create manual violation
// PATCH  /api/fleetpoint/violations/:id/review       — review + note
// PATCH  /api/fleetpoint/violations/:id/fine         — update fine status
// GET    /api/fleetpoint/violations/config            — get threshold config
// PUT    /api/fleetpoint/violations/config            — update threshold config
// GET    /api/fleetpoint/violations/export?format=pdf|xlsx — export
//
// WebSocket:
// Server emits { type: 'violation', violationId, vehicleId, driverId, severity }
// Frontend shows toast + increments sidebar badge
// ─────────────────────────────────────────────────────────────────────────────

export type ViolationSource = 'telematics' | 'dashcam' | 'manual'
export type ViolationCategory = 'speed' | 'behaviour' | 'safety' | 'compliance' | 'geozone'
export type ViolationSeverity = 'critical' | 'high' | 'medium' | 'low'
export type FineStatus = 'none' | 'pending' | 'paid' | 'disputed' | 'appealed'
export type ViolationReviewStatus = 'pending' | 'reviewed' | 'closed'

export interface Violation {
  id: string
  vehicleId: string
  vehiclePlate: string
  driverId: string
  driverName: string
  fleetId: string
  fleetName: string
  // Source — where did this violation come from?
  source: ViolationSource
  dashcamEventId: string  // links to DashCam footage if source = 'dashcam'
  // Violation details
  type: string
  category: ViolationCategory
  severity: ViolationSeverity
  speedKph: number
  thresholdKph: number  // configured threshold that was exceeded
  lat: number
  lng: number
  location: string
  description: string
  // Fine management
  fineAmount: number
  fineCurrency: string
  fineStatus: FineStatus
  fineDueDate: string
  // Review workflow
  reviewStatus: ViolationReviewStatus
  reviewedBy: string
  reviewNote: string
  // Driver score impact
  scoreImpact: number
  timestamp: string
  createdAt: string
}

export interface ViolationConfig {
  fleetId: string       // empty = global default
  fleetName: string
  // Speed thresholds
  speedAlertKph: number         // amber alert — approaching limit
  speedViolationKph: number     // red violation — limit exceeded
  speedCriticalKph: number      // critical — significantly over limit
  // Behaviour thresholds (g-force)
  harshBrakingG: number         // e.g. 0.4g
  harshAccelerationG: number    // e.g. 0.4g
  harshCorneringG: number       // e.g. 0.5g
  // Idling (minutes)
  idlingMinutes: number
  // Working hours
  drivingOutsideHoursEnabled: boolean
  shiftStartTime: string        // HH:MM
  shiftEndTime: string          // HH:MM
  // Geozone
  geozoneViolationsEnabled: boolean
  // Active violation types toggle
  // TODO: Each can be toggled per fleet in Configuration tab
  speedEnabled: boolean
  harshBrakingEnabled: boolean
  harshAccelerationEnabled: boolean
  harshCorneringEnabled: boolean
  idlingEnabled: boolean
  mobileUseEnabled: boolean
  seatbeltEnabled: boolean
  geozoneEnabled: boolean
}

export const violationConfigs: ViolationConfig[] = [
  // Global default — applies to all fleets unless overridden
  // TODO: PUT /api/fleetpoint/violations/config to update
  {
    fleetId: '', fleetName: 'Global Default',
    speedAlertKph: 105, speedViolationKph: 113, speedCriticalKph: 128,
    harshBrakingG: 0.4, harshAccelerationG: 0.4, harshCorneringG: 0.5,
    idlingMinutes: 10,
    drivingOutsideHoursEnabled: true, shiftStartTime: '06:00', shiftEndTime: '22:00',
    geozoneViolationsEnabled: true,
    speedEnabled: true, harshBrakingEnabled: true, harshAccelerationEnabled: true,
    harshCorneringEnabled: true, idlingEnabled: true, mobileUseEnabled: true,
    seatbeltEnabled: true, geozoneEnabled: true,
  },
  // London HGV — stricter speed limits (HGV max 60mph on motorway)
  {
    fleetId: 'F001', fleetName: 'London HGV',
    speedAlertKph: 88, speedViolationKph: 97, speedCriticalKph: 113,
    harshBrakingG: 0.35, harshAccelerationG: 0.35, harshCorneringG: 0.45,
    idlingMinutes: 5,
    drivingOutsideHoursEnabled: true, shiftStartTime: '05:00', shiftEndTime: '23:00',
    geozoneViolationsEnabled: true,
    speedEnabled: true, harshBrakingEnabled: true, harshAccelerationEnabled: true,
    harshCorneringEnabled: true, idlingEnabled: true, mobileUseEnabled: true,
    seatbeltEnabled: true, geozoneEnabled: true,
  },
  // Cold Chain — temp monitoring + stricter behaviour (fragile cargo)
  {
    fleetId: 'F002', fleetName: 'Cold Chain',
    speedAlertKph: 97, speedViolationKph: 105, speedCriticalKph: 120,
    harshBrakingG: 0.3, harshAccelerationG: 0.3, harshCorneringG: 0.4,
    idlingMinutes: 3,
    drivingOutsideHoursEnabled: true, shiftStartTime: '05:00', shiftEndTime: '22:00',
    geozoneViolationsEnabled: true,
    speedEnabled: true, harshBrakingEnabled: true, harshAccelerationEnabled: true,
    harshCorneringEnabled: true, idlingEnabled: true, mobileUseEnabled: true,
    seatbeltEnabled: true, geozoneEnabled: true,
  },
  // Manchester Vans — urban, lower speed limits
  {
    fleetId: 'F003', fleetName: 'Manchester Vans',
    speedAlertKph: 97, speedViolationKph: 113, speedCriticalKph: 128,
    harshBrakingG: 0.45, harshAccelerationG: 0.45, harshCorneringG: 0.55,
    idlingMinutes: 8,
    drivingOutsideHoursEnabled: true, shiftStartTime: '06:00', shiftEndTime: '20:00',
    geozoneViolationsEnabled: true,
    speedEnabled: true, harshBrakingEnabled: true, harshAccelerationEnabled: true,
    harshCorneringEnabled: true, idlingEnabled: true, mobileUseEnabled: true,
    seatbeltEnabled: true, geozoneEnabled: true,
  },
]

export const violations: Violation[] = [
  {
    id: 'VIO001',
    vehicleId: 'V004', vehiclePlate: 'LP-9901',
    driverId: 'D005', driverName: 'Connor McBride',
    fleetId: 'F001', fleetName: 'London HGV',
    source: 'dashcam', dashcamEventId: 'EVT003',
    type: 'Fatigue — Closed Eyes',
    category: 'safety', severity: 'critical',
    speedKph: 64, thresholdKph: 0,
    lat: 51.5800, lng: -0.1200,
    location: 'A1(M) Southbound, London',
    description: 'Driver fatigue detected — eyes closed for 2.4 seconds at 64km/h. DashCam footage confirmed. Formal warning issued.',
    fineAmount: 0, fineCurrency: 'GBP', fineStatus: 'none', fineDueDate: '',
    reviewStatus: 'reviewed', reviewedBy: 'Ali Mujtaba',
    reviewNote: 'Violation confirmed from cabin footage. Driver counselled. Mandatory rest enforced.',
    scoreImpact: -18,
    timestamp: '2026-05-21T06:48:12', createdAt: '2026-05-21T08:30:00',
  },
  {
    id: 'VIO002',
    vehicleId: 'V004', vehiclePlate: 'LP-9901',
    driverId: 'D005', driverName: 'Connor McBride',
    fleetId: 'F001', fleetName: 'London HGV',
    source: 'dashcam', dashcamEventId: 'EVT004',
    type: 'Phone Use While Driving',
    category: 'safety', severity: 'critical',
    speedKph: 58, thresholdKph: 0,
    lat: 51.5700, lng: -0.1100,
    location: 'A1(M) Southbound, Finchley',
    description: 'Mobile phone use confirmed from cabin camera footage. Vehicle travelling at 58km/h.',
    fineAmount: 200, fineCurrency: 'GBP', fineStatus: 'pending', fineDueDate: '2026-06-10',
    reviewStatus: 'reviewed', reviewedBy: 'Ali Mujtaba',
    reviewNote: 'Phone use confirmed. £200 fine issued. Formal warning on file.',
    scoreImpact: -20,
    timestamp: '2026-05-21T06:52:33', createdAt: '2026-05-21T08:31:00',
  },
  {
    id: 'VIO003',
    vehicleId: 'V001', vehiclePlate: 'LP-4821',
    driverId: 'D001', driverName: 'James Hartley',
    fleetId: 'F001', fleetName: 'London HGV',
    source: 'telematics', dashcamEventId: '',
    type: 'Speeding',
    category: 'speed', severity: 'high',
    speedKph: 119, thresholdKph: 97,
    lat: 51.7500, lng: -1.0800,
    location: 'M40 Northbound, Junction 8',
    description: 'Vehicle exceeded HGV speed threshold. Recorded at 119km/h, threshold 97km/h (+22km/h over).',
    fineAmount: 0, fineCurrency: 'GBP', fineStatus: 'none', fineDueDate: '',
    reviewStatus: 'reviewed', reviewedBy: 'Ali Mujtaba',
    reviewNote: 'Speeding confirmed from GPS data. Driver warned.',
    scoreImpact: -8,
    timestamp: '2026-05-21T07:18:45', createdAt: '2026-05-21T07:18:45',
  },
  {
    id: 'VIO004',
    vehicleId: 'V001', vehiclePlate: 'LP-4821',
    driverId: 'D001', driverName: 'James Hartley',
    fleetId: 'F001', fleetName: 'London HGV',
    source: 'telematics', dashcamEventId: 'EVT001',
    type: 'Forward Collision Warning',
    category: 'safety', severity: 'critical',
    speedKph: 98, thresholdKph: 0,
    lat: 51.8200, lng: -1.1400,
    location: 'M40 Northbound, Oxfordshire',
    description: 'ADAS forward collision warning triggered at 98km/h. Too-close following distance detected.',
    fineAmount: 0, fineCurrency: 'GBP', fineStatus: 'none', fineDueDate: '',
    reviewStatus: 'pending', reviewedBy: '', reviewNote: '',
    scoreImpact: -12,
    timestamp: '2026-05-21T07:34:22', createdAt: '2026-05-21T07:34:22',
  },
  {
    id: 'VIO005',
    vehicleId: 'V003', vehiclePlate: 'LP-7734',
    driverId: 'D003', driverName: 'Mohammed Al-Rashid',
    fleetId: 'F001', fleetName: 'London HGV',
    source: 'telematics', dashcamEventId: '',
    type: 'Speeding',
    category: 'speed', severity: 'high',
    speedKph: 112, thresholdKph: 97,
    lat: 51.7200, lng: -1.1900,
    location: 'M40 Southbound, Oxfordshire',
    description: 'Speeding — 112km/h in 97km/h HGV zone.',
    fineAmount: 0, fineCurrency: 'GBP', fineStatus: 'none', fineDueDate: '',
    reviewStatus: 'pending', reviewedBy: '', reviewNote: '',
    scoreImpact: -8,
    timestamp: '2026-05-21T14:24:10', createdAt: '2026-05-21T14:24:10',
  },
  {
    id: 'VIO006',
    vehicleId: 'V003', vehiclePlate: 'LP-7734',
    driverId: 'D003', driverName: 'Mohammed Al-Rashid',
    fleetId: 'F001', fleetName: 'London HGV',
    source: 'dashcam', dashcamEventId: 'EVT007',
    type: 'Road Departure Warning',
    category: 'safety', severity: 'critical',
    speedKph: 88, thresholdKph: 0,
    lat: 52.1800, lng: -0.9800,
    location: 'M40 Southbound, Bicester',
    description: 'ADAS road departure warning — vehicle crossed lane markings at 88km/h. DashCam footage available.',
    fineAmount: 0, fineCurrency: 'GBP', fineStatus: 'none', fineDueDate: '',
    reviewStatus: 'pending', reviewedBy: '', reviewNote: '',
    scoreImpact: -15,
    timestamp: '2026-05-21T14:38:19', createdAt: '2026-05-21T14:38:19',
  },
  {
    id: 'VIO007',
    vehicleId: 'V002', vehiclePlate: 'LP-3312',
    driverId: 'D002', driverName: 'Oliver Pemberton',
    fleetId: 'F001', fleetName: 'London HGV',
    source: 'telematics', dashcamEventId: '',
    type: 'Harsh Braking',
    category: 'behaviour', severity: 'medium',
    speedKph: 72, thresholdKph: 0,
    lat: 52.2500, lng: -1.1400,
    location: 'M45 Junction, Northamptonshire',
    description: 'Harsh braking event detected — deceleration exceeded 0.35g threshold.',
    fineAmount: 0, fineCurrency: 'GBP', fineStatus: 'none', fineDueDate: '',
    reviewStatus: 'pending', reviewedBy: '', reviewNote: '',
    scoreImpact: -6,
    timestamp: '2026-05-21T09:14:08', createdAt: '2026-05-21T09:14:08',
  },
  {
    id: 'VIO008',
    vehicleId: 'V006', vehiclePlate: 'LP-0392',
    driverId: 'D007', driverName: 'Thomas Griffiths',
    fleetId: 'F002', fleetName: 'Cold Chain',
    source: 'manual', dashcamEventId: '',
    type: 'MOT Expired',
    category: 'compliance', severity: 'critical',
    speedKph: 0, thresholdKph: 0,
    lat: 53.4650, lng: -2.2900,
    location: 'Trafford Park DC, Manchester',
    description: 'MOT certificate expired. Vehicle LP-0392 must not be driven on public roads until MOT renewed.',
    fineAmount: 1000, fineCurrency: 'GBP', fineStatus: 'pending', fineDueDate: '2026-06-01',
    reviewStatus: 'reviewed', reviewedBy: 'Ali Mujtaba',
    reviewNote: 'Vehicle grounded. Work order WO003 raised for MOT prep.',
    scoreImpact: 0,
    timestamp: '2026-05-20T00:00:00', createdAt: '2026-05-20T08:00:00',
  },
  {
    id: 'VIO009',
    vehicleId: 'V011', vehiclePlate: 'LP-2201',
    driverId: 'D008', driverName: 'Aisha Okonkwo',
    fleetId: 'F004', fleetName: 'Birmingham Ops',
    source: 'telematics', dashcamEventId: '',
    type: 'Harsh Acceleration',
    category: 'behaviour', severity: 'low',
    speedKph: 42, thresholdKph: 0,
    lat: 52.4860, lng: -1.8900,
    location: 'Digbeth, Birmingham',
    description: 'Harsh acceleration detected — 0.48g exceeds 0.45g threshold for Birmingham Ops fleet.',
    fineAmount: 0, fineCurrency: 'GBP', fineStatus: 'none', fineDueDate: '',
    reviewStatus: 'reviewed', reviewedBy: 'Ali Mujtaba',
    reviewNote: 'Minor event. Driver score updated.',
    scoreImpact: -3,
    timestamp: '2026-05-21T10:45:33', createdAt: '2026-05-21T10:45:33',
  },
  {
    id: 'VIO010',
    vehicleId: 'V003', vehiclePlate: 'LP-7734',
    driverId: 'D003', driverName: 'Mohammed Al-Rashid',
    fleetId: 'F001', fleetName: 'London HGV',
    source: 'manual', dashcamEventId: '',
    type: 'Licence Expiry',
    category: 'compliance', severity: 'critical',
    speedKph: 0, thresholdKph: 0,
    lat: 51.5400, lng: -0.0800,
    location: 'Stratford Depot, London',
    description: 'Driver licence expired 195 days ago. Driver must not operate any vehicle until licence renewed.',
    fineAmount: 0, fineCurrency: 'GBP', fineStatus: 'none', fineDueDate: '',
    reviewStatus: 'reviewed', reviewedBy: 'Ali Mujtaba',
    reviewNote: 'Driver notified. HR contacted. Temporary reassignment to non-driving duties.',
    scoreImpact: -25,
    timestamp: '2026-05-21T06:00:00', createdAt: '2026-05-21T06:00:00',
  },
  {
    id: 'VIO011',
    vehicleId: 'V004', vehiclePlate: 'LP-9901',
    driverId: 'D005', driverName: 'Connor McBride',
    fleetId: 'F001', fleetName: 'London HGV',
    source: 'telematics', dashcamEventId: '',
    type: 'Geozone Violation',
    category: 'geozone', severity: 'high',
    speedKph: 0, thresholdKph: 0,
    lat: 52.5200, lng: -1.0000,
    location: 'Birmingham Depot Zone B — Restricted',
    description: 'Vehicle LP-9901 entered restricted zone B. London HGV fleet not authorised in this zone.',
    fineAmount: 0, fineCurrency: 'GBP', fineStatus: 'none', fineDueDate: '',
    reviewStatus: 'pending', reviewedBy: '', reviewNote: '',
    scoreImpact: -10,
    timestamp: '2026-05-21T14:22:00', createdAt: '2026-05-21T14:22:00',
  },
  {
    id: 'VIO012',
    vehicleId: 'V008', vehiclePlate: 'LP-5531',
    driverId: 'D006', driverName: 'Priya Sharma',
    fleetId: 'F003', fleetName: 'Manchester Vans',
    source: 'telematics', dashcamEventId: '',
    type: 'Speeding',
    category: 'speed', severity: 'medium',
    speedKph: 121, thresholdKph: 113,
    lat: 53.4900, lng: -2.2100,
    location: 'M60 Orbital, Manchester',
    description: 'Speeding — 121km/h in 113km/h zone.',
    fineAmount: 100, fineCurrency: 'GBP', fineStatus: 'paid', fineDueDate: '2026-05-15',
    reviewStatus: 'closed', reviewedBy: 'Sarah Whitfield',
    reviewNote: 'Fixed penalty paid. Driver score updated.',
    scoreImpact: -5,
    timestamp: '2026-05-19T11:22:10', createdAt: '2026-05-19T11:22:10',
  },
]

// ─── GEOZONES DATA ────────────────────────────────────────────────────────────
// DEVELOPER NOTES:
// ─────────────────────────────────────────────────────────────────────────────
// ARCHITECTURE:
// Geozones = geographic boundaries with rules
// A geozone can optionally link to a POI (poiId FK)
// A geozone can optionally link to a Route as a corridor (routeId FK)
//
// GEOFENCE CHECKING (backend):
// On every GPS ping → check if vehicle inside/outside any active geozone
// Use PostGIS ST_Within() for polygon containment — REQUIRES PostGIS extension
// On state change (outside→inside or inside→outside):
//   → Create geozone_event record
//   → If alertOnEntry and entering → fire alert via WebSocket
//   → If alertOnExit and exiting → fire alert via WebSocket
//   → If type='restricted' and entering → auto-create violation record
//   → If type='poi' and entering → update linked POI visit log + start SLA timer
//   → If type='poi' and exiting → calculate dwell time + check SLA compliance
//
// TODO: Install PostGIS on PostgreSQL: CREATE EXTENSION postgis;
// TODO: Index geozones: CREATE INDEX ON geozones USING GIST (ST_GeomFromGeoJSON(coordinates))
// TODO: Build geofence checker in telematics processing pipeline
//
// DRAW ON MAP (frontend):
// Use Leaflet.draw plugin for polygon/circle drawing
// TODO: npm install leaflet-draw @types/leaflet-draw
// On shape complete → extract GeoJSON coordinates → POST to API
//
// DB Schema:
// Table: geozones
//   id, name, description
//   type: 'allowed'|'restricted'|'speed'|'curfew'|'poi'|'corridor'|'custom'
//   shapeType: 'polygon'|'circle'|'corridor'
//   coordinates: JSONB (GeoJSON polygon OR { lat, lng, radius } for circle)
//   color: string (hex — for map display)
//   alertOnEntry: boolean
//   alertOnExit: boolean
//   speedLimitKph: number (nullable — for speed zones)
//   maxDwellMinutes: number (nullable)
//   curfewStart: string HH:MM (nullable)
//   curfewEnd: string HH:MM (nullable)
//   assignedTo: 'all'|'fleet'|'vehicle'|'driver'
//   assignedIds: string[] JSONB
//   poiId: FK → poi.id (nullable)
//   routeId: FK → routes.id (nullable — corridor zones link to route)
//   active: boolean
//   createdBy: userId FK
//   createdAt, updatedAt
//
// Table: geozone_events (entry/exit log)
//   id, geozoneId FK, vehicleId FK, driverId FK
//   eventType: 'entry'|'exit'
//   dwellMinutes: number (calculated on exit)
//   lat, lng (exact location at event time)
//   timestamp: datetime
//
// API endpoints:
// GET    /api/fleetpoint/geozones                    — list all
// GET    /api/fleetpoint/geozones/:id                — single geozone
// GET    /api/fleetpoint/geozones/:id/events         — entry/exit history
// GET    /api/fleetpoint/geozones/:id/analytics      — visits, dwell, violations
// GET    /api/fleetpoint/geozones/active             — zones with vehicles inside NOW
// POST   /api/fleetpoint/geozones                    — create (GeoJSON body)
// PATCH  /api/fleetpoint/geozones/:id                — update
// DELETE /api/fleetpoint/geozones/:id                — delete
//
// WebSocket events:
// { type: 'geozone-entry', geozoneId, vehicleId, driverId, timestamp }
// { type: 'geozone-exit', geozoneId, vehicleId, driverId, dwellMinutes, timestamp }
// { type: 'geozone-violation', geozoneId, vehicleId, driverId, timestamp }
// ─────────────────────────────────────────────────────────────────────────────

export type GeozoneType = 'allowed' | 'restricted' | 'speed' | 'curfew' | 'poi' | 'corridor' | 'custom'
export type GeozoneShapeType = 'polygon' | 'circle' | 'corridor'

export interface GeozoneEvent {
  vehiclePlate: string
  driverName: string
  eventType: 'entry' | 'exit'
  dwellMinutes: number
  timestamp: string
}

export interface Geozone {
  id: string
  name: string
  description: string
  type: GeozoneType
  shapeType: GeozoneShapeType
  // Coordinates — GeoJSON polygon points or circle center
  // TODO: stored as PostGIS geometry in DB
  // Frontend draws using Leaflet — coordinates extracted from drawn shape
  center: { lat: number; lng: number }
  radius?: number           // meters — for circle shapes
  polygon?: [number, number][] // [lat, lng] pairs — for polygon shapes
  color: string
  // Rules
  alertOnEntry: boolean
  alertOnExit: boolean
  speedLimitKph: number | null
  maxDwellMinutes: number | null
  curfewStart: string | null
  curfewEnd: string | null
  // Assignment
  assignedTo: 'all' | 'fleet' | 'vehicle' | 'driver'
  assignedIds: string[]
  assignedNames: string[]
  // Links
  poiId: string             // FK → poi.id (nullable)
  routeId: string           // FK → routes.id (nullable — corridor zones)
  active: boolean
  // Analytics — TODO: fetch from GET /api/fleetpoint/geozones/:id/analytics
  visitsToday: number
  visitsThisWeek: number
  avgDwellMinutes: number
  activeVehicles: number    // vehicles inside RIGHT NOW
  violationsTotal: number
  recentEvents: GeozoneEvent[]
}

export const geozones: Geozone[] = [
  // ── DEPOTS — Allowed zones ─────────────────────────────────────────────────
  {
    id: 'GZ001',
    name: 'Stratford Logistics Park — Depot',
    description: 'London HQ depot perimeter — all vehicles allowed, alert on unexpected exit',
    type: 'allowed',
    shapeType: 'circle',
    center: { lat: 51.5400, lng: -0.0800 },
    radius: 250,
    color: '#22c55e',
    alertOnEntry: false, alertOnExit: true,
    speedLimitKph: 15, maxDwellMinutes: null,
    curfewStart: null, curfewEnd: null,
    assignedTo: 'all', assignedIds: [], assignedNames: ['All Vehicles'],
    poiId: 'EPOI001', routeId: '',
    active: true,
    visitsToday: 8, visitsThisWeek: 42, avgDwellMinutes: 34,
    activeVehicles: 2, violationsTotal: 0,
    recentEvents: [
      { vehiclePlate: 'LP-4821', driverName: 'James Hartley', eventType: 'exit', dwellMinutes: 36, timestamp: '2026-05-21T06:48:00' },
      { vehiclePlate: 'LP-7734', driverName: 'Mohammed Al-Rashid', eventType: 'entry', dwellMinutes: 0, timestamp: '2026-05-21T06:05:00' },
    ],
  },
  {
    id: 'GZ002',
    name: 'Trafford Park DC — Manchester',
    description: 'Manchester distribution centre — Manchester Vans fleet only',
    type: 'allowed',
    shapeType: 'circle',
    center: { lat: 53.4650, lng: -2.2900 },
    radius: 200,
    color: '#22c55e',
    alertOnEntry: false, alertOnExit: true,
    speedLimitKph: 10, maxDwellMinutes: null,
    curfewStart: '22:00', curfewEnd: '06:00',
    assignedTo: 'fleet', assignedIds: ['F003'], assignedNames: ['Manchester Vans'],
    poiId: 'EPOI002', routeId: '',
    active: true,
    visitsToday: 5, visitsThisWeek: 28, avgDwellMinutes: 22,
    activeVehicles: 1, violationsTotal: 0,
    recentEvents: [
      { vehiclePlate: 'LP-2244', driverName: 'Sarah Whitfield', eventType: 'entry', dwellMinutes: 0, timestamp: '2026-05-21T08:00:00' },
    ],
  },
  // ── RESTRICTED zones ───────────────────────────────────────────────────────
  {
    id: 'GZ003',
    name: 'Birmingham Depot Zone B — Restricted',
    description: 'Restricted area — London HGV fleet not authorised. Immediate alert + violation on entry.',
    type: 'restricted',
    shapeType: 'polygon',
    center: { lat: 52.5200, lng: -1.0000 },
    polygon: [[52.5250, -1.0050], [52.5250, -0.9950], [52.5150, -0.9950], [52.5150, -1.0050]],
    color: '#dc2626',
    alertOnEntry: true, alertOnExit: false,
    speedLimitKph: null, maxDwellMinutes: null,
    curfewStart: null, curfewEnd: null,
    assignedTo: 'fleet', assignedIds: ['F001'], assignedNames: ['London HGV'],
    poiId: '', routeId: '',
    active: true,
    visitsToday: 1, visitsThisWeek: 3, avgDwellMinutes: 12,
    activeVehicles: 0, violationsTotal: 3,
    recentEvents: [
      { vehiclePlate: 'LP-7734', driverName: 'Mohammed Al-Rashid', eventType: 'entry', dwellMinutes: 12, timestamp: '2026-05-21T14:22:00' },
    ],
  },
  {
    id: 'GZ004',
    name: 'High Risk Zone — East London',
    description: 'High crime area — alert on entry after 20:00 or dwell >15 min',
    type: 'restricted',
    shapeType: 'circle',
    center: { lat: 51.5250, lng: -0.0450 },
    radius: 300,
    color: '#ef4444',
    alertOnEntry: true, alertOnExit: false,
    speedLimitKph: null, maxDwellMinutes: 15,
    curfewStart: '20:00', curfewEnd: '06:00',
    assignedTo: 'all', assignedIds: [], assignedNames: ['All Vehicles'],
    poiId: '', routeId: '',
    active: true,
    visitsToday: 0, visitsThisWeek: 1, avgDwellMinutes: 8,
    activeVehicles: 0, violationsTotal: 1,
    recentEvents: [],
  },
  // ── SPEED zones ────────────────────────────────────────────────────────────
  {
    id: 'GZ005',
    name: 'Stratford Depot Yard — 5mph Zone',
    description: 'Depot yard speed limit — 5mph max for safety',
    type: 'speed',
    shapeType: 'polygon',
    center: { lat: 51.5390, lng: -0.0790 },
    polygon: [[51.5400, -0.0810], [51.5400, -0.0770], [51.5380, -0.0770], [51.5380, -0.0810]],
    color: '#f59e0b',
    alertOnEntry: false, alertOnExit: false,
    speedLimitKph: 8, maxDwellMinutes: null,
    curfewStart: null, curfewEnd: null,
    assignedTo: 'all', assignedIds: [], assignedNames: ['All Vehicles'],
    poiId: 'EPOI001', routeId: '',
    active: true,
    visitsToday: 12, visitsThisWeek: 58, avgDwellMinutes: 18,
    activeVehicles: 2, violationsTotal: 4,
    recentEvents: [
      { vehiclePlate: 'LP-4821', driverName: 'James Hartley', eventType: 'entry', dwellMinutes: 0, timestamp: '2026-05-21T06:12:00' },
    ],
  },
  // ── CURFEW zones ───────────────────────────────────────────────────────────
  {
    id: 'GZ006',
    name: 'ULEZ — Central London',
    description: 'Ultra Low Emission Zone — alert on entry. Non-compliant vehicles incur daily charge.',
    type: 'curfew',
    shapeType: 'circle',
    center: { lat: 51.5100, lng: -0.1200 },
    radius: 6000,
    color: '#7c3aed',
    alertOnEntry: true, alertOnExit: false,
    speedLimitKph: null, maxDwellMinutes: null,
    curfewStart: null, curfewEnd: null,
    assignedTo: 'all', assignedIds: [], assignedNames: ['All Vehicles'],
    poiId: 'EPOI011', routeId: '',
    active: true,
    visitsToday: 6, visitsThisWeek: 31, avgDwellMinutes: 142,
    activeVehicles: 3, violationsTotal: 0,
    recentEvents: [
      { vehiclePlate: 'LP-3312', driverName: 'Oliver Pemberton', eventType: 'entry', dwellMinutes: 0, timestamp: '2026-05-21T09:00:00' },
    ],
  },
  // ── POI zones ──────────────────────────────────────────────────────────────
  {
    id: 'GZ007',
    name: 'Amazon BHX2 — Customer Site Boundary',
    description: 'Customer site boundary — auto-triggers job start/end. SLA timer starts on entry.',
    type: 'poi',
    shapeType: 'circle',
    center: { lat: 52.4550, lng: -1.7300 },
    radius: 300,
    color: '#2563eb',
    alertOnEntry: true, alertOnExit: true,
    speedLimitKph: null, maxDwellMinutes: 120,
    curfewStart: null, curfewEnd: null,
    assignedTo: 'all', assignedIds: [], assignedNames: ['All Vehicles'],
    poiId: 'EPOI004', routeId: '',
    active: true,
    visitsToday: 4, visitsThisWeek: 21, avgDwellMinutes: 78,
    activeVehicles: 0, violationsTotal: 2,
    recentEvents: [
      { vehiclePlate: 'LP-3312', driverName: 'Oliver Pemberton', eventType: 'entry', dwellMinutes: 0, timestamp: '2026-05-21T09:15:00' },
      { vehiclePlate: 'LP-3312', driverName: 'Oliver Pemberton', eventType: 'exit', dwellMinutes: 93, timestamp: '2026-05-21T10:48:00' },
    ],
  },
  // ── CORRIDOR zones ─────────────────────────────────────────────────────────
  {
    id: 'GZ008',
    name: 'London → Birmingham Corridor',
    description: 'Route corridor — 500m tolerance. Deviation triggers route violation alert.',
    type: 'corridor',
    shapeType: 'corridor',
    center: { lat: 52.0000, lng: -1.2000 },
    radius: 500,
    color: '#0d9488',
    alertOnEntry: false, alertOnExit: true,
    speedLimitKph: null, maxDwellMinutes: null,
    curfewStart: null, curfewEnd: null,
    assignedTo: 'fleet', assignedIds: ['F001'], assignedNames: ['London HGV'],
    poiId: '', routeId: 'RT001',
    active: true,
    visitsToday: 3, visitsThisWeek: 16, avgDwellMinutes: 0,
    activeVehicles: 1, violationsTotal: 1,
    recentEvents: [],
  },
]

// ─── DOCUMENTS DATA ───────────────────────────────────────────────────────────
// DEVELOPER NOTES:
// ─────────────────────────────────────────────────────────────────────────────
// TIER 1 (built now): Compliance documents — vehicle, driver, company
// TIER 2 (Sprint 3 after Digital Twin): Customer contracts, PODs, delivery notes
//
// DOCUMENT STORAGE:
// Files stored in cloud storage (AWS S3 or Azure Blob)
// Backend generates pre-signed URLs for secure upload/download
// Frontend never uploads directly to S3 — always via backend
//
// UPLOAD FLOW:
// 1. POST /api/fleetpoint/documents/upload-url → { uploadUrl, documentId }
// 2. Frontend PUT file to uploadUrl (pre-signed S3 URL)
// 3. POST /api/fleetpoint/documents/confirm { documentId, metadata }
// 4. Backend stores document record in DB
//
// EXPIRY ALERTS:
// Backend cron job runs daily at 06:00
// Checks all documents with expiryDate
// Sends alerts at: 90 days, 30 days, 7 days, 1 day, day of expiry
// Alert via: in-app notification + email + SMS (configurable per org)
// Creates alert record in alerts table
//
// DB Schema:
// Table: documents
//   id, name, category, type
//   linkedTo: 'vehicle'|'driver'|'company'
//   linkedId: string (vehicleId or driverId or null for company)
//   linkedName: string (plate or driver name)
//   fileUrl: string (S3/Azure URL)
//   fileSize: number (bytes)
//   fileType: string (application/pdf, image/jpeg, etc.)
//   issueDate: date
//   expiryDate: date (nullable)
//   issuedBy: string (DVLA, insurer name, etc.)
//   documentNumber: string (licence number, policy number, etc.)
//   status: 'valid'|'expiring'|'expired'|'missing'
//   uploadedBy: userId FK
//   createdAt, updatedAt
//
// API endpoints:
// GET    /api/fleetpoint/documents                   — list all (paginated)
// GET    /api/fleetpoint/documents/:id               — single document
// GET    /api/fleetpoint/documents/expiring          — expiring in next 90 days
// GET    /api/fleetpoint/documents/missing           — vehicles/drivers missing docs
// POST   /api/fleetpoint/documents/upload-url        — get pre-signed upload URL
// POST   /api/fleetpoint/documents/confirm           — confirm upload + save metadata
// PATCH  /api/fleetpoint/documents/:id               — update metadata
// DELETE /api/fleetpoint/documents/:id               — delete document
// GET    /api/fleetpoint/documents/export            — export compliance report
// ─────────────────────────────────────────────────────────────────────────────

export type DocumentCategory = 'vehicle' | 'driver' | 'company'
export type DocumentStatus = 'valid' | 'expiring' | 'expired' | 'missing'

export type DocumentType =
  // Vehicle documents
  | 'mot-certificate'
  | 'vehicle-insurance'
  | 'road-tax'
  | 'v5c-registration'
  | 'vehicle-service-record'
  | 'tachograph-calibration'
  | 'goods-vehicle-test'
  // Driver documents
  | 'driving-licence'
  | 'cpc-card'
  | 'medical-certificate'
  | 'dbs-check'
  | 'driver-training-certificate'
  | 'tacho-card'
  // Company documents
  | 'operator-licence'
  | 'fleet-insurance-policy'
  | 'fors-certificate'
  | 'earned-recognition'
  | 'public-liability-insurance'

export interface FleetDocument {
  id: string
  name: string
  category: DocumentCategory
  type: DocumentType
  // What this document is linked to
  linkedTo: 'vehicle' | 'driver' | 'company'
  linkedId: string
  linkedName: string  // plate or driver name or company name
  // File details
  // TODO: fileUrl = pre-signed S3/Azure URL from backend
  // Upload: POST /api/fleetpoint/documents/upload-url
  fileUrl: string
  fileName: string
  fileSize: number  // bytes
  fileType: string  // MIME type
  // Document metadata
  issueDate: string
  expiryDate: string  // empty if no expiry
  issuedBy: string
  documentNumber: string
  notes: string
  // Status — calculated from expiryDate
  // Backend recalculates daily via cron job
  status: DocumentStatus
  daysUntilExpiry: number  // negative = expired
  // Audit
  uploadedBy: string
  uploadedAt: string
}
export const fleetDocuments: FleetDocument[] = [
  // ── VEHICLE DOCUMENTS ──────────────────────────────────────────────────────
  {
    id: 'DOC001',
    name: 'MOT Certificate — LP-4821',
    category: 'vehicle', type: 'mot-certificate',
    linkedTo: 'vehicle', linkedId: 'V001', linkedName: 'LP-4821',
    fileUrl: '/documents/DOC001_mot_LP4821.pdf',
    fileName: 'MOT_LP4821_2026.pdf', fileSize: 245000, fileType: 'application/pdf',
    issueDate: '2025-05-14', expiryDate: '2026-05-14',
    issuedBy: 'DVSA Approved Test Centre', documentNumber: 'MOT-2025-LP4821-001',
    notes: 'Annual MOT — passed with advisory on rear tyre wear',
    status: 'expired', daysUntilExpiry: -13,
    uploadedBy: 'Ali Mujtaba', uploadedAt: '2025-05-14T10:00:00',
  },
  {
    id: 'DOC002',
    name: 'Vehicle Insurance — LP-4821',
    category: 'vehicle', type: 'vehicle-insurance',
    linkedTo: 'vehicle', linkedId: 'V001', linkedName: 'LP-4821',
    fileUrl: '/documents/DOC002_insurance_LP4821.pdf',
    fileName: 'Insurance_LP4821_2026.pdf', fileSize: 512000, fileType: 'application/pdf',
    issueDate: '2025-08-01', expiryDate: '2026-08-01',
    issuedBy: 'Aviva Commercial Insurance', documentNumber: 'POL-AVV-2025-88441',
    notes: 'Comprehensive commercial vehicle insurance — £5M public liability',
    status: 'valid', daysUntilExpiry: 66,
    uploadedBy: 'Ali Mujtaba', uploadedAt: '2025-08-01T09:00:00',
  },
  {
    id: 'DOC003',
    name: 'MOT Certificate — LP-9901',
    category: 'vehicle', type: 'mot-certificate',
    linkedTo: 'vehicle', linkedId: 'V004', linkedName: 'LP-9901',
    fileUrl: '/documents/DOC003_mot_LP9901.pdf',
    fileName: 'MOT_LP9901_EXPIRED.pdf', fileSize: 198000, fileType: 'application/pdf',
    issueDate: '2024-05-20', expiryDate: '2025-05-20',
    issuedBy: 'DVSA Approved Test Centre', documentNumber: 'MOT-2024-LP9901-001',
    notes: '⚠️ EXPIRED — renewal overdue. Vehicle grounded until new MOT obtained.',
    status: 'expired', daysUntilExpiry: -371,
    uploadedBy: 'Ali Mujtaba', uploadedAt: '2024-05-20T11:00:00',
  },
  {
    id: 'DOC004',
    name: 'MOT Certificate — LP-7734',
    category: 'vehicle', type: 'mot-certificate',
    linkedTo: 'vehicle', linkedId: 'V003', linkedName: 'LP-7734',
    fileUrl: '/documents/DOC004_mot_LP7734.pdf',
    fileName: 'MOT_LP7734_2026.pdf', fileSize: 220000, fileType: 'application/pdf',
    issueDate: '2025-07-08', expiryDate: '2026-07-08',
    issuedBy: 'DVSA Approved Test Centre', documentNumber: 'MOT-2025-LP7734-001',
    notes: 'Annual MOT — passed',
    status: 'valid', daysUntilExpiry: 42,
    uploadedBy: 'Ali Mujtaba', uploadedAt: '2025-07-08T14:00:00',
  },
  {
    id: 'DOC005',
    name: 'Tachograph Calibration — LP-4821',
    category: 'vehicle', type: 'tachograph-calibration',
    linkedTo: 'vehicle', linkedId: 'V001', linkedName: 'LP-4821',
    fileUrl: '/documents/DOC005_tacho_LP4821.pdf',
    fileName: 'Tacho_Calibration_LP4821.pdf', fileSize: 180000, fileType: 'application/pdf',
    issueDate: '2024-03-15', expiryDate: '2026-03-15',
    issuedBy: 'Approved Tachograph Centre — Dartford', documentNumber: 'TACHO-2024-001',
    notes: 'Digital tachograph calibration — 2 year validity',
    status: 'expired', daysUntilExpiry: -73,
    uploadedBy: 'Ali Mujtaba', uploadedAt: '2024-03-15T10:00:00',
  },
  {
    id: 'DOC006',
    name: 'Vehicle Insurance — LP-7712',
    category: 'vehicle', type: 'vehicle-insurance',
    linkedTo: 'vehicle', linkedId: 'V015', linkedName: 'LP-7712',
    fileUrl: '/documents/DOC006_insurance_LP7712.pdf',
    fileName: 'Insurance_LP7712_2026.pdf', fileSize: 498000, fileType: 'application/pdf',
    issueDate: '2025-06-01', expiryDate: '2026-06-01',
    issuedBy: 'NFU Mutual', documentNumber: 'POL-NFU-2025-33218',
    notes: 'Fleet insurance — included in fleet block policy',
    status: 'valid', daysUntilExpiry: 5,
    uploadedBy: 'Ali Mujtaba', uploadedAt: '2025-06-01T09:00:00',
  },

  // ── DRIVER DOCUMENTS ───────────────────────────────────────────────────────
  {
    id: 'DOC007',
    name: 'Driving Licence — James Hartley',
    category: 'driver', type: 'driving-licence',
    linkedTo: 'driver', linkedId: 'D001', linkedName: 'James Hartley',
    fileUrl: '/documents/DOC007_licence_hartley.pdf',
    fileName: 'DL_JamesHartley.pdf', fileSize: 320000, fileType: 'application/pdf',
    issueDate: '2018-03-22', expiryDate: '2028-03-22',
    issuedBy: 'DVLA', documentNumber: 'HARTL803224JA9BY',
    notes: 'Categories: B, C, C+E, CPC — HGV qualified',
    status: 'valid', daysUntilExpiry: 664,
    uploadedBy: 'Ali Mujtaba', uploadedAt: '2024-01-15T09:00:00',
  },
  {
    id: 'DOC008',
    name: 'CPC Card — James Hartley',
    category: 'driver', type: 'cpc-card',
    linkedTo: 'driver', linkedId: 'D001', linkedName: 'James Hartley',
    fileUrl: '/documents/DOC008_cpc_hartley.pdf',
    fileName: 'CPC_JamesHartley.pdf', fileSize: 180000, fileType: 'application/pdf',
    issueDate: '2023-06-01', expiryDate: '2028-06-01',
    issuedBy: 'DVSA', documentNumber: 'CPC-2023-JH-00441',
    notes: 'Driver CPC — 35 hours periodic training completed',
    status: 'valid', daysUntilExpiry: 735,
    uploadedBy: 'Ali Mujtaba', uploadedAt: '2023-06-01T09:00:00',
  },
  {
    id: 'DOC009',
    name: 'Driving Licence — Connor McBride',
    category: 'driver', type: 'driving-licence',
    linkedTo: 'driver', linkedId: 'D005', linkedName: 'Connor McBride',
    fileUrl: '/documents/DOC009_licence_mcbride.pdf',
    fileName: 'DL_ConnorMcBride_EXPIRED.pdf', fileSize: 298000, fileType: 'application/pdf',
    issueDate: '2013-11-08', expiryDate: '2025-11-08',
    issuedBy: 'DVLA', documentNumber: 'MCBRI811084CM9LB',
    notes: '⚠️ EXPIRED — driver must not operate any vehicle. HR notified.',
    status: 'expired', daysUntilExpiry: -200,
    uploadedBy: 'Ali Mujtaba', uploadedAt: '2024-01-10T09:00:00',
  },
  {
    id: 'DOC010',
    name: 'DBS Check — Connor McBride',
    category: 'driver', type: 'dbs-check',
    linkedTo: 'driver', linkedId: 'D005', linkedName: 'Connor McBride',
    fileUrl: '/documents/DOC010_dbs_mcbride.pdf',
    fileName: 'DBS_ConnorMcBride.pdf', fileSize: 156000, fileType: 'application/pdf',
    issueDate: '2023-02-14', expiryDate: '2026-02-14',
    issuedBy: 'Disclosure & Barring Service', documentNumber: 'DBS-2023-001-CM',
    notes: 'Standard DBS check — clear',
    status: 'expired', daysUntilExpiry: -102,
    uploadedBy: 'Ali Mujtaba', uploadedAt: '2023-02-14T09:00:00',
  },
  {
    id: 'DOC011',
    name: 'Driving Licence — Mohammed Al-Rashid',
    category: 'driver', type: 'driving-licence',
    linkedTo: 'driver', linkedId: 'D003', linkedName: 'Mohammed Al-Rashid',
    fileUrl: '/documents/DOC011_licence_alrashid.pdf',
    fileName: 'DL_MohammedAlRashid.pdf', fileSize: 310000, fileType: 'application/pdf',
    issueDate: '2015-09-20', expiryDate: '2026-07-28',
    issuedBy: 'DVLA', documentNumber: 'ALRAS509204MA9KM',
    notes: 'Categories: B, C, C+E, CPC',
    status: 'valid', daysUntilExpiry: 62,
    uploadedBy: 'Ali Mujtaba', uploadedAt: '2024-01-10T09:00:00',
  },
  {
    id: 'DOC012',
    name: 'Medical Certificate — Mohammed Al-Rashid',
    category: 'driver', type: 'medical-certificate',
    linkedTo: 'driver', linkedId: 'D003', linkedName: 'Mohammed Al-Rashid',
    fileUrl: '/documents/DOC012_medical_alrashid.pdf',
    fileName: 'Medical_MohammedAlRashid.pdf', fileSize: 220000, fileType: 'application/pdf',
    issueDate: '2024-08-10', expiryDate: '2026-08-10',
    issuedBy: 'DVLA Approved Medical Practitioner', documentNumber: 'MED-2024-MAR-001',
    notes: 'D4 medical — fit to drive HGV. Next medical due Aug 2026.',
    status: 'valid', daysUntilExpiry: 75,
    uploadedBy: 'Ali Mujtaba', uploadedAt: '2024-08-10T14:00:00',
  },
  {
    id: 'DOC013',
    name: 'Tacho Card — James Hartley',
    category: 'driver', type: 'tacho-card',
    linkedTo: 'driver', linkedId: 'D001', linkedName: 'James Hartley',
    fileUrl: '/documents/DOC013_tacho_hartley.pdf',
    fileName: 'TachoCard_JamesHartley.pdf', fileSize: 145000, fileType: 'application/pdf',
    issueDate: '2022-04-01', expiryDate: '2027-04-01',
    issuedBy: 'DVLA', documentNumber: 'GB-TACHO-2022-JH-00112',
    notes: 'Digital tachograph driver card — 5 year validity',
    status: 'valid', daysUntilExpiry: 309,
    uploadedBy: 'Ali Mujtaba', uploadedAt: '2022-04-01T09:00:00',
  },

  // ── COMPANY DOCUMENTS ──────────────────────────────────────────────────────
  {
    id: 'DOC014',
    name: 'Operator Licence — LogisticsPro Ltd',
    category: 'company', type: 'operator-licence',
    linkedTo: 'company', linkedId: 'company', linkedName: 'LogisticsPro Ltd',
    fileUrl: '/documents/DOC014_operator_licence.pdf',
    fileName: 'OperatorLicence_LogisticsPro.pdf', fileSize: 890000, fileType: 'application/pdf',
    issueDate: '2020-01-15', expiryDate: '2027-01-15',
    issuedBy: 'Traffic Commissioner — London & South East', documentNumber: 'OB2034451',
    notes: 'Standard National Operator Licence — authorised for 20 vehicles',
    status: 'valid', daysUntilExpiry: 233,
    uploadedBy: 'Ali Mujtaba', uploadedAt: '2020-01-15T09:00:00',
  },
  {
    id: 'DOC015',
    name: 'Fleet Insurance Policy — LogisticsPro Ltd',
    category: 'company', type: 'fleet-insurance-policy',
    linkedTo: 'company', linkedId: 'company', linkedName: 'LogisticsPro Ltd',
    fileUrl: '/documents/DOC015_fleet_insurance.pdf',
    fileName: 'FleetInsurance_LogisticsPro_2026.pdf', fileSize: 1240000, fileType: 'application/pdf',
    issueDate: '2025-08-01', expiryDate: '2026-08-01',
    issuedBy: 'Aviva Commercial Insurance', documentNumber: 'FLEET-AVV-2025-LP-001',
    notes: 'Block fleet policy — covers all 15 vehicles. Any driver authorised.',
    status: 'valid', daysUntilExpiry: 66,
    uploadedBy: 'Ali Mujtaba', uploadedAt: '2025-08-01T09:00:00',
  },
  {
    id: 'DOC016',
    name: 'FORS Silver Certificate',
    category: 'company', type: 'fors-certificate',
    linkedTo: 'company', linkedId: 'company', linkedName: 'LogisticsPro Ltd',
    fileUrl: '/documents/DOC016_fors_silver.pdf',
    fileName: 'FORS_Silver_LogisticsPro.pdf', fileSize: 445000, fileType: 'application/pdf',
    issueDate: '2025-03-10', expiryDate: '2026-03-10',
    issuedBy: 'FORS (Fleet Operator Recognition Scheme)', documentNumber: 'FORS-S-2025-LP-0881',
    notes: 'FORS Silver accreditation — required for TfL contracts',
    status: 'expired', daysUntilExpiry: -78,
    uploadedBy: 'Ali Mujtaba', uploadedAt: '2025-03-10T10:00:00',
  },
  {
    id: 'DOC017',
    name: 'Public Liability Insurance',
    category: 'company', type: 'public-liability-insurance',
    linkedTo: 'company', linkedId: 'company', linkedName: 'LogisticsPro Ltd',
    fileUrl: '/documents/DOC017_public_liability.pdf',
    fileName: 'PublicLiability_LogisticsPro.pdf', fileSize: 678000, fileType: 'application/pdf',
    issueDate: '2025-08-01', expiryDate: '2026-08-01',
    issuedBy: 'Zurich Insurance', documentNumber: 'ZUR-PL-2025-LP-44521',
    notes: '£10M public liability insurance — required for all customer contracts',
    status: 'valid', daysUntilExpiry: 66,
    uploadedBy: 'Ali Mujtaba', uploadedAt: '2025-08-01T09:00:00',
  },
]

// ─── TRIP REPLAY DATA ─────────────────────────────────────────────────────────
// DEVELOPER NOTES:
// ─────────────────────────────────────────────────────────────────────────────
// Trip Replay = playback of a completed vehicle trip with:
// - GPS trail animation (vehicle icon moves along route)
// - Event markers on route (violations, dashcam events, stops)
// - Timeline scrubber (drag to jump to any point)
// - DashCam footage sync (click event marker → footage plays)
// - Driver score impact per trip
// - Job/route context
//
// DATA FLOW:
// GPS pings stored in: trip_positions table (high frequency, ~10s intervals)
// GET /api/fleetpoint/trips/:id/positions → array of { lat, lng, speedKph, timestamp, heading }
// These are then animated on frontend using setInterval
//
// EVENT MARKERS come from joining:
// - violations WHERE timestamp BETWEEN trip.startTime AND trip.endTime AND vehicleId = trip.vehicleId
// - dashcam_events WHERE same conditions
// - trip_stops (derived from positions where speed = 0 for > stopThresholdMinutes)
//
// DB Schema:
// Table: trips
//   id, vehicleId FK, driverId FK, jobId FK (nullable), routeRunId FK (nullable)
//   startTime, endTime
//   startLat, startLng, endLat, endLng
//   startAddress, endAddress
//   distanceMiles, durationMinutes
//   maxSpeedKph, avgSpeedKph
//   idleMinutes, movingMinutes
//   harshBrakingCount, harshAccelerationCount, speedingCount
//   fuelUsedLitres (from CAN bus if available)
//   tripScore: number (calculated from events during trip)
//   createdAt
//
// Table: trip_positions (high volume — partition by month)
//   id, tripId FK, lat, lng, speedKph, heading, timestamp
//   INDEX on (tripId, timestamp)
//
// API endpoints:
// GET /api/fleetpoint/trips                          — list trips (paginated)
// GET /api/fleetpoint/trips/:id                      — trip detail
// GET /api/fleetpoint/trips/:id/positions            — GPS trail for replay
// GET /api/fleetpoint/trips/:id/events               — violations + dashcam events
// GET /api/fleetpoint/trips/:id/stops                — stop points with dwell time
// GET /api/fleetpoint/vehicles/:id/trips             — trips for a vehicle
// GET /api/fleetpoint/drivers/:id/trips              — trips for a driver
//
// ANIMATION:
// Frontend fetches positions array on page load
// Uses setInterval to advance position index based on playback speed
// Vehicle icon position interpolated between GPS points
// Timeline scrubber maps position index to trip duration
// ─────────────────────────────────────────────────────────────────────────────

export interface TripPosition {
  lat: number
  lng: number
  speedKph: number
  heading: number
  timestamp: string
}

export interface TripStop {
  lat: number
  lng: number
  address: string
  arrivalTime: string
  departureTime: string
  dwellMinutes: number
  reason: 'delivery' | 'fuel' | 'rest' | 'traffic' | 'unknown'
}

export interface TripEvent {
  id: string
  type: 'violation' | 'dashcam'
  eventType: string
  lat: number
  lng: number
  speedKph: number
  timestamp: string
  severity: 'critical' | 'warning' | 'info'
  description: string
  // Links
  violationId?: string
  dashcamEventId?: string
  // Video file for dashcam events
  // DEVELOPER NOTE: upload to public/videos/dashcam/events/{eventId}_{camera}.mp4
  videoFile?: string
  scoreImpact: number
  // Position index in the positions array — used to sync with timeline scrubber
  positionIndex: number
}

export interface Trip {
  id: string
  vehicleId: string
  vehiclePlate: string
  vehicleMake: string
  driverId: string
  driverName: string
  driverAvatar: string
  fleetId: string
  fleetName: string
  // Context
  jobId: string
  jobName: string
  routeRunId: string
  routeName: string
  // Trip stats
  startTime: string
  endTime: string
  startAddress: string
  endAddress: string
  distanceMiles: number
  durationMinutes: number
  maxSpeedKph: number
  avgSpeedKph: number
  idleMinutes: number
  movingMinutes: number
  harshBrakingCount: number
  harshAccelerationCount: number
  speedingCount: number
  fuelUsedLitres: number
  tripScore: number
  // GPS trail — simplified for demo
  // TODO: in production fetch from GET /api/fleetpoint/trips/:id/positions
  // High frequency data — could be 800+ points per trip
  positions: TripPosition[]
  stops: TripStop[]
  events: TripEvent[]
}

// Simplified GPS trail — London to Birmingham via M40
// TODO: replace with real GPS positions from DB
// Real data will have 500-1000+ points at ~10 second intervals
const londonToBirminghamTrail: TripPosition[] = [
  { lat: 51.5400, lng: -0.0800, speedKph: 0, heading: 315, timestamp: '2026-05-21T06:12:00' },
  { lat: 51.5450, lng: -0.1200, speedKph: 35, heading: 270, timestamp: '2026-05-21T06:15:00' },
  { lat: 51.5200, lng: -0.2500, speedKph: 65, heading: 285, timestamp: '2026-05-21T06:25:00' },
  { lat: 51.5100, lng: -0.4000, speedKph: 88, heading: 290, timestamp: '2026-05-21T06:40:00' },
  { lat: 51.5050, lng: -0.5500, speedKph: 95, heading: 292, timestamp: '2026-05-21T06:55:00' },
  { lat: 51.5900, lng: -0.7800, speedKph: 97, heading: 295, timestamp: '2026-05-21T07:10:00' },
  { lat: 51.6800, lng: -0.9500, speedKph: 105, heading: 300, timestamp: '2026-05-21T07:18:00' },
  { lat: 51.7500, lng: -1.0800, speedKph: 119, heading: 305, timestamp: '2026-05-21T07:18:45' },
  { lat: 51.8200, lng: -1.1400, speedKph: 98, heading: 310, timestamp: '2026-05-21T07:34:22' },
  { lat: 51.9000, lng: -1.2500, speedKph: 90, heading: 315, timestamp: '2026-05-21T07:45:00' },
  { lat: 52.0000, lng: -1.3500, speedKph: 85, heading: 318, timestamp: '2026-05-21T08:00:00' },
  { lat: 52.1000, lng: -1.4500, speedKph: 88, heading: 320, timestamp: '2026-05-21T08:15:00' },
  { lat: 52.2000, lng: -1.5500, speedKph: 92, heading: 322, timestamp: '2026-05-21T08:30:00' },
  { lat: 52.3000, lng: -1.6200, speedKph: 78, heading: 325, timestamp: '2026-05-21T08:45:00' },
  { lat: 52.3800, lng: -1.6800, speedKph: 65, heading: 328, timestamp: '2026-05-21T09:00:00' },
  { lat: 52.4200, lng: -1.7000, speedKph: 45, heading: 330, timestamp: '2026-05-21T09:10:00' },
  { lat: 52.4550, lng: -1.7300, speedKph: 0, heading: 0, timestamp: '2026-05-21T09:18:00' },
]

export const trips: Trip[] = [
  {
    id: 'TRIP001',
    vehicleId: 'V001', vehiclePlate: 'LP-4821', vehicleMake: 'Volvo FH',
    driverId: 'D001', driverName: 'James Hartley', driverAvatar: 'JH',
    fleetId: 'F001', fleetName: 'London HGV',
    jobId: 'JOB001', jobName: 'Amazon BHX2 Morning Delivery',
    routeRunId: 'RR001', routeName: 'London → Birmingham Express',
    startTime: '2026-05-21T06:12:00', endTime: '2026-05-21T09:18:00',
    startAddress: 'Stratford Logistics Park, London E15',
    endAddress: 'Amazon BHX2 Fulfilment Centre, Birmingham B26',
    distanceMiles: 118, durationMinutes: 186,
    maxSpeedKph: 119, avgSpeedKph: 82,
    idleMinutes: 18, movingMinutes: 168,
    harshBrakingCount: 1, harshAccelerationCount: 0, speedingCount: 2,
    fuelUsedLitres: 28.4,
    tripScore: 94,
    positions: londonToBirminghamTrail,
    stops: [
      {
        lat: 51.5400, lng: -0.0800,
        address: 'Stratford Logistics Park, London E15',
        arrivalTime: '2026-05-21T06:00:00', departureTime: '2026-05-21T06:12:00',
        dwellMinutes: 12, reason: 'delivery',
      },
      {
        lat: 52.4550, lng: -1.7300,
        address: 'Amazon BHX2 Fulfilment Centre, Birmingham B26',
        arrivalTime: '2026-05-21T09:18:00', departureTime: '2026-05-21T10:48:00',
        dwellMinutes: 90, reason: 'delivery',
      },
    ],
    events: [
      {
        id: 'TE001', type: 'violation', eventType: 'Speeding',
        lat: 51.7500, lng: -1.0800, speedKph: 119,
        timestamp: '2026-05-21T07:18:45',
        severity: 'warning',
        description: 'Recorded 119km/h — exceeded 97km/h HGV threshold by 22km/h',
        violationId: 'VIO003',
        scoreImpact: -8, positionIndex: 7,
      },
      {
        id: 'TE002', type: 'dashcam', eventType: 'Forward Collision Warning',
        lat: 51.8200, lng: -1.1400, speedKph: 98,
        timestamp: '2026-05-21T07:34:22',
        severity: 'critical',
        description: 'ADAS forward collision warning — too-close following distance at 98km/h',
        dashcamEventId: 'EVT001',
        videoFile: '/videos/dashcam/events/EVT001_front.mp4',
        scoreImpact: -12, positionIndex: 8,
      },
    ],
  },
  {
    id: 'TRIP002',
    vehicleId: 'V004', vehiclePlate: 'LP-9901', vehicleMake: 'Volvo FH',
    driverId: 'D005', driverName: 'Connor McBride', driverAvatar: 'CM',
    fleetId: 'F001', fleetName: 'London HGV',
    jobId: '', jobName: 'No job assigned',
    routeRunId: '', routeName: '',
    startTime: '2026-05-21T06:00:00', endTime: '2026-05-21T07:12:00',
    startAddress: 'Stratford Depot, London E15',
    endAddress: 'A1(M) Southbound — Vehicle returned',
    distanceMiles: 28, durationMinutes: 72,
    maxSpeedKph: 64, avgSpeedKph: 38,
    idleMinutes: 8, movingMinutes: 64,
    harshBrakingCount: 3, harshAccelerationCount: 2, speedingCount: 0,
    fuelUsedLitres: 8.2,
    tripScore: 51,
    positions: [
      { lat: 51.5400, lng: -0.0800, speedKph: 0, heading: 0, timestamp: '2026-05-21T06:00:00' },
      { lat: 51.5500, lng: -0.0900, speedKph: 42, heading: 0, timestamp: '2026-05-21T06:10:00' },
      { lat: 51.5600, lng: -0.1000, speedKph: 58, heading: 0, timestamp: '2026-05-21T06:30:00' },
      { lat: 51.5700, lng: -0.1100, speedKph: 58, heading: 0, timestamp: '2026-05-21T06:52:33' },
      { lat: 51.5800, lng: -0.1200, speedKph: 64, heading: 0, timestamp: '2026-05-21T06:48:12' },
      { lat: 51.5900, lng: -0.1300, speedKph: 45, heading: 0, timestamp: '2026-05-21T07:00:00' },
      { lat: 51.5950, lng: -0.1350, speedKph: 0, heading: 0, timestamp: '2026-05-21T07:12:00' },
    ],
    stops: [
      {
        lat: 51.5950, lng: -0.1350,
        address: 'A1(M) Southbound, London',
        arrivalTime: '2026-05-21T07:12:00', departureTime: '2026-05-21T07:20:00',
        dwellMinutes: 8, reason: 'unknown',
      },
    ],
    events: [
      {
        id: 'TE003', type: 'dashcam', eventType: 'Closed Eyes Detected',
        lat: 51.5800, lng: -0.1200, speedKph: 64,
        timestamp: '2026-05-21T06:48:12',
        severity: 'critical',
        description: 'Driver fatigue — eyes closed for 2.4 seconds at 64km/h',
        dashcamEventId: 'EVT003',
        videoFile: '/videos/dashcam/events/EVT003_cabin.mp4',
        scoreImpact: -18, positionIndex: 4,
      },
      {
        id: 'TE004', type: 'dashcam', eventType: 'Phone Use While Driving',
        lat: 51.5700, lng: -0.1100, speedKph: 58,
        timestamp: '2026-05-21T06:52:33',
        severity: 'critical',
        description: 'Mobile phone use confirmed from cabin camera',
        dashcamEventId: 'EVT004',
        videoFile: '/videos/dashcam/events/EVT004_cabin.mp4',
        scoreImpact: -20, positionIndex: 3,
      },
    ],
  },
  {
    id: 'TRIP003',
    vehicleId: 'V002', vehiclePlate: 'LP-3312', vehicleMake: 'DAF XF',
    driverId: 'D002', driverName: 'Oliver Pemberton', driverAvatar: 'OP',
    fleetId: 'F001', fleetName: 'London HGV',
    jobId: 'JOB002', jobName: 'Tesco RDC Scheduled Delivery',
    routeRunId: '', routeName: '',
    startTime: '2026-05-21T08:05:00', endTime: '2026-05-21T10:48:00',
    startAddress: 'Stratford Logistics Park, London E15',
    endAddress: 'Tesco RDC, Daventry NN11',
    distanceMiles: 87, durationMinutes: 163,
    maxSpeedKph: 105, avgSpeedKph: 74,
    idleMinutes: 22, movingMinutes: 141,
    harshBrakingCount: 2, harshAccelerationCount: 1, speedingCount: 1,
    fuelUsedLitres: 21.8,
    tripScore: 88,
    positions: [
      { lat: 51.5400, lng: -0.0800, speedKph: 0, heading: 315, timestamp: '2026-05-21T08:05:00' },
      { lat: 51.6000, lng: -0.3000, speedKph: 72, heading: 300, timestamp: '2026-05-21T08:25:00' },
      { lat: 51.7000, lng: -0.6000, speedKph: 88, heading: 305, timestamp: '2026-05-21T08:50:00' },
      { lat: 51.8000, lng: -0.9000, speedKph: 92, heading: 310, timestamp: '2026-05-21T09:10:00' },
      { lat: 52.0000, lng: -1.0000, speedKph: 72, heading: 315, timestamp: '2026-05-21T09:14:08' },
      { lat: 52.1500, lng: -1.0800, speedKph: 88, heading: 318, timestamp: '2026-05-21T09:35:00' },
      { lat: 52.2600, lng: -1.1600, speedKph: 45, heading: 320, timestamp: '2026-05-21T09:55:00' },
      { lat: 52.2600, lng: -1.1600, speedKph: 0, heading: 0, timestamp: '2026-05-21T10:48:00' },
    ],
    stops: [
      {
        lat: 52.2600, lng: -1.1600,
        address: 'Tesco RDC, Daventry NN11',
        arrivalTime: '2026-05-21T09:55:00', departureTime: '2026-05-21T10:48:00',
        dwellMinutes: 53, reason: 'delivery',
      },
    ],
    events: [
      {
        id: 'TE005', type: 'violation', eventType: 'Harsh Braking',
        lat: 52.0000, lng: -1.0000, speedKph: 72,
        timestamp: '2026-05-21T09:14:08',
        severity: 'warning',
        description: 'Harsh braking event — 0.35g deceleration exceeded threshold',
        violationId: 'VIO007',
        scoreImpact: -6, positionIndex: 4,
      },
    ],
  },
]

// ─── REPORTS DATA ─────────────────────────────────────────────────────────────
// DEVELOPER NOTES:
// ─────────────────────────────────────────────────────────────────────────────
// SPRINT 1: Standard pre-built reports — generated server-side
// SPRINT 2/3: Self-service drag-and-drop report builder
//
// REPORT GENERATION FLOW:
// 1. User selects report + filters (date range, fleet, driver)
// 2. POST /api/fleetpoint/reports/generate
//    Body: { reportType, dateFrom, dateTo, fleetId?, driverId?, format }
// 3. Backend queries relevant tables, aggregates data
// 4. Returns: { reportId, data: {...}, generatedAt }
// 5. Frontend renders inline with Recharts
// 6. Export: GET /api/fleetpoint/reports/:id/export?format=pdf|xlsx
//    Backend generates file, returns pre-signed download URL
//
// SCHEDULED REPORTS (Sprint 2):
// POST /api/fleetpoint/reports/schedule
// Body: { reportType, frequency: 'daily'|'weekly'|'monthly',
//         recipients: string[], filters, format }
// Backend cron generates and emails on schedule
//
// HSE REPORT (UK compliance):
// Required for UK Operator Licence compliance
// Traffic Commissioner audits
// FORS Silver/Gold accreditation
// Includes: incidents, near misses, fatigue events, miles driven, driver hours
// Export as PDF for official submission
// ─────────────────────────────────────────────────────────────────────────────

export type ReportCategory = 'safety' | 'fleet' | 'maintenance' | 'jobs' | 'compliance'

export interface ReportDefinition {
  id: string
  name: string
  description: string
  category: ReportCategory
  icon: string
  lastGenerated: string
  // What filters this report supports
  supportsDateRange: boolean
  supportsFleetFilter: boolean
  supportsDriverFilter: boolean
  supportsVehicleFilter: boolean
  // Available export formats
  formats: ('pdf' | 'xlsx' | 'csv')[]
  // Is this an HSE/compliance report?
  isCompliance: boolean
}

export const reportDefinitions: ReportDefinition[] = [
  // ── SAFETY REPORTS ─────────────────────────────────────────────────────────
  {
    id: 'RPT001', name: 'Driver Safety Scorecard',
    description: 'All drivers ranked by safety score with violation breakdown, trends and coaching recommendations.',
    category: 'safety', icon: '🛡️',
    lastGenerated: '2026-05-21T08:00:00',
    supportsDateRange: true, supportsFleetFilter: true, supportsDriverFilter: true, supportsVehicleFilter: false,
    formats: ['pdf', 'xlsx'], isCompliance: false,
  },
  {
    id: 'RPT002', name: 'Violations Summary',
    description: 'Complete violations log by type, driver, fleet. Includes fine amounts and review status.',
    category: 'safety', icon: '⚠️',
    lastGenerated: '2026-05-21T08:00:00',
    supportsDateRange: true, supportsFleetFilter: true, supportsDriverFilter: true, supportsVehicleFilter: true,
    formats: ['pdf', 'xlsx', 'csv'], isCompliance: false,
  },
  {
    id: 'RPT003', name: 'HSE Report',
    description: 'Health, Safety & Environment report for UK Operator Licence compliance, Traffic Commissioner audits and FORS accreditation.',
    category: 'safety', icon: '📋',
    lastGenerated: '2026-05-01T08:00:00',
    supportsDateRange: true, supportsFleetFilter: true, supportsDriverFilter: false, supportsVehicleFilter: false,
    formats: ['pdf'], isCompliance: true,
  },
  {
    id: 'RPT004', name: 'DashCam Events Report',
    description: 'All AI-detected camera events: forward collision, fatigue, distraction, phone use. With false positive rates.',
    category: 'safety', icon: '📷',
    lastGenerated: '2026-05-21T08:00:00',
    supportsDateRange: true, supportsFleetFilter: true, supportsDriverFilter: true, supportsVehicleFilter: true,
    formats: ['pdf', 'xlsx'], isCompliance: false,
  },
  // ── FLEET REPORTS ──────────────────────────────────────────────────────────
  {
    id: 'RPT005', name: 'Fleet Utilisation Report',
    description: 'Vehicle activity hours, idle vs moving time, underutilised vehicles. Helps optimise fleet size.',
    category: 'fleet', icon: '🚛',
    lastGenerated: '2026-05-20T08:00:00',
    supportsDateRange: true, supportsFleetFilter: true, supportsDriverFilter: false, supportsVehicleFilter: true,
    formats: ['pdf', 'xlsx'], isCompliance: false,
  },
  {
    id: 'RPT006', name: 'Mileage & Distance Report',
    description: 'Total miles per vehicle, driver and fleet. Date range breakdown with daily/weekly totals.',
    category: 'fleet', icon: '🛣️',
    lastGenerated: '2026-05-21T08:00:00',
    supportsDateRange: true, supportsFleetFilter: true, supportsDriverFilter: true, supportsVehicleFilter: true,
    formats: ['pdf', 'xlsx', 'csv'], isCompliance: false,
  },
  {
    id: 'RPT007', name: 'Trip Summary Report',
    description: 'All trips with vehicle, driver, distance, duration, score. Filter by fleet or driver.',
    category: 'fleet', icon: '🗺️',
    lastGenerated: '2026-05-21T08:00:00',
    supportsDateRange: true, supportsFleetFilter: true, supportsDriverFilter: true, supportsVehicleFilter: true,
    formats: ['pdf', 'xlsx', 'csv'], isCompliance: false,
  },
  {
    id: 'RPT008', name: 'Fuel Consumption Report',
    description: 'Fuel used per vehicle and fleet. Cost estimates, outlier detection, comparison between periods.',
    category: 'fleet', icon: '⛽',
    lastGenerated: '2026-05-20T08:00:00',
    supportsDateRange: true, supportsFleetFilter: true, supportsDriverFilter: false, supportsVehicleFilter: true,
    formats: ['pdf', 'xlsx'], isCompliance: false,
  },
  // ── MAINTENANCE REPORTS ────────────────────────────────────────────────────
  {
    id: 'RPT009', name: 'Maintenance Cost Report',
    description: 'Service costs by vehicle, fleet, workshop and service type. Budget vs actual comparison.',
    category: 'maintenance', icon: '🔧',
    lastGenerated: '2026-05-19T08:00:00',
    supportsDateRange: true, supportsFleetFilter: true, supportsDriverFilter: false, supportsVehicleFilter: true,
    formats: ['pdf', 'xlsx'], isCompliance: false,
  },
  {
    id: 'RPT010', name: 'Vehicle Health Summary',
    description: 'Fleet-wide health scores over time. CAN bus fault codes, predicted failures, maintenance backlog.',
    category: 'maintenance', icon: '🏥',
    lastGenerated: '2026-05-21T08:00:00',
    supportsDateRange: true, supportsFleetFilter: true, supportsDriverFilter: false, supportsVehicleFilter: true,
    formats: ['pdf', 'xlsx'], isCompliance: false,
  },
  {
    id: 'RPT011', name: 'Document Expiry Report',
    description: 'All expiring documents in next 30/60/90 days. MOT, insurance, licences, CPC cards. Traffic light status.',
    category: 'compliance', icon: '📁',
    lastGenerated: '2026-05-21T08:00:00',
    supportsDateRange: false, supportsFleetFilter: true, supportsDriverFilter: true, supportsVehicleFilter: true,
    formats: ['pdf', 'xlsx'], isCompliance: true,
  },
  // ── JOBS & ROUTES REPORTS ──────────────────────────────────────────────────
  {
    id: 'RPT012', name: 'Job Completion Report',
    description: 'Jobs completed, failed, on-time vs late. SLA compliance per customer. Driver performance on jobs.',
    category: 'jobs', icon: '💼',
    lastGenerated: '2026-05-20T08:00:00',
    supportsDateRange: true, supportsFleetFilter: true, supportsDriverFilter: true, supportsVehicleFilter: false,
    formats: ['pdf', 'xlsx'], isCompliance: false,
  },
  {
    id: 'RPT013', name: 'Route Adherence Report',
    description: 'Route compliance scores per route and driver. Deviation events, average deviation distance.',
    category: 'jobs', icon: '📍',
    lastGenerated: '2026-05-20T08:00:00',
    supportsDateRange: true, supportsFleetFilter: true, supportsDriverFilter: true, supportsVehicleFilter: false,
    formats: ['pdf', 'xlsx'], isCompliance: false,
  },
  // ── COMPLIANCE REPORTS ─────────────────────────────────────────────────────
  {
    id: 'RPT014', name: 'Driver Hours Compliance',
    description: 'EU/GB driver hours rules compliance. Driving time, rest periods, weekly/fortnightly limits.',
    category: 'compliance', icon: '⏱️',
    lastGenerated: '2026-05-18T08:00:00',
    supportsDateRange: true, supportsFleetFilter: true, supportsDriverFilter: true, supportsVehicleFilter: false,
    formats: ['pdf', 'xlsx'], isCompliance: true,
  },
  {
    id: 'RPT015', name: 'Operator Licence Compliance',
    description: 'Full compliance summary for UK Operator Licence. MOT status, insurance, driver qualifications, maintenance records.',
    category: 'compliance', icon: '🏛️',
    lastGenerated: '2026-05-01T08:00:00',
    supportsDateRange: false, supportsFleetFilter: false, supportsDriverFilter: false, supportsVehicleFilter: false,
    formats: ['pdf'], isCompliance: true,
  },
]

// ─── SETTINGS DATA ────────────────────────────────────────────────────────────
// DEVELOPER NOTES:
// ─────────────────────────────────────────────────────────────────────────────
// Settings stored in DB table: org_settings (per organisation)
// User preferences in: user_settings (per user)
//
// API:
// GET  /api/settings/org        — load org settings
// PUT  /api/settings/org        — save org settings
// GET  /api/settings/user       — load user settings
// PUT  /api/settings/user       — save user settings
// GET  /api/settings/integrations — integration status
// POST /api/settings/integrations/:id/test — test connection
//
// NOTIFICATIONS:
// Alert preferences stored per user in: notification_preferences
// GET  /api/settings/notifications
// PUT  /api/settings/notifications
//
// INTEGRATIONS:
// BSJ IOT: uses API key + endpoint stored encrypted in DB
// Never expose API keys to frontend — store in backend only
// POST /api/settings/integrations/bsj/test → { connected, deviceCount, lastSync }
// ─────────────────────────────────────────────────────────────────────────────

export interface OrgSettings {
  // Organisation
  companyName: string
  companyLogo: string
  timezone: string
  currency: string
  distanceUnit: 'miles' | 'km'
  speedUnit: 'mph' | 'kph'
  dateFormat: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD'
  timeFormat: '12h' | '24h'
  country: string
  industry: string
  // Billing
  plan: 'starter' | 'professional' | 'enterprise'
  seatsUsed: number
  seatsTotal: number
  billingEmail: string
  renewalDate: string
}

export interface NotificationSetting {
  id: string
  category: 'vehicle' | 'driver' | 'job' | 'system' | 'compliance'
  name: string
  description: string
  inApp: boolean
  email: boolean
  sms: boolean
  push: boolean
  // Who receives this alert
  recipients: 'all_managers' | 'fleet_manager' | 'driver' | 'custom'
}

export interface IntegrationSetting {
  id: string
  name: string
  description: string
  category: 'telematics' | 'camera' | 'accounting' | 'fuel' | 'tachograph' | 'api' | 'webhook'
  status: 'connected' | 'disconnected' | 'error' | 'coming_soon'
  icon: string
  deviceCount?: number
  lastSync?: string
  apiEndpoint?: string
  features: string[]
  comingSoon?: boolean
}

export const orgSettings: OrgSettings = {
  companyName: 'LogisticsPro Ltd',
  companyLogo: '',
  timezone: 'Europe/London',
  currency: 'GBP',
  distanceUnit: 'miles',
  speedUnit: 'mph',
  dateFormat: 'DD/MM/YYYY',
  timeFormat: '24h',
  country: 'United Kingdom',
  industry: 'Logistics & Transport',
  plan: 'professional',
  seatsUsed: 12,
  seatsTotal: 25,
  billingEmail: 'accounts@logisticspro.co.uk',
  renewalDate: '2027-01-01',
}

export const notificationSettings: NotificationSetting[] = [
  // Vehicle alerts
  { id: 'NS001', category: 'vehicle', name: 'Speeding Alert', description: 'Vehicle exceeds configured speed threshold', inApp: true, email: false, sms: false, push: true, recipients: 'fleet_manager' },
  { id: 'NS002', category: 'vehicle', name: 'Harsh Driving Event', description: 'Harsh braking, acceleration or cornering detected', inApp: true, email: false, sms: false, push: true, recipients: 'fleet_manager' },
  { id: 'NS003', category: 'vehicle', name: 'Vehicle Offline', description: 'No GPS signal received for more than 30 minutes', inApp: true, email: true, sms: false, push: false, recipients: 'all_managers' },
  { id: 'NS004', category: 'vehicle', name: 'Low Fuel Warning', description: 'Vehicle fuel level below 15%', inApp: true, email: false, sms: false, push: true, recipients: 'driver' },
  { id: 'NS005', category: 'vehicle', name: 'Geozone Violation', description: 'Vehicle entered restricted zone', inApp: true, email: true, sms: true, push: true, recipients: 'fleet_manager' },
  { id: 'NS006', category: 'vehicle', name: 'MOT Expiry Warning', description: 'Vehicle MOT expires within 30 days', inApp: true, email: true, sms: false, push: false, recipients: 'all_managers' },
  // Driver alerts
  { id: 'NS007', category: 'driver', name: 'Fatigue Alert', description: 'Driver fatigue detected by DashCam', inApp: true, email: true, sms: true, push: true, recipients: 'all_managers' },
  { id: 'NS008', category: 'driver', name: 'Phone Use Detected', description: 'Mobile phone use while driving detected', inApp: true, email: true, sms: false, push: true, recipients: 'fleet_manager' },
  { id: 'NS009', category: 'driver', name: 'Licence Expiry Warning', description: 'Driver licence expires within 60 days', inApp: true, email: true, sms: false, push: false, recipients: 'all_managers' },
  { id: 'NS010', category: 'driver', name: 'Driver Score Drop', description: 'Driver safety score drops by more than 10 points', inApp: true, email: true, sms: false, push: false, recipients: 'fleet_manager' },
  // Job alerts
  { id: 'NS011', category: 'job', name: 'Job Late Alert', description: 'Job is running behind schedule by more than 30 minutes', inApp: true, email: true, sms: true, push: true, recipients: 'all_managers' },
  { id: 'NS012', category: 'job', name: 'Job Completed', description: 'Driver has completed a job', inApp: true, email: false, sms: false, push: false, recipients: 'fleet_manager' },
  { id: 'NS013', category: 'job', name: 'SLA Breach', description: 'Delivery SLA has been breached', inApp: true, email: true, sms: true, push: true, recipients: 'all_managers' },
  // System alerts
  { id: 'NS014', category: 'system', name: 'Device Battery Low', description: 'IoT device battery below 20%', inApp: true, email: false, sms: false, push: false, recipients: 'all_managers' },
  { id: 'NS015', category: 'system', name: 'New Login', description: 'New login detected from an unrecognised device', inApp: true, email: true, sms: true, push: false, recipients: 'all_managers' },
  // Compliance
  { id: 'NS016', category: 'compliance', name: 'Document Expiry', description: 'Any compliance document expires within 30 days', inApp: true, email: true, sms: false, push: false, recipients: 'all_managers' },
  { id: 'NS017', category: 'compliance', name: 'Driver Hours Warning', description: 'Driver approaching EU/GB hours limit', inApp: true, email: true, sms: true, push: true, recipients: 'driver' },
]

export const integrationSettings: IntegrationSetting[] = [
  {
    id: 'INT001', name: 'BSJ IOT DashCam', category: 'camera',
    description: 'Live AI dashcam events — forward collision, fatigue, distraction, phone use, lane departure',
    status: 'connected', icon: '📷',
    deviceCount: 8, lastSync: '2026-05-21T14:38:00',
    apiEndpoint: 'https://api.bsjiot.com/v2',
    features: ['Live video streaming', 'AI event detection', 'ADAS alerts', 'DMS fatigue detection', 'Automatic event clips'],
  },
  {
    id: 'INT002', name: 'IoTility GPS Devices', category: 'telematics',
    description: 'Primary GPS tracking — real-time vehicle positions, trip data, CAN bus diagnostics',
    status: 'connected', icon: '📡',
    deviceCount: 15, lastSync: '2026-05-21T14:40:00',
    apiEndpoint: 'https://track.iotility.io/v1',
    features: ['Real-time tracking (10s intervals)', 'Trip recording', 'CAN bus data', 'Tachograph integration', 'Geofence checks'],
  },
  {
    id: 'INT003', name: 'Xero Accounting', category: 'accounting',
    description: 'Sync maintenance costs, fuel expenses and invoices with Xero',
    status: 'disconnected', icon: '💼',
    features: ['Maintenance cost sync', 'Fuel expense export', 'Invoice generation', 'Budget tracking'],
    comingSoon: false,
  },
  {
    id: 'INT004', name: 'Allstar Fuel Cards', category: 'fuel',
    description: 'Import fuel transactions from Allstar fuel cards — match to vehicles automatically',
    status: 'disconnected', icon: '⛽',
    features: ['Transaction import', 'Vehicle matching', 'Cost per mile calculation', 'Fuel theft detection'],
    comingSoon: false,
  },
  {
    id: 'INT005', name: 'Shell Fleet Card', category: 'fuel',
    description: 'Import Shell fleet card transactions',
    status: 'disconnected', icon: '⛽',
    features: ['Transaction import', 'Vehicle matching'],
    comingSoon: false,
  },
  {
    id: 'INT006', name: 'Tachograph Download', category: 'tachograph',
    description: 'Remote digital tachograph download — driver cards and vehicle units',
    status: 'coming_soon', icon: '⏱️',
    features: ['Remote VU download', 'Driver card download', 'Hours analysis', 'Infringement detection'],
    comingSoon: true,
  },
  {
    id: 'INT007', name: 'Webhooks', category: 'webhook',
    description: 'Send real-time event data to your own systems via HTTP webhooks',
    status: 'disconnected', icon: '🔗',
    features: ['Vehicle events', 'Violation events', 'Job status updates', 'Custom payloads', 'Retry logic'],
    comingSoon: false,
  },
  {
    id: 'INT008', name: 'REST API Access', category: 'api',
    description: 'Full API access to IoTility data — build custom integrations and dashboards',
    status: 'connected', icon: '🔑',
    features: ['Full read/write API', 'API key management', 'Rate limiting', 'Webhook support', 'OpenAPI docs'],
    comingSoon: false,
  },
]
