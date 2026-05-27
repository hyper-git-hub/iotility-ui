// src/components/charts/DashcamEventsChart.tsx
// DashCam events breakdown — harsh braking, distraction, near miss, collision
// TODO: fetch from GET /api/fleetpoint/dashcam/events/summary

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const data = [
  { name: 'Harsh Braking', value: 14, color: '#ef4444' },
  { name: 'Distraction', value: 8, color: '#f59e0b' },
  { name: 'Near Miss', value: 5, color: '#f97316' },
  { name: 'Harsh Accel.', value: 11, color: '#7c3aed' },
  { name: 'Sharp Turn', value: 9, color: '#06b6d4' },
]

export default function DashcamEventsChart() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">DashCam Events</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">This month · {data.reduce((a, b) => a + b.value, 0)} total events</p>
        </div>
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
