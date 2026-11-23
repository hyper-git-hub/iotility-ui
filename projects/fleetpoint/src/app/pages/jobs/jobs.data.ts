import { JobApiRecord } from '../../shared/services/jobs-api.service';
import { NOT_AVAILABLE, text } from '../maintenance/maintenance.data';

export { NOT_AVAILABLE };

/** "Failed" is the UI's name for fms-driver's aborted (4) jobs; the API has no "Assigned". */
export type JobStatus = 'Pending' | 'In Progress' | 'Completed' | 'Failed' | 'Assigned';

export interface JobTask {
  label: string;
  done: boolean;
}

export interface JobRecord {
  /** fms-driver job id. */
  recordId: number;
  /** Display id, e.g. JOB004. */
  id: string;
  name: string;
  driverId: string;
  driver: string;
  vehicleId: string;
  vehicle: string;
  type: string;
  /** "High" | "Normal" | "Low". */
  priority: string;
  /** Planned length of the job, from estimated_duration (minutes). */
  estimatedTime: string;
  pickup: string;
  dropoff: string;
  scheduled: string;
  start: Date | null;
  end: Date | null;
  status: JobStatus;
  /** "completed/total". */
  tasks: string;
  taskList: JobTask[];
  distance: string;
  started: string;
  completed: string;
  notes: string;
  createdBy: string;
  createdAt: string;
}

const STATUS: Record<string, JobStatus> = { '1': 'Pending', '2': 'In Progress', '3': 'Completed', '4': 'Failed' };
const TYPE: Record<string, string> = { '1': 'Ad-Hoc', '2': 'Scheduled', '3': 'Route' };
/** fms-driver job priority: 1 high, 2 normal, 3 low. */
export const PRIORITY_LABELS: Record<string, string> = { '1': 'High', '2': 'Normal', '3': 'Low' };
const COMPLETED = '3';

/** Binds what GET fms-driver/jobs/ sends; anything it doesn't is "—". */
export function toJobRecord(record: JobApiRecord): JobRecord {
  const tasks = [...(record.tasks ?? [])].sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
  const done = tasks.filter((task) => String(task.task_status) === COMPLETED).length;
  const start = parseDate(record.start_date);
  const end = parseDate(record.end_date);
  const vehicleId = record.vehicle == null ? '' : String(record.vehicle);
  return {
    recordId: record.id,
    id: `JOB${String(record.id).padStart(3, '0')}`,
    name: text(record.job_name),
    driverId: record.driver == null ? '' : String(record.driver),
    driver: text(record.driver_name),
    vehicleId,
    vehicle: record.vehicle_name?.trim() || NOT_AVAILABLE,
    type: TYPE[String(record.job_type)] ?? NOT_AVAILABLE,
    priority: PRIORITY_LABELS[String(record.priority)] ?? NOT_AVAILABLE,
    estimatedTime: duration(record.estimated_duration),
    pickup: text(tasks[0]?.pick_up__address),
    dropoff: text(tasks.at(-1)?.drop_off__address),
    scheduled: start || end ? `${dateTime(start)} → ${dateTime(end)}` : NOT_AVAILABLE,
    start,
    end,
    status: STATUS[String(record.job_status)] ?? 'Pending',
    tasks: `${done}/${tasks.length}`,
    taskList: tasks.map((task) => ({
      label: [task.pick_up__address, task.drop_off__address].filter(Boolean).join(' → ') || NOT_AVAILABLE,
      done: String(task.task_status) === COMPLETED,
    })),
    distance:
      record.travelled_distance == null
        ? NOT_AVAILABLE
        : `${Number(record.travelled_distance).toLocaleString(undefined, { maximumFractionDigits: 1 })} km`,
    started: record.start_time_by_driver ? dateTime(parseDate(record.start_time_by_driver)) : 'Not started',
    completed: record.end_time_by_driver ? dateTime(parseDate(record.end_time_by_driver)) : NOT_AVAILABLE,
    // The job's own notes; an abort reason only when there are none.
    notes: text(record.notes || record.reason_description || record.reason),
    createdBy: text(record.created_by_name || record.modified_by),
    createdAt: record.created_at ? shortDate(parseDate(record.created_at)) : NOT_AVAILABLE,
  };
}

/** Minutes as "45 min" or "2h 15m". */
function duration(minutes: number | null | undefined): string {
  if (minutes == null || !Number.isFinite(Number(minutes))) return NOT_AVAILABLE;
  const total = Math.max(0, Math.round(Number(minutes)));
  const hours = Math.floor(total / 60);
  return hours ? `${hours}h ${String(total % 60).padStart(2, '0')}m` : `${total} min`;
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "22 Sep 09:59" in the viewer's time zone. */
function dateTime(date: Date | null): string {
  if (!date) return NOT_AVAILABLE;
  return `${shortDate(date)} ${date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
}

function shortDate(date: Date | null): string {
  return date ? date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : NOT_AVAILABLE;
}

/** Local "YYYY-MM-DDTHH:mm" (date picker value) → UTC "yyyy-MM-dd HH:mm:ss", as hypernym-fms-fe sends it. */
export function toUtcDateTime(value: string): string {
  return new Date(value).toISOString().slice(0, 19).replace('T', ' ');
}
