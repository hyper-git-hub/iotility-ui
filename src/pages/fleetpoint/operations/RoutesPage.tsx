// src/pages/fleetpoint/operations/RoutesPage.tsx
// Routes management — Library, Active Runs, Dispatch, Adherence
//
// DEVELOPER NOTES:
// ─────────────────────────────────────────────────────────────────────────────
// Four tabs in one page — no sub-menu needed
// Routes = defined paths A→B with stops, tolerance, compliance scoring
//
// Key concepts:
// Route = template/definition (reusable)
// RouteRun = one execution of a route (linked to job optionally)
// Compliance = % of GPS pings within toleranceMeters of planned path
// Deviation = server-side calculation on every GPS ping
//
// Auto-dispatch:
// POST /api/fleetpoint/jobs/:id/auto-dispatch
// Algorithm: proximity + availability + score + vehicle type + hours
// Frontend shows: dispatch mode badge + reasoning tooltip
//
// Adherence map:
// GET /api/fleetpoint/routes/runs/:id/adherence
// Returns planned/actual/deviated polylines
// Rendered as three colored Polylines on Leaflet map
// Blue=planned, Green=actual, Red=deviated
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import {
  Search, Plus, Download, Filter, Navigation,
  CheckCircle, Clock, Play, XCircle, MapPin,
  ChevronRight, MoreHorizontal, Edit, Trash2,
  RefreshCw, Truck, Users, RotateCcw, X,
  AlertTriangle, Zap, Bot, User, Lightbulb,
  Route, Flag, Circle
} from 'lucide-react'
import FleetpointLayout from '../../../layouts/FleetpointLayout'
import { routes, routeRuns, drivers, vehicles, fleets } from '../../../data/fleetData'
import { useTheme } from '../../../hooks/useTheme'
import type { Route as RouteType, RouteRun, RouteStatus } from '../../../data/fleetData'

// ─── Config ───────────────────────────────────────────────────────────────────
const RUN_STATUS_CONFIG: Record<RouteStatus, { label: string; color: string; bg: string; border: string; icon: any }> = {
  scheduled:  { label: 'Scheduled',  color: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-200',   icon: Clock },
  'en-route': { label: 'En Route',   color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200', icon: Play },
  completed:  { label: 'Completed',  color: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-200',  icon: CheckCircle },
  cancelled:  { label: 'Cancelled',  color: 'text-gray-600',   bg: 'bg-gray-100',  border: 'border-gray-200',   icon: XCircle },
}

const DISPATCH_MODE_CONFIG = {
  manual:    { label: 'Manual',    icon: User,      color: 'text-gray-600',   bg: 'bg-gray-100' },
  suggested: { label: 'Suggested', icon: Lightbulb, color: 'text-amber-600',  bg: 'bg-amber-50' },
  auto:      { label: 'Auto',      icon: Bot,       color: 'text-purple-600', bg: 'bg-purple-50' },
}

const SCORE_COLOR = (s: number) => s >= 90 ? 'text-green-600' : s >= 75 ? 'text-amber-600' : s > 0 ? 'text-red-600' : 'text-gray-400'
const SCORE_BAR = (s: number) => s >= 90 ? '#22c55e' : s >= 75 ? '#f59e0b' : '#ef4444'

const formatTime = (iso: string) => {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

type TabId = 'library' | 'active' | 'dispatch' | 'adherence'

// Dummy adherence polylines for demo
// TODO: replace with GET /api/fleetpoint/routes/runs/:id/adherence
const PLANNED_POLYLINE: [number, number][] = [
  [51.5400, -0.0800], [51.5200, -0.1000], [51.4900, -0.2000],
  [51.8000, -1.2000], [52.0500, -1.4000], [52.2600, -1.5000], [52.4550, -1.7300]
]
const ACTUAL_POLYLINE: [number, number][] = [
  [51.5400, -0.0800], [51.5150, -0.0950], [51.4850, -0.1950],
  [51.8100, -1.1800], [52.0600, -1.3800], [52.2700, -1.4900], [52.4600, -1.7200]
]
const DEVIATED_POLYLINE: [number, number][] = [
  [51.8100, -1.1800], [51.8400, -1.1200], [51.8600, -1.1500], [52.0600, -1.3800]
]

export default function RoutesPage() {
  const { isDark } = useTheme()
  const [activeTab, setActiveTab] = useState<TabId>('library')
  const [search, setSearch] = useState('')
  const [filterFleet, setFilterFleet] = useState('all')
  const [filterStatus, setFilterStatus] = useState<'all' | RouteStatus>('all')
  const [selectedRun, setSelectedRun] = useState<RouteRun | null>(null)
  const [selectedRoute, setSelectedRoute] = useState<RouteType | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showDispatchModal, setShowDispatchModal] = useState(false)
  const [adherenceRun, setAdherenceRun] = useState<RouteRun | null>(routeRuns[0])
  const [activeMenu, setActiveMenu] = useState<string | null>(null)
  const [dispatchMode, setDispatchMode] = useState<'manual' | 'suggested' | 'auto'>('manual')

  // ── KPIs ────────────────────────────────────────────────────────────────────
  const totalRoutes = routes.length
  const activeRuns = routeRuns.filter(r => r.status === 'en-route').length
  const scheduledRuns = routeRuns.filter(r => r.status === 'scheduled').length
  const completedToday = routeRuns.filter(r => r.status === 'completed').length
  const avgCompliance = Math.round(routes.reduce((a, r) => a + r.avgComplianceScore, 0) / routes.length)
  const autoDispatched = routeRuns.filter(r => r.dispatchMode === 'auto').length

  // ── Filtered routes ──────────────────────────────────────────────────────────
  const filteredRoutes = routes.filter(r => {
    const s = search.toLowerCase()
    const matchSearch = !search ||
      r.name.toLowerCase().includes(s) ||
      r.startAddress.toLowerCase().includes(s) ||
      r.endAddress.toLowerCase().includes(s)
    const matchFleet = filterFleet === 'all' || r.assignedIds.includes(filterFleet)
    return matchSearch && matchFleet
  })

  // ── Filtered runs ────────────────────────────────────────────────────────────
  const filteredRuns = routeRuns.filter(r => {
    const matchStatus = filterStatus === 'all' || r.status === filterStatus
    const matchSearch = !search ||
      r.routeName.toLowerCase().includes(search.toLowerCase()) ||
      r.driverName.toLowerCase().includes(search.toLowerCase()) ||
      r.vehiclePlate.toLowerCase().includes(search.toLowerCase())
    return matchStatus && matchSearch
  })

  const tabs: { id: TabId; label: string; emoji: string; count?: number }[] = [
    { id: 'library', label: 'Routes Library', emoji: '🗺️', count: totalRoutes },
    { id: 'active', label: 'Active Runs', emoji: '▶️', count: activeRuns + scheduledRuns },
    { id: 'dispatch', label: 'Dispatch', emoji: '🚀' },
    { id: 'adherence', label: 'Adherence', emoji: '📊' },
  ]

  return (
    <FleetpointLayout>
      <div className={`p-6 min-h-full ${isDark ? 'bg-gray-950' : 'bg-gray-50'}`}>

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Routes</h1>
            <p className={`text-sm mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              {totalRoutes} routes · {activeRuns} en route · {avgCompliance}% avg compliance
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button className={`flex items-center gap-2 text-sm px-3 py-2 rounded-xl border transition-colors
              ${isDark ? 'border-gray-700 text-gray-300 hover:bg-gray-800' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              <Download size={15} /> Export
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
              <Plus size={15} /> Create Route
            </button>
          </div>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-6 gap-3 mb-5">
          {[
            { label: 'Total Routes', value: totalRoutes, icon: Navigation, color: 'text-purple-600', bg: 'bg-purple-50' },
            { label: 'En Route', value: activeRuns, icon: Play, color: 'text-purple-600', bg: 'bg-purple-50' },
            { label: 'Scheduled', value: scheduledRuns, icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Completed Today', value: completedToday, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
            { label: 'Avg Compliance', value: `${avgCompliance}%`, icon: Route, color: avgCompliance >= 90 ? 'text-green-600' : 'text-amber-600', bg: avgCompliance >= 90 ? 'bg-green-50' : 'bg-amber-50' },
            { label: 'Auto-Dispatched', value: autoDispatched, icon: Bot, color: 'text-purple-600', bg: 'bg-purple-50' },
          ].map((kpi, i) => (
            <div key={i} className={`border rounded-2xl p-3 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
              <div className={`w-7 h-7 rounded-lg ${kpi.bg} flex items-center justify-center mb-2`}>
                <kpi.icon size={14} className={kpi.color} />
              </div>
              <p className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{kpi.value}</p>
              <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{kpi.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className={`flex items-center gap-1 mb-5 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 -mb-px transition-all
                ${activeTab === tab.id
                  ? 'border-purple-600 text-purple-600'
                  : `border-transparent ${isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'}`
                }`}
            >
              <span>{tab.emoji}</span>
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full
                  ${activeTab === tab.id ? 'bg-purple-100 text-purple-700' : `${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-500'}`}`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── ROUTES LIBRARY TAB ────────────────────────────────────────────── */}
        {activeTab === 'library' && (
          <>
            {/* Search + filters */}
            <div className={`rounded-2xl border p-4 mb-4 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
              <div className="flex items-center gap-3">
                <div className={`flex-1 flex items-center gap-2 border rounded-xl px-3 py-2
                  ${isDark ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-gray-50'}`}>
                  <Search size={14} className="text-gray-400 shrink-0" />
                  <input type="text" placeholder="Search routes..."
                    value={search} onChange={e => setSearch(e.target.value)}
                    className={`flex-1 text-sm outline-none bg-transparent
                      ${isDark ? 'text-white placeholder-gray-500' : 'text-gray-900 placeholder-gray-400'}`} />
                  {search && <button onClick={() => setSearch('')}><X size={12} className="text-gray-400" /></button>}
                </div>
                <select value={filterFleet} onChange={e => setFilterFleet(e.target.value)}
                  className={`text-sm border rounded-xl px-3 py-2 outline-none ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200 text-gray-700'}`}>
                  <option value="all">All Fleets</option>
                  {fleets.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
            </div>

            {/* Routes table */}
            <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
              <table className="w-full text-sm">
                <thead>
                  <tr className={`border-b text-xs font-semibold uppercase tracking-wide
                    ${isDark ? 'border-gray-700 bg-gray-900 text-gray-400' : 'border-gray-100 bg-gray-50 text-gray-500'}`}>
                    <th className="px-4 py-3 text-left">Route</th>
                    <th className="px-4 py-3 text-left">Start → End</th>
                    <th className="px-4 py-3 text-left">Stops</th>
                    <th className="px-4 py-3 text-left">Distance</th>
                    <th className="px-4 py-3 text-left">Assigned To</th>
                    <th className="px-4 py-3 text-left">Template</th>
                    <th className="px-4 py-3 text-left">Avg Compliance</th>
                    <th className="px-4 py-3 text-left">Total Runs</th>
                    <th className="px-4 py-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRoutes.map(route => {
                    const fleet = fleets.find(f => route.assignedIds.includes(f.id))
                    return (
                      <tr key={route.id}
                        className={`border-b cursor-pointer transition-colors
                          ${isDark ? 'border-gray-700 hover:bg-gray-750' : 'border-gray-50 hover:bg-gray-50'}`}
                        onClick={() => setSelectedRoute(selectedRoute?.id === route.id ? null : route)}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0
                              ${isDark ? 'bg-gray-700' : 'bg-purple-50'}`}>
                              <Navigation size={13} className="text-purple-500" />
                            </div>
                            <div>
                              <p className={`font-semibold text-xs ${isDark ? 'text-white' : 'text-gray-900'}`}>{route.name}</p>
                              <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{route.id}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            <p className="truncate max-w-32">{route.startAddress.split(',')[0]}</p>
                            <p className={`${isDark ? 'text-gray-500' : 'text-gray-400'}`}>↓</p>
                            <p className="truncate max-w-32">{route.endAddress.split(',')[0]}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            {route.stops.length} stops
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            {route.distanceMiles} mi · ~{Math.round(route.estimatedMinutes / 60)}h{route.estimatedMinutes % 60}m
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {fleet && (
                            <span className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full" style={{ background: fleet.color }}></span>
                              <span className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{fleet.name}</span>
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {route.isTemplate ? (
                            <div>
                              <span className="text-xs bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full font-medium">
                                🔁 Template
                              </span>
                              <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                {route.recurringDays.join(' · ')}
                              </p>
                            </div>
                          ) : (
                            <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>One-time</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className={`w-14 h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
                              <div className="h-full rounded-full" style={{ width: `${route.avgComplianceScore}%`, background: SCORE_BAR(route.avgComplianceScore) }} />
                            </div>
                            <span className={`text-xs font-bold ${SCORE_COLOR(route.avgComplianceScore)}`}>
                              {route.avgComplianceScore}%
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{route.totalRuns}</span>
                        </td>
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => { setSelectedRoute(route); setShowDispatchModal(true) }}
                              className="flex items-center gap-1 text-xs bg-purple-600 hover:bg-purple-700 text-white px-2.5 py-1.5 rounded-lg font-medium transition-colors">
                              <Zap size={11} /> Dispatch
                            </button>
                            <div className="relative">
                              <button onClick={() => setActiveMenu(activeMenu === route.id ? null : route.id)}
                                className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
                                <MoreHorizontal size={14} />
                              </button>
                              {activeMenu === route.id && (
                                <div className={`absolute right-0 top-8 z-10 rounded-xl shadow-lg border w-40 overflow-hidden
                                  ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                                  {[
                                    { icon: Edit, label: 'Edit Route', action: () => {} },
                                    { icon: RotateCcw, label: 'View Runs', action: () => setActiveTab('active') },
                                    { icon: Trash2, label: 'Delete Route', action: () => {}, danger: true },
                                  ].map(item => (
                                    <button key={item.label} onClick={() => { item.action(); setActiveMenu(null) }}
                                      className={`w-full flex items-center gap-2 px-3 py-2.5 text-xs transition-colors
                                        ${(item as any).danger ? 'text-red-600 hover:bg-red-50' : `${isDark ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-50'}`}`}>
                                      <item.icon size={12} />{item.label}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              {/* Expanded stops panel */}
              {selectedRoute && (
                <div className={`border-t px-5 py-4 ${isDark ? 'border-gray-700 bg-gray-750' : 'border-gray-100 bg-gray-50'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <p className={`text-xs font-semibold uppercase tracking-wide ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      {selectedRoute.name} — Stops
                    </p>
                    <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      Tolerance: {selectedRoute.toleranceMeters}m · {selectedRoute.distanceMiles} miles
                    </p>
                  </div>
                  <div className="flex items-start gap-3 overflow-x-auto pb-2">
                    {selectedRoute.stops.map((stop, i) => (
                      <div key={stop.id} className="flex items-start gap-2 shrink-0">
                        <div className="flex flex-col items-center">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
                            ${i === 0 ? 'bg-green-500 text-white' : i === selectedRoute.stops.length - 1 ? 'bg-red-500 text-white' : 'bg-purple-500 text-white'}`}>
                            {i === 0 ? '▶' : i === selectedRoute.stops.length - 1 ? '🏁' : stop.order}
                          </div>
                          {i < selectedRoute.stops.length - 1 && (
                            <div className={`w-px h-8 mt-1 ${isDark ? 'bg-gray-600' : 'bg-gray-300'}`}></div>
                          )}
                        </div>
                        <div className={`rounded-xl p-3 min-w-44 ${isDark ? 'bg-gray-800' : 'bg-white'} border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                          <p className={`text-xs font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{stop.stopName}</p>
                          <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{stop.address.split(',')[0]}</p>
                          <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                            Dwell: {stop.expectedDwellMinutes}min
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className={`px-4 py-3 border-t text-xs ${isDark ? 'border-gray-700 text-gray-400' : 'border-gray-100 text-gray-500'}`}>
                Showing {filteredRoutes.length} of {routes.length} routes
              </div>
            </div>
          </>
        )}

        {/* ── ACTIVE RUNS TAB ───────────────────────────────────────────────── */}
        {activeTab === 'active' && (
          <>
            {/* Status filter chips */}
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              {(['all', 'en-route', 'scheduled', 'completed', 'cancelled'] as const).map(status => (
                <button key={status}
                  onClick={() => setFilterStatus(status === 'all' ? 'all' : status as RouteStatus)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all
                    ${filterStatus === status ? 'bg-purple-600 text-white border-purple-600'
                      : `${isDark ? 'border-gray-700 text-gray-300 hover:bg-gray-800' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}`}>
                  {status === 'all' ? `All Runs (${routeRuns.length})`
                    : `${RUN_STATUS_CONFIG[status as RouteStatus].label} (${routeRuns.filter(r => r.status === status).length})`}
                </button>
              ))}
            </div>

            <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
              <table className="w-full text-sm">
                <thead>
                  <tr className={`border-b text-xs font-semibold uppercase tracking-wide
                    ${isDark ? 'border-gray-700 bg-gray-900 text-gray-400' : 'border-gray-100 bg-gray-50 text-gray-500'}`}>
                    <th className="px-4 py-3 text-left">Route</th>
                    <th className="px-4 py-3 text-left">Driver</th>
                    <th className="px-4 py-3 text-left">Vehicle</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Dispatch</th>
                    <th className="px-4 py-3 text-left">Scheduled</th>
                    <th className="px-4 py-3 text-left">Stops</th>
                    <th className="px-4 py-3 text-left">Compliance</th>
                    <th className="px-4 py-3 text-left">Deviations</th>
                    <th className="px-4 py-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRuns.map(run => {
                    const status = RUN_STATUS_CONFIG[run.status]
                    const dispatch = DISPATCH_MODE_CONFIG[run.dispatchMode]
                    return (
                      <tr key={run.id}
                        className={`border-b transition-colors ${isDark ? 'border-gray-700 hover:bg-gray-750' : 'border-gray-50 hover:bg-gray-50'}`}>
                        <td className="px-4 py-3">
                          <p className={`font-semibold text-xs ${isDark ? 'text-white' : 'text-gray-900'}`}>{run.routeName}</p>
                          <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{run.id}</p>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                              {run.driverName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                            </div>
                            <span className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{run.driverName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-medium ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>
                            {run.vehiclePlate}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${status.color} ${status.bg} ${status.border}`}>
                            {status.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg ${dispatch.bg} w-fit`}>
                            <dispatch.icon size={11} className={dispatch.color} />
                            <span className={`text-xs font-medium ${dispatch.color}`}>{dispatch.label}</span>
                          </div>
                          {run.autoDispatchReason && (
                            <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'} max-w-36 truncate`}
                              title={run.autoDispatchReason}>
                              {run.autoDispatchReason}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <p className={`text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            {formatTime(run.scheduledStart)}
                          </p>
                          <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                            → {formatTime(run.scheduledEnd)}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <div className={`w-12 h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
                              <div className="h-full rounded-full bg-purple-500"
                                style={{ width: run.stopsTotal > 0 ? `${(run.stopsCompleted / run.stopsTotal) * 100}%` : '0%' }} />
                            </div>
                            <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                              {run.stopsCompleted}/{run.stopsTotal}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {run.complianceScore > 0 ? (
                            <span className={`text-xs font-bold ${SCORE_COLOR(run.complianceScore)}`}>
                              {run.complianceScore}%
                            </span>
                          ) : (
                            <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {run.deviationEvents > 0 ? (
                            <span className="flex items-center gap-1 text-xs text-red-600 font-medium">
                              <AlertTriangle size={11} /> {run.deviationEvents}
                            </span>
                          ) : (
                            <span className="text-xs text-green-600">✓ None</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => { setAdherenceRun(run); setActiveTab('adherence') }}
                              className={`p-1.5 rounded-lg text-xs transition-colors ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
                              title="View adherence map">
                              <Navigation size={13} />
                            </button>
                            <button
                              className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
                              title="Track on live map">
                              <MapPin size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <div className={`px-4 py-3 border-t text-xs ${isDark ? 'border-gray-700 text-gray-400' : 'border-gray-100 text-gray-500'}`}>
                Showing {filteredRuns.length} of {routeRuns.length} runs
              </div>
            </div>
          </>
        )}

        {/* ── DISPATCH TAB ──────────────────────────────────────────────────── */}
        {activeTab === 'dispatch' && (
          <div className="grid grid-cols-2 gap-5">

            {/* Dispatch form */}
            <div className={`rounded-2xl border p-5 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
              <h3 className={`font-bold text-sm mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Dispatch a Route
              </h3>
              {/* DEVELOPER NOTE:
                  POST /api/fleetpoint/routes/:id/dispatch
                  Body: { vehicleId, driverId, scheduledStart, scheduledEnd, jobId?, dispatchMode }
                  Response: { runId, status: 'scheduled' }
                  For auto-dispatch: POST /api/fleetpoint/jobs/:id/auto-dispatch
              */}
              <div className="flex flex-col gap-3">

                {/* Dispatch mode toggle */}
                <div>
                  <label className={`block text-xs font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Dispatch Mode
                  </label>
                  <div className={`flex rounded-xl p-0.5 ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
                    {(['manual', 'suggested', 'auto'] as const).map(mode => {
                      const cfg = DISPATCH_MODE_CONFIG[mode]
                      return (
                        <button key={mode}
                          onClick={() => setDispatchMode(mode)}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all
                            ${dispatchMode === mode
                              ? 'bg-purple-600 text-white shadow-sm'
                              : `${isDark ? 'text-gray-400' : 'text-gray-500'}`}`}>
                          <cfg.icon size={12} />
                          {cfg.label}
                        </button>
                      )
                    })}
                  </div>
                  {dispatchMode === 'auto' && (
                    <div className={`mt-2 p-3 rounded-xl text-xs ${isDark ? 'bg-purple-900/20 border border-purple-800 text-purple-300' : 'bg-purple-50 border border-purple-200 text-purple-700'}`}>
                      🤖 System will automatically find the best available driver based on: proximity, availability, safety score and vehicle type.
                    </div>
                  )}
                  {dispatchMode === 'suggested' && (
                    <div className={`mt-2 p-3 rounded-xl text-xs ${isDark ? 'bg-amber-900/20 border border-amber-800 text-amber-300' : 'bg-amber-50 border border-amber-200 text-amber-700'}`}>
                      💡 System will suggest the 3 best drivers. You confirm the final assignment.
                    </div>
                  )}
                </div>

                <div>
                  <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Select Route *
                  </label>
                  <select className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200 text-gray-700'}`}>
                    <option value="">Choose route...</option>
                    {routes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>

                {dispatchMode === 'manual' && (
                  <>
                    <div>
                      <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        Assign Driver *
                      </label>
                      <select className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200 text-gray-700'}`}>
                        <option value="">Select driver...</option>
                        {drivers.map(d => <option key={d.id} value={d.id}>{d.name} — Score {d.score}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        Assign Vehicle
                      </label>
                      <select className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200 text-gray-700'}`}>
                        <option value="">Select vehicle...</option>
                        {vehicles.map(v => <option key={v.id} value={v.id}>{v.plate} — {v.make} {v.model}</option>)}
                      </select>
                    </div>
                  </>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Start Date/Time *
                    </label>
                    <input type="datetime-local"
                      className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200 text-gray-700'}`} />
                  </div>
                  <div>
                    <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      End Date/Time
                    </label>
                    <input type="datetime-local"
                      className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200 text-gray-700'}`} />
                  </div>
                </div>

                <div>
                  <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Link to Job (optional)
                  </label>
                  <select className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200 text-gray-700'}`}>
                    <option value="">No job linked</option>
                    <option>JOB001 — Amazon BHX2 Morning Delivery</option>
                    <option>JOB002 — Tesco RDC Scheduled Delivery</option>
                    <option>JOB004 — Birmingham Ops Urban Run</option>
                  </select>
                </div>

                <button className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 rounded-xl transition-colors mt-2">
                  <Zap size={15} />
                  {dispatchMode === 'auto' ? 'Auto-Dispatch Route' : dispatchMode === 'suggested' ? 'Get Suggestions' : 'Dispatch Route'}
                </button>
              </div>
            </div>

            {/* Vehicle availability */}
            <div className={`rounded-2xl border p-5 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
              <h3 className={`font-bold text-sm mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Driver & Vehicle Availability
              </h3>
              {/* DEVELOPER NOTE:
                  GET /api/fleetpoint/drivers?status=available&date=TODAY
                  Shows which drivers are free right now / have no conflicting jobs
              */}
              <div className="flex flex-col gap-2">
                {drivers.map(d => {
                  const vehicle = vehicles.find(v => v.driverId === d.id)
                  const hasActiveRun = routeRuns.some(r => r.driverId === d.id && r.status === 'en-route')
                  const hasScheduled = routeRuns.some(r => r.driverId === d.id && r.status === 'scheduled')
                  const availability = hasActiveRun ? 'busy' : hasScheduled ? 'scheduled' : 'available'
                  return (
                    <div key={d.id}
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-all
                        ${availability === 'available'
                          ? `${isDark ? 'border-green-800 bg-green-900/10' : 'border-green-200 bg-green-50'}`
                          : availability === 'busy'
                          ? `${isDark ? 'border-red-800 bg-red-900/10' : 'border-red-200 bg-red-50'}`
                          : `${isDark ? 'border-amber-800 bg-amber-900/10' : 'border-amber-200 bg-amber-50'}`
                        }`}>
                      <div className="relative shrink-0">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-xs font-bold">
                          {d.avatar}
                        </div>
                        <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 ${isDark ? 'border-gray-800' : 'border-white'}
                          ${availability === 'available' ? 'bg-green-400' : availability === 'busy' ? 'bg-red-400' : 'bg-amber-400'}`}>
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{d.name}</p>
                        <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          {vehicle ? vehicle.plate : 'No vehicle'} · Score {d.score}
                        </p>
                      </div>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full
                        ${availability === 'available' ? 'bg-green-100 text-green-700'
                          : availability === 'busy' ? 'bg-red-100 text-red-700'
                          : 'bg-amber-100 text-amber-700'}`}>
                        {availability === 'available' ? 'Available' : availability === 'busy' ? 'En Route' : 'Scheduled'}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── ADHERENCE TAB ─────────────────────────────────────────────────── */}
        {activeTab === 'adherence' && (
          <div className="flex flex-col gap-4">

            {/* Run selector */}
            <div className={`rounded-2xl border p-4 flex items-center gap-4 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
              <div className="flex-1">
                <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Select Route Run
                </label>
                <select
                  value={adherenceRun?.id || ''}
                  onChange={e => setAdherenceRun(routeRuns.find(r => r.id === e.target.value) || null)}
                  className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200 text-gray-700'}`}>
                  {routeRuns.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.routeName} — {r.driverName} — {formatTime(r.scheduledStart)} — {RUN_STATUS_CONFIG[r.status].label}
                    </option>
                  ))}
                </select>
              </div>
              <button className={`flex items-center gap-2 text-sm px-3 py-2 rounded-xl border transition-colors mt-5
                ${isDark ? 'border-gray-700 text-gray-300 hover:bg-gray-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                <Download size={14} /> Export PDF
              </button>
            </div>

            {/* Compliance summary */}
            {adherenceRun && (
              <div className="grid grid-cols-5 gap-3">
                {[
                  { label: 'Compliance Score', value: `${adherenceRun.complianceScore || '—'}%`, color: SCORE_COLOR(adherenceRun.complianceScore) },
                  { label: 'Deviation Events', value: adherenceRun.deviationEvents || '—', color: adherenceRun.deviationEvents > 0 ? 'text-red-600' : 'text-green-600' },
                  { label: 'Avg Deviation', value: adherenceRun.avgDeviationMeters > 0 ? `${adherenceRun.avgDeviationMeters}m` : '—', color: 'text-gray-600' },
                  { label: 'Stops Completed', value: `${adherenceRun.stopsCompleted}/${adherenceRun.stopsTotal}`, color: 'text-purple-600' },
                  { label: 'Dispatch Mode', value: DISPATCH_MODE_CONFIG[adherenceRun.dispatchMode].label, color: 'text-blue-600' },
                ].map((stat, i) => (
                  <div key={i} className={`border rounded-2xl p-4 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                    <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
                    <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{stat.label}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Adherence map */}
            <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}
              style={{ height: '420px' }}>
              <div className={`flex items-center justify-between px-4 py-3 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                <div className="flex items-center gap-2">
                  <Navigation size={14} className="text-purple-600" />
                  <span className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    Deviation & Adherence Map
                  </span>
                  {adherenceRun && (
                    <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      — {adherenceRun.routeName}
                    </span>
                  )}
                </div>
                {/* Legend */}
                <div className="flex items-center gap-4">
                  {[
                    { color: '#2563eb', label: 'Planned' },
                    { color: '#22c55e', label: 'Actual' },
                    { color: '#ef4444', label: 'Deviated' },
                  ].map(item => (
                    <div key={item.label} className="flex items-center gap-1.5">
                      <div className="w-6 h-1.5 rounded-full" style={{ background: item.color }}></div>
                      <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ height: 'calc(420px - 57px)' }}>
                <MapContainer
                  center={[52.0, -0.8]}
                  zoom={7}
                  style={{ height: '100%', width: '100%' }}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  {/* Planned route — blue */}
                  <Polyline positions={PLANNED_POLYLINE}
                    pathOptions={{ color: '#2563eb', weight: 3, opacity: 0.8, dashArray: '8 4' }} />
                  {/* Actual route — green */}
                  <Polyline positions={ACTUAL_POLYLINE}
                    pathOptions={{ color: '#22c55e', weight: 3, opacity: 0.9 }} />
                  {/* Deviated sections — red */}
                  <Polyline positions={DEVIATED_POLYLINE}
                    pathOptions={{ color: '#ef4444', weight: 4, opacity: 1 }} />
                  {/* Start marker */}
                  <CircleMarker center={PLANNED_POLYLINE[0]} radius={8}
                    pathOptions={{ color: '#22c55e', fillColor: '#22c55e', fillOpacity: 1 }}>
                    <Popup><div style={{ fontSize: 12 }}><b>Start</b><br />Stratford Logistics Park</div></Popup>
                  </CircleMarker>
                  {/* End marker */}
                  <CircleMarker center={PLANNED_POLYLINE[PLANNED_POLYLINE.length - 1]} radius={8}
                    pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 1 }}>
                    <Popup><div style={{ fontSize: 12 }}><b>End</b><br />Amazon BHX2, Birmingham</div></Popup>
                  </CircleMarker>
                </MapContainer>
              </div>
            </div>

            {/* Developer note */}
            <div className={`rounded-xl p-3 text-xs ${isDark ? 'bg-gray-800 border border-gray-700 text-gray-400' : 'bg-gray-50 border border-gray-200 text-gray-500'}`}>
              💻 <strong>Developer Note:</strong> The polylines above are dummy data for demo.
              In production, fetch from <code>GET /api/fleetpoint/routes/runs/:id/adherence</code> which returns
              planned/actual/deviated coordinate arrays calculated server-side from GPS pings vs route geometry.
            </div>
          </div>
        )}
      </div>

      {/* Create Route Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-md">
          <div className={`rounded-3xl shadow-2xl w-full max-w-lg mx-4 p-6 ${isDark ? 'bg-gray-900' : 'bg-white'}`}>
            <div className="flex items-center justify-between mb-5">
              <h2 className={`font-bold text-lg ${isDark ? 'text-white' : 'text-gray-900'}`}>Create Route</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            {/* DEVELOPER NOTE:
                POST /api/fleetpoint/routes
                Body: { name, description, startAddress, endAddress, stops[], toleranceMeters,
                        assignedTo, assignedIds, isTemplate, recurringDays }
                TODO Sprint 2: Add interactive map for drawing route + placing stops visually
            */}
            <div className="flex flex-col gap-3">
              {[
                { label: 'Route Name *', placeholder: 'e.g. London → Birmingham Express' },
                { label: 'Description', placeholder: 'Brief description of this route' },
                { label: 'Start Address *', placeholder: 'e.g. Stratford Logistics Park, London' },
                { label: 'End Address *', placeholder: 'e.g. Amazon BHX2, Birmingham' },
              ].map(field => (
                <div key={field.label}>
                  <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{field.label}</label>
                  <input placeholder={field.placeholder}
                    className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-purple-500
                      ${isDark ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'}`} />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Tolerance (meters)</label>
                  <input type="number" placeholder="e.g. 500" defaultValue={500}
                    className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none ${isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-700'}`} />
                </div>
                <div>
                  <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Assign to Fleet</label>
                  <select className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none ${isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-700'}`}>
                    {fleets.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </div>
              </div>
              <div className={`rounded-xl border-2 border-dashed p-3 text-center ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                <MapPin size={16} className="text-gray-400 mx-auto mb-1" />
                <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  🗺️ Interactive route builder coming in Sprint 2
                </p>
                <p className={`text-xs ${isDark ? 'text-gray-600' : 'text-gray-300'}`}>
                  TODO: Draw route on map, click to add stops
                </p>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowCreateModal(false)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium border ${isDark ? 'border-gray-700 text-gray-300' : 'border-gray-200 text-gray-600'}`}>
                Cancel
              </button>
              <button onClick={() => setShowCreateModal(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-purple-600 hover:bg-purple-700 text-white transition-colors">
                Create Route
              </button>
            </div>
          </div>
        </div>
      )}
    </FleetpointLayout>
  )
}
