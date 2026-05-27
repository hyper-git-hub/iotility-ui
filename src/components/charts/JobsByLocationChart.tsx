// src/components/charts/JobsByLocationChart.tsx
// Jobs by city — ad-hoc vs scheduled
// TODO: fetch from GET /api/fleetpoint/jobs/by-location

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const data = [
  { city: 'London', adhoc: 12, scheduled: 8 },
  { city: 'Manchester', adhoc: 7, scheduled: 11 },
  { city: 'Birmingham', adhoc: 5, scheduled: 9 },
  { city: 'Leeds', adhoc: 3, scheduled: 6 },
  { city: 'Bristol', adhoc: 4, scheduled: 5 },
]

export default function JobsByLocationChart() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Jobs by Location</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">Today · ad-hoc vs scheduled</p>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="city" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
          <Legend iconType="circle" iconSize={8} />
          <Bar dataKey="adhoc" fill="#f97316" name="Ad-hoc" radius={[4, 4, 0, 0]} />
          <Bar dataKey="scheduled" fill="#f59e0b" name="Scheduled" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
