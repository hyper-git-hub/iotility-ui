// src/components/livemap/MapControls.tsx
// Map overlay controls — fullscreen toggle, live clock, vehicle count
// Add new map control buttons here

import { Maximize2, Minimize2 } from 'lucide-react'

interface Props {
  fullscreen: boolean
  onToggleFullscreen: () => void
  vehicleCount: number
  currentTime: Date
  isDark: boolean
}

export default function MapControls({ fullscreen, onToggleFullscreen, vehicleCount, currentTime, isDark }: Props) {
  return (
    <div className={`absolute top-4 right-4 z-[1000] rounded-xl shadow-lg px-3 py-2 flex items-center gap-3
      ${isDark ? 'bg-gray-900/90 border border-gray-700' : 'bg-white/90 border border-gray-200'} backdrop-blur-sm`}>
      <div className="flex items-center gap-1.5 text-xs">
        <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
        <span className={isDark ? 'text-gray-300' : 'text-gray-600'}>
          Live · {currentTime.toLocaleTimeString('en-GB')}
        </span>
      </div>
      <div className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
        {vehicleCount} vehicles
      </div>
      <button
        onClick={onToggleFullscreen}
        title={fullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen map'}
        className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-all border
          ${fullscreen
            ? 'bg-purple-600 text-white border-purple-600'
            : `${isDark ? 'bg-gray-800 text-gray-300 hover:bg-gray-700 border-gray-700' : 'bg-white text-gray-600 hover:bg-gray-50 border-gray-200'}`
          }`}
      >
        {fullscreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
        {fullscreen ? 'Exit' : 'Fullscreen'}
      </button>
    </div>
  )
}
