// src/components/livemap/FlyToVehicle.tsx
// Flies the map to a selected vehicle
// Used inside MapContainer so it can access the Leaflet map instance

import { useEffect } from 'react'
import { useMap } from 'react-leaflet'
import type { Vehicle } from "../../data/fleetData"

interface Props {
  vehicle: Vehicle | null
}

export default function FlyToVehicle({ vehicle }: Props) {
  const map = useMap()
  useEffect(() => {
    if (vehicle) {
      map.flyTo([vehicle.lat, vehicle.lng], 14, { duration: 1.2 })
    }
  }, [vehicle, map])
  return null
}
