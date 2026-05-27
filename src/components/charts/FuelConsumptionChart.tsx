// src/components/charts/FuelConsumptionChart.tsx
// Fuel consumption by fleet this week
// TODO: fetch from GET /api/fleetpoint/fuel?range=7d

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const data = [
  { day: 'Mon', hgv: 420, vans: 180, transit: 95 },
  { day: 'Tue', hgv: 390, vans: 165, transit: 88 },
  { day: 'Wed', hgv: 445, vans: 190, transit: 102 },
  { day: 'Thu', hgv: 380, vans: 172, transit: 91 },
  { day: 'Fri', hgv: 410, vans: 185, transit: 97 },
  { day: 'Sat', hgv: 320, vans: 140, transit: 75 },
  { day: 'Sun', hgv: 348, vans: 155, transit: 82 },
]

export default function FuelConsumptionChart() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Fuel Consumption</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">Last 7 days · litres by fleet type</p>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="day" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v: number) => [`${v}L`]} />
          <Legend iconType="circle" iconSize={8} />
          <Line type="monotone" dataKey="hgv" stroke="#7c3aed" strokeWidth={2} dot={false} name="HGV" />
          <Line type="monotone" dataKey="vans" stroke="#f59e0b" strokeWidth={2} dot={false} name="Vans" />
          <Line type="monotone" dataKey="transit" stroke="#22c55e" strokeWidth={2} dot={false} name="Transit" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
