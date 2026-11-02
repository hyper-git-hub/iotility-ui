import { DropdownOption } from '@iotility/shared-ui';
import { RouteAllocationRecord, RouteApiRecord } from '../../shared/services/routes-api.service';
import { NOT_AVAILABLE, text } from '../maintenance/maintenance.data';

export { NOT_AVAILABLE };

export type RunStatus = 'Scheduled' | 'En Route' | 'Completed' | 'Cancelled';
export interface RouteRecord {
  recordId: number;
  id: string;
  name: string;
  start: string;
  end: string;
  stops: number;
  distance: string;
  duration: string;
  /** Vehicles this route is allocated to. */
  assigned: string;
  vehicleIds: string[];
  runs: number;
  stopList: RouteStop[];
  /** Planned road path as [lat, lng] pairs. */
  path: [number, number][];
}
export interface RunRecord {
  recordId: number;
  id: string;
  routeId: string;
  route: string;
  driver: string;
  vehicle: string;
  status: RunStatus;
  dispatch: string;
  scheduled: string;
  startsAt: Date | null;
  stops: string;
  compliance: string;
  deviations: string;
}
export interface RouteStop { name: string; address: string; dwell: string; }

export const STATUS_OPTIONS: DropdownOption[] = [
  { id: 'all', label: 'All statuses' },
  { id: 'Scheduled', label: 'Scheduled' },
  { id: 'En Route', label: 'En Route' },
  { id: 'Completed', label: 'Completed' },
  { id: 'Cancelled', label: 'Cancelled' },
];

/** job_status_display → run status ("En-route" is the API's spelling). */
const RUN_STATUS: Record<string, RunStatus> = { scheduled: 'Scheduled', 'en-route': 'En Route', completed: 'Completed', cancelled: 'Cancelled' };

export const routeCode = (id: number | null | undefined) => (id == null ? NOT_AVAILABLE : `RT-${String(id).padStart(3, '0')}`);

/** Binds what GET /api/route/ sends; anything it doesn't is "—". */
export function toRouteRecord(route: RouteApiRecord): RouteRecord {
  const allocations = route.route_allocations ?? [];
  const vehicles = [...new Set(allocations.map((item) => item.vehicle_name).filter((name): name is string => !!name))];
  const subroutes = route.subroutes ?? [];
  return {
    recordId: route.id,
    id: routeCode(route.id),
    name: text(route.name),
    start: place(route.origin_name),
    end: place(route.destination_name),
    stops: route.no_of_stops ?? route.stops?.length ?? 0,
    distance: kilometres(route.distance),
    duration: minutes(route.estimated_arrival ?? route.travel_duration),
    assigned: vehicles.length ? vehicles.join(', ') : NOT_AVAILABLE,
    vehicleIds: allocations.map((item) => String(item.vehicle ?? '')).filter(Boolean),
    runs: allocations.length,
    stopList: [
      { name: place(route.origin_name), address: 'Start point', dwell: NOT_AVAILABLE },
      ...(route.stops ?? []).map((_, index) => ({
        name: text(route.stop_names?.[index]?.stop_name) === NOT_AVAILABLE ? `Stop ${index + 1}` : place(route.stop_names?.[index]?.stop_name),
        address: `Stop ${index + 1}`,
        dwell: subroutes[index]?.stay_time != null ? `${subroutes[index].stay_time}min` : NOT_AVAILABLE,
      })),
      { name: place(route.destination_name), address: 'End point', dwell: NOT_AVAILABLE },
    ],
    path: route.polyline ? decodePolyline(route.polyline) : [],
  };
}

export function toRunRecord(run: RouteAllocationRecord): RunRecord {
  const startsAt = run.start_date ? new Date(run.start_date) : null;
  const status = RUN_STATUS[String(run.job_status_display ?? '').toLowerCase()];
  return {
    recordId: run.id,
    id: `RUN-${run.id}`,
    routeId: routeCode(run.route),
    route: text(run.route_name),
    driver: text(run.driver_name),
    vehicle: text(run.vehicle_name),
    status: status ?? 'Scheduled',
    dispatch: NOT_AVAILABLE,
    scheduled: startsAt && !Number.isNaN(startsAt.getTime()) ? dateTime(startsAt) : NOT_AVAILABLE,
    startsAt,
    stops: run.no_of_stops != null ? String(run.no_of_stops) : NOT_AVAILABLE,
    compliance: NOT_AVAILABLE,
    deviations: NOT_AVAILABLE,
  };
}

/** The API keeps full addresses; the UI shows the first part, like hypernym-fms-fe. */
function place(value: string | null | undefined): string {
  return text(value?.split(',')[0]);
}

function kilometres(metres: number | null): string {
  return metres == null ? NOT_AVAILABLE : `${(metres / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })} km`;
}

function minutes(value: number | null): string {
  if (value == null) return NOT_AVAILABLE;
  const total = Math.round(value);
  return total >= 60 ? `${Math.floor(total / 60)}h ${total % 60}m` : `${total}m`;
}

function dateTime(date: Date): string {
  return `${date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} ${date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
}

/** Google encoded polyline (precision 5) → [lat, lng] pairs. */
export function decodePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = [];
  let index = 0, lat = 0, lng = 0;
  const next = () => {
    let shift = 0, result = 0, byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  while (index < encoded.length) {
    lat += next();
    lng += next();
    points.push([lat / 1e5, lng / 1e5]);
  }
  return points;
}

/** [lat, lng] pairs → Google encoded polyline (precision 5). */
export function encodePolyline(path: [number, number][]): string {
  let output = '', previousLat = 0, previousLng = 0;
  const encode = (value: number) => {
    let current = value < 0 ? ~(value << 1) : value << 1;
    let chunk = '';
    while (current >= 0x20) {
      chunk += String.fromCharCode((0x20 | (current & 0x1f)) + 63);
      current >>= 5;
    }
    return chunk + String.fromCharCode(current + 63);
  };
  for (const [latitude, longitude] of path) {
    const lat = Math.round(latitude * 1e5), lng = Math.round(longitude * 1e5);
    output += encode(lat - previousLat) + encode(lng - previousLng);
    previousLat = lat;
    previousLng = lng;
  }
  return output;
}

/** Local "YYYY-MM-DDTHH:mm" (date picker value) → UTC "yyyy-MM-dd HH:mm:ss", as hypernym-fms-fe sends it. */
export function toUtcDateTime(value: string): string {
  return new Date(value).toISOString().slice(0, 19).replace('T', ' ');
}
