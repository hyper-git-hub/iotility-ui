// src/components/charts/AggressiveDrivingChart.tsx
// Aggressive driving events by fleet over time
// TODO: fetch from GET /api/fleetpoint/aggressive-driving?range=30d

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const data = [
  { week: 'Wk 1', fleet01: 45, fleet02: 28 },
  { week: 'Wk 2', fleet01: 52, fleet02: 31 },
  { week: 'Wk 3', fleet01: 38, fleet02: 24 },
  { week: 'Wk 4', fleet01: 61, fleet02: 35 },
  { week: 'Wk 5', fleet01: 42, fleet02: 29 },
  { week: 'Wk 6', fleet01: 55, fleet02: 33 },
]

export default function AggressiveDrivingChart() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Aggressively Driven Fleets</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">Events per fleet · last 6 weeks</p>
        </div>
        <select className="text-xs border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1 bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300">
          <option>Last 6 Weeks</option>
          <option>Last 3 Months</option>
        </select>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="fleet01Grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="fleet02Grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="week" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
          <Legend iconType="circle" iconSize={8} />
          <Area type="monotone" dataKey="fleet01" stroke="#ef4444" strokeWidth={2} fill="url(#fleet01Grad)" name="London Fleet" />
          <Area type="monotone" dataKey="fleet02" stroke="#f59e0b" strokeWidth={2} fill="url(#fleet02Grad)" name="Manchester Fleet" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
