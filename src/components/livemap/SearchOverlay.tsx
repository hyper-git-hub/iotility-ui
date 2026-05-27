// src/components/livemap/SearchOverlay.tsx
// Fullscreen map search overlay — search vehicles, filter by status
// Only visible when fullscreen mode is active
// TODO: add recent searches, favourites

import { Search, X } from 'lucide-react'
import type { Vehicle } from "../../data/fleetData"
import { vehicleTypeIcons } from '../../data/fleetData'
import type { FilterStatus } from "./types"
import { STATUS_COLORS, STATUS_LABELS } from "./types"

interface Props {
  search: string
  onSearchChange: (val: string) => void
  filterStatus: FilterStatus
  onFilterChange: (status: FilterStatus) => void
  filteredVehicles: Vehicle[]
  onSelectVehicle: (vehicle: Vehicle) => void
  isDark: boolean
  totalVehicles: number
}

const FILTER_OPTIONS: FilterStatus[] = ['all', 'moving', 'idle', 'alert', 'offline']

export default function SearchOverlay({
  search, onSearchChange, filterStatus, onFilterChange,
  filteredVehicles, onSelectVehicle, isDark, totalVehicles
}: Props) {
  return (
    <div className={`absolute top-4 left-4 z-[1000] rounded-xl shadow-lg p-3 w-80
      ${isDark ? 'bg-gray-900/95 border border-gray-700' : 'bg-white/95 border border-gray-200'} backdrop-blur-sm`}>

      {/* Search input */}
      <div className={`flex items-center gap-2 border rounded-xl px-3 py-2 mb-2
        ${isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'}`}>
        <Search size={13} className="text-gray-400 shrink-0" />
        <input
          type="text"
          placeholder="Search plate, driver, location..."
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          autoFocus
          className={`flex-1 text-xs outline-none bg-transparent
            ${isDark ? 'text-white placeholder-gray-500' : 'text-gray-900 placeholder-gray-400'}`}
        />
        {search && (
          <button onClick={() => onSearchChange('')}>
            <X size={12} className="text-gray-400" />
          </button>
        )}
      </div>

      {/* Status filters */}
      <div className="flex gap-1 flex-wrap mb-2">
        {FILTER_OPTIONS.map(status => (
          <button
            key={status}
            onClick={() => onFilterChange(status)}
            className={`text-xs px-2 py-1 rounded-full font-medium transition-all
              ${filterStatus === status
                ? 'bg-purple-600 text-white'
                : `${isDark ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-600'}`
              }`}
          >
            {status === 'all' ? `All (${totalVehicles})` : (
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: STATUS_COLORS[status] }}></span>
                {STATUS_LABELS[status]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Results dropdown */}
      {search.length > 0 && filteredVehicles.length > 0 && (
        <div className={`rounded-xl border overflow-hidden max-h-48 overflow-y-auto
          ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
          {filteredVehicles.slice(0, 6).map(v => (
            <button
              key={v.id}
              onClick={() => { onSelectVehicle(v); onSearchChange('') }}
              className={`w-full text-left px-3 py-2 flex items-center gap-2 border-b transition-all
                ${isDark ? 'border-gray-700 hover:bg-gray-800 text-gray-300' : 'border-gray-100 hover:bg-gray-50 text-gray-700'}`}
            >
              <span className="text-base">{vehicleTypeIcons[v.type]}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold">{v.plate}</span>
                  <span className="text-xs" style={{ color: STATUS_COLORS[v.status] }}>{STATUS_LABELS[v.status]}</span>
                </div>
                <p className="text-xs truncate opacity-60">{v.driver} · {v.location}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {search.length > 0 && filteredVehicles.length === 0 && (
        <p className={`text-xs text-center py-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
          No vehicles found
        </p>
      )}
    </div>
  )
}
