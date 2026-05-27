// src/components/livemap/VehicleMarker.tsx
// Single vehicle marker with emoji icon + status ring + hover tooltip
// To add a new vehicle type: add entry to vehicleTypeIcons in fleetData.ts
// TODO: animate marker position when new GPS ping received via WebSocket

import { Marker, Tooltip } from 'react-leaflet'
import L from 'leaflet'
import type { Vehicle } from "../../data/fleetData"
import { vehicleTypeIcons } from '../../data/fleetData'
import { STATUS_COLORS, STATUS_LABELS } from './types'

interface Props {
  vehicle: Vehicle
  selected: boolean
  onClick: (vehicle: Vehicle) => void
}

export const createVehicleIcon = (vehicle: Vehicle, selected: boolean) => {
  const emoji = vehicleTypeIcons[vehicle.type] || '🚛'
  const color = STATUS_COLORS[vehicle.status]
  const size = selected ? 44 : 34
  const fontSize = selected ? 22 : 18
  return L.divIcon({
    className: '',
    html: `
      <div style="
        width:${size}px; height:${size}px;
        background:white;
        border:3px solid ${color};
        border-radius:50%;
        display:flex; align-items:center; justify-content:center;
        font-size:${fontSize}px;
        box-shadow:0 2px 8px rgba(0,0,0,0.25), 0 0 0 ${selected ? '4px' : '0px'} ${color}44;
        transition:all 0.2s; cursor:pointer;
      ">${emoji}</div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

export default function VehicleMarker({ vehicle, selected, onClick }: Props) {
  return (
    <Marker
      position={[vehicle.lat, vehicle.lng]}
      icon={createVehicleIcon(vehicle, selected)}
      eventHandlers={{ click: () => onClick(vehicle) }}
    >
      <Tooltip permanent={false} direction="top" offset={[0, -20]}>
        <div style={{ fontSize: 12, minWidth: 140, fontFamily: 'system-ui' }}>
          <div style={{ fontWeight: 700, marginBottom: 2 }}>
            {vehicleTypeIcons[vehicle.type]} {vehicle.plate}
          </div>
          <div style={{ color: '#6b7280', marginBottom: 2 }}>{vehicle.make} {vehicle.model}</div>
          <div style={{ color: '#6b7280', marginBottom: 4 }}>
            {vehicle.driver !== 'Unassigned' ? `👤 ${vehicle.driver}` : '👤 Unassigned'}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ color: STATUS_COLORS[vehicle.status], fontWeight: 600 }}>
              ● {STATUS_LABELS[vehicle.status]}
            </span>
            {vehicle.speed > 0 && <span>{vehicle.speed}mph</span>}
            {vehicle.fuel && <span>⛽ {vehicle.fuel}%</span>}
          </div>
          {vehicle.tempAlert && <div style={{ color: '#ea580c', marginTop: 4 }}>🌡️ {vehicle.temp}°C</div>}
          {vehicle.dashcamAlert && <div style={{ color: '#7c3aed', marginTop: 4 }}>📷 DashCam Event</div>}
          {vehicle.geofenceAlert && <div style={{ color: '#2563eb', marginTop: 4 }}>📍 Geofence Alert</div>}
          <div style={{ color: '#9ca3af', fontSize: 10, marginTop: 4 }}>Click for full details</div>
        </div>
      </Tooltip>
    </Marker>
  )
}
