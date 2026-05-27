// src/components/charts/DriverViolationsChart.tsx
// Driver violations by fleet
// TODO: fetch from GET /api/fleetpoint/violations/summary

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const data = [
  { fleet: 'London', violations: 61, fill: '#ef4444' },
  { fleet: 'Manchester', violations: 18, fill: '#f59e0b' },
  { fleet: 'Birmingham', violations: 32, fill: '#f97316' },
  { fleet: 'Leeds', violations: 12, fill: '#22c55e' },
]

export default function DriverViolationsChart() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Driver Violations</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">This month · by depot</p>
        </div>
        <select className="text-xs border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1 bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300">
          <option>Fleet</option>
          <option>Driver</option>
          <option>Type</option>
        </select>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="fleet" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v: number) => [v, 'Violations']} />
          <Bar dataKey="violations" radius={[6, 6, 0, 0]}>
            {data.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
