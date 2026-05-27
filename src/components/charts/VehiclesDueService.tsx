// src/components/charts/VehiclesDueService.tsx
// Table of vehicles approaching or overdue for service
// TODO: fetch from GET /api/fleetpoint/maintenance/due

import { Wrench, AlertTriangle, CheckCircle } from 'lucide-react'

const vehicles = [
  { plate: 'LP-9901', make: 'Volvo FH', service: 'Full Service', due: 'Overdue by 12 days', mileage: '142,300 mi', status: 'overdue' },
  { plate: 'LP-7712', make: 'Mercedes Sprinter', service: 'Oil Change', due: 'Due in 3 days', mileage: '67,200 mi', status: 'due-soon' },
  { plate: 'LP-4821', make: 'Volvo FH', service: 'Brake Inspection', due: 'Due in 8 days', mileage: '198,100 mi', status: 'due-soon' },
  { plate: 'LP-3312', make: 'DAF XF', service: 'Tyre Rotation', due: 'Due in 14 days', mileage: '88,400 mi', status: 'upcoming' },
  { plate: 'LP-6612', make: 'Volvo FH Reefer', service: 'Reefer Unit Check', due: 'Due in 21 days', mileage: '54,700 mi', status: 'upcoming' },
]

const statusConfig: Record<string, { color: string, icon: any, label: string }> = {
  overdue: { color: 'text-red-600 bg-red-50 border-red-200', icon: AlertTriangle, label: 'Overdue' },
  'due-soon': { color: 'text-amber-600 bg-amber-50 border-amber-200', icon: Wrench, label: 'Due Soon' },
  upcoming: { color: 'text-blue-600 bg-blue-50 border-blue-200', icon: CheckCircle, label: 'Upcoming' },
}

export default function VehiclesDueService() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Vehicles Due for Service</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">{vehicles.filter(v => v.status === 'overdue').length} overdue · {vehicles.filter(v => v.status === 'due-soon').length} due soon</p>
        </div>
        <button className="text-xs text-purple-600 hover:underline">View all</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-700">
              {['Vehicle', 'Make', 'Service', 'Mileage', 'Due', 'Status'].map(h => (
                <th key={h} className="text-left text-gray-500 dark:text-gray-400 font-medium pb-2 pr-4">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {vehicles.map(v => {
              const cfg = statusConfig[v.status]
              return (
                <tr key={v.plate} className="border-b border-gray-50 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  <td className="py-2.5 pr-4 font-bold text-gray-900 dark:text-white">{v.plate}</td>
                  <td className="py-2.5 pr-4 text-gray-600 dark:text-gray-300">{v.make}</td>
                  <td className="py-2.5 pr-4 text-gray-600 dark:text-gray-300">{v.service}</td>
                  <td className="py-2.5 pr-4 text-gray-500 dark:text-gray-400">{v.mileage}</td>
                  <td className="py-2.5 pr-4 text-gray-600 dark:text-gray-300">{v.due}</td>
                  <td className="py-2.5">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${cfg.color}`}>
                      <cfg.icon size={10} />
                      {cfg.label}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
