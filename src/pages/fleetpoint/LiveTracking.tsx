// src/pages/fleetpoint/LiveTracking.tsx
// Live tracking orchestrator — thin wrapper, all logic in /components/livemap/
// To add a new map feature: create component in /components/livemap/ and add here

import { useState, useEffect } from 'react'
import { MapContainer, TileLayer } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import FleetpointLayout from '../../layouts/FleetpointLayout'
import { vehicles, drivers, alerts } from '../../data/fleetData'
import type { Vehicle } from '../../data/fleetData'
import { useTheme } from '../../hooks/useTheme'
import type { ViewMode, FilterStatus } from '../../components/livemap/types'

import VehicleMarker from '../../components/livemap/VehicleMarker'
import VehicleTrail from '../../components/livemap/VehicleTrail'
import FlyToVehicle from '../../components/livemap/FlyToVehicle'
import VehiclePanel from '../../components/livemap/VehiclePanel'
import VehicleListPanel from '../../components/livemap/VehicleListPanel'
import MapControls from '../../components/livemap/MapControls'
import MapLegend from '../../components/livemap/MapLegend'
import SearchOverlay from '../../components/livemap/SearchOverlay'
import FleetFilter from '../../components/livemap/FleetFilter'

export default function LiveTracking() {
  const { isDark } = useTheme()
  const [viewMode, setViewMode] = useState<ViewMode>('vehicles')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [selectedFleetId, setSelectedFleetId] = useState('all')
  const [search, setSearch] = useState('')
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [fullscreen, setFullscreen] = useState(false)

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFullscreen(false) }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  const filteredVehicles = vehicles.filter(v => {
    const matchesFleet = selectedFleetId === 'all' || v.fleetId === selectedFleetId
    const matchesStatus = filterStatus === 'all' || v.status === filterStatus
    const matchesSearch = search === '' ||
      v.plate.toLowerCase().includes(search.toLowerCase()) ||
      v.driver.toLowerCase().includes(search.toLowerCase()) ||
      v.location.toLowerCase().includes(search.toLowerCase()) ||
      v.make.toLowerCase().includes(search.toLowerCase()) ||
      v.type.toLowerCase().includes(search.toLowerCase())
    return matchesFleet && matchesStatus && matchesSearch
  })

  const filteredDrivers = drivers.filter(d => {
    const matchesFleet = selectedFleetId === 'all' || d.fleetId === selectedFleetId
    const matchesSearch = search === '' ||
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.role.toLowerCase().includes(search.toLowerCase())
    return matchesFleet && matchesSearch
  })

  const handleDriverClick = (driverId: string) => {
    const driverVehicle = vehicles.find(v => v.driverId === driverId)
    if (driverVehicle) setSelectedVehicle(selectedVehicle?.id === driverVehicle.id ? null : driverVehicle)
  }

  const selectedDriver = selectedVehicle ? drivers.find(d => d.id === selectedVehicle.driverId) : undefined
  const vehicleAlerts = selectedVehicle ? alerts.filter(a => a.vehicleId === selectedVehicle.id) : []

  return (
    <FleetpointLayout fullscreen={fullscreen}>
      <div className="flex h-full overflow-hidden">

        {/* Left panel — hidden in fullscreen */}
        {!fullscreen && (
          <div className="flex flex-col w-72 shrink-0">
            <FleetFilter
              selectedFleetId={selectedFleetId}
              onFleetChange={(id) => {
                setSelectedFleetId(id)
                setSelectedVehicle(null)
              }}
              isDark={isDark}
            />
            <VehicleListPanel
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              search={search}
              onSearchChange={setSearch}
              filterStatus={filterStatus}
              onFilterChange={setFilterStatus}
              filteredVehicles={filteredVehicles}
              filteredDrivers={filteredDrivers}
              selectedVehicle={selectedVehicle}
              onSelectVehicle={setSelectedVehicle}
              onSelectDriver={handleDriverClick}
              currentTime={currentTime}
              isDark={isDark}
            />
          </div>
        )}

        {/* Map */}
        <div className="flex-1 relative">
          <MapContainer center={[52.5, -1.5]} zoom={6} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <FlyToVehicle vehicle={selectedVehicle} />
            {selectedVehicle && <VehicleTrail vehicle={selectedVehicle} />}
            {filteredVehicles.map(v => (
              <VehicleMarker
                key={v.id}
                vehicle={v}
                selected={selectedVehicle?.id === v.id}
                onClick={v => setSelectedVehicle(selectedVehicle?.id === v.id ? null : v)}
              />
            ))}
            {/* TODO: add RouteInspector, GeofenceLayer, ClusterView here */}
          </MapContainer>

          <MapLegend isDark={isDark} />
          <MapControls
            fullscreen={fullscreen}
            onToggleFullscreen={() => setFullscreen(!fullscreen)}
            vehicleCount={filteredVehicles.length}
            currentTime={currentTime}
            isDark={isDark}
          />

          {fullscreen && (
            <SearchOverlay
              search={search}
              onSearchChange={setSearch}
              filterStatus={filterStatus}
              onFilterChange={setFilterStatus}
              filteredVehicles={filteredVehicles}
              onSelectVehicle={v => { setSelectedVehicle(v); setSearch('') }}
              isDark={isDark}
              totalVehicles={vehicles.length}
            />
          )}
        </div>

        {/* Right panel — hidden in fullscreen */}
        {selectedVehicle && !fullscreen && (
          <VehiclePanel
            vehicle={selectedVehicle}
            driver={selectedDriver}
            alerts={vehicleAlerts}
            isDark={isDark}
            onClose={() => setSelectedVehicle(null)}
          />
        )}

      </div>
    </FleetpointLayout>
  )
}
