// src/components/charts/DriverTasksChart.tsx
// Driver task completion status by fleet
// TODO: fetch from GET /api/fleetpoint/driver-tasks/status

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const data = [
  { name: 'Completed', value: 33.3, color: '#f97316' },
  { name: 'Pending', value: 66.7, color: '#dc2626' },
  { name: 'In Progress', value: 0, color: '#6b7280' },
  { name: 'Aborted', value: 0, color: '#f59e0b' },
]

export default function DriverTasksChart() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Driver Tasks Status</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">Today · all fleets</p>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie data={data.filter(d => d.value > 0)} cx="50%" cy="45%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
            {data.map((entry, i) => <Cell key={i} fill={entry.color} />)}
          </Pie>
          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v: number) => [`${v.toFixed(1)}%`]} />
          <Legend iconType="circle" iconSize={8} formatter={(value) => <span style={{ fontSize: 11 }}>{value}</span>} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
