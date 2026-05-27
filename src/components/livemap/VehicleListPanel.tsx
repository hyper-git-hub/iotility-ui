// src/components/livemap/VehicleListPanel.tsx
// Left panel — vehicle list with search, filters, status badges
// TODO: add sort options (by status, speed, alerts)

import { Search, X, Truck, Users, Star } from 'lucide-react'
import type { Vehicle, Driver } from "../../data/fleetData"
import { vehicles as allVehicles, vehicleTypeIcons } from '../../data/fleetData'
import type { ViewMode, FilterStatus } from "./types"
import { STATUS_COLORS, STATUS_LABELS } from "./types"

interface Props {
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  search: string
  onSearchChange: (val: string) => void
  filterStatus: FilterStatus
  onFilterChange: (status: FilterStatus) => void
  filteredVehicles: Vehicle[]
  filteredDrivers: Driver[]
  selectedVehicle: Vehicle | null
  onSelectVehicle: (vehicle: Vehicle | null) => void
  onSelectDriver: (driverId: string) => void
  currentTime: Date
  isDark: boolean
}

const FILTER_OPTIONS: FilterStatus[] = ['all', 'moving', 'idle', 'alert', 'offline']

export default function VehicleListPanel({
  viewMode, onViewModeChange, search, onSearchChange,
  filterStatus, onFilterChange, filteredVehicles, filteredDrivers,
  selectedVehicle, onSelectVehicle, onSelectDriver, currentTime, isDark
}: Props) {
  return (
    <div className={`w-72 flex flex-col shrink-0 border-r overflow-hidden
      ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'}`}>

      {/* Header */}
      <div className={`px-4 py-3 border-b shrink-0 ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
        <div className="flex items-center justify-between mb-3">
          <h2 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Live Tracking</h2>
          <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            {currentTime.toLocaleTimeString('en-GB')}
          </span>
        </div>

        {/* View toggle */}
        <div className={`flex rounded-xl p-0.5 mb-3 ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}>
          {(['vehicles', 'drivers'] as ViewMode[]).map(mode => (
            <button
              key={mode}
              onClick={() => { onViewModeChange(mode); onSearchChange('') }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-all
                ${viewMode === mode ? 'bg-purple-600 text-white shadow-sm' : `${isDark ? 'text-gray-400' : 'text-gray-500'}`}`}
            >
              {mode === 'vehicles' ? <Truck size={12} /> : <Users size={12} />}
              {mode === 'vehicles' ? 'Vehicles' : 'Drivers'}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className={`flex items-center gap-2 border rounded-xl px-3 py-2
          ${isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'}`}>
          <Search size={13} className="text-gray-400 shrink-0" />
          <input
            type="text"
            placeholder={`Search ${viewMode}...`}
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            className={`flex-1 text-xs outline-none bg-transparent
              ${isDark ? 'text-white placeholder-gray-500' : 'text-gray-900 placeholder-gray-400'}`}
          />
          {search && <button onClick={() => onSearchChange('')}><X size={12} className="text-gray-400" /></button>}
        </div>
      </div>

      {/* Status filters — vehicles only */}
      {viewMode === 'vehicles' && (
        <div className={`px-3 py-2 border-b shrink-0 flex gap-1 overflow-x-auto ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
          {FILTER_OPTIONS.map(status => (
            <button
              key={status}
              onClick={() => onFilterChange(status)}
              className={`shrink-0 text-xs px-2.5 py-1 rounded-full font-medium transition-all
                ${filterStatus === status
                  ? 'bg-purple-600 text-white'
                  : `${isDark ? 'bg-gray-800 text-gray-400 hover:bg-gray-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`
                }`}
            >
              {status === 'all' ? `All (${allVehicles.length})` : (
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: STATUS_COLORS[status] }}></span>
                  {STATUS_LABELS[status]} ({allVehicles.filter(v => v.status === status).length})
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto">

        {/* Vehicles */}
        {viewMode === 'vehicles' && filteredVehicles.map(v => (
          <button
            key={v.id}
            onClick={() => onSelectVehicle(selectedVehicle?.id === v.id ? null : v)}
            className={`w-full text-left px-4 py-3 border-b transition-all
              ${selectedVehicle?.id === v.id
                ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800'
                : `${isDark ? 'border-gray-800 hover:bg-gray-800' : 'border-gray-100 hover:bg-gray-50'}`
              }`}
          >
            <div className="flex items-start gap-2.5">
              <span className="text-lg mt-0.5 shrink-0">{vehicleTypeIcons[v.type] || '🚛'}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{v.plate}</span>
                  <span className="text-xs font-medium" style={{ color: STATUS_COLORS[v.status] }}>
                    {v.speed > 0 ? `${v.speed}mph` : STATUS_LABELS[v.status]}
                  </span>
                </div>
                <p className={`text-xs truncate ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{v.make} {v.model}</p>
                <p className={`text-xs truncate mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{v.location}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {v.tempAlert && <span className="text-xs text-orange-600">🌡️ {v.temp}°C</span>}
                  {v.dashcamAlert && <span className="text-xs text-purple-600">📷 DashCam</span>}
                  {v.geofenceAlert && <span className="text-xs text-blue-600">📍 Geofence</span>}
                  {v.status === 'offline' && <span className="text-xs text-gray-500">📵 {v.lastUpdate}</span>}
                </div>
              </div>
            </div>
          </button>
        ))}

        {viewMode === 'vehicles' && filteredVehicles.length === 0 && (
          <div className="p-8 text-center">
            <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>No vehicles match your filter</p>
          </div>
        )}

        {/* Drivers */}
        {viewMode === 'drivers' && filteredDrivers.map(d => {
          const driverVehicle = allVehicles.find(v => v.driverId === d.id)
          const isSelected = selectedVehicle?.id === driverVehicle?.id
          return (
            <button
              key={d.id}
              onClick={() => onSelectDriver(d.id)}
              className={`w-full text-left px-4 py-3 border-b transition-all
                ${isSelected
                  ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800'
                  : `${isDark ? 'border-gray-800 hover:bg-gray-800' : 'border-gray-100 hover:bg-gray-50'}`
                }`}
            >
              <div className="flex items-center gap-2.5">
                <div className="relative shrink-0">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-xs font-bold">
                    {d.avatar}
                  </div>
                  <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2
                    ${isDark ? 'border-gray-900' : 'border-white'}
                    ${d.status === 'on-duty' ? 'bg-green-400' : d.status === 'on-break' ? 'bg-amber-400' : 'bg-gray-300'}`}>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-semibold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>{d.name}</span>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <Star size={10} className="text-amber-400 fill-amber-400" />
                      <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{d.score}</span>
                    </div>
                  </div>
                  <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{d.role}</p>
                  <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    {driverVehicle ? driverVehicle.plate : 'No vehicle'} · {d.trips} trips · {d.distance}km
                  </p>
                </div>
              </div>
            </button>
          )
        })}

        {viewMode === 'drivers' && filteredDrivers.length === 0 && (
          <div className="p-8 text-center">
            <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>No drivers match your search</p>
          </div>
        )}
      </div>
    </div>
  )
}
