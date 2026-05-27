// src/pages/fleetpoint/fleet/DevicesPage.tsx
// Device inventory and management page
// Shows all hardware devices — GPS trackers, dashcams, sensors, RFID, eye sensors
// Grouped by vehicle bundle or listed individually
//
// DEVELOPER NOTES:
// ─────────────────────────────────────────────────────────────────────────────
// All data below is dummy/demo data. In production replace with:
// GET /api/fleetpoint/devices                    — full device list
// GET /api/fleetpoint/devices/:id                — single device
// GET /api/fleetpoint/vehicles/:id/devices       — devices on a vehicle (bundle)
// PATCH /api/fleetpoint/devices/:id/assign       — assign to vehicle
// PATCH /api/fleetpoint/devices/:id/uninstall    — remove from vehicle
// DELETE /api/fleetpoint/devices/:id             — delete device
// POST /api/fleetpoint/devices                   — register new device
//
// Device bundle = group of devices installed on same vehicle
// bundleId links devices together — same bundleId = same vehicle installation
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import {
  Search, Filter, Download, Plus, AlertTriangle,
  Wifi, WifiOff, Battery, Package, CheckCircle,
  MoreHorizontal, Edit, Trash2, RefreshCw, MapPin,
  Cpu, Camera, Thermometer, Zap, Eye, CreditCard,
  ChevronDown, ChevronUp
} from 'lucide-react'
import FleetpointLayout from '../../../layouts/FleetpointLayout'
import { extendedDevices, vehicles } from '../../../data/fleetData'
import { useTheme } from '../../../hooks/useTheme'

// ─── Config — add new device categories here as hardware expands ──────────────
const CATEGORY_CONFIG: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  'gps-tracker':  { label: 'GPS Tracker',       icon: Cpu,         color: 'text-purple-600', bg: 'bg-purple-50' },
  'dashcam':      { label: 'DashCam',           icon: Camera,      color: 'text-blue-600',   bg: 'bg-blue-50' },
  'temp-sensor':  { label: 'Temp Sensor',       icon: Thermometer, color: 'text-orange-600', bg: 'bg-orange-50' },
  'fuel-sensor':  { label: 'Fuel Sensor',       icon: Zap,         color: 'text-amber-600',  bg: 'bg-amber-50' },
  'rfid-reader':  { label: 'RFID Reader',       icon: CreditCard,  color: 'text-green-600',  bg: 'bg-green-50' },
  'eye-sensor':   { label: 'Eye/Fatigue Sensor',icon: Eye,         color: 'text-rose-600',   bg: 'bg-rose-50' },
  'access-card':  { label: 'Access Card',       icon: CreditCard,  color: 'text-teal-600',   bg: 'bg-teal-50' },
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  'active':      { label: 'Active',      color: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-200' },
  'installed':   { label: 'Installed',   color: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-200' },
  'uninstalled': { label: 'Uninstalled', color: 'text-gray-600',   bg: 'bg-gray-100',  border: 'border-gray-200' },
  'faulty':      { label: 'Faulty',      color: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-200' },
  'in-stock':    { label: 'In Stock',    color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200' },
  'issued':      { label: 'Issued',      color: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-200' },
}

type ViewMode = 'list' | 'bundle'

export default function DevicesPage() {
  const { isDark } = useTheme()
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterCategory, setFilterCategory] = useState('all')
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [showFilters, setShowFilters] = useState(false)
  const [activeMenu, setActiveMenu] = useState<string | null>(null)
  const [expandedBundles, setExpandedBundles] = useState<string[]>(['B001', 'B002', 'B003'])
  const [showAddModal, setShowAddModal] = useState(false)

  // ── KPI counts ──────────────────────────────────────────────────────────────
  const total = extendedDevices.length
  const active = extendedDevices.filter(d => d.status === 'active').length
  const faulty = extendedDevices.filter(d => d.status === 'faulty').length
  const inStock = extendedDevices.filter(d => d.status === 'in-stock').length
  const unassigned = extendedDevices.filter(d => !d.vehicleId).length

  // ── Filtered list ───────────────────────────────────────────────────────────
  const filtered = extendedDevices.filter(d => {
    const s = search.toLowerCase()
    const matchSearch = !search ||
      d.imei.includes(s) ||
      d.serial.toLowerCase().includes(s) ||
      d.model.toLowerCase().includes(s) ||
      d.manufacturer.toLowerCase().includes(s) ||
      d.vehiclePlate.toLowerCase().includes(s) ||
      d.notes.toLowerCase().includes(s)
    const matchStatus = filterStatus === 'all' || d.status === filterStatus
    const matchCat = filterCategory === 'all' || d.category === filterCategory
    return matchSearch && matchStatus && matchCat
  })

  // ── Bundle grouping for bundle view ─────────────────────────────────────────
  const bundles = vehicles
    .map(v => ({
      vehicle: v,
      devices: extendedDevices.filter(d => d.vehicleId === v.id),
    }))
    .filter(b => b.devices.length > 0)

  const unassignedDevices = extendedDevices.filter(d => !d.vehicleId)

  const toggleBundle = (id: string) =>
    setExpandedBundles(prev => prev.includes(id) ? prev.filter(b => b !== id) : [...prev, id])

  const SignalBar = ({ strength }: { strength: number }) => {
    const color = strength === 0 ? '#ef4444' : strength < 50 ? '#f59e0b' : '#22c55e'
    return (
      <div className="flex items-end gap-0.5 h-4">
        {[25, 50, 75, 100].map((threshold, i) => (
          <div key={i} className="w-1 rounded-sm"
            style={{
              height: `${(i + 1) * 25}%`,
              background: strength >= threshold ? color : isDark ? '#374151' : '#e5e7eb'
            }} />
        ))}
      </div>
    )
  }

  return (
    <FleetpointLayout>
      <div className={`p-6 min-h-full ${isDark ? 'bg-gray-950' : 'bg-gray-50'}`}>

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Devices</h1>
            <p className={`text-sm mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              {total} devices · {active} active · {faulty} faulty · {inStock} in stock
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button className={`flex items-center gap-2 text-sm px-3 py-2 rounded-xl border transition-colors
              ${isDark ? 'border-gray-700 text-gray-300 hover:bg-gray-800' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              <Download size={15} /> Export
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
              <Plus size={15} /> Register Device
            </button>
          </div>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-5 gap-3 mb-5">
          {[
            { label: 'Total Devices', value: total, icon: Cpu, color: 'text-purple-600', bg: 'bg-purple-50' },
            { label: 'Active', value: active, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
            { label: 'Faulty', value: faulty, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
            { label: 'In Stock', value: inStock, icon: Package, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Unassigned', value: unassigned, icon: WifiOff, color: 'text-amber-600', bg: 'bg-amber-50' },
          ].map((kpi, i) => (
            <div key={i} className={`border rounded-2xl p-4 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
              <div className={`w-8 h-8 rounded-xl ${kpi.bg} flex items-center justify-center mb-2`}>
                <kpi.icon size={16} className={kpi.color} />
              </div>
              <p className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{kpi.value}</p>
              <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{kpi.label}</p>
            </div>
          ))}
        </div>

        {/* Search + filters + view toggle */}
        <div className={`rounded-2xl border p-4 mb-4 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center gap-3">
            <div className={`flex-1 flex items-center gap-2 border rounded-xl px-3 py-2
              ${isDark ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-gray-50'}`}>
              <Search size={14} className="text-gray-400 shrink-0" />
              <input
                type="text"
                placeholder="Search IMEI, serial, model, vehicle..."
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
                  : `${isDark ? 'border-gray-700 text-gray-300' : 'border-gray-200 text-gray-600'}`}`}>
              <Filter size={14} /> Filters
            </button>
            {/* View toggle */}
            <div className={`flex rounded-xl border overflow-hidden ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
              {(['list', 'bundle'] as ViewMode[]).map(mode => (
                <button key={mode} onClick={() => setViewMode(mode)}
                  className={`px-3 py-2 text-xs font-medium transition-colors
                    ${viewMode === mode ? 'bg-purple-600 text-white' : `${isDark ? 'bg-gray-800 text-gray-400' : 'bg-white text-gray-500'}`}`}>
                  {mode === 'list' ? '☰ List' : '🔗 Bundle'}
                </button>
              ))}
            </div>
          </div>

          {showFilters && (
            <div className="flex items-center gap-3 mt-3 flex-wrap">
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                className={`text-sm border rounded-xl px-3 py-2 outline-none
                  ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200 text-gray-700'}`}>
                <option value="all">All Status</option>
                {Object.entries(STATUS_CONFIG).map(([val, cfg]) => (
                  <option key={val} value={val}>{cfg.label}</option>
                ))}
              </select>
              <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
                className={`text-sm border rounded-xl px-3 py-2 outline-none
                  ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200 text-gray-700'}`}>
                <option value="all">All Types</option>
                {Object.entries(CATEGORY_CONFIG).map(([val, cfg]) => (
                  <option key={val} value={val}>{cfg.label}</option>
                ))}
              </select>
              <button onClick={() => { setFilterStatus('all'); setFilterCategory('all'); setSearch('') }}
                className="text-xs text-purple-600 hover:underline">Clear all</button>
            </div>
          )}
        </div>

        {/* ── LIST VIEW ──────────────────────────────────────────────────────── */}
        {viewMode === 'list' && (
          <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className={`border-b text-xs font-semibold uppercase tracking-wide
                    ${isDark ? 'border-gray-700 bg-gray-900 text-gray-400' : 'border-gray-100 bg-gray-50 text-gray-500'}`}>
                    <th className="px-4 py-3 text-left">Device</th>
                    <th className="px-4 py-3 text-left">Type</th>
                    <th className="px-4 py-3 text-left">IMEI / Serial</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Vehicle</th>
                    <th className="px-4 py-3 text-left">Signal</th>
                    <th className="px-4 py-3 text-left">Battery</th>
                    <th className="px-4 py-3 text-left">Firmware</th>
                    <th className="px-4 py-3 text-left">Last Ping</th>
                    <th className="px-4 py-3 text-left">Warranty</th>
                    <th className="px-4 py-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(device => {
                    const cat = CATEGORY_CONFIG[device.category]
                    const status = STATUS_CONFIG[device.status]
                    const warrantyDays = device.warrantyExpiry && device.warrantyExpiry !== ''
                      ? Math.floor((new Date(device.warrantyExpiry).getTime() - Date.now()) / 86400000)
                      : null
                    const warrantyColor = warrantyDays === null ? 'text-gray-400'
                      : warrantyDays < 0 ? 'text-red-600'
                      : warrantyDays < 90 ? 'text-amber-600'
                      : 'text-green-600'

                    return (
                      <tr key={device.id}
                        className={`border-b transition-colors
                          ${isDark ? 'border-gray-700 hover:bg-gray-750' : 'border-gray-50 hover:bg-gray-50'}`}>

                        {/* Device */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className={`w-8 h-8 rounded-lg ${cat.bg} flex items-center justify-center shrink-0`}>
                              <cat.icon size={14} className={cat.color} />
                            </div>
                            <div>
                              <p className={`font-semibold text-xs ${isDark ? 'text-white' : 'text-gray-900'}`}>{device.model}</p>
                              <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{device.manufacturer}</p>
                            </div>
                          </div>
                        </td>

                        {/* Type */}
                        <td className="px-4 py-3">
                          <span className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{cat.label}</span>
                        </td>

                        {/* IMEI / Serial */}
                        <td className="px-4 py-3">
                          <p className={`text-xs font-mono ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            {device.imei || '—'}
                          </p>
                          <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{device.serial}</p>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium
                            ${status.color} ${status.bg} ${status.border}`}>
                            {status.label}
                          </span>
                          {device.status === 'faulty' && (
                            <AlertTriangle size={12} className="text-red-500 ml-1 inline" />
                          )}
                        </td>

                        {/* Vehicle */}
                        <td className="px-4 py-3">
                          {device.vehiclePlate ? (
                            <span className={`text-xs font-medium ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>
                              {device.vehiclePlate}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400 italic">Unassigned</span>
                          )}
                        </td>

                        {/* Signal */}
                        <td className="px-4 py-3">
                          {device.signalStrength > 0 ? (
                            <div className="flex items-center gap-1.5">
                              <SignalBar strength={device.signalStrength} />
                              <span className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                                {device.signalStrength}%
                              </span>
                            </div>
                          ) : (
                            <WifiOff size={14} className="text-gray-400" />
                          )}
                        </td>

                        {/* Battery */}
                        <td className="px-4 py-3">
                          {device.battery !== undefined ? (
                            <div className="flex items-center gap-1.5">
                              <Battery size={13} className={device.battery < 20 ? 'text-red-500' : 'text-gray-400'} />
                              <span className={`text-xs font-medium ${device.battery < 20 ? 'text-red-600' : isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                                {device.battery}%
                              </span>
                            </div>
                          ) : (
                            <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Hardwired</span>
                          )}
                        </td>

                        {/* Firmware */}
                        <td className="px-4 py-3">
                          <span className={`text-xs font-mono ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                            {device.firmwareVersion}
                          </span>
                        </td>

                        {/* Last ping */}
                        <td className="px-4 py-3">
                          <span className={`text-xs ${device.status === 'faulty' ? 'text-red-600 font-medium' : isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            {device.lastPing}
                          </span>
                        </td>

                        {/* Warranty */}
                        <td className="px-4 py-3">
                          <span className={`text-xs font-medium ${warrantyColor}`}>
                            {warrantyDays === null ? '—'
                              : warrantyDays < 0 ? 'Expired'
                              : `${warrantyDays}d`}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3">
                          <div className="relative">
                            <button
                              onClick={() => setActiveMenu(activeMenu === device.id ? null : device.id)}
                              className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
                              <MoreHorizontal size={14} />
                            </button>
                            {activeMenu === device.id && (
                              <div className={`absolute right-0 top-8 z-10 rounded-xl shadow-lg border w-44 overflow-hidden
                                ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                                {[
                                  { icon: RefreshCw, label: 'Reassign Vehicle', action: () => {} },
                                  { icon: MapPin, label: 'Track on Map', action: () => {} },
                                  { icon: Edit, label: 'Edit Device', action: () => {} },
                                  { icon: Trash2, label: 'Remove Device', action: () => {}, danger: true },
                                ].map(item => (
                                  <button key={item.label}
                                    onClick={() => { item.action(); setActiveMenu(null) }}
                                    className={`w-full flex items-center gap-2 px-3 py-2.5 text-xs transition-colors
                                      ${(item as any).danger
                                        ? 'text-red-600 hover:bg-red-50'
                                        : `${isDark ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-50'}`}`}>
                                    <item.icon size={12} />{item.label}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className={`px-4 py-3 border-t text-xs ${isDark ? 'border-gray-700 text-gray-400' : 'border-gray-100 text-gray-500'}`}>
              Showing {filtered.length} of {extendedDevices.length} devices
            </div>
          </div>
        )}

        {/* ── BUNDLE VIEW ────────────────────────────────────────────────────── */}
        {viewMode === 'bundle' && (
          <div className="flex flex-col gap-4">
            {bundles.map(({ vehicle: v, devices: bundleDevices }) => {
              const hasAlert = bundleDevices.some(d => d.status === 'faulty')
              const isExpanded = expandedBundles.includes(v.id)
              return (
                <div key={v.id} className={`rounded-2xl border overflow-hidden
                  ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}
                  ${hasAlert ? 'border-l-4 border-l-red-500' : ''}`}>

                  {/* Bundle header */}
                  <button
                    onClick={() => toggleBundle(v.id)}
                    className={`w-full flex items-center gap-4 px-5 py-4 text-left transition-colors
                      ${isDark ? 'hover:bg-gray-750' : 'hover:bg-gray-50'}`}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0
                      ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
                      🚛
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`font-bold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>{v.plate}</span>
                        <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          {v.make} {v.model}
                        </span>
                        {hasAlert && (
                          <span className="flex items-center gap-1 text-xs bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded-full">
                            <AlertTriangle size={10} /> Faulty device
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        {bundleDevices.map(d => {
                          const cat = CATEGORY_CONFIG[d.category]
                          return (
                            <div key={d.id} className="flex items-center gap-1">
                              <cat.icon size={11} className={cat.color} />
                              <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{cat.label}</span>
                              <span className={`w-1.5 h-1.5 rounded-full ${d.status === 'active' ? 'bg-green-400' : d.status === 'faulty' ? 'bg-red-400' : 'bg-gray-300'}`}></span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        {bundleDevices.length} devices
                      </span>
                      {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                    </div>
                  </button>

                  {/* Bundle devices */}
                  {isExpanded && (
                    <div className={`border-t ${isDark ? 'border-gray-700' : 'border-gray-100'}`}>
                      {bundleDevices.map((device, i) => {
                        const cat = CATEGORY_CONFIG[device.category]
                        const status = STATUS_CONFIG[device.status]
                        return (
                          <div key={device.id}
                            className={`flex items-center gap-4 px-5 py-3
                              ${i < bundleDevices.length - 1 ? `border-b ${isDark ? 'border-gray-700' : 'border-gray-50'}` : ''}
                              ${device.status === 'faulty' ? (isDark ? 'bg-red-900/10' : 'bg-red-50/50') : ''}`}>

                            <div className={`w-8 h-8 rounded-lg ${cat.bg} flex items-center justify-center shrink-0`}>
                              <cat.icon size={14} className={cat.color} />
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className={`text-xs font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                  {device.model}
                                </span>
                                <span className={`text-xs px-2 py-0.5 rounded-full border font-medium
                                  ${status.color} ${status.bg} ${status.border}`}>
                                  {status.label}
                                </span>
                              </div>
                              <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                {device.notes}
                              </p>
                            </div>

                            <div className="flex items-center gap-6 shrink-0">
                              <div className="text-right">
                                <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>IMEI</p>
                                <p className={`text-xs font-mono ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                  {device.imei || '—'}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Signal</p>
                                <div className="flex items-center gap-1 justify-end">
                                  <SignalBar strength={device.signalStrength} />
                                  <span className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                                    {device.signalStrength}%
                                  </span>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Last ping</p>
                                <p className={`text-xs font-medium ${device.status === 'faulty' ? 'text-red-600' : isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                  {device.lastPing}
                                </p>
                              </div>
                              <button className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
                                <MoreHorizontal size={14} />
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}

            {/* Unassigned devices */}
            {unassignedDevices.length > 0 && (
              <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                <div className={`flex items-center gap-3 px-5 py-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-100'}`}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
                    <Package size={18} className="text-gray-400" />
                  </div>
                  <div>
                    <p className={`font-bold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>Unassigned / In Stock</p>
                    <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      {unassignedDevices.length} devices not assigned to any vehicle
                    </p>
                  </div>
                </div>
                {unassignedDevices.map((device, i) => {
                  const cat = CATEGORY_CONFIG[device.category]
                  const status = STATUS_CONFIG[device.status]
                  return (
                    <div key={device.id}
                      className={`flex items-center gap-4 px-5 py-3
                        ${i < unassignedDevices.length - 1 ? `border-b ${isDark ? 'border-gray-700' : 'border-gray-50'}` : ''}`}>
                      <div className={`w-8 h-8 rounded-lg ${cat.bg} flex items-center justify-center shrink-0`}>
                        <cat.icon size={14} className={cat.color} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{device.model}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${status.color} ${status.bg} ${status.border}`}>
                            {status.label}
                          </span>
                        </div>
                        <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{device.notes}</p>
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        <span className={`text-xs font-mono ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          {device.serial}
                        </span>
                        <button className="text-xs bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg font-medium transition-colors">
                          Assign to Vehicle
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Register Device Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className={`rounded-3xl shadow-2xl w-full max-w-md mx-4 p-6 ${isDark ? 'bg-gray-900' : 'bg-white'}`}>
            <h2 className={`text-lg font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Register New Device</h2>
            {/* DEVELOPER NOTE: POST /api/fleetpoint/devices with IMEI, model, category, vehicleId */}
            <div className="flex flex-col gap-3">
              {[
                { label: 'IMEI Number', placeholder: '15-digit IMEI' },
                { label: 'Serial Number', placeholder: 'Device serial' },
                { label: 'Model', placeholder: 'e.g. FMC920' },
                { label: 'Manufacturer', placeholder: 'e.g. Teltonika' },
              ].map(field => (
                <div key={field.label}>
                  <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{field.label}</label>
                  <input placeholder={field.placeholder}
                    className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-purple-500
                      ${isDark ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'}`} />
                </div>
              ))}
              <div>
                <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Device Type</label>
                <select className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-purple-500
                  ${isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-700'}`}>
                  {Object.entries(CATEGORY_CONFIG).map(([val, cfg]) => (
                    <option key={val} value={val}>{cfg.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={() => setShowAddModal(false)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium border ${isDark ? 'border-gray-700 text-gray-300' : 'border-gray-200 text-gray-600'}`}>
                Cancel
              </button>
              <button onClick={() => setShowAddModal(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-purple-600 hover:bg-purple-700 text-white">
                Register Device
              </button>
            </div>
          </div>
        </div>
      )}
    </FleetpointLayout>
  )
}
