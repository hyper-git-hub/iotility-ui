// src/components/charts/DriverOfWeek.tsx
// Top performing driver this week — gamification element
// TODO: fetch from GET /api/fleetpoint/driver-of-week

import { Trophy, Star, TrendingUp } from 'lucide-react'

export default function DriverOfWeek() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 h-full">
      <div className="flex items-center gap-2 mb-4">
        <Trophy size={16} className="text-amber-500" />
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Driver of the Week</h3>
      </div>
      <div className="flex flex-col items-center text-center">
        <div className="relative mb-3">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white text-xl font-black shadow-lg">
            AO
          </div>
          <div className="absolute -top-1 -right-1 w-6 h-6 bg-amber-400 rounded-full flex items-center justify-center">
            <Star size={12} className="text-white fill-white" />
          </div>
        </div>
        <p className="font-bold text-gray-900 dark:text-white text-sm">Aisha Okonkwo</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Transit Driver · Birmingham</p>
        <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2 mb-1">
          <div className="h-2 rounded-full bg-gradient-to-r from-amber-400 to-green-500" style={{ width: '98%' }}></div>
        </div>
        <p className="text-2xl font-black text-gray-900 dark:text-white">98 <span className="text-sm font-normal text-gray-500">/ 100</span></p>
        <div className="grid grid-cols-3 gap-2 mt-3 w-full">
          {[
            { label: 'Trips', value: '14' },
            { label: 'Distance', value: '143km' },
            { label: 'Score', value: '+6↑' },
          ].map(stat => (
            <div key={stat.label} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-2">
              <p className="text-xs font-bold text-gray-900 dark:text-white">{stat.value}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
