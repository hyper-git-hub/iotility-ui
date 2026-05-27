// src/pages/fleetpoint/fleet/POIPage.tsx
// Point of Interest management — location POIs, customer sites, exclusion zones
//
// DEVELOPER NOTES:
// ─────────────────────────────────────────────────────────────────────────────
// POI = Any named point of interest in the IoTility ecosystem
// A POI can optionally link to a Geozone (geozoneId FK in DB)
// A POI can optionally link to a Route (routeId FK — future sprint)
//
// Entry/exit events come via WebSocket — server does radius check on GPS ping
// WS /api/fleetpoint/live-positions emits:
//   { type: 'poi-entry' | 'poi-exit', poiId, vehicleId, driverName, timestamp }
// Frontend just receives events — NO geofence math on client side
//
// API endpoints:
// GET    /api/fleetpoint/poi                  — all POIs (paginated)
// GET    /api/fleetpoint/poi/:id              — single POI detail
// GET    /api/fleetpoint/poi/:id/visits       — visit history
// GET    /api/fleetpoint/poi/:id/analytics    — dwell, SLA, compliance stats
// POST   /api/fleetpoint/poi                  — create POI
// PATCH  /api/fleetpoint/poi/:id              — update POI
// DELETE /api/fleetpoint/poi/:id              — delete POI
//
// Future sprints:
// - Driver/Vehicle watchlist POI types
// - Route POIs (link to Jobs module)
// - POI analytics dashboard
// - POI-to-POI relationships (route = series of POIs)
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import { MapContainer, TileLayer, Circle, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import {
  Search, Plus, Filter, Download, AlertTriangle,
  MapPin, Clock, Users, CheckCircle, X,
  Building2, Fuel, Coffee, Shield, AlertOctagon,
  Zap, ChevronRight, Eye, Edit, Trash2
} from 'lucide-react'
import FleetpointLayout from '../../../layouts/FleetpointLayout'
import { enhancedPOIs } from '../../../data/fleetData'
import { useTheme } from '../../../hooks/useTheme'
import type { EnhancedPOI, POIType } from '../../../data/fleetData'

// ─── POI type config — add new types here as platform expands ─────────────────
const POI_TYPE_CONFIG: Record<POIType, {
  label: string
  icon: any
  color: string
  bg: string
  border: string
  mapColor: string
}> = {
  depot:      { label: 'Depot',          icon: Building2,    color: 'text-purple-700', bg: 'bg-purple-50',  border: 'border-purple-200', mapColor: '#7c3aed' },
  customer:   { label: 'Customer Site',  icon: Users,        color: 'text-blue-700',   bg: 'bg-blue-50',    border: 'border-blue-200',   mapColor: '#2563eb' },
  fuel:       { label: 'Fuel Station',   icon: Fuel,         color: 'text-amber-700',  bg: 'bg-amber-50',   border: 'border-amber-200',  mapColor: '#d97706' },
  rest:       { label: 'Rest Stop',      icon: Coffee,       color: 'text-green-700',  bg: 'bg-green-50',   border: 'border-green-200',  mapColor: '#16a34a' },
  exclusion:  { label: 'Exclusion Zone', icon: Shield,       color: 'text-red-700',    bg: 'bg-red-50',     border: 'border-red-200',    mapColor: '#dc2626' },
  unsafe:     { label: 'Unsafe Area',    icon: AlertOctagon, color: 'text-orange-700', bg: 'bg-orange-50',  border: 'border-orange-200', mapColor: '#ea580c' },
  competitor: { label: 'Competitor',     icon: Zap,          color: 'text-rose-700',   bg: 'bg-rose-50',    border: 'border-rose-200',   mapColor: '#e11d48' },
  route:      { label: 'Route',          icon: MapPin,       color: 'text-teal-700',   bg: 'bg-teal-50',    border: 'border-teal-200',   mapColor: '#0d9488' },
  custom:     { label: 'Custom',         icon: MapPin,       color: 'text-gray-700',   bg: 'bg-gray-100',   border: 'border-gray-200',   mapColor: '#6b7280' },
}

const ASSIGNED_LABEL = (poi: EnhancedPOI) => {
  if (poi.assignedTo === 'all') return 'All vehicles'
  if (poi.assignedTo === 'fleet') return `${poi.assignedIds.length} fleet(s)`
  if (poi.assignedTo === 'vehicle') return `${poi.assignedIds.length} vehicle(s)`
  return '—'
}

export default function POIPage() {
  const { isDark } = useTheme()
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<'all' | POIType>('all')
  const [selectedPOI, setSelectedPOI] = useState<EnhancedPOI | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [addStep, setAddStep] = useState(1)

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const total = enhancedPOIs.length
  const withAlerts = enhancedPOIs.filter(p => p.activeAlerts > 0).length
  const visitsToday = enhancedPOIs.reduce((a, p) => a + p.visitsToday, 0)
  const slaBreaches = enhancedPOIs.filter(p => p.slaComplianceRate < 100 && p.slaMinutes).length
  const exclusionViolations = enhancedPOIs.filter(p => p.type === 'exclusion' && p.activeAlerts > 0).length

  // ── Filtered ──────────────────────────────────────────────────────────────
  const filtered = enhancedPOIs.filter(p => {
    const s = search.toLowerCase()
    const matchSearch = !search ||
      p.name.toLowerCase().includes(s) ||
      p.address.toLowerCase().includes(s) ||
      p.notes.toLowerCase().includes(s)
    const matchType = filterType === 'all' || p.type === filterType
    return matchSearch && matchType
  })

  return (
    <FleetpointLayout>
      <div className={`p-6 min-h-full ${isDark ? 'bg-gray-950' : 'bg-gray-50'}`}>

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Points of Interest
            </h1>
            <p className={`text-sm mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              {total} POIs · {visitsToday} visits today · {withAlerts} active alerts
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button className={`flex items-center gap-2 text-sm px-3 py-2 rounded-xl border transition-colors
              ${isDark ? 'border-gray-700 text-gray-300 hover:bg-gray-800' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              <Download size={15} /> Export
            </button>
            <button
              onClick={() => { setShowAddModal(true); setAddStep(1) }}
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
              <Plus size={15} /> Add POI
            </button>
          </div>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-5 gap-3 mb-5">
          {[
            { label: 'Total POIs', value: total, icon: MapPin, color: 'text-purple-600', bg: 'bg-purple-50' },
            { label: 'Visits Today', value: visitsToday, icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Active Alerts', value: withAlerts, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
            { label: 'SLA Breaches', value: slaBreaches, icon: AlertOctagon, color: 'text-amber-600', bg: 'bg-amber-50' },
            { label: 'Exclusion Violations', value: exclusionViolations, icon: Shield, color: 'text-orange-600', bg: 'bg-orange-50' },
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

        {/* Type filter tabs */}
        <div className={`flex items-center gap-1 mb-4 overflow-x-auto pb-1`}>
          {(['all', ...Object.keys(POI_TYPE_CONFIG)] as ('all' | POIType)[]).map(type => {
            const cfg = type === 'all' ? null : POI_TYPE_CONFIG[type]
            const count = type === 'all' ? total : enhancedPOIs.filter(p => p.type === type).length
            if (count === 0 && type !== 'all') return null
            return (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-all
                  ${filterType === type
                    ? 'bg-purple-600 text-white border-purple-600'
                    : `${isDark ? 'border-gray-700 text-gray-300 hover:bg-gray-800' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`
                  }`}
              >
                {cfg && <cfg.icon size={11} />}
                {type === 'all' ? 'All POIs' : cfg?.label}
                <span className={`font-bold ${filterType === type ? 'text-white' : 'text-gray-400'}`}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Search */}
        <div className={`flex items-center gap-2 border rounded-xl px-3 py-2 mb-4
          ${isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'}`}>
          <Search size={14} className="text-gray-400 shrink-0" />
          <input
            type="text"
            placeholder="Search POI name, address, notes..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className={`flex-1 text-sm outline-none bg-transparent
              ${isDark ? 'text-white placeholder-gray-500' : 'text-gray-900 placeholder-gray-400'}`}
          />
          {search && <button onClick={() => setSearch('')}><X size={12} className="text-gray-400" /></button>}
        </div>

        {/* Main content — map + list */}
        <div className="grid grid-cols-5 gap-4">

          {/* MAP — 2 cols */}
          <div className={`col-span-2 rounded-2xl border overflow-hidden ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}
            style={{ height: '520px' }}>
            <div className={`px-4 py-3 border-b flex items-center gap-2 ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
              <MapPin size={14} className="text-purple-600" />
              <span className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>POI Map</span>
              <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>· {filtered.length} shown</span>
            </div>

            {/* Type legend */}
            <div className={`px-3 py-2 border-b flex flex-wrap gap-2 ${isDark ? 'border-gray-700' : 'border-gray-100'}`}>
              {Object.entries(POI_TYPE_CONFIG)
                .filter(([type]) => enhancedPOIs.some(p => p.type === type))
                .map(([type, cfg]) => (
                  <div key={type} className="flex items-center gap-1">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: cfg.mapColor }}></div>
                    <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{cfg.label}</span>
                  </div>
                ))}
            </div>

            <div style={{ height: 'calc(520px - 88px)' }}>
              <MapContainer
                center={[52.5, -1.5]}
                zoom={6}
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {filtered.map(poi => {
                  const cfg = POI_TYPE_CONFIG[poi.type]
                  return (
                    <Circle
                      key={poi.id}
                      center={[poi.lat, poi.lng]}
                      radius={poi.radius}
                      pathOptions={{
                        color: cfg.mapColor,
                        fillColor: cfg.mapColor,
                        fillOpacity: selectedPOI?.id === poi.id ? 0.35 : 0.15,
                        weight: selectedPOI?.id === poi.id ? 3 : 1.5,
                      }}
                      eventHandlers={{ click: () => setSelectedPOI(poi) }}
                    >
                      <Popup>
                        <div style={{ fontSize: 12, minWidth: 160 }}>
                          <p style={{ fontWeight: 700, marginBottom: 4 }}>{poi.name}</p>
                          <p style={{ color: '#6b7280', marginBottom: 4 }}>{poi.address}</p>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <span>{cfg.label}</span>
                            <span>· {poi.visitsToday} visits today</span>
                          </div>
                          {poi.activeAlerts > 0 && (
                            <p style={{ color: '#dc2626', marginTop: 4 }}>⚠️ {poi.activeAlerts} active alert(s)</p>
                          )}
                        </div>
                      </Popup>
                    </Circle>
                  )
                })}
              </MapContainer>
            </div>
          </div>

          {/* POI LIST — 3 cols */}
          <div className="col-span-3 flex flex-col gap-3 overflow-y-auto" style={{ maxHeight: '520px' }}>
            {filtered.map(poi => {
              const cfg = POI_TYPE_CONFIG[poi.type]
              const isSelected = selectedPOI?.id === poi.id
              return (
                <div
                  key={poi.id}
                  onClick={() => setSelectedPOI(isSelected ? null : poi)}
                  className={`rounded-2xl border cursor-pointer transition-all
                    ${isSelected
                      ? 'border-purple-500 ring-2 ring-purple-500/20'
                      : `${isDark ? 'border-gray-700 hover:border-gray-600' : 'border-gray-200 hover:border-gray-300'}`
                    }
                    ${isDark ? 'bg-gray-800' : 'bg-white'}
                    ${poi.activeAlerts > 0 ? 'border-l-4 border-l-red-500' : ''}`}
                >
                  {/* POI header */}
                  <div className="flex items-start gap-3 p-4">
                    <div className={`w-9 h-9 rounded-xl ${cfg.bg} flex items-center justify-center shrink-0`}>
                      <cfg.icon size={16} className={cfg.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className={`font-bold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>{poi.name}</p>
                          <p className={`text-xs mt-0.5 truncate ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{poi.address}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {poi.activeAlerts > 0 && (
                            <span className="flex items-center gap-1 text-xs bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded-full font-medium">
                              <AlertTriangle size={10} /> {poi.activeAlerts}
                            </span>
                          )}
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${cfg.color} ${cfg.bg} ${cfg.border}`}>
                            {cfg.label}
                          </span>
                        </div>
                      </div>

                      {/* Stats row */}
                      <div className="flex items-center gap-4 mt-2 flex-wrap">
                        <div className="flex items-center gap-1">
                          <Clock size={11} className="text-gray-400" />
                          <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            {poi.visitsToday} visits today
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Users size={11} className="text-gray-400" />
                          <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            {ASSIGNED_LABEL(poi)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <MapPin size={11} className="text-gray-400" />
                          <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            {poi.radius}m radius
                          </span>
                        </div>
                        {poi.geozoneId && (
                          <div className="flex items-center gap-1">
                            <Shield size={11} className="text-purple-500" />
                            <span className="text-xs text-purple-600">Geozone linked</span>
                          </div>
                        )}
                        {poi.slaMinutes && (
                          <div className="flex items-center gap-1">
                            {poi.slaComplianceRate >= 95
                              ? <CheckCircle size={11} className="text-green-500" />
                              : <AlertTriangle size={11} className="text-amber-500" />
                            }
                            <span className={`text-xs ${poi.slaComplianceRate >= 95 ? 'text-green-600' : 'text-amber-600'}`}>
                              SLA {poi.slaComplianceRate}%
                            </span>
                          </div>
                        )}
                        {poi.dwellTimeLimit && (
                          <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            Max dwell {poi.dwellTimeLimit}min
                          </span>
                        )}
                        {poi.curfewStart && (
                          <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            Curfew {poi.curfewStart}–{poi.curfewEnd}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expanded — recent visits + actions */}
                  {isSelected && (
                    <div className={`border-t px-4 py-3 ${isDark ? 'border-gray-700' : 'border-gray-100'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <p className={`text-xs font-semibold uppercase tracking-wide ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          Recent Visits
                        </p>
                        <div className="flex items-center gap-2">
                          <button className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
                            <Eye size={13} />
                          </button>
                          <button className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
                            <Edit size={13} />
                          </button>
                          <button className="p-1.5 rounded-lg hover:bg-red-50 text-red-500">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      {poi.recentVisits.length > 0 ? (
                        <div className="flex flex-col gap-1.5">
                          {poi.recentVisits.map((visit, i) => (
                            <div key={i} className={`flex items-center gap-3 px-3 py-2 rounded-xl
                              ${visit.slaBreach
                                ? 'bg-red-50 dark:bg-red-900/20'
                                : `${isDark ? 'bg-gray-700' : 'bg-gray-50'}`
                              }`}>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className={`text-xs font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                    {visit.vehiclePlate}
                                  </span>
                                  <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                    {visit.driverName}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3 mt-0.5">
                                  <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                    {visit.entryTime} → {visit.exitTime}
                                  </span>
                                  <span className={`text-xs font-medium ${visit.slaBreach ? 'text-red-600' : 'text-green-600'}`}>
                                    {visit.dwellMinutes}min
                                    {visit.slaBreach && ' ⚠️ SLA breach'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                          No visits recorded today
                        </p>
                      )}

                      <div className="flex items-center gap-4 mt-3 pt-3 border-t"
                        style={{ borderColor: isDark ? '#374151' : '#f3f4f6' }}>
                        <div className="text-center">
                          <p className={`text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{poi.visitsThisWeek}</p>
                          <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>This week</p>
                        </div>
                        <div className="text-center">
                          <p className={`text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{poi.avgDwellMinutes}min</p>
                          <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Avg dwell</p>
                        </div>
                        {poi.slaMinutes && (
                          <div className="text-center">
                            <p className={`text-sm font-bold ${poi.slaComplianceRate >= 95 ? 'text-green-600' : 'text-amber-600'}`}>
                              {poi.slaComplianceRate}%
                            </p>
                            <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>SLA rate</p>
                          </div>
                        )}
                        {poi.contactName && (
                          <div className="ml-auto text-right">
                            <p className={`text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{poi.contactName}</p>
                            <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{poi.contactPhone}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Add POI Modal — multi step */}
      {showAddModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-md">
          <div className={`rounded-3xl shadow-2xl w-full max-w-lg mx-4 ${isDark ? 'bg-gray-900' : 'bg-white'}`}>

            {/* Modal header */}
            <div className={`flex items-center justify-between px-6 py-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
              <div>
                <h2 className={`font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Add Point of Interest</h2>
                <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Step {addStep} of 4</p>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            {/* Progress */}
            <div className="flex gap-1 px-6 pt-4">
              {[1, 2, 3, 4].map(step => (
                <div key={step} className={`flex-1 h-1.5 rounded-full transition-all
                  ${step <= addStep ? 'bg-purple-600' : `${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}`} />
              ))}
            </div>

            <div className="p-6">
              {/* Step 1 — POI Type */}
              {addStep === 1 && (
                <div>
                  <h3 className={`font-semibold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>Choose POI Type</h3>
                  <p className={`text-xs mb-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    What kind of point of interest is this?
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {Object.entries(POI_TYPE_CONFIG).map(([type, cfg]) => (
                      <button key={type}
                        onClick={() => setAddStep(2)}
                        className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all hover:border-purple-400
                          ${isDark ? 'border-gray-700 hover:bg-gray-800' : 'border-gray-200 hover:bg-gray-50'}`}>
                        <div className={`w-8 h-8 rounded-lg ${cfg.bg} flex items-center justify-center`}>
                          <cfg.icon size={16} className={cfg.color} />
                        </div>
                        <span className={`text-xs font-medium text-center ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                          {cfg.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 2 — Details */}
              {addStep === 2 && (
                <div className="flex flex-col gap-3">
                  <h3 className={`font-semibold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>POI Details</h3>
                  {[
                    { label: 'POI Name', placeholder: 'e.g. Amazon BHX2 Fulfilment' },
                    { label: 'Address', placeholder: 'Full address or postcode' },
                    { label: 'Radius (meters)', placeholder: 'e.g. 200' },
                  ].map(field => (
                    <div key={field.label}>
                      <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        {field.label}
                      </label>
                      <input placeholder={field.placeholder}
                        className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-purple-500
                          ${isDark ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'}`} />
                    </div>
                  ))}
                  {/* DEVELOPER NOTE: lat/lng should be captured from map click */}
                  {/* TODO: integrate map picker — on click capture lat/lng coordinates */}
                  <div className={`rounded-xl border-2 border-dashed p-3 text-center ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                    <MapPin size={16} className="text-gray-400 mx-auto mb-1" />
                    <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      TODO: click on map to set location
                    </p>
                  </div>
                </div>
              )}

              {/* Step 3 — Assignment + Rules */}
              {addStep === 3 && (
                <div className="flex flex-col gap-3">
                  <h3 className={`font-semibold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>Assignment & Alert Rules</h3>
                  <div>
                    <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Assign to
                    </label>
                    <select className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none
                      ${isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-700'}`}>
                      <option>All vehicles</option>
                      <option>Specific fleet</option>
                      <option>Specific vehicle</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Alert on Entry', key: 'entry' },
                      { label: 'Alert on Exit', key: 'exit' },
                    ].map(rule => (
                      <label key={rule.key} className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer
                        ${isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'}`}>
                        <input type="checkbox" className="rounded" />
                        <span className={`text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{rule.label}</span>
                      </label>
                    ))}
                  </div>
                  <div>
                    <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Max dwell time (minutes) — leave blank for no limit
                    </label>
                    <input type="number" placeholder="e.g. 120"
                      className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none
                        ${isDark ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'}`} />
                  </div>
                  <div>
                    <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Link to Geozone (optional)
                    </label>
                    {/* DEVELOPER NOTE: fetch geozones from GET /api/fleetpoint/geozones */}
                    <select className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none
                      ${isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-700'}`}>
                      <option value="">No geozone</option>
                      <option>London Low Emission Zone</option>
                      <option>Birmingham Depot Zone B</option>
                      <option>Manchester Night Curfew</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Step 4 — Confirm */}
              {addStep === 4 && (
                <div className="text-center py-4">
                  <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <CheckCircle size={28} className="text-green-500" />
                  </div>
                  <h3 className={`font-bold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>Ready to create</h3>
                  <p className={`text-sm mb-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    Your POI will be active immediately after creation.
                  </p>
                  {/* DEVELOPER NOTE: POST /api/fleetpoint/poi with all form data */}
                  {/* Response: { id, name, type, lat, lng, ... } */}
                  {/* On success: add to local state, close modal, show toast */}
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div className={`flex items-center justify-between px-6 py-4 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
              <button
                onClick={() => addStep > 1 ? setAddStep(addStep - 1) : setShowAddModal(false)}
                className={`text-sm px-4 py-2 rounded-xl border transition-colors
                  ${isDark ? 'border-gray-700 text-gray-300' : 'border-gray-200 text-gray-600'}`}>
                {addStep === 1 ? 'Cancel' : 'Back'}
              </button>
              <button
                onClick={() => addStep < 4 ? setAddStep(addStep + 1) : setShowAddModal(false)}
                className="text-sm px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold transition-colors flex items-center gap-1.5">
                {addStep === 4 ? 'Create POI' : 'Next'} <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </FleetpointLayout>
  )
}
