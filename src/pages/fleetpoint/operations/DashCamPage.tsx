// src/pages/fleetpoint/operations/DashCamPage.tsx
// DashCam — Live View, Events, Review Queue, Analytics
//
// DEVELOPER NOTES:
// ─────────────────────────────────────────────────────────────────────────────
// VIDEO FILES — HOW TO MAKE DEMO WORK:
// Upload dashcam footage to: public/videos/dashcam/
//
// Event videos naming convention:
//   public/videos/dashcam/events/{eventId}_{camera}.mp4
//   Example: public/videos/dashcam/events/EVT001_front.mp4
//            public/videos/dashcam/events/EVT001_cabin.mp4
//            public/videos/dashcam/events/EVT001_rear.mp4
//            public/videos/dashcam/events/EVT001_side.mp4
//
// Live feed videos naming convention:
//   public/videos/dashcam/live/{vehiclePlate}_{camera}.mp4
//   Example: public/videos/dashcam/live/LP-4821_front.mp4
//            public/videos/dashcam/live/LP-4821_cabin.mp4
//
// When video files exist in public/videos/dashcam/ they auto-play in demo.
// When files are missing the placeholder UI shows with the expected file path.
// No code changes needed — just upload the .mp4 files.
//
// BACKEND INTEGRATION:
// BSJ IOT cameras → backend adapter → IoTility events table → frontend
// Frontend never calls BSJ API directly
// Live streams: backend proxies RTSP → HLS, frontend plays HLS via <video>
// TODO: Build BSJ IOT adapter service (Node.js)
//       Map BSJ device IDs → vehicleId/driverId
//       Store enriched events in dashcam_events table
//
// API endpoints:
// GET    /api/fleetpoint/dashcam/events           — list events (paginated)
// GET    /api/fleetpoint/dashcam/events/:id       — single event
// PATCH  /api/fleetpoint/dashcam/events/:id/review — review event
// GET    /api/fleetpoint/dashcam/live/:vehicleId  — live stream URLs
// GET    /api/fleetpoint/dashcam/analytics        — analytics data
//
// WebSocket:
// WS emits { type: 'dashcam-event', ... } for real-time event push
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import {
  Camera, AlertTriangle, CheckCircle, Eye, X,
  Play, Search, Filter, Download, Flag, XCircle,
  Clock, Zap, Bot, User, Truck, MapPin,
  MoreHorizontal, ChevronRight, Video, Wifi, WifiOff
} from 'lucide-react'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend
} from 'recharts'
import FleetpointLayout from '../../../layouts/FleetpointLayout'
import { dashcamEvents, drivers, vehicles } from '../../../data/fleetData'
import { useTheme } from '../../../hooks/useTheme'
import type { DashcamEvent, DashcamEventCategory, DashcamReviewStatus } from '../../../data/fleetData'

// ─── Config ───────────────────────────────────────────────────────────────────
const CATEGORY_CONFIG: Record<DashcamEventCategory, {
  label: string; color: string; bg: string; border: string; mapColor: string
}> = {
  'safety-critical': { label: 'Safety Critical', color: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-200',    mapColor: '#dc2626' },
  'fatigue':         { label: 'Driver Fatigue',  color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200', mapColor: '#ea580c' },
  'distraction':     { label: 'Distraction',     color: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-200',  mapColor: '#d97706' },
  'driving-style':   { label: 'Driving Style',   color: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-200',   mapColor: '#2563eb' },
  'identity':        { label: 'Identity',         color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200', mapColor: '#7c3aed' },
  'camera':          { label: 'Camera',           color: 'text-gray-700',   bg: 'bg-gray-100',  border: 'border-gray-200',   mapColor: '#6b7280' },
}

const SEVERITY_CONFIG = {
  critical: { label: 'Critical', color: 'text-red-700',    bg: 'bg-red-50',   border: 'border-red-300',   dot: 'bg-red-500' },
  warning:  { label: 'Warning',  color: 'text-amber-700',  bg: 'bg-amber-50', border: 'border-amber-300', dot: 'bg-amber-500' },
  info:     { label: 'Info',     color: 'text-blue-700',   bg: 'bg-blue-50',  border: 'border-blue-300',  dot: 'bg-blue-400' },
}

const REVIEW_CONFIG: Record<DashcamReviewStatus, { label: string; color: string; bg: string }> = {
  'unreviewed':    { label: 'Unreviewed',    color: 'text-gray-600',   bg: 'bg-gray-100' },
  'acknowledged':  { label: 'Acknowledged',  color: 'text-green-700',  bg: 'bg-green-50' },
  'violation':     { label: 'Violation',     color: 'text-red-700',    bg: 'bg-red-50' },
  'false-positive':{ label: 'False Positive',color: 'text-blue-700',   bg: 'bg-blue-50' },
}

type TabId = 'live' | 'events' | 'review' | 'analytics'
type GridLayout = '1x1' | '2x2' | '3x3' | '4x4'

// ── Video placeholder component ───────────────────────────────────────────────
// Shows video if file exists, placeholder with path if not
// DEVELOPER: upload .mp4 files to public/videos/dashcam/ to activate
const VideoTile = ({
  src, label, isDark, small = false
}: { src: string; label: string; isDark: boolean; small?: boolean }) => {
  const [error, setError] = useState(false)
  return (
    <div className={`relative bg-gray-900 rounded-xl overflow-hidden flex items-center justify-center
      ${small ? 'aspect-video' : 'aspect-video'}`}>
      {!error ? (
        <video
          src={src}
          className="w-full h-full object-cover"
          autoPlay muted loop playsInline
          onError={() => setError(true)}
        />
      ) : (
        // Placeholder shown when video file not yet uploaded
        <div className="absolute inset-0 flex flex-col items-center justify-center p-2">
          <Video size={small ? 16 : 24} className="text-gray-600 mb-1" />
          <p className="text-gray-600 text-xs text-center font-medium">{label}</p>
          <p className="text-gray-700 text-xs text-center mt-1 font-mono break-all">{src}</p>
          {/* DEVELOPER NOTE: Upload video file to path above to activate this tile */}
        </div>
      )}
      <div className="absolute bottom-1 left-1">
        <span className="text-xs bg-black/60 text-white px-1.5 py-0.5 rounded font-medium">
          {label}
        </span>
      </div>
      <div className="absolute top-1 right-1 flex items-center gap-1">
        <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></div>
        <span className="text-xs text-white/80">LIVE</span>
      </div>
    </div>
  )
}

export default function DashCamPage() {
  const { isDark } = useTheme()
  const [activeTab, setActiveTab] = useState<TabId>('live')
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState<'all' | DashcamEventCategory>('all')
  const [filterSeverity, setFilterSeverity] = useState<'all' | 'critical' | 'warning' | 'info'>('all')
  const [filterReview, setFilterReview] = useState<'all' | DashcamReviewStatus>('all')
  const [selectedEvent, setSelectedEvent] = useState<DashcamEvent | null>(null)
  const [gridLayout, setGridLayout] = useState<GridLayout>('2x2')
  const [selectedVehicle, setSelectedVehicle] = useState(vehicles[0])
  const [reviewNote, setReviewNote] = useState('')

  // ── KPIs ────────────────────────────────────────────────────────────────────
  const total = dashcamEvents.length
  const critical = dashcamEvents.filter(e => e.severity === 'critical').length
  const unreviewed = dashcamEvents.filter(e => e.reviewStatus === 'unreviewed').length
  const violations = dashcamEvents.filter(e => e.reviewStatus === 'violation').length
  const falsePosRate = Math.round(
    (dashcamEvents.filter(e => e.reviewStatus === 'false-positive').length / total) * 100
  )

  // ── Filtered events ──────────────────────────────────────────────────────────
  const filtered = dashcamEvents.filter(e => {
    const s = search.toLowerCase()
    const matchSearch = !search ||
      e.driverName.toLowerCase().includes(s) ||
      e.vehiclePlate.toLowerCase().includes(s) ||
      e.eventType.toLowerCase().includes(s) ||
      e.location.toLowerCase().includes(s)
    const matchCat = filterCategory === 'all' || e.category === filterCategory
    const matchSev = filterSeverity === 'all' || e.severity === filterSeverity
    const matchRev = filterReview === 'all' || e.reviewStatus === filterReview
    return matchSearch && matchCat && matchSev && matchRev
  })

  // ── Grid columns per layout ──────────────────────────────────────────────────
  const gridCols: Record<GridLayout, string> = {
    '1x1': 'grid-cols-1',
    '2x2': 'grid-cols-2',
    '3x3': 'grid-cols-3',
    '4x4': 'grid-cols-4',
  }

  // ── Analytics data ───────────────────────────────────────────────────────────
  const categoryData = Object.entries(CATEGORY_CONFIG).map(([cat, cfg]) => ({
    name: cfg.label,
    value: dashcamEvents.filter(e => e.category === cat).length,
    color: cfg.mapColor,
  })).filter(d => d.value > 0)

  const driverEventData = drivers.map(d => ({
    name: d.name.split(' ')[0],
    events: dashcamEvents.filter(e => e.driverId === d.id).length,
    critical: dashcamEvents.filter(e => e.driverId === d.id && e.severity === 'critical').length,
  })).filter(d => d.events > 0).sort((a, b) => b.events - a.events)

  const trendData = [
    { day: 'Mon', events: 4, critical: 1 },
    { day: 'Tue', events: 7, critical: 3 },
    { day: 'Wed', events: 3, critical: 1 },
    { day: 'Thu', events: 8, critical: 2 },
    { day: 'Fri', events: 6, critical: 2 },
    { day: 'Sat', events: 2, critical: 0 },
    { day: 'Sun', events: total, critical },
  ]

  const tabs: { id: TabId; label: string; emoji: string; count?: number }[] = [
    { id: 'live',      label: 'Live View',     emoji: '📹' },
    { id: 'events',    label: 'Events',        emoji: '⚡', count: total },
    { id: 'review',    label: 'Review Queue',  emoji: '👁️', count: unreviewed },
    { id: 'analytics', label: 'Analytics',     emoji: '📊' },
  ]

  return (
    <FleetpointLayout>
      <div className={`p-6 min-h-full ${isDark ? 'bg-gray-950' : 'bg-gray-50'}`}>

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>DashCam</h1>
            <p className={`text-sm mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              {total} events today · {critical} critical · {unreviewed} unreviewed · Powered by BSJ IOT
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button className={`flex items-center gap-2 text-sm px-3 py-2 rounded-xl border transition-colors
              ${isDark ? 'border-gray-700 text-gray-300 hover:bg-gray-800' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              <Download size={15} /> Export
            </button>
          </div>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-5 gap-3 mb-5">
          {[
            { label: 'Total Events', value: total, color: 'text-purple-600', bg: 'bg-purple-50', icon: Camera },
            { label: 'Critical', value: critical, color: 'text-red-600', bg: 'bg-red-50', icon: AlertTriangle },
            { label: 'Unreviewed', value: unreviewed, color: 'text-amber-600', bg: 'bg-amber-50', icon: Eye },
            { label: 'Violations Raised', value: violations, color: 'text-orange-600', bg: 'bg-orange-50', icon: Flag },
            { label: 'False Positive Rate', value: `${falsePosRate}%`, color: 'text-blue-600', bg: 'bg-blue-50', icon: CheckCircle },
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

        {/* ── LIVE VIEW TAB ─────────────────────────────────────────────────── */}
        {activeTab === 'live' && (
          <div className="flex gap-4">

            {/* Driver/Vehicle selector */}
            <div className={`w-52 shrink-0 rounded-2xl border overflow-hidden flex flex-col
              ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}
              style={{ maxHeight: '580px' }}>
              <div className={`px-3 py-2.5 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                <p className={`text-xs font-semibold uppercase tracking-wide ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  Vehicles
                </p>
              </div>
              <div className="flex-1 overflow-y-auto">
                {vehicles.filter(v => v.status !== 'offline').map(v => {
                  const driver = drivers.find(d => d.id === v.driverId)
                  const isSelected = selectedVehicle.id === v.id
                  const hasEvent = dashcamEvents.some(e =>
                    e.vehicleId === v.id && e.reviewStatus === 'unreviewed'
                  )
                  return (
                    <button key={v.id}
                      onClick={() => setSelectedVehicle(v)}
                      className={`w-full flex items-center gap-2 px-3 py-2.5 text-left border-b transition-colors
                        ${isDark ? 'border-gray-700' : 'border-gray-50'}
                        ${isSelected
                          ? 'bg-purple-600'
                          : `${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}`}`}>
                      <div className="relative shrink-0">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm
                          ${isSelected ? 'bg-purple-500' : isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
                          🚛
                        </div>
                        {hasEvent && (
                          <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className={`text-xs font-semibold truncate
                          ${isSelected ? 'text-white' : isDark ? 'text-white' : 'text-gray-900'}`}>
                          {v.plate}
                        </p>
                        <p className={`text-xs truncate
                          ${isSelected ? 'text-purple-200' : isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          {driver ? driver.name.split(' ')[0] : 'Unassigned'}
                        </p>
                      </div>
                      <div className={`w-1.5 h-1.5 rounded-full shrink-0
                        ${v.status === 'moving' ? 'bg-green-400' : v.status === 'idle' ? 'bg-amber-400' : 'bg-gray-300'}`}>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Camera grid */}
            <div className="flex-1">
              {/* Grid controls */}
              <div className={`flex items-center justify-between mb-3 px-3 py-2 rounded-xl border
                ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                  <span className={`text-xs font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {selectedVehicle.plate} — {drivers.find(d => d.id === selectedVehicle.driverId)?.name || 'Unassigned'}
                  </span>
                  <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    · {selectedVehicle.speed}mph · {selectedVehicle.location}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {(['1x1', '2x2', '3x3', '4x4'] as GridLayout[]).map(layout => (
                    <button key={layout}
                      onClick={() => setGridLayout(layout)}
                      className={`text-xs px-2 py-1 rounded-lg font-medium transition-colors
                        ${gridLayout === layout
                          ? 'bg-purple-600 text-white'
                          : `${isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-500'}`}`}>
                      {layout}
                    </button>
                  ))}
                </div>
              </div>

              {/* Camera tiles */}
              {/* DEVELOPER NOTE:
                  Live stream URLs come from GET /api/fleetpoint/dashcam/live/:vehicleId
                  Backend proxies BSJ IOT RTSP stream → HLS for browser playback
                  For demo: upload .mp4 files to public/videos/dashcam/live/
                  File naming: {vehiclePlate}_{camera}.mp4
                  Example: LP-4821_front.mp4, LP-4821_cabin.mp4
              */}
              <div className={`grid ${gridCols[gridLayout]} gap-2`}>
                {[
                  { camera: 'front', label: 'Front Camera' },
                  { camera: 'cabin', label: 'Cabin Camera' },
                  { camera: 'rear',  label: 'Rear Camera' },
                  { camera: 'side',  label: 'Side Camera' },
                ].slice(0, gridLayout === '1x1' ? 1 : gridLayout === '2x2' ? 4 : gridLayout === '3x3' ? 4 : 4).map(cam => (
                  <VideoTile
                    key={cam.camera}
                    src={`/videos/dashcam/live/${selectedVehicle.plate}_${cam.camera}.mp4`}
                    label={cam.label}
                    isDark={isDark}
                  />
                ))}
              </div>

              {/* Live alerts for this vehicle */}
              {dashcamEvents.filter(e => e.vehicleId === selectedVehicle.id).length > 0 && (
                <div className={`mt-3 rounded-xl border p-3 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                  <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    Recent Events — {selectedVehicle.plate}
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {dashcamEvents.filter(e => e.vehicleId === selectedVehicle.id).slice(0, 3).map(event => {
                      const cat = CATEGORY_CONFIG[event.category]
                      const sev = SEVERITY_CONFIG[event.severity]
                      return (
                        <div key={event.id}
                          onClick={() => { setSelectedEvent(event); setActiveTab('events') }}
                          className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer
                            ${isDark ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-50 hover:bg-gray-100'}`}>
                          <div className={`w-2 h-2 rounded-full shrink-0 ${sev.dot}`}></div>
                          <span className={`text-xs font-medium flex-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {event.eventType}
                          </span>
                          <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            {new Date(event.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <ChevronRight size={12} className="text-gray-400" />
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Live event feed */}
            <div className={`w-56 shrink-0 rounded-2xl border overflow-hidden flex flex-col
              ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}
              style={{ maxHeight: '580px' }}>
              <div className={`px-3 py-2.5 border-b flex items-center gap-2 ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                <p className={`text-xs font-semibold uppercase tracking-wide ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  Live Alerts
                </p>
              </div>
              <div className="flex-1 overflow-y-auto flex flex-col gap-0">
                {dashcamEvents
                  .filter(e => e.severity === 'critical' || e.reviewStatus === 'unreviewed')
                  .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                  .map(event => {
                    const cat = CATEGORY_CONFIG[event.category]
                    const sev = SEVERITY_CONFIG[event.severity]
                    return (
                      <div key={event.id}
                        onClick={() => { setSelectedEvent(event); setActiveTab('events') }}
                        className={`px-3 py-2.5 border-b cursor-pointer transition-colors
                          ${isDark ? 'border-gray-700 hover:bg-gray-700' : 'border-gray-50 hover:bg-gray-50'}
                          ${event.severity === 'critical' ? (isDark ? 'bg-red-900/10' : 'bg-red-50/50') : ''}`}>
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <div className={`w-1.5 h-1.5 rounded-full ${sev.dot}`}></div>
                          <span className={`text-xs font-semibold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {event.eventType}
                          </span>
                        </div>
                        <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          {event.driverName.split(' ')[0]} · {event.vehiclePlate}
                        </p>
                        <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                          {new Date(event.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    )
                  })}
              </div>
            </div>
          </div>
        )}

        {/* ── EVENTS TAB ────────────────────────────────────────────────────── */}
        {activeTab === 'events' && (
          <>
            {/* Search + filters */}
            <div className={`rounded-2xl border p-4 mb-4 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
              <div className="flex items-center gap-3">
                <div className={`flex-1 flex items-center gap-2 border rounded-xl px-3 py-2
                  ${isDark ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-gray-50'}`}>
                  <Search size={14} className="text-gray-400 shrink-0" />
                  <input type="text" placeholder="Search driver, vehicle, event type, location..."
                    value={search} onChange={e => setSearch(e.target.value)}
                    className={`flex-1 text-sm outline-none bg-transparent
                      ${isDark ? 'text-white placeholder-gray-500' : 'text-gray-900 placeholder-gray-400'}`} />
                  {search && <button onClick={() => setSearch('')}><X size={12} className="text-gray-400" /></button>}
                </div>
                <select value={filterCategory} onChange={e => setFilterCategory(e.target.value as any)}
                  className={`text-sm border rounded-xl px-3 py-2 outline-none ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200 text-gray-700'}`}>
                  <option value="all">All Categories</option>
                  {Object.entries(CATEGORY_CONFIG).map(([val, cfg]) => (
                    <option key={val} value={val}>{cfg.label}</option>
                  ))}
                </select>
                <select value={filterSeverity} onChange={e => setFilterSeverity(e.target.value as any)}
                  className={`text-sm border rounded-xl px-3 py-2 outline-none ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200 text-gray-700'}`}>
                  <option value="all">All Severity</option>
                  <option value="critical">Critical</option>
                  <option value="warning">Warning</option>
                  <option value="info">Info</option>
                </select>
                <select value={filterReview} onChange={e => setFilterReview(e.target.value as any)}
                  className={`text-sm border rounded-xl px-3 py-2 outline-none ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200 text-gray-700'}`}>
                  <option value="all">All Status</option>
                  <option value="unreviewed">Unreviewed</option>
                  <option value="acknowledged">Acknowledged</option>
                  <option value="violation">Violation</option>
                  <option value="false-positive">False Positive</option>
                </select>
              </div>
            </div>

            {/* Events table + detail panel */}
            <div className="flex gap-4">
              <div className={`flex-1 rounded-2xl border overflow-hidden ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                <table className="w-full text-sm">
                  <thead>
                    <tr className={`border-b text-xs font-semibold uppercase tracking-wide
                      ${isDark ? 'border-gray-700 bg-gray-900 text-gray-400' : 'border-gray-100 bg-gray-50 text-gray-500'}`}>
                      <th className="px-4 py-3 text-left">Event</th>
                      <th className="px-4 py-3 text-left">Driver</th>
                      <th className="px-4 py-3 text-left">Vehicle</th>
                      <th className="px-4 py-3 text-left">Category</th>
                      <th className="px-4 py-3 text-left">Severity</th>
                      <th className="px-4 py-3 text-left">Time</th>
                      <th className="px-4 py-3 text-left">Location</th>
                      <th className="px-4 py-3 text-left">Speed</th>
                      <th className="px-4 py-3 text-left">Job/Route</th>
                      <th className="px-4 py-3 text-left">Status</th>
                      <th className="px-4 py-3 text-left">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(event => {
                      const cat = CATEGORY_CONFIG[event.category]
                      const sev = SEVERITY_CONFIG[event.severity]
                      const rev = REVIEW_CONFIG[event.reviewStatus]
                      const isSelected = selectedEvent?.id === event.id
                      return (
                        <tr key={event.id}
                          onClick={() => setSelectedEvent(isSelected ? null : event)}
                          className={`border-b cursor-pointer transition-colors
                            ${isDark ? 'border-gray-700 hover:bg-gray-750' : 'border-gray-50 hover:bg-gray-50'}
                            ${isSelected ? (isDark ? 'bg-purple-900/20' : 'bg-purple-50') : ''}
                            ${event.severity === 'critical' && event.reviewStatus === 'unreviewed'
                              ? (isDark ? 'border-l-2 border-l-red-500' : 'border-l-2 border-l-red-400') : ''}`}>
                          <td className="px-4 py-3">
                            <p className={`font-semibold text-xs ${isDark ? 'text-white' : 'text-gray-900'}`}>{event.eventType}</p>
                            <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{event.id}</p>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                                {event.driverName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                              </div>
                              <span className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                {event.driverName.split(' ')[0]}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-medium ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>
                              {event.vehiclePlate}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium
                              ${cat.color} ${cat.bg} ${cat.border}`}>
                              {cat.label}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <div className={`w-2 h-2 rounded-full ${sev.dot}`}></div>
                              <span className={`text-xs font-medium ${sev.color}`}>{sev.label}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                              {new Date(event.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </td>
                          <td className="px-4 py-3 max-w-32">
                            <span className={`text-xs truncate block ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                              {event.location.split(',')[0]}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs ${event.speedKph > 90 ? 'text-red-600 font-bold' : isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                              {event.speedKph} km/h
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {event.jobName ? (
                              <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'} truncate block max-w-24`}>
                                {event.jobName.split(' ')[0]}...
                              </span>
                            ) : (
                              <span className={`text-xs ${isDark ? 'text-gray-600' : 'text-gray-300'}`}>—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${rev.color} ${rev.bg}`}>
                              {rev.label}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {event.scoreImpact < 0 ? (
                              <span className="text-xs font-bold text-red-600">{event.scoreImpact}</span>
                            ) : (
                              <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                <div className={`px-4 py-3 border-t text-xs ${isDark ? 'border-gray-700 text-gray-400' : 'border-gray-100 text-gray-500'}`}>
                  Showing {filtered.length} of {dashcamEvents.length} events
                </div>
              </div>

              {/* Event detail panel */}
              {selectedEvent && (
                <div className={`w-80 shrink-0 rounded-2xl border overflow-hidden flex flex-col
                  ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                  <div className={`flex items-center justify-between px-4 py-3 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                    <h3 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>Event Detail</h3>
                    <button onClick={() => setSelectedEvent(null)} className="text-gray-400 hover:text-gray-600">
                      <X size={16} />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">

                    {/* Event info */}
                    <div>
                      <p className={`font-bold text-sm mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {selectedEvent.eventType}
                      </p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium
                          ${CATEGORY_CONFIG[selectedEvent.category].color}
                          ${CATEGORY_CONFIG[selectedEvent.category].bg}
                          ${CATEGORY_CONFIG[selectedEvent.category].border}`}>
                          {CATEGORY_CONFIG[selectedEvent.category].label}
                        </span>
                        <span className={`text-xs font-medium ${SEVERITY_CONFIG[selectedEvent.severity].color}`}>
                          {SEVERITY_CONFIG[selectedEvent.severity].label}
                        </span>
                      </div>
                    </div>

                    {/* Key details */}
                    <div className="flex flex-col gap-2">
                      {[
                        { label: 'Driver', value: selectedEvent.driverName },
                        { label: 'Vehicle', value: selectedEvent.vehiclePlate },
                        { label: 'Fleet', value: selectedEvent.fleetName },
                        { label: 'Speed', value: `${selectedEvent.speedKph} km/h` },
                        { label: 'Location', value: selectedEvent.location },
                        { label: 'Job', value: selectedEvent.jobName || '—' },
                        { label: 'Route', value: selectedEvent.routeName || '—' },
                        { label: 'Score Impact', value: selectedEvent.scoreImpact < 0 ? `${selectedEvent.scoreImpact} pts` : '—' },
                        { label: 'BSJ Device', value: selectedEvent.bsjDeviceId },
                      ].map(item => (
                        <div key={item.label} className="flex items-start justify-between gap-2">
                          <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{item.label}</span>
                          <span className={`text-xs font-medium text-right ${
                            item.label === 'Score Impact' && selectedEvent.scoreImpact < 0
                              ? 'text-red-600'
                              : isDark ? 'text-gray-200' : 'text-gray-800'
                          }`}>{item.value}</span>
                        </div>
                      ))}
                    </div>

                    {/* Video thumbnails */}
                    {/* DEVELOPER NOTE:
                        Upload video files to:
                        public/videos/dashcam/events/{eventId}_{camera}.mp4
                        Files: EVT001_front.mp4, EVT001_cabin.mp4, EVT001_rear.mp4, EVT001_side.mp4
                        Videos auto-play when files exist. Placeholder shows until uploaded.
                    */}
                    <div>
                      <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        Footage — {selectedEvent.id}
                      </p>
                      <div className="grid grid-cols-2 gap-1.5">
                        {Object.entries(selectedEvent.videoFiles).map(([cam, src]) => (
                          <VideoTile key={cam} src={src} label={cam} isDark={isDark} small />
                        ))}
                      </div>
                    </div>

                    {/* Review status */}
                    {selectedEvent.reviewNote && (
                      <div className={`rounded-xl p-3 ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
                        <p className={`text-xs font-semibold mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                          Review Note
                        </p>
                        <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{selectedEvent.reviewNote}</p>
                        <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                          by {selectedEvent.reviewedBy}
                        </p>
                      </div>
                    )}

                    {/* Quick review actions */}
                    {selectedEvent.reviewStatus === 'unreviewed' && (
                      <div>
                        <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          Quick Review
                        </p>
                        <div className="grid grid-cols-3 gap-1.5">
                          {[
                            { label: '✅ Acknowledge', action: 'acknowledged', color: 'bg-green-600 hover:bg-green-700' },
                            { label: '⚠️ Violation', action: 'violation', color: 'bg-red-600 hover:bg-red-700' },
                            { label: '❌ False +ve', action: 'false-positive', color: 'bg-blue-600 hover:bg-blue-700' },
                          ].map(action => (
                            <button key={action.action}
                              onClick={() => setActiveTab('review')}
                              className={`text-xs py-2 rounded-xl text-white font-medium transition-colors ${action.color}`}>
                              {action.label}
                            </button>
                          ))}
                        </div>
                        {/* DEVELOPER NOTE: PATCH /api/fleetpoint/dashcam/events/:id/review
                            Body: { status, note, reviewedBy }
                            On 'violation': creates entry in violations table
                            On 'acknowledged': updates driver safety score by scoreImpact
                        */}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── REVIEW QUEUE TAB ──────────────────────────────────────────────── */}
        {activeTab === 'review' && (
          <div className="flex flex-col gap-4">
            <div className={`rounded-2xl border p-4 flex items-center justify-between
              ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
              <div>
                <p className={`font-bold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Review Queue — {unreviewed} events pending
                </p>
                <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  Review oldest first · Acknowledge, flag as violation, or mark false positive
                </p>
              </div>
              <button className={`text-xs px-3 py-2 rounded-xl border transition-colors
                ${isDark ? 'border-gray-700 text-gray-300 hover:bg-gray-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                Bulk Acknowledge All
              </button>
            </div>

            {dashcamEvents.filter(e => e.reviewStatus === 'unreviewed').map(event => {
              const cat = CATEGORY_CONFIG[event.category]
              const sev = SEVERITY_CONFIG[event.severity]
              return (
                <div key={event.id}
                  className={`rounded-2xl border overflow-hidden
                    ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}
                    ${event.severity === 'critical' ? 'border-l-4 border-l-red-500' : ''}`}>
                  <div className="flex gap-4 p-4">

                    {/* 2-camera preview */}
                    <div className="w-64 shrink-0">
                      <div className="grid grid-cols-2 gap-1 mb-1">
                        <VideoTile src={event.videoFiles.front} label="Front" isDark={isDark} small />
                        <VideoTile src={event.videoFiles.cabin} label="Cabin" isDark={isDark} small />
                      </div>
                      <p className={`text-xs text-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        {event.id} · 4 cameras available
                      </p>
                    </div>

                    {/* Event info */}
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`font-bold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>
                              {event.eventType}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium
                              ${cat.color} ${cat.bg} ${cat.border}`}>
                              {cat.label}
                            </span>
                            <div className="flex items-center gap-1">
                              <div className={`w-2 h-2 rounded-full ${sev.dot}`}></div>
                              <span className={`text-xs font-medium ${sev.color}`}>{sev.label}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                              👤 {event.driverName}
                            </span>
                            <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                              🚛 {event.vehiclePlate}
                            </span>
                            <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                              🕐 {new Date(event.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                              📍 {event.location}
                            </span>
                            <span className={`text-xs ${event.speedKph > 90 ? 'text-red-600 font-bold' : isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                              ⚡ {event.speedKph} km/h
                            </span>
                            {event.jobName && (
                              <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                💼 {event.jobName}
                              </span>
                            )}
                          </div>
                        </div>
                        {event.scoreImpact < 0 && (
                          <span className="text-sm font-bold text-red-600 shrink-0">
                            {event.scoreImpact} pts
                          </span>
                        )}
                      </div>

                      {/* Review note input */}
                      <textarea
                        placeholder="Add review note (optional)..."
                        rows={2}
                        className={`w-full border rounded-xl px-3 py-2 text-xs outline-none focus:border-purple-500 resize-none mb-3
                          ${isDark ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'}`}
                      />

                      {/* Action buttons */}
                      {/* DEVELOPER NOTE:
                          PATCH /api/fleetpoint/dashcam/events/:id/review
                          Body: { status: 'acknowledged'|'violation'|'false-positive', note }
                          On 'violation': POST /api/fleetpoint/violations (auto-create violation record)
                          On 'acknowledged': PATCH /api/fleetpoint/drivers/:id/score (apply scoreImpact)
                          On 'false-positive': scoreImpact = 0, no score change
                      */}
                      <div className="flex items-center gap-2">
                        <button className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-colors">
                          <CheckCircle size={12} /> Acknowledge
                        </button>
                        <button className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-colors">
                          <Flag size={12} /> Raise Violation
                        </button>
                        <button className={`flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-xl border transition-colors
                          ${isDark ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                          <XCircle size={12} /> False Positive
                        </button>
                        <button className={`flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl border transition-colors ml-auto
                          ${isDark ? 'border-gray-600 text-gray-400 hover:bg-gray-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                          <Play size={12} /> Full Footage
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}

            {unreviewed === 0 && (
              <div className={`rounded-2xl border p-12 text-center ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                <CheckCircle size={32} className="text-green-500 mx-auto mb-3" />
                <p className={`font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>All caught up!</p>
                <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>No unreviewed events in the queue.</p>
              </div>
            )}
          </div>
        )}

        {/* ── ANALYTICS TAB ─────────────────────────────────────────────────── */}
        {activeTab === 'analytics' && (
          <div className="flex flex-col gap-5">

            {/* Top row — category pie + driver bar */}
            <div className="grid grid-cols-3 gap-5">

              {/* Events by category */}
              <div className={`rounded-2xl border p-4 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                <h3 className={`font-bold text-sm mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Events by Category
                </h3>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={categoryData} cx="50%" cy="50%" innerRadius={45} outerRadius={70}
                      paddingAngle={3} dataKey="value">
                      {categoryData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(val, name) => [val, name]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-col gap-1 mt-1">
                  {categoryData.map(item => (
                    <div key={item.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full" style={{ background: item.color }}></div>
                        <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{item.name}</span>
                      </div>
                      <span className={`text-xs font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top drivers by events */}
              <div className={`col-span-2 rounded-2xl border p-4 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                <h3 className={`font-bold text-sm mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Events by Driver
                </h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={driverEventData} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#f3f4f6'} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="events" name="Total Events" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="critical" name="Critical" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Trend chart */}
            <div className={`rounded-2xl border p-4 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
              <h3 className={`font-bold text-sm mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Event Trend — Last 7 Days
              </h3>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={trendData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#f3f4f6'} />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="events" name="Total Events" stroke="#7c3aed" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="critical" name="Critical" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* False positive rate note */}
            <div className={`rounded-2xl p-4 flex items-start gap-3
              ${isDark ? 'bg-blue-900/20 border border-blue-800' : 'bg-blue-50 border border-blue-200'}`}>
              <Bot size={16} className="text-blue-500 mt-0.5 shrink-0" />
              <div>
                <p className={`text-sm font-semibold ${isDark ? 'text-blue-300' : 'text-blue-800'}`}>
                  False Positive Rate: {falsePosRate}%
                </p>
                <p className={`text-xs mt-0.5 ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>
                  BSJ IOT AI cameras occasionally over-trigger (especially Yawn detection and Driver ID events).
                  Review queue helps track and reduce false positives over time.
                  Fleet managers should mark false positives — this data feeds back to improve AI model accuracy.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </FleetpointLayout>
  )
}
