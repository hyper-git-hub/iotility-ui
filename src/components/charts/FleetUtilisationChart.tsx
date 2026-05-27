// src/components/charts/FleetUtilisationChart.tsx
// Vehicle utilisation rate by fleet group
// TODO: fetch from GET /api/fleetpoint/utilisation?range=7d

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const data = [
  { fleet: 'HGV', utilisation: 82 },
  { fleet: 'Sprinter', utilisation: 74 },
  { fleet: 'Transit', utilisation: 91 },
  { fleet: 'Reefer', utilisation: 68 },
  { fleet: 'DAF XF', utilisation: 78 },
]

const getColor = (value: number) => {
  if (value >= 85) return '#22c55e'
  if (value >= 70) return '#f59e0b'
  return '#ef4444'
}

export default function FleetUtilisationChart() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Fleet Utilisation</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">Today · by vehicle type</p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"></span>Good</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500"></span>OK</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"></span>Low</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="fleet" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} unit="%" />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
            formatter={(value: number) => [`${value}%`, 'Utilisation']}
          />
          <Bar dataKey="utilisation" radius={[6, 6, 0, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={getColor(entry.utilisation)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
