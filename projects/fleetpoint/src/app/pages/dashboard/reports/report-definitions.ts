import { TableColumn } from '@iotility/shared-ui';
import { ReportType } from '../../../shared/services/reports-api.service';

export interface ReportDefinition {
  type: ReportType;
  name: string;
  description: string;
  icon: string;
  columns: TableColumn[];
  minTableWidth?: number;
}

const column = (key: string, label: string, type?: TableColumn['type']): TableColumn => ({
  key,
  label,
  ...(type ? { type } : {}),
});

export const REPORT_DEFINITIONS: readonly ReportDefinition[] = [
  {
    type: 'fuel',
    name: 'Fuel Fill-up',
    description: 'Fuel quantity, cost, vehicle and driver',
    icon: 'FF',
    minTableWidth: 1000,
    columns: [
      column('fill_up_date', 'Fill-up Date', 'date'),
      column('fuel_filled', 'Quantity (Ltrs)'),
      column('amount_paid', 'Amount Paid'),
      column('payment_method_name', 'Payment Method'),
      column('vehicle_name', 'Vehicle'),
      column('driver_name', 'Driver'),
    ],
  },
  {
    type: 'immobilizer',
    name: 'Immobilizer',
    description: 'Vehicle immobilizer actions and locations',
    icon: 'IM',
    minTableWidth: 1000,
    columns: [
      column('vehicle_name', 'Vehicle ID'),
      column('driver_name', 'Driver'),
      column('action', 'Action'),
      column('customer_name', 'Action By'),
      column('created_at', 'Action Date / Time', 'date'),
      column('location_status', 'Location'),
    ],
  },
  {
    type: 'job_anomaly',
    name: 'Driver Jobs Anomaly',
    description: 'Planned and actual driver job deviations',
    icon: 'JA',
    minTableWidth: 1600,
    columns: [
      column('driver', 'Driver'),
      column('start_time_by_driver', 'Job Begin Time', 'date'),
      column('end_time_by_driver', 'Job End Time', 'date'),
      column('job_begin_location', 'Job Begin Location'),
      column('job_end_location', 'Job End Location'),
      column('start_date', 'Planned Start Time', 'date'),
      column('end_date', 'Planned End Time', 'date'),
      column('planned_job_begin_location', 'Planned Begin Location'),
      column('planned_job_end_location', 'Planned End Location'),
      column('planned_duration', 'Planned Duration (HRS)'),
      column('deviation', 'Deviation (HRS)'),
    ],
  },
  {
    type: 'vehicle_usage',
    name: 'Driver Vehicle Usage',
    description: 'Working and non-working vehicle usage',
    icon: 'VU',
    minTableWidth: 1300,
    columns: [
      column('id', 'Driver ID'),
      column('driver', 'Driver'),
      column('vehicle', 'Vehicle'),
      column('working_hours_distance', 'Working Hours Distance'),
      column('working_hours', 'Working Hours'),
      column('non_working_hours_distance', 'Non-Working Distance'),
      column('non_working_hours', 'Non-Working Hours'),
      column('total_distance_travelled', 'Total Distance (KM)'),
    ],
  },
  {
    type: 'job_report',
    name: 'Job',
    description: 'Jobs, assigned vehicles, staff and status',
    icon: 'JR',
    columns: [
      column('job', 'Jobs'),
      column('vehicle', 'Vehicle'),
      column('job_status', 'Job Status'),
      column('staff_name', 'Staff Name'),
    ],
  },
  {
    type: 'fleet_usage',
    name: 'Fleet Usage',
    description: 'Fleet vehicle, driver and location activity',
    icon: 'FU',
    minTableWidth: 900,
    columns: [
      column('vehicle', 'Vehicle ID'),
      column('driver', 'Driver Name'),
      column('fleet_type', 'Fleet Type'),
      column('created_at', 'Date / Time', 'date'),
      column('location', 'Location'),
    ],
  },
  {
    type: 'incident_report',
    name: 'Incident',
    description: 'Vehicle incidents and dashcam evidence',
    icon: 'IR',
    minTableWidth: 1100,
    columns: [
      column('id', 'Incident ID'),
      column('vehicle_name', 'Vehicle Name'),
      column('driver_name', 'Driver Name'),
      column('speed', 'Last Known Speed'),
      column('created_at', 'Crash Date / Time', 'date'),
      column('location', 'Location'),
    ],
  },
  {
    type: 'trip_report',
    name: 'Trip',
    description: 'Vehicle trip history and driving duration',
    icon: 'TR',
    minTableWidth: 1200,
    columns: [
      column('id', 'Trip ID'),
      column('vehicle', 'Vehicle'),
      column('driver_name', 'Driver'),
      column('start_time', 'Start Time', 'date'),
      column('end_time', 'End Time', 'date'),
      column('driving_duration', 'Driving Duration'),
      column('close_reason', 'Trip Close Reason'),
    ],
  },
];
