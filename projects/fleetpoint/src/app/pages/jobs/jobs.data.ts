export type JobStatus = 'Pending' | 'In Progress' | 'Completed' | 'Failed' | 'Assigned';
export type JobPriority = 'High' | 'Normal';

export interface JobRecord {
  id: string;
  name: string;
  driver: string;
  vehicle: string;
  type: string;
  priority: JobPriority;
  pickup: string;
  dropoff: string;
  scheduled: string;
  status: JobStatus;
  tasks: string;
}

export const jobsData: JobRecord[] = [
  { id: 'JOB001', name: 'Amazon BHX2 — Morning Delivery', driver: 'James Hartley', vehicle: 'LP-4821', type: 'Delivery', priority: 'High', pickup: 'Stratford Logistics Park', dropoff: 'Amazon BHX2', scheduled: '06:00 → 09:30', status: 'Completed', tasks: '3/3' },
  { id: 'JOB003', name: 'Cold Chain — Manchester Collection', driver: 'Thomas Griffiths', vehicle: 'LP-6612', type: 'Collection', priority: 'High', pickup: 'Trafford Park DC', dropoff: 'Tilbury Cold Storage', scheduled: '07:00 → 13:00', status: 'In Progress', tasks: '2/4' },
  { id: 'JOB002', name: 'Tesco RDC — Scheduled Delivery', driver: 'Oliver Pemberton', vehicle: 'LP-3312', type: 'Delivery', priority: 'High', pickup: 'Stratford Logistics Park', dropoff: 'Tesco RDC', scheduled: '08:00 → 11:00', status: 'In Progress', tasks: '1/3' },
  { id: 'JOB008', name: 'Priya — Manchester Local Deliveries', driver: 'Priya Sharma', vehicle: 'LP-5531', type: 'Delivery', priority: 'Normal', pickup: 'Trafford Park DC', dropoff: 'Northern Quarter', scheduled: '09:00 → 12:00', status: 'Failed', tasks: '1/2' },
  { id: 'JOB004', name: 'Birmingham Ops — Urban Delivery Run', driver: 'Aisha Okonkwo', vehicle: 'LP-2201', type: 'Delivery', priority: 'Normal', pickup: 'Aston Depot', dropoff: 'Multiple stops — Digbeth', scheduled: '10:00 → 15:00', status: 'Pending', tasks: '0/4' },
  { id: 'JOB005', name: 'Manchester Van — Ad Hoc Collection', driver: 'Sarah Whitfield', vehicle: 'LP-2244', type: 'Ad Hoc', priority: 'High', pickup: 'Salford Business Park', dropoff: 'Trafford Park DC', scheduled: '11:00 → 13:00', status: 'Pending', tasks: '0/2' },
  { id: 'JOB006', name: 'Vehicle Inspection — LP-9901', driver: 'Connor McBride', vehicle: 'LP-9901', type: 'Inspection', priority: 'High', pickup: 'Stratford Depot', dropoff: 'Volvo Truck Centre', scheduled: '14:00 → 17:00', status: 'Pending', tasks: '0/3' },
  { id: 'JOB007', name: 'Leeds — M1 Northbound Transfer', driver: 'Mohammed Al-Rashid', vehicle: 'LP-3388', type: 'Transfer', priority: 'Normal', pickup: 'Stourton Hub', dropoff: 'Stratford Logistics Park', scheduled: '15:00 → 19:00', status: 'Assigned', tasks: '0/2' },
];