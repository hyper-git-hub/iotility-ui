// src/components/livemap/VehicleTrail.tsx
// Breadcrumb trail for selected vehicle — last 20 mins of positions
// TODO: fetch real positions from GET /api/fleetpoint/vehicles/:id/positions?last=20m
// To add trail for a new vehicle: add entry to vehicleTrails in fleetData.ts

import { Polyline } from 'react-leaflet'
import type { Vehicle } from "../../data/fleetData"
import { vehicleTrails } from '../../data/fleetData'
import { STATUS_COLORS } from './types'

interface Props {
  vehicle: Vehicle
}

export default function VehicleTrail({ vehicle }: Props) {
  const trail = vehicleTrails[vehicle.id]
  if (!trail) return null

  const positions: [number, number][] = [
    ...trail,
    [vehicle.lat, vehicle.lng]
  ]

  return (
    <Polyline
      positions={positions}
      pathOptions={{
        color: STATUS_COLORS[vehicle.status],
        weight: 3,
        opacity: 0.6,
        dashArray: '6 4',
      }}
    />
  )
}
