// src/components/charts/CO2TrendChart.tsx
// CO2 emissions and fuel efficiency trend — 7 day view
// TODO: fetch from GET /api/fleetpoint/emissions?range=7d
// Links to Sustainex module for detailed ESG reporting

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const data = [
  { day: 'Mon', co2: 920, fuel: 380 },
  { day: 'Tue', co2: 880, fuel: 360 },
  { day: 'Wed', co2: 950, fuel: 395 },
  { day: 'Thu', co2: 870, fuel: 355 },
  { day: 'Fri', co2: 910, fuel: 375 },
  { day: 'Sat', co2: 760, fuel: 310 },
  { day: 'Sun', co2: 847, fuel: 348 },
]

export default function CO2TrendChart() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">CO₂ & Fuel Efficiency</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">Last 7 days · LogisticsPro fleet</p>
        </div>
        <div className="flex items-center gap-1 text-xs text-green-600 bg-green-50 dark:bg-green-900/30 px-2 py-1 rounded-full font-medium">
          ↓ 4% vs last week
        </div>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="co2Gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="fuelGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="day" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
            formatter={(value: number, name: string) => [
              name === 'co2' ? `${value}kg` : `${value}L`,
              name === 'co2' ? 'CO₂' : 'Fuel'
            ]}
          />
          <Legend formatter={(value) => value === 'co2' ? 'CO₂ (kg)' : 'Fuel (L)'} iconType="circle" iconSize={8} />
          <Area type="monotone" dataKey="co2" stroke="#7c3aed" strokeWidth={2} fill="url(#co2Gradient)" />
          <Area type="monotone" dataKey="fuel" stroke="#f59e0b" strokeWidth={2} fill="url(#fuelGradient)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
