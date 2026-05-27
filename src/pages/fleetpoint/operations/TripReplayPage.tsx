// src/pages/fleetpoint/operations/TripReplayPage.tsx
// Trip Replay — animated vehicle playback with events, timeline scrubber, dashcam sync
//
// DEVELOPER NOTES:
// ─────────────────────────────────────────────────────────────────────────────
// ANIMATION:
// positions[] array loaded on trip select
// setInterval advances positionIndex based on playback speed
// Speed multipliers: 1x=500ms, 2x=250ms, 3x=166ms, 4x=125ms, 5x=100ms
// Vehicle icon position = positions[positionIndex]
// Timeline scrubber = positionIndex / positions.length * 100
//
// IN PRODUCTION:
// GET /api/fleetpoint/trips/:id/positions → 500-1000+ GPS points
// Frontend animates through them — no backend involvement during playback
// All data fetched upfront, no streaming needed
//
// DASHCAM FOOTAGE SYNC:
// When playback reaches an event positionIndex → show event highlight
// Click event marker OR event in list → jump to that positionIndex
// Video file path: /videos/dashcam/events/{eventId}_{camera}.mp4
// Upload files to public/videos/dashcam/events/ to activate
//
// VEHICLE ICON HEADING:
// heading field in TripPosition rotates the vehicle icon
// TODO: use CSS transform rotate(${heading}deg) on marker
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from 'react'
import { MapContainer, TileLayer, Polyline, CircleMarker, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  Play, Pause, Square, SkipBack, ChevronRight,
  ChevronLeft, Clock, Navigation, AlertTriangle,
  Camera, MapPin, Fuel, Activity, User, Truck,
  Download, Search, X, CheckCircle, Video
} from 'lucide-react'
import FleetpointLayout from '../../../layouts/FleetpointLayout'
import { trips, vehicles, drivers } from '../../../data/fleetData'
import { useTheme } from '../../../hooks/useTheme'
import type { Trip, TripEvent, TripPosition } from '../../../data/fleetData'

// ── Playback speeds ───────────────────────────────────────────────────────────
const SPEEDS = [1, 2, 3, 4, 5]
const SPEED_INTERVAL: Record<number, number> = { 1: 500, 2: 250, 3: 166, 4: 125, 5: 100 }

// ── Event marker colors ───────────────────────────────────────────────────────
const EVENT_COLORS: Record<string, string> = {
  'violation': '#ef4444',
  'dashcam': '#f59e0b',
}

const SEVERITY_COLORS = {
  critical: '#ef4444',
  warning: '#f59e0b',
  info: '#3b82f6',
}

const STOP_REASON_ICONS: Record<string, string> = {
  delivery: '📦', fuel: '⛽', rest: '☕', traffic: '🚦', unknown: '🅿️'
}

// ── Map auto-pan component ────────────────────────────────────────────────────
function MapPanner({ position }: { position: [number, number] | null }) {
  const map = useMap()
  useEffect(() => {
    if (position) map.panTo(position, { animate: true, duration: 0.3 })
  }, [position, map])
  return null
}

// ── Format helpers ────────────────────────────────────────────────────────────
const fmtDuration = (mins: number) => `${Math.floor(mins / 60)}h ${mins % 60}m`
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

export default function TripReplayPage() {
  const { isDark } = useTheme()

  // ── Trip selection ────────────────────────────────────────────────────────
  const [selectedTripId, setSelectedTripId] = useState<string>(trips[0].id)
  const [searchVehicle, setSearchVehicle] = useState('')
  const selectedTrip = trips.find(t => t.id === selectedTripId) || trips[0]

  // ── Playback state ────────────────────────────────────────────────────────
  const [isPlaying, setIsPlaying] = useState(false)
  const [positionIndex, setPositionIndex] = useState(0)
  const [speed, setSpeed] = useState(1)
  const [activeTab, setActiveTab] = useState<'report' | 'history' | 'statistics' | 'stops' | 'events'>('events')
  const [selectedEvent, setSelectedEvent] = useState<TripEvent | null>(null)
  const [activeCamera, setActiveCamera] = useState<'front' | 'cabin' | 'rear' | 'side'>('front')

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const positions = selectedTrip.positions

  // ── Playback controls ─────────────────────────────────────────────────────
  const stopPlayback = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = null
    setIsPlaying(false)
  }, [])

  const startPlayback = useCallback(() => {
    if (positionIndex >= positions.length - 1) setPositionIndex(0)
    setIsPlaying(true)
    intervalRef.current = setInterval(() => {
      setPositionIndex(prev => {
        if (prev >= positions.length - 1) {
          stopPlayback()
          return prev
        }
        return prev + 1
      })
    }, SPEED_INTERVAL[speed])
  }, [positionIndex, positions.length, speed, stopPlayback])

  // Restart interval when speed changes
  useEffect(() => {
    if (isPlaying) {
      if (intervalRef.current) clearInterval(intervalRef.current)
      intervalRef.current = setInterval(() => {
        setPositionIndex(prev => {
          if (prev >= positions.length - 1) { stopPlayback(); return prev }
          return prev + 1
        })
      }, SPEED_INTERVAL[speed])
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [speed, isPlaying, positions.length, stopPlayback])

  // Cleanup on unmount
  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current) }, [])

  // Reset when trip changes
  useEffect(() => {
    stopPlayback()
    setPositionIndex(0)
    setSelectedEvent(null)
  }, [selectedTripId, stopPlayback])

  const currentPosition = positions[positionIndex]
  const progress = positions.length > 1 ? (positionIndex / (positions.length - 1)) * 100 : 0

  // Check if current position has an event
  const currentEvent = selectedTrip.events.find(e => e.positionIndex === positionIndex)

  // Jump to event
  const jumpToEvent = (event: TripEvent) => {
    stopPlayback()
    setPositionIndex(event.positionIndex)
    setSelectedEvent(event)
  }

  // Trail up to current position
  const trailPositions = positions.slice(0, positionIndex + 1).map(p => [p.lat, p.lng] as [number, number])
  const remainingPositions = positions.slice(positionIndex).map(p => [p.lat, p.lng] as [number, number])
  const fullTrail = positions.map(p => [p.lat, p.lng] as [number, number])

  const filteredTrips = trips.filter(t => {
    const s = searchVehicle.toLowerCase()
    return !searchVehicle || t.vehiclePlate.toLowerCase().includes(s) || t.driverName.toLowerCase().includes(s)
  })

  return (
    <FleetpointLayout>
      <div className={`flex flex-col h-full min-h-screen ${isDark ? 'bg-gray-950' : 'bg-gray-50'}`}>

        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b shrink-0
          ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div>
            <h1 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Trip Replay</h1>
            <p className={`text-sm mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              Animated trip playback with events, violations and dashcam footage
            </p>
          </div>
          <button className={`flex items-center gap-2 text-sm px-3 py-2 rounded-xl border transition-colors
            ${isDark ? 'border-gray-700 text-gray-300 hover:bg-gray-800' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            <Download size={15} /> Export Report
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden" style={{ height: 'calc(100vh - 140px)' }}>

          {/* Left — Trip selector */}
          <div className={`w-56 shrink-0 border-r flex flex-col overflow-hidden
            ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'}`}>
            <div className={`p-3 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
              <div className={`flex items-center gap-2 border rounded-xl px-3 py-2
                ${isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'}`}>
                <Search size={12} className="text-gray-400 shrink-0" />
                <input type="text" placeholder="Search vehicle or driver..."
                  value={searchVehicle} onChange={e => setSearchVehicle(e.target.value)}
                  className={`flex-1 text-xs outline-none bg-transparent
                    ${isDark ? 'text-white placeholder-gray-500' : 'text-gray-900 placeholder-gray-400'}`} />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {filteredTrips.map(trip => {
                const isSelected = trip.id === selectedTripId
                return (
                  <button key={trip.id}
                    onClick={() => setSelectedTripId(trip.id)}
                    className={`w-full px-3 py-3 text-left border-b transition-colors
                      ${isDark ? 'border-gray-800' : 'border-gray-50'}
                      ${isSelected ? 'bg-purple-600' : `${isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-50'}`}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                        {trip.driverAvatar}
                      </div>
                      <span className={`text-xs font-semibold truncate ${isSelected ? 'text-white' : isDark ? 'text-white' : 'text-gray-900'}`}>
                        {trip.vehiclePlate}
                      </span>
                    </div>
                    <p className={`text-xs truncate ${isSelected ? 'text-purple-200' : isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      {trip.driverName.split(' ')[0]}
                    </p>
                    <div className="flex items-center justify-between mt-1">
                      <span className={`text-xs ${isSelected ? 'text-purple-200' : isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        {fmtDate(trip.startTime)}
                      </span>
                      <span className={`text-xs font-bold ${isSelected ? 'text-white' : trip.tripScore >= 90 ? 'text-green-600' : trip.tripScore >= 75 ? 'text-amber-600' : 'text-red-600'}`}>
                        {trip.tripScore}
                      </span>
                    </div>
                    {trip.events.length > 0 && (
                      <span className={`text-xs ${isSelected ? 'text-red-300' : 'text-red-500'} font-medium`}>
                        ⚠️ {trip.events.length} event{trip.events.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Center — Map + controls */}
          <div className="flex-1 flex flex-col overflow-hidden">

            {/* Map */}
            <div className="flex-1 relative">
              <MapContainer
                center={[positions[0].lat, positions[0].lng]}
                zoom={9}
                style={{ height: '100%', width: '100%' }}
                zoomControl={false}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {/* Full route — faded */}
                <Polyline positions={fullTrail}
                  pathOptions={{ color: isDark ? '#4b5563' : '#d1d5db', weight: 3, opacity: 0.5, dashArray: '6 4' }} />

                {/* Completed trail — solid */}
                {trailPositions.length > 1 && (
                  <Polyline positions={trailPositions}
                    pathOptions={{ color: '#7c3aed', weight: 4, opacity: 0.9 }} />
                )}

                {/* Start marker */}
                <CircleMarker center={[positions[0].lat, positions[0].lng]} radius={8}
                  pathOptions={{ color: '#22c55e', fillColor: '#22c55e', fillOpacity: 1, weight: 2 }}>
                  <Popup><div style={{ fontSize: 11 }}><b>Start</b><br />{selectedTrip.startAddress}<br />{fmtTime(selectedTrip.startTime)}</div></Popup>
                </CircleMarker>

                {/* End marker */}
                <CircleMarker center={[positions[positions.length - 1].lat, positions[positions.length - 1].lng]} radius={8}
                  pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 1, weight: 2 }}>
                  <Popup><div style={{ fontSize: 11 }}><b>End</b><br />{selectedTrip.endAddress}<br />{fmtTime(selectedTrip.endTime)}</div></Popup>
                </CircleMarker>

                {/* Event markers */}
                {selectedTrip.events.map(event => (
                  <CircleMarker key={event.id}
                    center={[event.lat, event.lng]}
                    radius={selectedEvent?.id === event.id ? 10 : 7}
                    pathOptions={{
                      color: SEVERITY_COLORS[event.severity],
                      fillColor: EVENT_COLORS[event.type],
                      fillOpacity: 0.9,
                      weight: selectedEvent?.id === event.id ? 3 : 2,
                    }}
                    eventHandlers={{ click: () => jumpToEvent(event) }}>
                    <Popup>
                      <div style={{ fontSize: 11, minWidth: 160 }}>
                        <p style={{ fontWeight: 700, marginBottom: 4 }}>{event.eventType}</p>
                        <p style={{ color: '#6b7280', marginBottom: 2 }}>🕐 {fmtTime(event.timestamp)}</p>
                        <p style={{ color: '#6b7280', marginBottom: 4 }}>⚡ {event.speedKph} km/h</p>
                        <p style={{ fontSize: 10 }}>{event.description}</p>
                        {event.videoFile && (
                          <p style={{ color: '#7c3aed', marginTop: 4, fontWeight: 600 }}>📷 Footage available</p>
                        )}
                      </div>
                    </Popup>
                  </CircleMarker>
                ))}

                {/* Stop markers */}
                {selectedTrip.stops.map((stop, i) => (
                  <CircleMarker key={i}
                    center={[stop.lat, stop.lng]}
                    radius={6}
                    pathOptions={{ color: '#6b7280', fillColor: '#f3f4f6', fillOpacity: 0.9, weight: 2 }}>
                    <Popup>
                      <div style={{ fontSize: 11 }}>
                        <p style={{ fontWeight: 700 }}>{STOP_REASON_ICONS[stop.reason]} {stop.reason}</p>
                        <p style={{ color: '#6b7280' }}>{stop.address}</p>
                        <p>Dwell: {stop.dwellMinutes} min</p>
                      </div>
                    </Popup>
                  </CircleMarker>
                ))}

                {/* Current vehicle position */}
                <CircleMarker
                  center={[currentPosition.lat, currentPosition.lng]}
                  radius={12}
                  pathOptions={{ color: '#7c3aed', fillColor: '#7c3aed', fillOpacity: 1, weight: 3 }}>
                  <Popup>
                    <div style={{ fontSize: 11 }}>
                      <p style={{ fontWeight: 700 }}>{selectedTrip.vehiclePlate}</p>
                      <p>{currentPosition.speedKph} km/h</p>
                      <p>{fmtTime(currentPosition.timestamp)}</p>
                    </div>
                  </Popup>
                </CircleMarker>

                <MapPanner position={[currentPosition.lat, currentPosition.lng]} />
              </MapContainer>

              {/* Map overlay — current speed + time */}
              <div className={`absolute top-3 left-3 z-[1000] rounded-xl px-3 py-2 shadow-lg
                ${isDark ? 'bg-gray-900/90 text-white' : 'bg-white/90 text-gray-900'}`}>
                <div className="flex items-center gap-3">
                  <div className="text-center">
                    <p className="text-lg font-black text-purple-600">{currentPosition.speedKph}</p>
                    <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>km/h</p>
                  </div>
                  <div className={`w-px h-8 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}></div>
                  <div className="text-center">
                    <p className="text-sm font-bold">{fmtTime(currentPosition.timestamp)}</p>
                    <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{fmtDate(selectedTrip.startTime)}</p>
                  </div>
                </div>
              </div>

              {/* Event alert overlay */}
              {currentEvent && (
                <div className={`absolute top-3 right-3 z-[1000] rounded-xl px-4 py-3 shadow-lg border-l-4 border-l-red-500
                  ${isDark ? 'bg-gray-900/95 text-white' : 'bg-white/95 text-gray-900'}`}>
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={16} className="text-red-500 shrink-0" />
                    <div>
                      <p className="text-xs font-bold">{currentEvent.eventType}</p>
                      <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{currentEvent.description}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Legend */}
              <div className={`absolute bottom-3 left-3 z-[1000] rounded-xl px-3 py-2 shadow-lg
                ${isDark ? 'bg-gray-900/90' : 'bg-white/90'}`}>
                <div className="flex items-center gap-3">
                  {[
                    { color: '#7c3aed', label: 'Travelled' },
                    { color: '#22c55e', label: 'Start' },
                    { color: '#ef4444', label: 'End' },
                    { color: '#ef4444', label: 'Violation', square: true },
                    { color: '#f59e0b', label: 'DashCam', square: true },
                    { color: '#6b7280', label: 'Stop', square: true },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-1">
                      {item.square
                        ? <div className="w-2.5 h-2.5 rounded-sm" style={{ background: item.color }}></div>
                        : <div className="w-2.5 h-2.5 rounded-full" style={{ background: item.color }}></div>
                      }
                      <span className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Playback controls */}
            <div className={`shrink-0 border-t px-4 py-3 ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'}`}>
              {/* Timeline scrubber */}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {fmtTime(currentPosition.timestamp)}
                  </span>
                  <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {fmtTime(positions[positions.length - 1].timestamp)}
                  </span>
                </div>
                <div className={`relative h-2 rounded-full cursor-pointer ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}
                  onClick={e => {
                    const rect = e.currentTarget.getBoundingClientRect()
                    const pct = (e.clientX - rect.left) / rect.width
                    const idx = Math.round(pct * (positions.length - 1))
                    stopPlayback()
                    setPositionIndex(Math.max(0, Math.min(idx, positions.length - 1)))
                  }}>
                  <div className="h-full rounded-full bg-purple-600 transition-all"
                    style={{ width: `${progress}%` }} />
                  {/* Event markers on scrubber */}
                  {selectedTrip.events.map(event => (
                    <div key={event.id}
                      className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full cursor-pointer hover:scale-150 transition-transform"
                      style={{
                        left: `${(event.positionIndex / (positions.length - 1)) * 100}%`,
                        background: SEVERITY_COLORS[event.severity],
                      }}
                      onClick={e => { e.stopPropagation(); jumpToEvent(event) }}
                      title={event.eventType}
                    />
                  ))}
                  {/* Scrubber handle */}
                  <div className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-purple-600 border-2 border-white shadow-md"
                    style={{ left: `calc(${progress}% - 8px)` }} />
                </div>
              </div>

              {/* Controls row */}
              <div className="flex items-center gap-4">
                {/* Transport controls */}
                <div className="flex items-center gap-1">
                  <button onClick={() => { stopPlayback(); setPositionIndex(0) }}
                    className={`p-2 rounded-xl transition-colors ${isDark ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
                    <SkipBack size={16} />
                  </button>
                  <button onClick={isPlaying ? stopPlayback : startPlayback}
                    className="p-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white transition-colors">
                    {isPlaying ? <Pause size={18} /> : <Play size={18} />}
                  </button>
                  <button onClick={() => { stopPlayback(); setPositionIndex(0) }}
                    className={`p-2 rounded-xl transition-colors ${isDark ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
                    <Square size={16} />
                  </button>
                </div>

                {/* Speed */}
                <div className={`flex rounded-xl border overflow-hidden ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                  {SPEEDS.map(s => (
                    <button key={s} onClick={() => setSpeed(s)}
                      className={`px-2.5 py-1.5 text-xs font-bold transition-colors
                        ${speed === s ? 'bg-purple-600 text-white' : `${isDark ? 'bg-gray-800 text-gray-400 hover:bg-gray-700' : 'bg-white text-gray-500 hover:bg-gray-50'}`}`}>
                      {s}x
                    </button>
                  ))}
                </div>

                {/* Progress info */}
                <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  {positionIndex + 1} / {positions.length} points · {Math.round(progress)}%
                </span>

                {/* Trip score */}
                <div className="ml-auto flex items-center gap-3">
                  {selectedTrip.events.length > 0 && (
                    <span className="text-xs text-amber-600 font-medium">
                      ⚠️ {selectedTrip.events.length} events — click markers to jump
                    </span>
                  )}
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}>
                    <Activity size={14} className="text-purple-500" />
                    <span className={`text-xs font-bold ${selectedTrip.tripScore >= 90 ? 'text-green-600' : selectedTrip.tripScore >= 75 ? 'text-amber-600' : 'text-red-600'}`}>
                      Trip Score: {selectedTrip.tripScore}/100
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right — Trip info panel */}
          <div className={`w-72 shrink-0 border-l flex flex-col overflow-hidden
            ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'}`}>

            {/* Trip summary */}
            <div className={`p-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-sm font-bold">
                  {selectedTrip.driverAvatar}
                </div>
                <div>
                  <p className={`font-bold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>{selectedTrip.driverName}</p>
                  <p className={`text-xs ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>{selectedTrip.vehiclePlate} · {selectedTrip.vehicleMake}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Distance', value: `${selectedTrip.distanceMiles} mi`, icon: Navigation },
                  { label: 'Duration', value: fmtDuration(selectedTrip.durationMinutes), icon: Clock },
                  { label: 'Max Speed', value: `${selectedTrip.maxSpeedKph}kph`, icon: Activity },
                  { label: 'Avg Speed', value: `${selectedTrip.avgSpeedKph}kph`, icon: Activity },
                  { label: 'Idle Time', value: `${selectedTrip.idleMinutes}m`, icon: Clock },
                  { label: 'Fuel Used', value: `${selectedTrip.fuelUsedLitres}L`, icon: Fuel },
                ].map(stat => (
                  <div key={stat.label} className={`rounded-xl p-2 ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}>
                    <p className={`text-xs font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{stat.value}</p>
                    <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{stat.label}</p>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 mt-2">
                <div className="flex-1 flex flex-col gap-1">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <span className={`text-xs truncate ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      {selectedTrip.startAddress.split(',')[0]}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-red-500"></div>
                    <span className={`text-xs truncate ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      {selectedTrip.endAddress.split(',')[0]}
                    </span>
                  </div>
                </div>
              </div>

              {selectedTrip.jobName && (
                <div className={`mt-2 px-2 py-1.5 rounded-lg text-xs ${isDark ? 'bg-purple-900/30 text-purple-300' : 'bg-purple-50 text-purple-700'}`}>
                  💼 {selectedTrip.jobName}
                </div>
              )}
            </div>

            {/* Tabs */}
            <div className={`flex border-b overflow-x-auto ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
              {[
                { id: 'events', label: 'Events', count: selectedTrip.events.length },
                { id: 'stops', label: 'Stops', count: selectedTrip.stops.length },
                { id: 'statistics', label: 'Stats' },
              ].map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
                  className={`flex-1 px-2 py-2.5 text-xs font-medium border-b-2 transition-all whitespace-nowrap
                    ${activeTab === tab.id
                      ? 'border-purple-600 text-purple-600'
                      : `border-transparent ${isDark ? 'text-gray-400' : 'text-gray-500'}`}`}>
                  {tab.label}
                  {tab.count !== undefined && tab.count > 0 && (
                    <span className={`ml-1 text-xs font-bold px-1 py-0.5 rounded-full
                      ${activeTab === tab.id ? 'bg-purple-100 text-purple-700' : `${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-500'}`}`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto">

              {/* Events tab */}
              {activeTab === 'events' && (
                <div className="flex flex-col">
                  {selectedTrip.events.length === 0 ? (
                    <div className="p-6 text-center">
                      <CheckCircle size={24} className="text-green-500 mx-auto mb-2" />
                      <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>Clean trip!</p>
                      <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>No events recorded</p>
                    </div>
                  ) : (
                    selectedTrip.events.map(event => {
                      const isActive = selectedEvent?.id === event.id || currentEvent?.id === event.id
                      return (
                        <div key={event.id}
                          onClick={() => jumpToEvent(event)}
                          className={`px-4 py-3 border-b cursor-pointer transition-colors
                            ${isDark ? 'border-gray-800 hover:bg-gray-800' : 'border-gray-50 hover:bg-gray-50'}
                            ${isActive ? (isDark ? 'bg-purple-900/20 border-l-2 border-l-purple-500' : 'bg-purple-50 border-l-2 border-l-purple-500') : ''}`}>
                          <div className="flex items-start gap-2">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5
                              ${event.type === 'violation' ? 'bg-red-50' : 'bg-amber-50'}`}>
                              {event.type === 'dashcam' ? <Camera size={12} className="text-amber-500" /> : <AlertTriangle size={12} className="text-red-500" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-xs font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{event.eventType}</p>
                              <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{fmtTime(event.timestamp)} · {event.speedKph}kph</p>
                              {event.scoreImpact < 0 && (
                                <p className="text-xs text-red-600 font-bold">{event.scoreImpact} pts</p>
                              )}
                            </div>
                          </div>

                          {/* DashCam footage */}
                          {event.videoFile && isActive && (
                            <div className="mt-2">
                              <p className={`text-xs font-semibold mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                Footage — {event.dashcamEventId}
                              </p>
                              {/* Camera selector */}
                              <div className="flex gap-1 mb-1.5">
                                {(['front', 'cabin', 'rear', 'side'] as const).map(cam => (
                                  <button key={cam} onClick={e => { e.stopPropagation(); setActiveCamera(cam) }}
                                    className={`text-xs px-1.5 py-0.5 rounded font-medium transition-colors
                                      ${activeCamera === cam ? 'bg-purple-600 text-white' : `${isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-500'}`}`}>
                                    {cam}
                                  </button>
                                ))}
                              </div>
                              {/* Video tile */}
                              {/* DEVELOPER NOTE:
                                  fileUrl = /videos/dashcam/events/{eventId}_{camera}.mp4
                                  Upload video files to public/videos/dashcam/events/
                                  to activate playback in demo
                              */}
                              <div className="bg-gray-900 rounded-lg aspect-video flex items-center justify-center relative overflow-hidden">
                                <video
                                  src={event.videoFile.replace('_front', `_${activeCamera}`)}
                                  className="w-full h-full object-cover"
                                  autoPlay muted loop playsInline
                                  onError={() => {}}
                                />
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                  <Video size={20} className="text-gray-600 mb-1" />
                                  <p className="text-gray-600 text-xs text-center font-medium">{event.dashcamEventId}_{activeCamera}.mp4</p>
                                  <p className="text-gray-700 text-xs text-center mt-0.5">Upload to activate</p>
                                </div>
                              </div>
                            </div>
                          )}

                          {!isActive && event.videoFile && (
                            <p className={`text-xs mt-1 ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>
                              📷 Click to view footage
                            </p>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
              )}

              {/* Stops tab */}
              {activeTab === 'stops' && (
                <div className="flex flex-col">
                  {selectedTrip.stops.map((stop, i) => (
                    <div key={i} className={`px-4 py-3 border-b ${isDark ? 'border-gray-800' : 'border-gray-50'}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-base">{STOP_REASON_ICONS[stop.reason]}</span>
                        <span className={`text-xs font-semibold capitalize ${isDark ? 'text-white' : 'text-gray-900'}`}>{stop.reason}</span>
                        <span className={`text-xs font-bold ml-auto ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{stop.dwellMinutes}min</span>
                      </div>
                      <p className={`text-xs truncate ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{stop.address}</p>
                      <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        {fmtTime(stop.arrivalTime)} → {fmtTime(stop.departureTime)}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Statistics tab */}
              {activeTab === 'statistics' && (
                <div className="p-4 flex flex-col gap-3">
                  {[
                    { label: 'Total Distance', value: `${selectedTrip.distanceMiles} miles` },
                    { label: 'Total Duration', value: fmtDuration(selectedTrip.durationMinutes) },
                    { label: 'Moving Time', value: fmtDuration(selectedTrip.movingMinutes) },
                    { label: 'Idle Time', value: `${selectedTrip.idleMinutes} min` },
                    { label: 'Max Speed', value: `${selectedTrip.maxSpeedKph} km/h` },
                    { label: 'Avg Speed', value: `${selectedTrip.avgSpeedKph} km/h` },
                    { label: 'Fuel Used', value: `${selectedTrip.fuelUsedLitres} L` },
                    { label: 'Harsh Braking', value: selectedTrip.harshBrakingCount },
                    { label: 'Harsh Accel.', value: selectedTrip.harshAccelerationCount },
                    { label: 'Speeding Events', value: selectedTrip.speedingCount },
                    { label: 'Trip Score', value: `${selectedTrip.tripScore}/100` },
                    { label: 'Fleet', value: selectedTrip.fleetName },
                  ].map(stat => (
                    <div key={stat.label} className="flex items-center justify-between">
                      <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{stat.label}</span>
                      <span className={`text-xs font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{stat.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </FleetpointLayout>
  )
}
