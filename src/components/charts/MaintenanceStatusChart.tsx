// src/components/charts/MaintenanceStatusChart.tsx
// Maintenance by service type — stacked bar
// TODO: fetch from GET /api/fleetpoint/maintenance/status

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const data = [
  { type: 'Oil Change', scheduled: 3, completed: 2, overdue: 1 },
  { type: 'Spark Plug', scheduled: 2, completed: 1, overdue: 1 },
  { type: 'Transmission', scheduled: 1, completed: 0, overdue: 1 },
  { type: 'Air Filter', scheduled: 4, completed: 3, overdue: 0 },
  { type: 'Brake Pads', scheduled: 2, completed: 2, overdue: 0 },
  { type: 'Tyres', scheduled: 3, completed: 1, overdue: 2 },
]

export default function MaintenanceStatusChart() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Maintenance Status</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">By service type</p>
        </div>
        <select className="text-xs border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1 bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300">
          <option>Service Type</option>
          <option>Vehicle</option>
          <option>Depot</option>
        </select>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="type" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
          <Legend iconType="circle" iconSize={8} />
          <Bar dataKey="completed" stackId="a" fill="#22c55e" name="Completed" />
          <Bar dataKey="scheduled" stackId="a" fill="#f59e0b" name="Scheduled" />
          <Bar dataKey="overdue" stackId="a" fill="#ef4444" name="Overdue" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
