// src/components/charts/MaintenanceProbabilityChart.tsx
// Predictive maintenance probability per vehicle
// TODO: fetch from GET /api/fleetpoint/maintenance/probability (ML model output)

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const data = [
  { vehicle: 'LP-9901', probability: 92, status: 'Replace Now' },
  { vehicle: 'LP-7712', probability: 78, status: 'Due Soon' },
  { vehicle: 'LP-4821', probability: 65, status: 'Monitor' },
  { vehicle: 'LP-3312', probability: 45, status: 'Monitor' },
  { vehicle: 'LP-6612', probability: 31, status: 'OK' },
  { vehicle: 'LP-2244', probability: 18, status: 'OK' },
]

const getColor = (p: number) => p >= 80 ? '#ef4444' : p >= 60 ? '#f59e0b' : '#22c55e'

export default function MaintenanceProbabilityChart() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Maintenance Probability</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">Predictive · ML model · top 6 vehicles</p>
        </div>
        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">AI Powered</span>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 10 }} domain={[0, 100]} unit="%" />
          <YAxis dataKey="vehicle" type="category" tick={{ fontSize: 11 }} width={60} />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
            formatter={(v: number, _, props) => [`${v}% — ${props.payload.status}`]}
          />
          <Bar dataKey="probability" radius={[0, 6, 6, 0]}>
            {data.map((entry, i) => <Cell key={i} fill={getColor(entry.probability)} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
