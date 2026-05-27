// src/components/charts/StaffStatisticsChart.tsx
// Staff availability — total, on jobs, on bench, available
// TODO: fetch from GET /api/fleetpoint/staff/statistics

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const data = [
  { depot: 'London', total: 8, onJobs: 5, onBench: 1, available: 2 },
  { depot: 'Manchester', total: 6, onJobs: 4, onBench: 0, available: 2 },
  { depot: 'Birmingham', total: 4, onJobs: 3, onBench: 1, available: 0 },
  { depot: 'Leeds', total: 3, onJobs: 2, onBench: 0, available: 1 },
]

export default function StaffStatisticsChart() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Staff Statistics</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">Today · by depot</p>
        </div>
        <select className="text-xs border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1 bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300">
          <option>Today</option>
          <option>This Week</option>
        </select>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="depot" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
          <Legend iconType="circle" iconSize={8} />
          <Bar dataKey="total" fill="#f59e0b" name="Total Staff" radius={[0, 0, 0, 0]} />
          <Bar dataKey="onJobs" fill="#dc2626" name="On Jobs" />
          <Bar dataKey="onBench" fill="#6b7280" name="On Bench" />
          <Bar dataKey="available" fill="#f97316" name="Available" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
