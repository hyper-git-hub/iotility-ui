// src/components/charts/DriverSafetyScorecard.tsx
// Driver safety scores breakdown — speed, harsh braking, sharp turns, total
// TODO: fetch from GET /api/fleetpoint/driver-safety-scores

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const data = [
  { name: 'James H.', speed: 8200, harshBraking: 3100, acceleration: 2800, sharpTurn: 1900 },
  { name: 'Oliver P.', speed: 12400, harshBraking: 8200, acceleration: 5100, sharpTurn: 3200 },
  { name: 'Mohammed', speed: 6100, harshBraking: 4200, acceleration: 3100, sharpTurn: 2100 },
  { name: 'Sarah W.', speed: 2100, harshBraking: 1800, acceleration: 900, sharpTurn: 600 },
  { name: 'Connor M.', speed: 18200, harshBraking: 9400, acceleration: 6200, sharpTurn: 4100 },
  { name: 'Priya S.', speed: 5200, harshBraking: 3800, acceleration: 2200, sharpTurn: 1400 },
  { name: 'Thomas G.', speed: 9100, harshBraking: 5200, acceleration: 3800, sharpTurn: 2600 },
  { name: 'Aisha O.', speed: 1200, harshBraking: 900, acceleration: 600, sharpTurn: 400 },
]

export default function DriverSafetyScorecard() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Driver Safety Scorecard</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">This month · violation points by type</p>
        </div>
        <select className="text-xs border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1 bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300">
          <option>This Month</option>
          <option>Last Month</option>
          <option>Last 3 Months</option>
        </select>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 0, left: 10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 10 }} />
          <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={65} />
          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
          <Legend iconType="circle" iconSize={8} />
          <Bar dataKey="speed" stackId="a" fill="#f59e0b" name="Speed" />
          <Bar dataKey="harshBraking" stackId="a" fill="#7c3aed" name="Harsh Braking" />
          <Bar dataKey="acceleration" stackId="a" fill="#f97316" name="Harsh Accel." />
          <Bar dataKey="sharpTurn" stackId="a" fill="#06b6d4" name="Sharp Turn" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
