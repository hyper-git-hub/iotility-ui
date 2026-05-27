// src/pages/fleetpoint/fleet/VehiclesPage.tsx
// Vehicle registry — status strip, compliance warnings, fleet chips, full table
// TODO: fetch from GET /api/fleetpoint/vehicles
// TODO: PATCH /api/fleetpoint/vehicles/:id
// TODO: DELETE /api/fleetpoint/vehicles/:id

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search, Filter, Download, Plus, ChevronUp, ChevronDown,
  AlertTriangle, CheckCircle, Clock, Edit, MapPin, Truck,
  Fuel, Wrench, WifiOff
} from 'lucide-react'
import FleetpointLayout from '../../../layouts/FleetpointLayout'
import { vehicles, fleets, vehicleTypeIcons } from '../../../data/fleetData'
import { useTheme } from '../../../hooks/useTheme'

const STATUS_BG: Record<string, string> = {
  moving: 'bg-green-50 text-green-700 border-green-200',
  idle: 'bg-amber-50 text-amber-700 border-amber-200',
  stopped: 'bg-gray-100 text-gray-600 border-gray-200',
  alert: 'bg-red-50 text-red-700 border-red-200',
  offline: 'bg-gray-200 text-gray-600 border-gray-300',
}

const STATUS_COLORS: Record<string, string> = {
  moving: '#22c55e', idle: '#f59e0b', stopped: '#6b7280',
  alert: '#ef4444', offline: '#374151',
}

const MOT_STATUS = (mot?: string) => {
  if (!mot) return { label: 'Unknown', color: 'text-gray-400', urgent: false }
  const days = Math.floor((new Date(mot).getTime() - Date.now()) / 86400000)
  if (days < 0) return { label: 'Expired', color: 'text-red-600', urgent: true }
  if (days < 30) return { label: `${days}d`, color: 'text-red-600', urgent: true }
  if (days < 90) return { label: `${days}d`, color: 'text-amber-600', urgent: false }
  return { label: `${days}d`, color: 'text-green-600', urgent: false }
}

type SortField = 'plate' | 'fleet' | 'status' | 'speed' | 'fuel' | 'mileage'

export default function VehiclesPage() {
  const { isDark } = useTheme()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [filterFleet, setFilterFleet] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterType, setFilterType] = useState('all')
  const [showFilters, setShowFilters] = useState(false)
  const [sortField, setSortField] = useState<SortField>('plate')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [selectedRows, setSelectedRows] = useState<string[]>([])

  // Status counts
  const moving = vehicles.filter(v => v.status === 'moving').length
  const idle = vehicles.filter(v => v.status === 'idle').length
  const stopped = vehicles.filter(v => v.status === 'stopped').length
  const alert = vehicles.filter(v => v.status === 'alert').length
  const offline = vehicles.filter(v => v.status === 'offline').length

  // Compliance warnings
  const motExpiring = vehicles.filter(v => {
    if (!v.mot) return false
    const days = Math.floor((new Date(v.mot).getTime() - Date.now()) / 86400000)
    return days < 30
  })
  const lowFuel = vehicles.filter(v => v.fuel < 25)
  const serviceOverdue = vehicles.filter(v => {
    if (!v.nextService) return false
    return new Date(v.nextService) < new Date()
  })
  const offlineVehicles = vehicles.filter(v => v.status === 'offline')

  const vehicleTypes = [...new Set(vehicles.map(v => v.type))]

  const filtered = vehicles
    .filter(v => {
      const s = search.toLowerCase()
      const matchSearch = !search ||
        v.plate.toLowerCase().includes(s) ||
        v.make.toLowerCase().includes(s) ||
        v.model.toLowerCase().includes(s) ||
        v.driver.toLowerCase().includes(s) ||
        v.location.toLowerCase().includes(s)
      const matchFleet = filterFleet === 'all' || v.fleetId === filterFleet
      const matchStatus = filterStatus === 'all' || v.status === filterStatus
      const matchType = filterType === 'all' || v.type === filterType
      return matchSearch && matchFleet && matchStatus && matchType
    })
    .sort((a, b) => {
      let aVal: any, bVal: any
      switch (sortField) {
        case 'plate': aVal = a.plate; bVal = b.plate; break
        case 'fleet': aVal = a.fleetId; bVal = b.fleetId; break
        case 'status': aVal = a.status; bVal = b.status; break
        case 'speed': aVal = a.speed; bVal = b.speed; break
        case 'fuel': aVal = a.fuel; bVal = b.fuel; break
        case 'mileage': aVal = a.mileage; bVal = b.mileage; break
        default: aVal = a.plate; bVal = b.plate
      }
      if (typeof aVal === 'number') return sortDir === 'asc' ? aVal - bVal : bVal - aVal
      return sortDir === 'asc'
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal))
    })

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }

  const toggleRow = (id: string) =>
    setSelectedRows(prev => prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id])

  const SortIcon = ({ field }: { field: SortField }) => (
    <span className="ml-1 inline-flex flex-col">
      <ChevronUp size={10} className={sortField === field && sortDir === 'asc' ? 'text-purple-600' : 'text-gray-300'} />
      <ChevronDown size={10} className={sortField === field && sortDir === 'desc' ? 'text-purple-600' : 'text-gray-300'} />
    </span>
  )

  return (
    <FleetpointLayout>
      <div className={`p-6 min-h-full ${isDark ? 'bg-gray-950' : 'bg-gray-50'}`}>

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Vehicles</h1>
            <p className={`text-sm mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              {filtered.length} of {vehicles.length} vehicles
              {selectedRows.length > 0 && ` · ${selectedRows.length} selected`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button className={`flex items-center gap-2 text-sm px-3 py-2 rounded-xl border transition-colors
              ${isDark ? 'border-gray-700 text-gray-300 hover:bg-gray-800' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              <Download size={15} /> Export
            </button>
            <button className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
              <Plus size={15} /> Add Vehicle
            </button>
          </div>
        </div>

        {/* STATUS STRIP */}
        <div className={`rounded-2xl border p-4 mb-4 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className={`text-xs font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Live Fleet Status — {vehicles.length} vehicles
            </span>
          </div>

          {/* Progress bar */}
          <div className="flex h-2.5 rounded-full overflow-hidden gap-0.5 mb-3">
            {[
              { count: moving, color: '#22c55e' },
              { count: idle, color: '#f59e0b' },
              { count: stopped, color: '#6b7280' },
              { count: alert, color: '#ef4444' },
              { count: offline, color: '#374151' },
            ].map((s, i) => (
              <div key={i} className="rounded-full transition-all duration-500"
                style={{ width: `${(s.count / vehicles.length) * 100}%`, background: s.color }} />
            ))}
          </div>

          {/* Status chips — clickable to filter */}
          <div className="flex items-center gap-2 flex-wrap">
            {[
              { label: 'Moving', count: moving, status: 'moving', color: '#22c55e', bg: 'bg-green-50 border-green-200 text-green-700' },
              { label: 'Idling', count: idle, status: 'idle', color: '#f59e0b', bg: 'bg-amber-50 border-amber-200 text-amber-700' },
              { label: 'Stopped', count: stopped, status: 'stopped', color: '#6b7280', bg: 'bg-gray-100 border-gray-200 text-gray-600' },
              { label: 'Alert', count: alert, status: 'alert', color: '#ef4444', bg: 'bg-red-50 border-red-200 text-red-700' },
              { label: 'Offline', count: offline, status: 'offline', color: '#374151', bg: 'bg-gray-200 border-gray-300 text-gray-600' },
            ].map(s => (
              <button
                key={s.status}
                onClick={() => setFilterStatus(filterStatus === s.status ? 'all' : s.status)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all
                  ${filterStatus === s.status
                    ? 'ring-2 ring-purple-500 ring-offset-1'
                    : 'opacity-80 hover:opacity-100'
                  } ${s.bg}`}
              >
                <span className="w-2 h-2 rounded-full" style={{ background: s.color }}></span>
                {s.label} <span className="font-bold">{s.count}</span>
              </button>
            ))}

            {/* Fleet filter chips */}
            <div className="h-4 w-px bg-gray-200 dark:bg-gray-600 mx-1"></div>
            {fleets.map(f => (
              <button
                key={f.id}
                onClick={() => setFilterFleet(filterFleet === f.id ? 'all' : f.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all
                  ${filterFleet === f.id
                    ? 'ring-2 ring-purple-500 ring-offset-1'
                    : 'opacity-70 hover:opacity-100'
                  } ${isDark ? 'border-gray-600 text-gray-300' : 'border-gray-200 text-gray-600'}`}
              >
                <span className="w-2 h-2 rounded-full" style={{ background: f.color }}></span>
                {f.name} <span className="font-bold">{f.vehicleIds.length}</span>
              </button>
            ))}
          </div>
        </div>

        {/* COMPLIANCE WARNINGS */}
        {(motExpiring.length > 0 || lowFuel.length > 0 || serviceOverdue.length > 0 || offlineVehicles.length > 0) && (
          <div className={`rounded-2xl border p-4 mb-4 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
            <p className={`text-xs font-semibold uppercase tracking-wide mb-3 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              Compliance & Attention Required
            </p>
            <div className="flex flex-wrap gap-2">
              {motExpiring.length > 0 && (
                <button
                  onClick={() => { setFilterStatus('all'); setSearch('') }}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 border border-red-200 hover:border-red-400 transition-colors"
                >
                  <AlertTriangle size={13} className="text-red-600 shrink-0" />
                  <span className="text-xs font-medium text-red-700">
                    {motExpiring.length} MOT expiring — {motExpiring.map(v => v.plate).join(', ')}
                  </span>
                </button>
              )}
              {serviceOverdue.length > 0 && (
                <button className="flex items-center gap-2 px-3 py-2 rounded-xl bg-orange-50 border border-orange-200 hover:border-orange-400 transition-colors">
                  <Wrench size={13} className="text-orange-600 shrink-0" />
                  <span className="text-xs font-medium text-orange-700">
                    {serviceOverdue.length} service overdue — {serviceOverdue.map(v => v.plate).join(', ')}
                  </span>
                </button>
              )}
              {lowFuel.length > 0 && (
                <button
                  onClick={() => setFilterStatus('all')}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 hover:border-amber-400 transition-colors"
                >
                  <Fuel size={13} className="text-amber-600 shrink-0" />
                  <span className="text-xs font-medium text-amber-700">
                    {lowFuel.length} low fuel — {lowFuel.map(v => v.plate).join(', ')}
                  </span>
                </button>
              )}
              {offlineVehicles.length > 0 && (
                <button
                  onClick={() => setFilterStatus('offline')}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-100 border border-gray-300 hover:border-gray-400 transition-colors"
                >
                  <WifiOff size={13} className="text-gray-600 shrink-0" />
                  <span className="text-xs font-medium text-gray-700">
                    {offlineVehicles.length} offline — {offlineVehicles.map(v => v.plate).join(', ')}
                  </span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Search + filters */}
        <div className={`rounded-2xl border p-4 mb-4 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center gap-3">
            <div className={`flex-1 flex items-center gap-2 border rounded-xl px-3 py-2
              ${isDark ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-gray-50'}`}>
              <Search size={14} className="text-gray-400 shrink-0" />
              <input
                type="text"
                placeholder="Search plate, make, driver, location..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className={`flex-1 text-sm outline-none bg-transparent
                  ${isDark ? 'text-white placeholder-gray-500' : 'text-gray-900 placeholder-gray-400'}`}
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 text-sm px-3 py-2 rounded-xl border transition-colors
                ${showFilters
                  ? 'border-purple-500 bg-purple-50 text-purple-600'
                  : `${isDark ? 'border-gray-700 text-gray-300' : 'border-gray-200 text-gray-600'}`}`}
            >
              <Filter size={14} /> Filters
            </button>
          </div>

          {showFilters && (
            <div className="flex items-center gap-3 mt-3 flex-wrap">
              {[
                {
                  label: 'Type', value: filterType, onChange: setFilterType,
                  options: [{ value: 'all', label: 'All Types' }, ...vehicleTypes.map(t => ({ value: t, label: t }))]
                },
              ].map(f => (
                <select key={f.label} value={f.value} onChange={e => f.onChange(e.target.value)}
                  className={`text-sm border rounded-xl px-3 py-2 outline-none
                    ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200 text-gray-700'}`}>
                  {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ))}
              <button
                onClick={() => { setFilterFleet('all'); setFilterStatus('all'); setFilterType('all'); setSearch('') }}
                className="text-xs text-purple-600 hover:underline"
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>

        {/* Table */}
        <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={`border-b text-xs font-semibold uppercase tracking-wide
                  ${isDark ? 'border-gray-700 bg-gray-900 text-gray-400' : 'border-gray-100 bg-gray-50 text-gray-500'}`}>
                  <th className="px-4 py-3 w-10">
                    <input type="checkbox"
                      checked={selectedRows.length === filtered.length && filtered.length > 0}
                      onChange={() => setSelectedRows(selectedRows.length === filtered.length ? [] : filtered.map(v => v.id))}
                      className="rounded" />
                  </th>
                  <th className="px-4 py-3 text-left cursor-pointer" onClick={() => toggleSort('plate')}>
                    Vehicle <SortIcon field="plate" />
                  </th>
                  <th className="px-4 py-3 text-left cursor-pointer" onClick={() => toggleSort('fleet')}>
                    Fleet <SortIcon field="fleet" />
                  </th>
                  <th className="px-4 py-3 text-left cursor-pointer" onClick={() => toggleSort('status')}>
                    Status <SortIcon field="status" />
                  </th>
                  <th className="px-4 py-3 text-left">Driver</th>
                  <th className="px-4 py-3 text-left">Location</th>
                  <th className="px-4 py-3 text-left cursor-pointer" onClick={() => toggleSort('speed')}>
                    Speed <SortIcon field="speed" />
                  </th>
                  <th className="px-4 py-3 text-left cursor-pointer" onClick={() => toggleSort('fuel')}>
                    Fuel <SortIcon field="fuel" />
                  </th>
                  <th className="px-4 py-3 text-left cursor-pointer" onClick={() => toggleSort('mileage')}>
                    Mileage <SortIcon field="mileage" />
                  </th>
                  <th className="px-4 py-3 text-left">MOT</th>
                  <th className="px-4 py-3 text-left">Alerts</th>
                  <th className="px-4 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(v => {
                  const fleet = fleets.find(f => f.id === v.fleetId)
                  const mot = MOT_STATUS(v.mot)
                  const isSelected = selectedRows.includes(v.id)
                  return (
                    <tr key={v.id}
                      className={`border-b transition-colors
                        ${isDark ? 'border-gray-700 hover:bg-gray-750' : 'border-gray-50 hover:bg-gray-50'}
                        ${isSelected ? (isDark ? 'bg-purple-900/20' : 'bg-purple-50') : ''}`}
                    >
                      <td className="px-4 py-3">
                        <input type="checkbox" checked={isSelected} onChange={() => toggleRow(v.id)} className="rounded" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{vehicleTypeIcons[v.type] || '🚛'}</span>
                          <div>
                            <p className={`font-bold text-xs ${isDark ? 'text-white' : 'text-gray-900'}`}>{v.plate}</p>
                            <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{v.year} {v.make} {v.model}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: fleet?.color || '#6b7280' }}></span>
                          <span className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{fleet?.name || '—'}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium capitalize ${STATUS_BG[v.status]}`}>
                          {v.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs ${v.driver === 'Unassigned' ? 'text-gray-400 italic' : isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                          {v.driver}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-40">
                        <span className={`text-xs truncate block ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{v.location}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium ${v.speed > 70 ? 'text-red-600' : isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                          {v.speed > 0 ? `${v.speed}mph` : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <div className={`w-12 h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-gray-600' : 'bg-gray-100'}`}>
                            <div className="h-full rounded-full"
                              style={{ width: `${v.fuel}%`, background: v.fuel < 20 ? '#ef4444' : v.fuel < 40 ? '#f59e0b' : '#22c55e' }} />
                          </div>
                          <span className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{v.fuel}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                          {v.mileage.toLocaleString()} mi
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium ${mot.color}`}>{mot.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {v.tempAlert && <span title="Temp Alert">🌡️</span>}
                          {v.dashcamAlert && <span title="DashCam">📷</span>}
                          {v.geofenceAlert && <span title="Geofence">📍</span>}
                          {v.status === 'offline' && <span title="Offline">📵</span>}
                          {v.status === 'alert' && !v.tempAlert && !v.dashcamAlert && !v.geofenceAlert && (
                            <AlertTriangle size={13} className="text-red-500" />
                          )}
                          {!v.tempAlert && !v.dashcamAlert && !v.geofenceAlert && v.status !== 'alert' && v.status !== 'offline' && (
                            <CheckCircle size={13} className="text-green-500" />
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => navigate('/fleetpoint/live-tracking')} title="Track on map"
                            className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
                            <MapPin size={13} />
                          </button>
                          <button onClick={() => navigate(`/fleetpoint/vehicles/${v.plate}/trips`)} title="Trip history"
                            className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
                            <Clock size={13} />
                          </button>
                          <button title="Edit vehicle"
                            className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
                            <Edit size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className={`px-4 py-3 flex items-center justify-between border-t text-xs
            ${isDark ? 'border-gray-700 text-gray-400' : 'border-gray-100 text-gray-500'}`}>
            <span>Showing {filtered.length} of {vehicles.length} vehicles</span>
            {selectedRows.length > 0 && (
              <span className="text-purple-600 font-medium">{selectedRows.length} selected</span>
            )}
          </div>
        </div>
      </div>
    </FleetpointLayout>
  )
}
