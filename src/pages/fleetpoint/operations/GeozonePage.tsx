// src/pages/fleetpoint/operations/GeozonePage.tsx
// Geozones — Zone Map, Zone List, Analytics
//
// DEVELOPER NOTES:
// ─────────────────────────────────────────────────────────────────────────────
// DRAWING ZONES ON MAP:
// TODO: Install Leaflet.draw for interactive zone drawing
//       npm install leaflet-draw @types/leaflet-draw
//       On shape complete → extract GeoJSON coordinates
//       POST to /api/fleetpoint/geozones with coordinates + rules
//
// GEOFENCE CHECKING (backend):
// PostGIS ST_Within() checks every GPS ping against active geozones
// On state change → WebSocket event to frontend
// TODO: CREATE EXTENSION postgis; on PostgreSQL
//
// POI INTEGRATION:
// When type='poi' → entry triggers job start + SLA timer
// Exit triggers dwell time calculation + SLA compliance check
// Backend handles this — frontend just receives events
//
// CORRIDOR ZONES:
// routeId FK links corridor zone to a route definition
// Tolerance = radius in meters around route path
// Deviation check runs in telematics processing pipeline
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import { MapContainer, TileLayer, Circle, Polygon, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import {
  Search, Plus, Filter, Download, X,
  Shield, Zap, Clock, MapPin, Eye,
  Edit, Trash2, CheckCircle, AlertTriangle,
  Navigation, Users, ToggleRight, ChevronDown,
  ChevronUp, Activity
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell
} from 'recharts'
import FleetpointLayout from '../../../layouts/FleetpointLayout'
import { geozones } from '../../../data/fleetData'
import { useTheme } from '../../../hooks/useTheme'
import type { Geozone, GeozoneType } from '../../../data/fleetData'

// ─── Config ───────────────────────────────────────────────────────────────────
const TYPE_CONFIG: Record<GeozoneType, {
  label: string; color: string; bg: string; border: string
  mapColor: string; icon: any; description: string
}> = {
  allowed:    { label: 'Allowed Zone',    color: 'text-green-700',  bg: 'bg-green-50',   border: 'border-green-200',  mapColor: '#22c55e', icon: CheckCircle, description: 'Vehicles must stay within' },
  restricted: { label: 'Restricted Zone', color: 'text-red-700',    bg: 'bg-red-50',     border: 'border-red-200',    mapColor: '#dc2626', icon: Shield,      description: 'No entry — violation on entry' },
  speed:      { label: 'Speed Zone',      color: 'text-amber-700',  bg: 'bg-amber-50',   border: 'border-amber-200',  mapColor: '#f59e0b', icon: Zap,         description: 'Custom speed limit inside' },
  curfew:     { label: 'Curfew Zone',     color: 'text-purple-700', bg: 'bg-purple-50',  border: 'border-purple-200', mapColor: '#7c3aed', icon: Clock,       description: 'Rules active during set hours' },
  poi:        { label: 'POI Zone',        color: 'text-blue-700',   bg: 'bg-blue-50',    border: 'border-blue-200',   mapColor: '#2563eb', icon: MapPin,      description: 'POI boundary — auto job tracking' },
  corridor:   { label: 'Corridor',        color: 'text-teal-700',   bg: 'bg-teal-50',    border: 'border-teal-200',   mapColor: '#0d9488', icon: Navigation,  description: 'Route tube — deviation alerts' },
  custom:     { label: 'Custom Zone',     color: 'text-gray-700',   bg: 'bg-gray-100',   border: 'border-gray-200',   mapColor: '#6b7280', icon: Activity,    description: 'Custom rules' },
}

type TabId = 'map' | 'list' | 'analytics'

export default function GeozonePage() {
  const { isDark } = useTheme()
  const [activeTab, setActiveTab] = useState<TabId>('map')
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<'all' | GeozoneType>('all')
  const [selectedZone, setSelectedZone] = useState<Geozone | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createStep, setCreateStep] = useState(1)
  const [selectedType, setSelectedType] = useState<GeozoneType>('allowed')
  const [expandedZone, setExpandedZone] = useState<string | null>(null)

  // ── KPIs ────────────────────────────────────────────────────────────────────
  const total = geozones.length
  const active = geozones.filter(z => z.active).length
  const activeVehicles = geozones.reduce((a, z) => a + z.activeVehicles, 0)
  const violations = geozones.reduce((a, z) => a + z.violationsTotal, 0)
  const restricted = geozones.filter(z => z.type === 'restricted').length

  // ── Filtered ────────────────────────────────────────────────────────────────
  const filtered = geozones.filter(z => {
    const s = search.toLowerCase()
    const matchSearch = !search ||
      z.name.toLowerCase().includes(s) ||
      z.description.toLowerCase().includes(s)
    const matchType = filterType === 'all' || z.type === filterType
    return matchSearch && matchType
  })

  // ── Analytics data ────────────────────────────────────────────────────────
  const visitData = geozones
    .filter(z => z.visitsToday > 0)
    .sort((a, b) => b.visitsToday - a.visitsToday)
    .map(z => ({
      name: z.name.split('—')[0].trim().split(' ').slice(0, 2).join(' '),
      visits: z.visitsToday,
      color: TYPE_CONFIG[z.type].mapColor,
    }))

  const violationData = geozones
    .filter(z => z.violationsTotal > 0)
    .map(z => ({
      name: z.name.split('—')[0].trim().split(' ').slice(0, 2).join(' '),
      violations: z.violationsTotal,
    }))

  const tabs: { id: TabId; label: string; emoji: string }[] = [
    { id: 'map',       label: 'Zone Map',   emoji: '🗺️' },
    { id: 'list',      label: 'Zone List',  emoji: '📋' },
    { id: 'analytics', label: 'Analytics',  emoji: '📊' },
  ]

  return (
    <FleetpointLayout>
      <div className={`p-6 min-h-full ${isDark ? 'bg-gray-950' : 'bg-gray-50'}`}>

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Geozones</h1>
            <p className={`text-sm mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              {total} zones · {active} active · {activeVehicles} vehicles inside now · {violations} violations
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button className={`flex items-center gap-2 text-sm px-3 py-2 rounded-xl border transition-colors
              ${isDark ? 'border-gray-700 text-gray-300 hover:bg-gray-800' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              <Download size={15} /> Export
            </button>
            <button onClick={() => { setShowCreateModal(true); setCreateStep(1) }}
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
              <Plus size={15} /> New Zone
            </button>
          </div>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-5 gap-3 mb-5">
          {[
            { label: 'Total Zones', value: total, color: 'text-purple-600', bg: 'bg-purple-50', icon: MapPin },
            { label: 'Active', value: active, color: 'text-green-600', bg: 'bg-green-50', icon: CheckCircle },
            { label: 'Restricted', value: restricted, color: 'text-red-600', bg: 'bg-red-50', icon: Shield },
            { label: 'Vehicles Inside', value: activeVehicles, color: 'text-blue-600', bg: 'bg-blue-50', icon: Users },
            { label: 'Total Violations', value: violations, color: 'text-orange-600', bg: 'bg-orange-50', icon: AlertTriangle },
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
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 -mb-px transition-all
                ${activeTab === tab.id
                  ? 'border-purple-600 text-purple-600'
                  : `border-transparent ${isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'}`}`}>
              <span>{tab.emoji}</span>{tab.label}
            </button>
          ))}
        </div>

        {/* ── ZONE MAP TAB ──────────────────────────────────────────────────── */}
        {activeTab === 'map' && (
          <div className="flex gap-4">

            {/* Left — zone list panel */}
            <div className={`w-64 shrink-0 rounded-2xl border overflow-hidden flex flex-col
              ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}
              style={{ maxHeight: '600px' }}>

              {/* Search */}
              <div className={`p-3 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                <div className={`flex items-center gap-2 border rounded-xl px-3 py-2
                  ${isDark ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-gray-50'}`}>
                  <Search size={12} className="text-gray-400 shrink-0" />
                  <input type="text" placeholder="Search zones..."
                    value={search} onChange={e => setSearch(e.target.value)}
                    className={`flex-1 text-xs outline-none bg-transparent
                      ${isDark ? 'text-white placeholder-gray-500' : 'text-gray-900 placeholder-gray-400'}`} />
                </div>
              </div>

              {/* Type filter tabs */}
              <div className={`p-2 border-b flex flex-wrap gap-1 ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                <button onClick={() => setFilterType('all')}
                  className={`text-xs px-2 py-1 rounded-lg font-medium transition-colors
                    ${filterType === 'all' ? 'bg-purple-600 text-white' : `${isDark ? 'text-gray-400 hover:bg-gray-700' : 'text-gray-500 hover:bg-gray-100'}`}`}>
                  All
                </button>
                {Object.entries(TYPE_CONFIG).map(([type, cfg]) => {
                  const count = geozones.filter(z => z.type === type).length
                  if (count === 0) return null
                  return (
                    <button key={type} onClick={() => setFilterType(type as GeozoneType)}
                      className={`text-xs px-2 py-1 rounded-lg font-medium transition-colors
                        ${filterType === type ? 'bg-purple-600 text-white' : `${isDark ? 'text-gray-400 hover:bg-gray-700' : 'text-gray-500 hover:bg-gray-100'}`}`}>
                      {cfg.label.split(' ')[0]}
                    </button>
                  )
                })}
              </div>

              {/* Zone list */}
              <div className="flex-1 overflow-y-auto">
                {filtered.map(zone => {
                  const cfg = TYPE_CONFIG[zone.type]
                  const isSelected = selectedZone?.id === zone.id
                  return (
                    <button key={zone.id}
                      onClick={() => setSelectedZone(isSelected ? null : zone)}
                      className={`w-full px-3 py-3 text-left border-b transition-colors
                        ${isDark ? 'border-gray-700' : 'border-gray-50'}
                        ${isSelected ? 'bg-purple-600' : `${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}`}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`w-2.5 h-2.5 rounded-full shrink-0`}
                          style={{ background: cfg.mapColor }}></div>
                        <span className={`text-xs font-semibold truncate
                          ${isSelected ? 'text-white' : isDark ? 'text-white' : 'text-gray-900'}`}>
                          {zone.name.split('—')[0].trim()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className={`text-xs ${isSelected ? 'text-purple-200' : cfg.color} ${isSelected ? '' : cfg.bg} px-1.5 py-0.5 rounded font-medium`}>
                          {cfg.label}
                        </span>
                        <div className="flex items-center gap-2">
                          {zone.activeVehicles > 0 && (
                            <span className={`text-xs font-bold ${isSelected ? 'text-green-300' : 'text-green-600'}`}>
                              {zone.activeVehicles} inside
                            </span>
                          )}
                          {zone.violationsTotal > 0 && (
                            <span className={`text-xs font-bold ${isSelected ? 'text-red-300' : 'text-red-600'}`}>
                              {zone.violationsTotal} ⚠️
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Center — Map */}
            <div className={`flex-1 rounded-2xl border overflow-hidden ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}
              style={{ height: '600px' }}>

              {/* Map header */}
              <div className={`flex items-center justify-between px-4 py-3 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(TYPE_CONFIG).map(([type, cfg]) => (
                    <div key={type} className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-sm" style={{ background: cfg.mapColor, opacity: 0.7 }}></div>
                      <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{cfg.label}</span>
                    </div>
                  ))}
                </div>
                {/* DEVELOPER NOTE:
                    TODO: Add Leaflet.draw toolbar here
                    npm install leaflet-draw @types/leaflet-draw
                    Draw tools: polygon, circle, rectangle
                    On shape drawn → extract coordinates → open create modal
                */}
                <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  🖊️ Draw tool coming in Sprint 2
                </span>
              </div>

              <div style={{ height: 'calc(600px - 49px)' }}>
                <MapContainer center={[52.2, -1.2]} zoom={7}
                  style={{ height: '100%', width: '100%' }}>
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  {filtered.map(zone => {
                    const cfg = TYPE_CONFIG[zone.type]
                    const isSelected = selectedZone?.id === zone.id
                    const fillOpacity = isSelected ? 0.4 : 0.15
                    const weight = isSelected ? 3 : 1.5

                    const popupContent = (
                      <div style={{ fontSize: 11, minWidth: 180 }}>
                        <p style={{ fontWeight: 700, marginBottom: 4 }}>{zone.name}</p>
                        <p style={{ color: cfg.mapColor, fontWeight: 600, marginBottom: 4 }}>{cfg.label}</p>
                        <p style={{ color: '#6b7280', marginBottom: 2 }}>{zone.description}</p>
                        <hr style={{ margin: '6px 0' }} />
                        <p>📊 Visits today: <strong>{zone.visitsToday}</strong></p>
                        <p>🚛 Inside now: <strong>{zone.activeVehicles}</strong></p>
                        {zone.violationsTotal > 0 && (
                          <p style={{ color: '#dc2626' }}>⚠️ Violations: <strong>{zone.violationsTotal}</strong></p>
                        )}
                        {zone.speedLimitKph && (
                          <p>🚦 Speed limit: <strong>{zone.speedLimitKph} km/h</strong></p>
                        )}
                        {zone.curfewStart && (
                          <p>🕐 Curfew: <strong>{zone.curfewStart}–{zone.curfewEnd}</strong></p>
                        )}
                        {zone.maxDwellMinutes && (
                          <p>⏱️ Max dwell: <strong>{zone.maxDwellMinutes} min</strong></p>
                        )}
                        {zone.poiId && (
                          <p style={{ color: '#2563eb' }}>📍 Linked to POI</p>
                        )}
                        {zone.routeId && (
                          <p style={{ color: '#0d9488' }}>🗺️ Linked to Route</p>
                        )}
                      </div>
                    )

                    if (zone.shapeType === 'polygon' && zone.polygon) {
                      const positions = zone.polygon.map(([lat, lng]) => [lat, lng] as [number, number])
                      return (
                        <Polygon key={zone.id}
                          positions={positions}
                          pathOptions={{ color: cfg.mapColor, fillColor: cfg.mapColor, fillOpacity, weight }}
                          eventHandlers={{ click: () => setSelectedZone(zone) }}>
                          <Popup>{popupContent}</Popup>
                        </Polygon>
                      )
                    }

                    return (
                      <Circle key={zone.id}
                        center={[zone.center.lat, zone.center.lng]}
                        radius={zone.radius || 300}
                        pathOptions={{ color: cfg.mapColor, fillColor: cfg.mapColor, fillOpacity, weight }}
                        eventHandlers={{ click: () => setSelectedZone(zone) }}>
                        <Popup>{popupContent}</Popup>
                      </Circle>
                    )
                  })}
                </MapContainer>
              </div>
            </div>

            {/* Right — zone detail panel */}
            {selectedZone && (
              <div className={`w-64 shrink-0 rounded-2xl border overflow-hidden flex flex-col
                ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}
                style={{ maxHeight: '600px' }}>
                <div className={`flex items-center justify-between px-4 py-3 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                  <h3 className={`font-bold text-xs ${isDark ? 'text-white' : 'text-gray-900'}`}>Zone Details</h3>
                  <button onClick={() => setSelectedZone(null)} className="text-gray-400 hover:text-gray-600">
                    <X size={14} />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                  {(() => {
                    const cfg = TYPE_CONFIG[selectedZone.type]
                    return (
                      <>
                        <div>
                          <p className={`font-bold text-sm mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {selectedZone.name}
                          </p>
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium
                            ${cfg.color} ${cfg.bg} ${cfg.border}`}>
                            {cfg.label}
                          </span>
                        </div>

                        <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          {selectedZone.description}
                        </p>

                        {/* Rules */}
                        <div className={`rounded-xl p-3 ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
                          <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            Rules
                          </p>
                          <div className="flex flex-col gap-1.5">
                            {[
                              { label: 'Alert on Entry', value: selectedZone.alertOnEntry },
                              { label: 'Alert on Exit', value: selectedZone.alertOnExit },
                            ].map(rule => (
                              <div key={rule.label} className="flex items-center justify-between">
                                <span className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{rule.label}</span>
                                <span className={`text-xs font-medium ${rule.value ? 'text-green-600' : 'text-gray-400'}`}>
                                  {rule.value ? '✓ Yes' : '✗ No'}
                                </span>
                              </div>
                            ))}
                            {selectedZone.speedLimitKph && (
                              <div className="flex items-center justify-between">
                                <span className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Speed Limit</span>
                                <span className="text-xs font-bold text-amber-600">{selectedZone.speedLimitKph} km/h</span>
                              </div>
                            )}
                            {selectedZone.maxDwellMinutes && (
                              <div className="flex items-center justify-between">
                                <span className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Max Dwell</span>
                                <span className="text-xs font-medium text-blue-600">{selectedZone.maxDwellMinutes} min</span>
                              </div>
                            )}
                            {selectedZone.curfewStart && (
                              <div className="flex items-center justify-between">
                                <span className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Curfew</span>
                                <span className="text-xs font-medium text-purple-600">
                                  {selectedZone.curfewStart}–{selectedZone.curfewEnd}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Stats */}
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { label: 'Today', value: selectedZone.visitsToday },
                            { label: 'This Week', value: selectedZone.visitsThisWeek },
                            { label: 'Avg Dwell', value: `${selectedZone.avgDwellMinutes}m` },
                            { label: 'Violations', value: selectedZone.violationsTotal },
                          ].map(stat => (
                            <div key={stat.label} className={`rounded-xl p-2 text-center ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
                              <p className={`text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{stat.value}</p>
                              <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{stat.label}</p>
                            </div>
                          ))}
                        </div>

                        {/* Links */}
                        {(selectedZone.poiId || selectedZone.routeId) && (
                          <div className={`rounded-xl p-3 ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
                            <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                              Linked To
                            </p>
                            {selectedZone.poiId && (
                              <p className="text-xs text-blue-600 font-medium">📍 POI: {selectedZone.poiId}</p>
                            )}
                            {selectedZone.routeId && (
                              <p className="text-xs text-teal-600 font-medium">🗺️ Route: {selectedZone.routeId}</p>
                            )}
                          </div>
                        )}

                        {/* Recent events */}
                        {selectedZone.recentEvents.length > 0 && (
                          <div>
                            <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                              Recent Activity
                            </p>
                            <div className="flex flex-col gap-1.5">
                              {selectedZone.recentEvents.map((event, i) => (
                                <div key={i} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg
                                  ${event.eventType === 'entry'
                                    ? (isDark ? 'bg-green-900/20' : 'bg-green-50')
                                    : (isDark ? 'bg-blue-900/20' : 'bg-blue-50')}`}>
                                  <span className="text-xs">
                                    {event.eventType === 'entry' ? '→' : '←'}
                                  </span>
                                  <div className="flex-1 min-w-0">
                                    <p className={`text-xs font-medium truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                      {event.vehiclePlate}
                                    </p>
                                    <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                      {event.driverName.split(' ')[0]} ·
                                      {event.dwellMinutes > 0 ? ` ${event.dwellMinutes}min` : ''}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-2 pt-1">
                          <button className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-xs font-medium border transition-colors
                            ${isDark ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                            <Edit size={11} /> Edit
                          </button>
                          <button className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-xs font-medium bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-colors">
                            <Trash2 size={11} /> Delete
                          </button>
                        </div>
                      </>
                    )
                  })()}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── ZONE LIST TAB ─────────────────────────────────────────────────── */}
        {activeTab === 'list' && (
          <>
            <div className={`flex items-center gap-3 mb-4`}>
              <div className={`flex-1 flex items-center gap-2 border rounded-xl px-3 py-2
                ${isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'}`}>
                <Search size={14} className="text-gray-400 shrink-0" />
                <input type="text" placeholder="Search zones..."
                  value={search} onChange={e => setSearch(e.target.value)}
                  className={`flex-1 text-sm outline-none bg-transparent
                    ${isDark ? 'text-white placeholder-gray-500' : 'text-gray-900 placeholder-gray-400'}`} />
              </div>
              <select value={filterType} onChange={e => setFilterType(e.target.value as any)}
                className={`text-sm border rounded-xl px-3 py-2 outline-none
                  ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200 text-gray-700'}`}>
                <option value="all">All Types</option>
                {Object.entries(TYPE_CONFIG).map(([val, cfg]) => (
                  <option key={val} value={val}>{cfg.label}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-3">
              {filtered.map(zone => {
                const cfg = TYPE_CONFIG[zone.type]
                const isExpanded = expandedZone === zone.id
                return (
                  <div key={zone.id}
                    className={`rounded-2xl border overflow-hidden transition-all
                      ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}
                      ${zone.type === 'restricted' && zone.violationsTotal > 0 ? 'border-l-4 border-l-red-500' : ''}
                      ${zone.type === 'poi' ? 'border-l-4 border-l-blue-500' : ''}`}>

                    <button
                      onClick={() => setExpandedZone(isExpanded ? null : zone.id)}
                      className={`w-full flex items-center gap-4 px-5 py-4 text-left transition-colors
                        ${isDark ? 'hover:bg-gray-750' : 'hover:bg-gray-50'}`}>

                      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: cfg.mapColor + '20' }}>
                        <cfg.icon size={18} style={{ color: cfg.mapColor }} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={`font-bold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {zone.name}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${cfg.color} ${cfg.bg} ${cfg.border}`}>
                            {cfg.label}
                          </span>
                          {!zone.active && (
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                              ${isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-500'}`}>
                              Inactive
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 flex-wrap">
                          <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            {zone.shapeType === 'circle' ? `Circle · ${zone.radius}m radius` : zone.shapeType}
                          </span>
                          <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            Assigned: {zone.assignedNames.join(', ')}
                          </span>
                          {zone.speedLimitKph && (
                            <span className="text-xs text-amber-600 font-medium">🚦 {zone.speedLimitKph} km/h</span>
                          )}
                          {zone.curfewStart && (
                            <span className="text-xs text-purple-600 font-medium">
                              🕐 {zone.curfewStart}–{zone.curfewEnd}
                            </span>
                          )}
                          {zone.poiId && (
                            <span className="text-xs text-blue-600 font-medium">📍 POI linked</span>
                          )}
                          {zone.routeId && (
                            <span className="text-xs text-teal-600 font-medium">🗺️ Route linked</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-4 shrink-0">
                        <div className="text-center">
                          <p className={`text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {zone.visitsToday}
                          </p>
                          <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Today</p>
                        </div>
                        {zone.activeVehicles > 0 && (
                          <div className="text-center">
                            <p className="text-sm font-bold text-green-600">{zone.activeVehicles}</p>
                            <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Inside</p>
                          </div>
                        )}
                        {zone.violationsTotal > 0 && (
                          <div className="text-center">
                            <p className="text-sm font-bold text-red-600">{zone.violationsTotal}</p>
                            <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Violations</p>
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <button className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
                            <Edit size={13} />
                          </button>
                          <button className="p-1.5 rounded-lg hover:bg-red-50 text-red-500">
                            <Trash2 size={13} />
                          </button>
                        </div>
                        {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className={`border-t px-5 py-4 ${isDark ? 'border-gray-700' : 'border-gray-100'}`}>
                        <div className="grid grid-cols-4 gap-4 mb-4">
                          {[
                            { label: 'Visits Today', value: zone.visitsToday },
                            { label: 'This Week', value: zone.visitsThisWeek },
                            { label: 'Avg Dwell', value: `${zone.avgDwellMinutes} min` },
                            { label: 'Violations', value: zone.violationsTotal },
                          ].map(stat => (
                            <div key={stat.label} className={`rounded-xl p-3 text-center ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
                              <p className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{stat.value}</p>
                              <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{stat.label}</p>
                            </div>
                          ))}
                        </div>
                        {zone.recentEvents.length > 0 && (
                          <div>
                            <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                              Recent Events
                            </p>
                            <div className="flex gap-2 flex-wrap">
                              {zone.recentEvents.map((event, i) => (
                                <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs
                                  ${event.eventType === 'entry'
                                    ? (isDark ? 'bg-green-900/20 text-green-300' : 'bg-green-50 text-green-700')
                                    : (isDark ? 'bg-blue-900/20 text-blue-300' : 'bg-blue-50 text-blue-700')}`}>
                                  <span>{event.eventType === 'entry' ? '→ Entered' : '← Exited'}</span>
                                  <span className="font-semibold">{event.vehiclePlate}</span>
                                  <span>{event.driverName.split(' ')[0]}</span>
                                  {event.dwellMinutes > 0 && <span>· {event.dwellMinutes}min</span>}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* ── ANALYTICS TAB ─────────────────────────────────────────────────── */}
        {activeTab === 'analytics' && (
          <div className="flex flex-col gap-5">

            <div className="grid grid-cols-2 gap-5">

              {/* Visits by zone */}
              <div className={`rounded-2xl border p-5 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                <h3 className={`font-bold text-sm mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Visits Today — by Zone
                </h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={visitData} layout="vertical" margin={{ left: 0, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#f3f4f6'} />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={90} />
                    <Tooltip />
                    <Bar dataKey="visits" radius={[0, 4, 4, 0]}>
                      {visitData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Violations by zone */}
              <div className={`rounded-2xl border p-5 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                <h3 className={`font-bold text-sm mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Violations — by Zone
                </h3>
                {violationData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={violationData} layout="vertical" margin={{ left: 0, right: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#f3f4f6'} />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={90} />
                      <Tooltip />
                      <Bar dataKey="violations" fill="#ef4444" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-48">
                    <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      No violations recorded
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Zone summary table */}
            <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
              <div className={`px-5 py-3 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                <h3 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>Zone Summary</h3>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className={`border-b text-xs font-semibold uppercase tracking-wide
                    ${isDark ? 'border-gray-700 bg-gray-900 text-gray-400' : 'border-gray-100 bg-gray-50 text-gray-500'}`}>
                    <th className="px-4 py-3 text-left">Zone</th>
                    <th className="px-4 py-3 text-left">Type</th>
                    <th className="px-4 py-3 text-left">Assigned To</th>
                    <th className="px-4 py-3 text-left">Visits Today</th>
                    <th className="px-4 py-3 text-left">This Week</th>
                    <th className="px-4 py-3 text-left">Avg Dwell</th>
                    <th className="px-4 py-3 text-left">Inside Now</th>
                    <th className="px-4 py-3 text-left">Violations</th>
                    <th className="px-4 py-3 text-left">Links</th>
                  </tr>
                </thead>
                <tbody>
                  {geozones.map(zone => {
                    const cfg = TYPE_CONFIG[zone.type]
                    return (
                      <tr key={zone.id}
                        className={`border-b ${isDark ? 'border-gray-700 hover:bg-gray-750' : 'border-gray-50 hover:bg-gray-50'}`}>
                        <td className="px-4 py-3">
                          <p className={`text-xs font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {zone.name.split('—')[0].trim()}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${cfg.color} ${cfg.bg} ${cfg.border}`}>
                            {cfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            {zone.assignedNames.join(', ')}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            {zone.visitsToday}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            {zone.visitsThisWeek}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            {zone.avgDwellMinutes} min
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {zone.activeVehicles > 0 ? (
                            <span className="text-xs font-bold text-green-600">{zone.activeVehicles} 🚛</span>
                          ) : (
                            <span className={`text-xs ${isDark ? 'text-gray-600' : 'text-gray-300'}`}>—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {zone.violationsTotal > 0 ? (
                            <span className="text-xs font-bold text-red-600">{zone.violationsTotal} ⚠️</span>
                          ) : (
                            <span className="text-xs text-green-600">✓ None</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            {zone.poiId && <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-medium">POI</span>}
                            {zone.routeId && <span className="text-xs bg-teal-50 text-teal-600 px-1.5 py-0.5 rounded font-medium">Route</span>}
                            {!zone.poiId && !zone.routeId && <span className={`text-xs ${isDark ? 'text-gray-600' : 'text-gray-300'}`}>—</span>}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Create Zone Modal — multi step */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-md">
          <div className={`rounded-3xl shadow-2xl w-full max-w-lg mx-4 ${isDark ? 'bg-gray-900' : 'bg-white'}`}>
            <div className={`flex items-center justify-between px-6 py-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
              <div>
                <h2 className={`font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>New Geozone</h2>
                <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Step {createStep} of 4</p>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            {/* Progress */}
            <div className="flex gap-1 px-6 pt-4">
              {[1, 2, 3, 4].map(step => (
                <div key={step} className={`flex-1 h-1.5 rounded-full transition-all
                  ${step <= createStep ? 'bg-purple-600' : `${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}`} />
              ))}
            </div>

            <div className="p-6">
              {/* Step 1 — Zone Type */}
              {createStep === 1 && (
                <div>
                  <h3 className={`font-semibold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>Choose Zone Type</h3>
                  <p className={`text-xs mb-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    What kind of zone is this?
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(TYPE_CONFIG).map(([type, cfg]) => (
                      <button key={type}
                        onClick={() => setSelectedType(type as GeozoneType)}
                        className={`flex items-start gap-3 p-3 rounded-xl border-2 text-left transition-all
                          ${selectedType === type
                            ? 'border-purple-500 bg-purple-50'
                            : `${isDark ? 'border-gray-700 hover:border-gray-600' : 'border-gray-200 hover:border-gray-300'}`}`}>
                        <div className={`w-7 h-7 rounded-lg ${cfg.bg} flex items-center justify-center shrink-0`}>
                          <cfg.icon size={14} className={cfg.color} />
                        </div>
                        <div>
                          <p className={`text-xs font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{cfg.label}</p>
                          <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{cfg.description}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 2 — Name + Shape */}
              {createStep === 2 && (
                <div className="flex flex-col gap-3">
                  <h3 className={`font-semibold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>Zone Details</h3>
                  <div>
                    <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Zone Name *</label>
                    <input placeholder="e.g. Stratford Depot Yard"
                      className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-purple-500
                        ${isDark ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'}`} />
                  </div>
                  <div>
                    <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Description</label>
                    <textarea rows={2} placeholder="What is this zone for?"
                      className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none resize-none focus:border-purple-500
                        ${isDark ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'}`} />
                  </div>
                  <div>
                    <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Shape Type</label>
                    <div className="flex gap-2">
                      {['Circle', 'Polygon'].map(shape => (
                        <button key={shape}
                          className={`flex-1 py-2 rounded-xl text-xs font-medium border transition-colors
                            ${isDark ? 'border-gray-700 text-gray-300 hover:bg-gray-800' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                          {shape === 'Circle' ? '⭕' : '⬡'} {shape}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className={`rounded-xl border-2 border-dashed p-4 text-center ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                    <MapPin size={18} className="text-gray-400 mx-auto mb-2" />
                    <p className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      🖊️ Interactive draw tool coming in Sprint 2
                    </p>
                    <p className={`text-xs ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                      TODO: Leaflet.draw — click to place, drag to resize
                    </p>
                  </div>
                </div>
              )}

              {/* Step 3 — Rules */}
              {createStep === 3 && (
                <div className="flex flex-col gap-3">
                  <h3 className={`font-semibold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>Zone Rules</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {['Alert on Entry', 'Alert on Exit'].map(rule => (
                      <label key={rule} className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer
                        ${isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'}`}>
                        <input type="checkbox" className="rounded" />
                        <span className={`text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{rule}</span>
                      </label>
                    ))}
                  </div>
                  {(selectedType === 'speed') && (
                    <div>
                      <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        Speed Limit (km/h)
                      </label>
                      <input type="number" placeholder="e.g. 8"
                        className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none
                          ${isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-700'}`} />
                    </div>
                  )}
                  <div>
                    <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Max Dwell Time (minutes) — optional
                    </label>
                    <input type="number" placeholder="Leave blank for no limit"
                      className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none
                        ${isDark ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' : 'bg-white border-gray-200 text-gray-700 placeholder-gray-400'}`} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {['Curfew Start', 'Curfew End'].map(label => (
                      <div key={label}>
                        <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                          {label} (optional)
                        </label>
                        <input type="time"
                          className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none
                            ${isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-700'}`} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 4 — Assignment + Links */}
              {createStep === 4 && (
                <div className="flex flex-col gap-3">
                  <h3 className={`font-semibold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    Assignment & Links
                  </h3>
                  <div>
                    <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Assign To *
                    </label>
                    <select className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none
                      ${isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-700'}`}>
                      <option>All Vehicles</option>
                      <option>Specific Fleet</option>
                      <option>Specific Vehicle</option>
                      <option>Specific Driver</option>
                    </select>
                  </div>
                  <div>
                    <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Link to POI (optional)
                      {/* DEVELOPER NOTE: This creates POI↔Geozone relationship
                          On vehicle entry → POI visit logged + SLA timer started
                          On vehicle exit → dwell time calculated + SLA checked */}
                    </label>
                    <select className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none
                      ${isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-700'}`}>
                      <option value="">No POI link</option>
                      <option>Stratford Logistics Park — HQ</option>
                      <option>Amazon BHX2 Fulfilment Centre</option>
                      <option>Tesco RDC — Daventry</option>
                    </select>
                  </div>
                  <div>
                    <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Link to Route as Corridor (optional)
                      {/* DEVELOPER NOTE: Creates corridor zone for route deviation detection
                          radius = tolerance in meters
                          On vehicle outside corridor → route deviation alert + violation */}
                    </label>
                    <select className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none
                      ${isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-700'}`}>
                      <option value="">No route link</option>
                      <option>London → Birmingham Express</option>
                      <option>Cold Chain — London to Tilbury</option>
                      <option>Manchester Urban Van Loop</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            <div className={`flex items-center justify-between px-6 py-4 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
              <button
                onClick={() => createStep > 1 ? setCreateStep(createStep - 1) : setShowCreateModal(false)}
                className={`text-sm px-4 py-2 rounded-xl border transition-colors
                  ${isDark ? 'border-gray-700 text-gray-300' : 'border-gray-200 text-gray-600'}`}>
                {createStep === 1 ? 'Cancel' : 'Back'}
              </button>
              <button
                onClick={() => createStep < 4 ? setCreateStep(createStep + 1) : setShowCreateModal(false)}
                className="text-sm px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold transition-colors">
                {createStep === 4 ? 'Create Zone' : 'Next →'}
              </button>
            </div>
          </div>
        </div>
      )}
    </FleetpointLayout>
  )
}
