// src/pages/fleetpoint/fleet/DriversPage.tsx
// Driver management — list, search, filter, allocate, shift management
// TODO: fetch from GET /api/fleetpoint/drivers
// TODO: PATCH /api/fleetpoint/drivers/:id/allocate
// TODO: PATCH /api/fleetpoint/drivers/:id/shift

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search, Filter, Download, Plus, ChevronUp, ChevronDown,
  Star, AlertTriangle, CheckCircle, Users, UserX,
  Car, Clock, Edit, Phone, MapPin, LayoutGrid, List
} from 'lucide-react'
import FleetpointLayout from '../../../layouts/FleetpointLayout'
import { drivers, vehicles, fleets } from '../../../data/fleetData'
import { useTheme } from '../../../hooks/useTheme'

const SHIFT_BG: Record<string, string> = {
  'on-duty': 'bg-green-50 text-green-700 border-green-200',
  'off-duty': 'bg-gray-100 text-gray-600 border-gray-200',
  'on-break': 'bg-amber-50 text-amber-700 border-amber-200',
}

const SHIFT_LABELS: Record<string, string> = {
  'on-duty': 'On Shift',
  'off-duty': 'Off Shift',
  'on-break': 'On Break',
}

const SCORE_COLOR = (s: number) => s >= 90 ? 'text-green-600' : s >= 75 ? 'text-amber-600' : 'text-red-600'
const SCORE_BAR = (s: number) => s >= 90 ? '#22c55e' : s >= 75 ? '#f59e0b' : '#ef4444'

const LICENCE_STATUS = (expiry: string) => {
  const days = Math.floor((new Date(expiry).getTime() - Date.now()) / 86400000)
  if (days < 0) return { label: 'Expired', color: 'text-red-600' }
  if (days < 30) return { label: `${days}d`, color: 'text-red-600' }
  if (days < 90) return { label: `${days}d`, color: 'text-amber-600' }
  return { label: `${days}d`, color: 'text-green-600' }
}

type ViewMode = 'list' | 'grid'
type SortField = 'name' | 'score' | 'violations' | 'trips' | 'status'

export default function DriversPage() {
  const { isDark } = useTheme()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [filterFleet, setFilterFleet] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [showFilters, setShowFilters] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [selectedRows, setSelectedRows] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState<'all' | 'allocations'>('all')

  const enrichedDrivers = drivers.map(d => {
    const vehicle = vehicles.find(v => v.driverId === d.id)
    const fleet = fleets.find(f => f.id === d.fleetId)
    return { ...d, vehicle, fleet }
  })

  const filtered = enrichedDrivers
    .filter(d => {
      const s = search.toLowerCase()
      const matchSearch = !search ||
        d.name.toLowerCase().includes(s) ||
        d.role.toLowerCase().includes(s) ||
        d.email.toLowerCase().includes(s) ||
        d.licence.toLowerCase().includes(s)
      const matchFleet = filterFleet === 'all' || d.fleetId === filterFleet
      const matchStatus = filterStatus === 'all' || d.status === filterStatus
      return matchSearch && matchFleet && matchStatus
    })
    .sort((a, b) => {
      let aVal: any, bVal: any
      switch (sortField) {
        case 'name': aVal = a.name; bVal = b.name; break
        case 'score': aVal = a.score; bVal = b.score; break
        case 'violations': aVal = a.violations; bVal = b.violations; break
        case 'trips': aVal = a.trips; bVal = b.trips; break
        case 'status': aVal = a.status; bVal = b.status; break
        default: aVal = a.name; bVal = b.name
      }
      if (typeof aVal === 'number') return sortDir === 'asc' ? aVal - bVal : bVal - aVal
      return sortDir === 'asc' ? String(aVal).localeCompare(String(bVal)) : String(bVal).localeCompare(String(aVal))
    })

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }

  const toggleRow = (id: string) =>
    setSelectedRows(prev => prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id])

  const onDuty = drivers.filter(d => d.status === 'on-duty').length
  const offDuty = drivers.filter(d => d.status === 'off-duty').length
  const onBreak = drivers.filter(d => d.status === 'on-break').length
  const unallocated = drivers.filter(d => !vehicles.find(v => v.driverId === d.id)).length

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
            <h1 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Drivers</h1>
            <p className={`text-sm mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              {filtered.length} of {drivers.length} drivers
              {selectedRows.length > 0 && ` · ${selectedRows.length} selected`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button className={`flex items-center gap-2 text-sm px-3 py-2 rounded-xl border transition-colors
              ${isDark ? 'border-gray-700 text-gray-300 hover:bg-gray-800' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              <Download size={15} /> Export
            </button>
            <button className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
              <Plus size={15} /> Add Driver
            </button>
          </div>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-4 gap-4 mb-5">
          {[
            { label: 'Total Drivers', value: drivers.length, icon: Users, color: 'text-purple-600', bg: 'bg-purple-50' },
            { label: 'On Shift', value: onDuty, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
            { label: 'Unallocated', value: unallocated, icon: UserX, color: 'text-amber-600', bg: 'bg-amber-50' },
            { label: 'Violations Today', value: drivers.reduce((a, d) => a + d.violations, 0), icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
          ].map((kpi, i) => (
            <div key={i} className={`border rounded-2xl p-4 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
              <div className={`w-9 h-9 rounded-xl ${kpi.bg} flex items-center justify-center mb-3`}>
                <kpi.icon size={18} className={kpi.color} />
              </div>
              <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{kpi.value}</p>
              <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{kpi.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className={`flex items-center gap-1 mb-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
          {[
            { id: 'all', label: 'All Drivers' },
            { id: 'allocations', label: 'Driver Allocations' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2.5 text-xs font-medium border-b-2 -mb-px transition-all
                ${activeTab === tab.id
                  ? 'border-purple-600 text-purple-600'
                  : `border-transparent ${isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'}`
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Allocations tab */}
        {activeTab === 'allocations' && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {fleets.map(fleet => {
              const fleetDrivers = enrichedDrivers.filter(d => d.fleetId === fleet.id)
              return (
                <div key={fleet.id} className={`border rounded-2xl p-4 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-3 h-3 rounded-full" style={{ background: fleet.color }}></div>
                    <h3 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>{fleet.name}</h3>
                    <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>({fleetDrivers.length} drivers)</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {fleetDrivers.length > 0 ? fleetDrivers.map(d => (
                      <div
                        key={d.id}
                        onClick={() => navigate(`/fleetpoint/drivers/${d.id}`)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer border transition-all
                          ${d.status === 'on-duty'
                            ? 'bg-green-50 border-green-200 hover:border-green-400'
                            : d.status === 'on-break'
                            ? 'bg-amber-50 border-amber-200 hover:border-amber-400'
                            : `${isDark ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'} hover:border-purple-300`
                          }`}
                      >
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                          {d.avatar}
                        </div>
                        <div>
                          <p className={`text-xs font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{d.name.split(' ')[0]}</p>
                          <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            {d.vehicle ? d.vehicle.plate : 'Unallocated'}
                          </p>
                        </div>
                      </div>
                    )) : (
                      <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>No drivers in this fleet</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* All drivers tab */}
        {activeTab === 'all' && (
          <>
            {/* Search + filters */}
            <div className={`rounded-2xl border p-4 mb-4 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
              <div className="flex items-center gap-3">
                <div className={`flex-1 flex items-center gap-2 border rounded-xl px-3 py-2
                  ${isDark ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-gray-50'}`}>
                  <Search size={14} className="text-gray-400 shrink-0" />
                  <input
                    type="text"
                    placeholder="Search name, role, email, licence..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className={`flex-1 text-sm outline-none bg-transparent
                      ${isDark ? 'text-white placeholder-gray-500' : 'text-gray-900 placeholder-gray-400'}`}
                  />
                </div>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center gap-2 text-sm px-3 py-2 rounded-xl border transition-colors
                    ${showFilters ? 'border-purple-500 bg-purple-50 text-purple-600'
                      : `${isDark ? 'border-gray-700 text-gray-300' : 'border-gray-200 text-gray-600'}`}`}
                >
                  <Filter size={14} /> Filters
                </button>
                <div className={`flex rounded-xl border overflow-hidden ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                  {(['list', 'grid'] as ViewMode[]).map(mode => (
                    <button
                      key={mode}
                      onClick={() => setViewMode(mode)}
                      className={`p-2 transition-colors ${viewMode === mode
                        ? 'bg-purple-600 text-white'
                        : `${isDark ? 'bg-gray-800 text-gray-400' : 'bg-white text-gray-500'}`}`}
                    >
                      {mode === 'list' ? <List size={14} /> : <LayoutGrid size={14} />}
                    </button>
                  ))}
                </div>
              </div>

              {showFilters && (
                <div className="flex items-center gap-3 mt-3 flex-wrap">
                  {[
                    {
                      label: 'Fleet', value: filterFleet, onChange: setFilterFleet,
                      options: [{ value: 'all', label: 'All Fleets' }, ...fleets.map(f => ({ value: f.id, label: f.name }))]
                    },
                    {
                      label: 'Status', value: filterStatus, onChange: setFilterStatus,
                      options: [
                        { value: 'all', label: 'All Status' },
                        { value: 'on-duty', label: 'On Shift' },
                        { value: 'off-duty', label: 'Off Shift' },
                        { value: 'on-break', label: 'On Break' },
                      ]
                    },
                  ].map(f => (
                    <select key={f.label} value={f.value} onChange={e => f.onChange(e.target.value)}
                      className={`text-sm border rounded-xl px-3 py-2 outline-none
                        ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200 text-gray-700'}`}>
                      {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  ))}
                  <button onClick={() => { setFilterFleet('all'); setFilterStatus('all'); setSearch('') }}
                    className="text-xs text-purple-600 hover:underline">Clear all</button>
                </div>
              )}
            </div>

            {/* Grid view */}
            {viewMode === 'grid' && (
              <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
                {filtered.map(d => {
                  const licence = LICENCE_STATUS(d.licenceExpiry)
                  return (
                    <div
                      key={d.id}
                      onClick={() => navigate(`/fleetpoint/drivers/${d.id}`)}
                      className={`border rounded-2xl p-4 cursor-pointer hover:shadow-md transition-all
                        ${isDark ? 'bg-gray-800 border-gray-700 hover:border-purple-700' : 'bg-white border-gray-200 hover:border-purple-300'}`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-sm font-bold">
                              {d.avatar}
                            </div>
                            <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2
                              ${isDark ? 'border-gray-800' : 'border-white'}
                              ${d.status === 'on-duty' ? 'bg-green-400' : d.status === 'on-break' ? 'bg-amber-400' : 'bg-gray-300'}`}>
                            </div>
                          </div>
                          <div>
                            <p className={`font-bold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>{d.name}</p>
                            <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{d.role}</p>
                          </div>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${SHIFT_BG[d.status]}`}>
                          {SHIFT_LABELS[d.status]}
                        </span>
                      </div>

                      {/* Score */}
                      <div className="mb-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Safety Score</span>
                          <span className={`text-sm font-bold ${SCORE_COLOR(d.score)}`}>{d.score}/100</span>
                        </div>
                        <div className={`h-2 rounded-full overflow-hidden ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
                          <div className="h-full rounded-full" style={{ width: `${d.score}%`, background: SCORE_BAR(d.score) }} />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 mb-3">
                        {[
                          { label: 'Trips', value: d.trips },
                          { label: 'Violations', value: d.violations },
                          { label: 'Fines', value: d.finesPending },
                        ].map(stat => (
                          <div key={stat.label} className={`rounded-xl p-2 text-center ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
                            <p className={`text-sm font-bold ${stat.label === 'Violations' && stat.value > 5 ? 'text-red-600' : isDark ? 'text-white' : 'text-gray-900'}`}>
                              {stat.value}
                            </p>
                            <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{stat.label}</p>
                          </div>
                        ))}
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Car size={12} className="text-gray-400" />
                          <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            {d.vehicle ? d.vehicle.plate : 'Unallocated'}
                          </span>
                        </div>
                        <span className={`text-xs font-medium ${licence.color}`}>
                          Licence: {licence.label}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* List view */}
            {viewMode === 'list' && (
              <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className={`border-b text-xs font-semibold uppercase tracking-wide
                        ${isDark ? 'border-gray-700 bg-gray-900 text-gray-400' : 'border-gray-100 bg-gray-50 text-gray-500'}`}>
                        <th className="px-4 py-3 w-10">
                          <input type="checkbox"
                            checked={selectedRows.length === filtered.length && filtered.length > 0}
                            onChange={() => setSelectedRows(selectedRows.length === filtered.length ? [] : filtered.map(d => d.id))}
                            className="rounded" />
                        </th>
                        <th className="px-4 py-3 text-left cursor-pointer" onClick={() => toggleSort('name')}>
                          Driver <SortIcon field="name" />
                        </th>
                        <th className="px-4 py-3 text-left">Fleet</th>
                        <th className="px-4 py-3 text-left">Shift</th>
                        <th className="px-4 py-3 text-left">Vehicle</th>
                        <th className="px-4 py-3 text-left cursor-pointer" onClick={() => toggleSort('score')}>
                          Score <SortIcon field="score" />
                        </th>
                        <th className="px-4 py-3 text-left cursor-pointer" onClick={() => toggleSort('trips')}>
                          Trips <SortIcon field="trips" />
                        </th>
                        <th className="px-4 py-3 text-left cursor-pointer" onClick={() => toggleSort('violations')}>
                          Violations <SortIcon field="violations" />
                        </th>
                        <th className="px-4 py-3 text-left">Licence</th>
                        <th className="px-4 py-3 text-left">Categories</th>
                        <th className="px-4 py-3 text-left">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(d => {
                        const licence = LICENCE_STATUS(d.licenceExpiry)
                        const isSelected = selectedRows.includes(d.id)
                        return (
                          <tr key={d.id}
                            className={`border-b transition-colors cursor-pointer
                              ${isDark ? 'border-gray-700 hover:bg-gray-750' : 'border-gray-50 hover:bg-gray-50'}
                              ${isSelected ? (isDark ? 'bg-purple-900/20' : 'bg-purple-50') : ''}`}
                            onClick={() => navigate(`/fleetpoint/drivers/${d.id}`)}
                          >
                            <td className="px-4 py-3" onClick={e => { e.stopPropagation(); toggleRow(d.id) }}>
                              <input type="checkbox" checked={isSelected} onChange={() => toggleRow(d.id)} className="rounded" />
                            </td>

                            {/* Driver */}
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2.5">
                                <div className="relative shrink-0">
                                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-xs font-bold">
                                    {d.avatar}
                                  </div>
                                  <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2
                                    ${isDark ? 'border-gray-800' : 'border-white'}
                                    ${d.status === 'on-duty' ? 'bg-green-400' : d.status === 'on-break' ? 'bg-amber-400' : 'bg-gray-300'}`}>
                                  </div>
                                </div>
                                <div>
                                  <p className={`font-semibold text-xs ${isDark ? 'text-white' : 'text-gray-900'}`}>{d.name}</p>
                                  <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{d.role}</p>
                                </div>
                              </div>
                            </td>

                            {/* Fleet */}
                            <td className="px-4 py-3">
                              <span className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full shrink-0"
                                  style={{ background: d.fleet?.color || '#6b7280' }}></span>
                                <span className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                  {d.fleet?.name || '—'}
                                </span>
                              </span>
                            </td>

                            {/* Shift */}
                            <td className="px-4 py-3">
                              <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${SHIFT_BG[d.status]}`}>
                                {SHIFT_LABELS[d.status]}
                              </span>
                            </td>

                            {/* Vehicle */}
                            <td className="px-4 py-3">
                              <span className={`text-xs font-medium ${d.vehicle ? (isDark ? 'text-purple-400' : 'text-purple-600') : 'text-gray-400 italic'}`}>
                                {d.vehicle ? d.vehicle.plate : 'Unallocated'}
                              </span>
                            </td>

                            {/* Score */}
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className={`w-14 h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-gray-600' : 'bg-gray-100'}`}>
                                  <div className="h-full rounded-full" style={{ width: `${d.score}%`, background: SCORE_BAR(d.score) }} />
                                </div>
                                <span className={`text-xs font-bold ${SCORE_COLOR(d.score)}`}>{d.score}</span>
                              </div>
                            </td>

                            {/* Trips */}
                            <td className="px-4 py-3">
                              <span className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{d.trips} today</span>
                            </td>

                            {/* Violations */}
                            <td className="px-4 py-3">
                              <span className={`text-xs font-medium ${d.violations > 10 ? 'text-red-600' : d.violations > 5 ? 'text-amber-600' : 'text-green-600'}`}>
                                {d.violations}
                                {d.finesPending > 0 && <span className="ml-1 text-red-500">(£{d.finesPending} fine)</span>}
                              </span>
                            </td>

                            {/* Licence expiry */}
                            <td className="px-4 py-3">
                              <span className={`text-xs font-medium ${licence.color}`}>{licence.label}</span>
                            </td>

                            {/* Categories */}
                            <td className="px-4 py-3">
                              <div className="flex gap-1 flex-wrap">
                                {d.licenceCategories.map(cat => (
                                  <span key={cat} className={`text-xs px-1.5 py-0.5 rounded font-medium
                                    ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
                                    {cat}
                                  </span>
                                ))}
                              </div>
                            </td>

                            {/* Actions */}
                            <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                              <div className="flex items-center gap-1">
                                <button title="Track on map" onClick={() => navigate('/fleetpoint/live-tracking')}
                                  className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
                                  <MapPin size={13} />
                                </button>
                                <button title="Call driver"
                                  className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
                                  <Phone size={13} />
                                </button>
                                <button title="Edit driver"
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
                  <span>Showing {filtered.length} of {drivers.length} drivers</span>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-green-400"></span> {onDuty} on shift
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-amber-400"></span> {onBreak} on break
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-gray-300"></span> {offDuty} off shift
                    </span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </FleetpointLayout>
  )
}
