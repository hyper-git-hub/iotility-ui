// src/components/charts/LiveFleetStatus.tsx
// Real-time fleet status strip
// TODO: replace with WebSocket data from WS /api/fleetpoint/live-positions

import { Truck, AlertTriangle, WifiOff, Clock, CheckCircle } from 'lucide-react'
import { fleetKPIs, vehicles } from '../../data/fleetData'

export default function LiveFleetStatus() {
  const moving = vehicles.filter(v => v.status === 'moving').length
  const idle = vehicles.filter(v => v.status === 'idle').length
  const stopped = vehicles.filter(v => v.status === 'stopped').length
  const alert = vehicles.filter(v => v.status === 'alert').length
  const offline = vehicles.filter(v => v.status === 'offline').length

  const stats = [
    { label: 'Moving', value: moving, color: 'bg-green-500', textColor: 'text-green-600', bg: 'bg-green-50', icon: Truck },
    { label: 'Idling', value: idle, color: 'bg-amber-500', textColor: 'text-amber-600', bg: 'bg-amber-50', icon: Clock },
    { label: 'Stopped', value: stopped, color: 'bg-gray-400', textColor: 'text-gray-600', bg: 'bg-gray-50', icon: CheckCircle },
    { label: 'Alert', value: alert, color: 'bg-red-500', textColor: 'text-red-600', bg: 'bg-red-50', icon: AlertTriangle },
    { label: 'Offline', value: offline, color: 'bg-gray-700', textColor: 'text-gray-700', bg: 'bg-gray-100', icon: WifiOff },
  ]

  const total = vehicles.length

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Live Fleet Status</h3>
        <div className="flex items-center gap-1.5 text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
          <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
          Live · {total} vehicles
        </div>
      </div>

      {/* Progress bar */}
      <div className="flex h-2 rounded-full overflow-hidden mb-4 gap-0.5">
        {stats.map(s => (
          <div
            key={s.label}
            className={`${s.color} transition-all duration-500`}
            style={{ width: `${(s.value / total) * 100}%` }}
          ></div>
        ))}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-5 gap-2">
        {stats.map(s => (
          <div key={s.label} className={`${s.bg} dark:bg-gray-700 rounded-xl p-3 flex flex-col items-center`}>
            <s.icon size={16} className={`${s.textColor} mb-1`} />
            <span className={`text-xl font-bold ${s.textColor}`}>{s.value}</span>
            <span className="text-xs text-gray-500 dark:text-gray-400">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
