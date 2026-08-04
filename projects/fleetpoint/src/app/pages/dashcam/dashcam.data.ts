import { DropdownOption } from '@iotility/shared-ui';

export type DashcamCategory =
  'safety-critical' | 'fatigue' | 'distraction' | 'driving-style' | 'identity' | 'camera';
export type DashcamSeverity = 'Critical' | 'Warning' | 'Info';
export type DashcamReview = 'Unreviewed' | 'Acknowledged' | 'Violation' | 'False Positive';

export interface DashcamVehicle {
  id: string;
  plate: string;
  model: string;
  driver: string;
  cameras: string[];
  online: boolean;
}

export interface DashcamEvent {
  id: string;
  timestamp: string;
  eventType: string;
  category: DashcamCategory;
  severity: DashcamSeverity;
  review: DashcamReview;
  driver: string;
  vehicle: string;
  location: string;
  speed: number;
  scoreImpact: number;
  device: string;
  cameras: string[];
}

export const DASHCAM_VEHICLES: DashcamVehicle[] = [
  {
    id: 'V1',
    plate: 'LP-4821',
    model: 'Volvo FH',
    driver: 'Mohammed Al-Rashid',
    cameras: ['Front', 'Cabin', 'Rear'],
    online: true,
  },
  {
    id: 'V2',
    plate: 'LP-0392',
    model: 'Volvo FH Reefer',
    driver: 'Aisha Khan',
    cameras: ['Front', 'Cabin'],
    online: true,
  },
  {
    id: 'V3',
    plate: 'LP-9901',
    model: 'Volvo FH',
    driver: 'Connor Murphy',
    cameras: ['Front', 'Cabin', 'Rear', 'Side'],
    online: true,
  },
  {
    id: 'V4',
    plate: 'LP-2201',
    model: 'Mercedes Actros',
    driver: 'Oliver Price',
    cameras: ['Front', 'Cabin'],
    online: true,
  },
  {
    id: 'V5',
    plate: 'LP-7734',
    model: 'DAF XF',
    driver: 'James Wilson',
    cameras: ['Front', 'Cabin'],
    online: false,
  },
];

export const DASHCAM_EVENTS: DashcamEvent[] = [
  {
    id: 'EVT-1048',
    timestamp: 'Today · 14:38',
    eventType: 'Road Departure Warning',
    category: 'safety-critical',
    severity: 'Critical',
    review: 'Unreviewed',
    driver: 'Mohammed Al-Rashid',
    vehicle: 'LP-4821',
    location: 'M40 Southbound, Bicester',
    speed: 88,
    scoreImpact: -15,
    device: 'BSJ-4821',
    cameras: ['Front', 'Cabin'],
  },
  {
    id: 'EVT-1047',
    timestamp: 'Today · 14:24',
    eventType: 'Mobile Phone Use',
    category: 'distraction',
    severity: 'Critical',
    review: 'Violation',
    driver: 'Mohammed Al-Rashid',
    vehicle: 'LP-4821',
    location: 'M40 Southbound',
    speed: 74,
    scoreImpact: -10,
    device: 'BSJ-4821',
    cameras: ['Cabin'],
  },
  {
    id: 'EVT-1046',
    timestamp: 'Today · 13:52',
    eventType: 'Driver Yawning',
    category: 'fatigue',
    severity: 'Warning',
    review: 'False Positive',
    driver: 'Aisha Khan',
    vehicle: 'LP-0392',
    location: 'A38, Lichfield',
    speed: 58,
    scoreImpact: 0,
    device: 'BSJ-0392',
    cameras: ['Cabin'],
  },
  {
    id: 'EVT-1045',
    timestamp: 'Today · 12:06',
    eventType: 'Harsh Braking',
    category: 'driving-style',
    severity: 'Warning',
    review: 'Unreviewed',
    driver: 'Connor Murphy',
    vehicle: 'LP-9901',
    location: 'Trafford Park, Manchester',
    speed: 42,
    scoreImpact: -5,
    device: 'BSJ-9901',
    cameras: ['Front'],
  },
  {
    id: 'EVT-1044',
    timestamp: 'Today · 11:41',
    eventType: 'Seatbelt Not Detected',
    category: 'safety-critical',
    severity: 'Critical',
    review: 'Unreviewed',
    driver: 'Oliver Price',
    vehicle: 'LP-2201',
    location: 'Birmingham Ring Road',
    speed: 36,
    scoreImpact: -12,
    device: 'BSJ-2201',
    cameras: ['Cabin'],
  },
  {
    id: 'EVT-1043',
    timestamp: 'Today · 10:18',
    eventType: 'Camera Obscured',
    category: 'camera',
    severity: 'Info',
    review: 'Acknowledged',
    driver: 'Aisha Khan',
    vehicle: 'LP-0392',
    location: 'A5, Tamworth',
    speed: 0,
    scoreImpact: 0,
    device: 'BSJ-0392',
    cameras: ['Rear'],
  },
  {
    id: 'EVT-1042',
    timestamp: 'Today · 09:34',
    eventType: 'Driver Identification',
    category: 'identity',
    severity: 'Info',
    review: 'False Positive',
    driver: 'James Wilson',
    vehicle: 'LP-7734',
    location: 'Bicester Depot',
    speed: 0,
    scoreImpact: 0,
    device: 'BSJ-7734',
    cameras: ['Cabin'],
  },
  {
    id: 'EVT-1041',
    timestamp: 'Today · 08:15',
    eventType: 'Forward Collision Warning',
    category: 'safety-critical',
    severity: 'Critical',
    review: 'Violation',
    driver: 'Connor Murphy',
    vehicle: 'LP-9901',
    location: 'M6 Northbound',
    speed: 92,
    scoreImpact: -18,
    device: 'BSJ-9901',
    cameras: ['Front'],
  },
];

export const CATEGORY_LABELS: Record<DashcamCategory, string> = {
  'safety-critical': 'Safety Critical',
  fatigue: 'Driver Fatigue',
  distraction: 'Distraction',
  'driving-style': 'Driving Style',
  identity: 'Identity',
  camera: 'Camera',
};

export const CATEGORY_OPTIONS: DropdownOption[] = [
  { id: 'all', label: 'All Categories' },
  ...Object.entries(CATEGORY_LABELS).map(([id, label]) => ({ id, label })),
];
export const SEVERITY_OPTIONS: DropdownOption[] = [
  { id: 'all', label: 'All Severities' },
  ...['Critical', 'Warning', 'Info'].map((label) => ({ id: label, label })),
];
export const REVIEW_OPTIONS: DropdownOption[] = [
  { id: 'all', label: 'All Review Statuses' },
  ...['Unreviewed', 'Acknowledged', 'Violation', 'False Positive'].map((label) => ({
    id: label,
    label,
  })),
];
