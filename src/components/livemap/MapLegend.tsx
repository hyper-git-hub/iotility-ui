// src/components/livemap/MapLegend.tsx
// Status color legend + vehicle type legend overlaid on map
// Add new vehicle types here as fleet expands

import { STATUS_COLORS, STATUS_LABELS } from './types'

interface Props {
  isDark: boolean
}

export default function MapLegend({ isDark }: Props) {
  return (
    <>
      {/* Status legend — bottom left */}
      <div className={`absolute bottom-6 left-4 z-[1000] rounded-xl shadow-lg px-3 py-2 flex items-center gap-3
        ${isDark ? 'bg-gray-900/90 border border-gray-700' : 'bg-white/90 border border-gray-200'} backdrop-blur-sm`}>
        {Object.entries(STATUS_COLORS).map(([status, color]) => (
          <div key={status} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }}></div>
            <span className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{STATUS_LABELS[status]}</span>
          </div>
        ))}
      </div>

      {/* Vehicle type legend — bottom center */}
      <div className={`absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] rounded-xl shadow-lg px-3 py-2 flex items-center gap-3
        ${isDark ? 'bg-gray-900/90 border border-gray-700' : 'bg-white/90 border border-gray-200'} backdrop-blur-sm`}>
        {[['🚛', 'HGV'], ['❄️', 'Reefer'], ['🚐', 'Van'], ['🚌', 'Transit']].map(([icon, label]) => (
          <div key={label} className="flex items-center gap-1">
            <span className="text-sm">{icon}</span>
            <span className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{label}</span>
          </div>
        ))}
      </div>
    </>
  )
}
