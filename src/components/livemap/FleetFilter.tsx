// src/components/livemap/FleetFilter.tsx
// Fleet filter dropdown for live tracking
// Filters map and vehicle list to selected fleet
// TODO: fetch fleets from GET /api/fleetpoint/fleets

import { fleets } from '../../data/fleetData'

interface Props {
  selectedFleetId: string
  onFleetChange: (fleetId: string) => void
  isDark: boolean
}

export default function FleetFilter({ selectedFleetId, onFleetChange, isDark }: Props) {
  return (
    <div className={`px-3 py-2 border-b shrink-0 ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
      <select
        value={selectedFleetId}
        onChange={e => onFleetChange(e.target.value)}
        className={`w-full text-xs rounded-xl px-3 py-2 border font-medium transition-all outline-none
          ${isDark
            ? 'bg-gray-800 border-gray-700 text-white'
            : 'bg-gray-50 border-gray-200 text-gray-900'
          }`}
      >
        <option value="all">🚛 All Fleets ({fleets.reduce((a, f) => a + f.totalVehicles, 0)} vehicles)</option>
        {fleets.map(fleet => (
          <option key={fleet.id} value={fleet.id}>
            {fleet.name} ({fleet.totalVehicles} vehicles)
          </option>
        ))}
      </select>
    </div>
  )
}
