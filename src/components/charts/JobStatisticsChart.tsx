// src/components/charts/JobStatisticsChart.tsx
// Job completion statistics — pending vs completed
// TODO: fetch from GET /api/fleetpoint/jobs/statistics

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const data = [
  { name: 'Completed', value: 34, color: '#22c55e' },
  { name: 'In Progress', value: 12, color: '#7c3aed' },
  { name: 'Pending', value: 18, color: '#f59e0b' },
  { name: 'Cancelled', value: 3, color: '#ef4444' },
]

export default function JobStatisticsChart() {
  const total = data.reduce((a, b) => a + b.value, 0)
  const completionRate = Math.round((data[0].value / total) * 100)

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Job Statistics</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">Today · {total} total jobs · {completionRate}% complete</p>
        </div>
        <select className="text-xs border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1 bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300">
          <option>Today</option>
          <option>This Week</option>
          <option>This Month</option>
        </select>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie data={data} cx="50%" cy="45%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
            {data.map((entry, i) => <Cell key={i} fill={entry.color} />)}
          </Pie>
          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
          <Legend iconType="circle" iconSize={8} formatter={(value) => <span style={{ fontSize: 11 }}>{value}</span>} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
