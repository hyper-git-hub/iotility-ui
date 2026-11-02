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
  /** The API has no job priority. */
  priority: string;
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
const TYPE: Record<string, string> = { '1': 'Ad-Hoc', '2': 'Scheduled' };
const COMPLETED = '3';

/** Binds what GET fms-driver/jobs/ sends; anything it doesn't is "—". */
export function toJobRecord(record: JobApiRecord, vehicleNames: ReadonlyMap<string, string>): JobRecord {
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
    vehicle: vehicleNames.get(vehicleId) ?? NOT_AVAILABLE,
    type: TYPE[String(record.job_type)] ?? NOT_AVAILABLE,
    priority: NOT_AVAILABLE,
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
    notes: text(record.reason_description || record.reason),
    createdBy: text(record.modified_by),
    createdAt: record.created_at ? shortDate(parseDate(record.created_at)) : NOT_AVAILABLE,
  };
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
