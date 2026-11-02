import { DropdownOption } from '@iotility/shared-ui';
import {
  DASHCAM_MEDIA_URL,
  DashcamDeviceRecord,
  DashcamViolationRecord,
} from '../../shared/services/dashcam-api.service';
import { NOT_AVAILABLE, text } from '../maintenance/maintenance.data';

export { NOT_AVAILABLE };

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
  /** Event time in ms, for day buckets; null when the API sends none. */
  time: number | null;
  eventType: string;
  /** Grouped from the violation type; null for a type outside the AI camera set. */
  category: DashcamCategory | null;
  /** The API has no severity, review state or score impact for DashCam events. */
  severity: DashcamSeverity | null;
  review: DashcamReview | null;
  driver: string;
  vehicle: string;
  location: string;
  speed: number | null;
  scoreImpact: number | null;
  device: string;
  cameras: string[];
  /** Evidence clip or snapshot, when the device uploaded one. */
  mediaUrl: string;
}

/** Camera views per device model, as hypernym-fms-fe's livestream channel picker offers them. */
const DEVICE_CAMERAS: Record<string, string[]> = {
  'Howen DC': ['Front', 'Cabin'],
  'BSJ EH3T SC': ['Front'],
  'BSJ EH3T DC': ['Front', 'Rear'],
  'BSJ EH13P DC': ['Front', 'Rear'],
  'BSJ EH3T TC': ['Front', 'Rear', 'Cabin'],
  'BSJ EH13P TC': ['Front', 'Rear', 'Cabin'],
  'BSJ Multiple Channel': ['Front', 'Rear'],
};

export function deviceCameras(deviceType: string | null | undefined): string[] {
  if (!deviceType) return [];
  if (deviceType.toLowerCase().startsWith('concox')) return ['Front', 'Rear'];
  return DEVICE_CAMERAS[deviceType] ?? ['Front'];
}

const VIOLATION_CATEGORIES: Record<string, DashcamCategory> = {
  'eye closing': 'fatigue',
  yawning: 'fatigue',
  'fatigue alert': 'fatigue',
  calling: 'distraction',
  smoking: 'distraction',
  glancing: 'distraction',
  'camera covered': 'camera',
  'pedestrian collision': 'safety-critical',
  'lane departure': 'safety-critical',
  'too close to the vehicle ahead': 'safety-critical',
  'distance too close': 'safety-critical',
  'forward & backward collision': 'safety-critical',
};

export function toDashcamVehicle(device: DashcamDeviceRecord, events: DashcamEvent[]): DashcamVehicle {
  const plate = text(device.name);
  return {
    id: String(device.vehicle_id),
    plate,
    model: text(device.device_type),
    driver: events.find((event) => event.vehicle === plate && event.driver !== NOT_AVAILABLE)?.driver ?? NOT_AVAILABLE,
    cameras: deviceCameras(device.device_type),
    // The endpoint lists only the dashcams currently available for streaming.
    online: true,
  };
}

export function toDashcamEvent(record: DashcamViolationRecord, devices: DashcamDeviceRecord[]): DashcamEvent {
  const type = record.violation_name ?? record.violation_type;
  const device = devices.find((item) => item.vehicle_id === record.vehicle);
  const time = record.event_generation_time ? new Date(record.event_generation_time).getTime() : NaN;
  const speed = record.speed === null || record.speed === '' ? NaN : Number(record.speed);
  return {
    id: `EVT-${record.id}`,
    timestamp: Number.isNaN(time) ? NOT_AVAILABLE : eventTimestamp(new Date(time)),
    time: Number.isNaN(time) ? null : time,
    eventType: text(type),
    category: VIOLATION_CATEGORIES[type?.trim().toLowerCase() ?? ''] ?? null,
    severity: null,
    review: null,
    driver: text(record.driver_name),
    vehicle: text(record.vehicle_name),
    location: text(record.location),
    speed: Number.isNaN(speed) ? null : speed,
    scoreImpact: null,
    device: text(record.device_id),
    cameras: deviceCameras(device?.device_type),
    mediaUrl: record.file_name ? DASHCAM_MEDIA_URL + record.file_name : '',
  };
}

/** "Today · 14:38", or "28 Oct · 14:38" for an earlier day. */
function eventTimestamp(date: Date): string {
  const clock = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const day =
    date.toDateString() === new Date().toDateString()
      ? 'Today'
      : date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  return `${day} · ${clock}`;
}

export function initials(name: string): string {
  if (name === NOT_AVAILABLE) return NOT_AVAILABLE;
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export const CATEGORY_LABELS: Record<DashcamCategory, string> = {
  'safety-critical': 'Safety Critical',
  fatigue: 'Driver Fatigue',
  distraction: 'Distraction',
  'driving-style': 'Driving Style',
  identity: 'Identity',
  camera: 'Camera',
};

export function categoryLabel(category: DashcamCategory | null): string {
  return category ? CATEGORY_LABELS[category] : NOT_AVAILABLE;
}

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
