// src/components/livemap/VehiclePanel.tsx
// Right side panel — selected vehicle full details
// Shows live data, alerts, dashcam, driver info, quick actions
// To add new data section: add a new block inside the flex col below
// TODO: wire quick actions to real routes/APIs

import { useNavigate } from 'react-router-dom'
import { X, AlertTriangle, Navigation, Fuel, MapPin, Clock, Thermometer, Camera, Users, ChevronRight, Phone } from 'lucide-react'
import type { Vehicle, Driver, Alert } from "../../data/fleetData"
import { vehicleTypeIcons } from '../../data/fleetData'
import { STATUS_COLORS, STATUS_LABELS } from './types'

interface Props {
  vehicle: Vehicle
  driver: Driver | undefined
  alerts: Alert[]
  isDark: boolean
  onClose: () => void
}

export default function VehiclePanel({ vehicle, driver, alerts, isDark, onClose }: Props) {
  const navigate = useNavigate()

  return (
    <div className={`w-80 shrink-0 border-l overflow-y-auto flex flex-col
      ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'}`}>

      {/* Header */}
      <div className={`px-4 py-3 border-b shrink-0 flex items-center justify-between
        ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
        <div className="flex items-center gap-2">
          <span className="text-2xl">{vehicleTypeIcons[vehicle.type]}</span>
          <div>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{vehicle.plate}</span>
              <span className="text-xs font-medium px-1.5 py-0.5 rounded-full"
                style={{ background: STATUS_COLORS[vehicle.status] + '22', color: STATUS_COLORS[vehicle.status] }}>
                {STATUS_LABELS[vehicle.status]}
              </span>
            </div>
            <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{vehicle.make} {vehicle.model}</p>
          </div>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">

        {/* Active alerts */}
        {alerts.length > 0 && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3">
            <p className="text-xs font-bold text-red-700 dark:text-red-400 mb-2 flex items-center gap-1">
              <AlertTriangle size={12} /> {alerts.length} Active Alert{alerts.length > 1 ? 's' : ''}
            </p>
            {alerts.map(alert => (
              <p key={alert.id} className="text-xs text-red-600 dark:text-red-400 mt-1">{alert.message}</p>
            ))}
          </div>
        )}

        {/* Live data */}
        <div>
          <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            Live Data
          </p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { icon: Navigation, label: 'Speed', value: `${vehicle.speed} mph`, color: vehicle.speed > 70 ? 'text-red-600' : 'text-green-600' },
              { icon: Fuel, label: 'Fuel', value: `${vehicle.fuel}%`, color: vehicle.fuel < 20 ? 'text-red-600' : 'text-green-600' },
              { icon: MapPin, label: 'Status', value: STATUS_LABELS[vehicle.status], color: '' },
              { icon: Clock, label: 'Updated', value: vehicle.lastUpdate, color: '' },
              ...(vehicle.temp !== undefined ? [{
                icon: Thermometer,
                label: 'Cabin Temp',
                value: `${vehicle.temp}°C`,
                color: vehicle.tempAlert ? 'text-red-600' : 'text-green-600'
              }] : []),
            ].map((stat, i) => (
              <div key={i} className={`rounded-xl p-2.5 ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}>
                <div className="flex items-center gap-1.5 mb-1">
                  <stat.icon size={12} className="text-gray-400" />
                  <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{stat.label}</span>
                </div>
                <p className={`text-sm font-bold ${stat.color || (isDark ? 'text-white' : 'text-gray-900')}`}>{stat.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Location */}
        <div>
          <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Location</p>
          <div className={`rounded-xl p-3 flex items-start gap-2 ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}>
            <MapPin size={14} className="text-purple-500 mt-0.5 shrink-0" />
            <p className={`text-xs leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{vehicle.location}</p>
          </div>
        </div>

        {/* DashCam
            DEVELOPER NOTE: drop video at /public/dashcam/{vehicleId}.mp4
            e.g. /public/dashcam/V011.mp4 for LP-2201
            TODO: replace with live stream GET /api/fleetpoint/dashcam/:vehicleId/stream
        */}
        <div>
          <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>DashCam</p>
          {vehicle.dashcamAlert ? (
            <div className="rounded-xl overflow-hidden border border-orange-200 dark:border-orange-800">
              <div className="bg-orange-50 dark:bg-orange-900/20 px-3 py-1.5 flex items-center gap-1.5">
                <Camera size={12} className="text-orange-600" />
                <span className="text-xs font-medium text-orange-700 dark:text-orange-400">Event Recorded · Harsh Braking</span>
              </div>
              <video className="w-full" controls
                onError={(e) => {
                  const t = e.currentTarget; t.style.display = 'none'
                  const f = t.nextElementSibling as HTMLElement
                  if (f) f.style.display = 'flex'
                }}>
                <source src={`/dashcam/${vehicle.id}.mp4`} type="video/mp4" />
              </video>
              <div style={{ display: 'none' }} className={`p-4 flex-col items-center gap-1 ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}>
                <Camera size={20} className="text-gray-400" />
                <p className="text-xs text-gray-500 text-center">Add /public/dashcam/{vehicle.id}.mp4</p>
              </div>
            </div>
          ) : (
            <div className={`rounded-xl border-2 border-dashed p-4 flex flex-col items-center gap-1 ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
              <Camera size={20} className="text-gray-400" />
              <p className={`text-xs text-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>No recent events</p>
              <p className={`text-xs text-center ${isDark ? 'text-gray-600' : 'text-gray-300'}`}>Add /public/dashcam/{vehicle.id}.mp4</p>
            </div>
          )}
        </div>

        {/* Driver */}
        {driver && (
          <div>
            <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Driver</p>
            <div className={`rounded-xl p-3 ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-sm font-bold shrink-0">
                  {driver.avatar}
                </div>
                <div>
                  <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{driver.name}</p>
                  <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{driver.role}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 mb-3">
                {[
                  { label: 'Score', value: driver.score },
                  { label: 'Trips', value: driver.trips },
                  { label: 'km Today', value: driver.distance },
                ].map(stat => (
                  <div key={stat.label} className={`rounded-lg p-2 text-center ${isDark ? 'bg-gray-700' : 'bg-white'}`}>
                    <p className={`text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{stat.value}</p>
                    <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{stat.label}</p>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                  <div className="h-full rounded-full"
                    style={{ width: `${driver.score}%`, background: driver.score >= 90 ? '#22c55e' : driver.score >= 80 ? '#f59e0b' : '#ef4444' }}>
                  </div>
                </div>
                <span className={`text-xs font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{driver.score}/100</span>
              </div>
            </div>
          </div>
        )}

        {!driver && vehicle.driver === 'Unassigned' && (
          <div className={`rounded-xl border-2 border-dashed p-4 text-center ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            <Users size={20} className="text-gray-400 mx-auto mb-1" />
            <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>No driver assigned</p>
            <button className="text-xs text-purple-600 hover:underline mt-1">Assign driver →</button>
          </div>
        )}

        {/* Quick actions */}
        <div>
          <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            Quick Actions
          </p>
          <div className="flex flex-col gap-2">
            {[
              {
                label: 'View trip history',
                icon: Clock,
                // Dynamic route — same page component, different vehicle ID
                // TODO: GET /api/fleetpoint/vehicles/:id/trips
                action: () => navigate(`/fleetpoint/vehicles/${vehicle.plate}/trips`)
              },
              {
                label: 'View all alerts',
                icon: AlertTriangle,
                action: () => navigate(`/fleetpoint/violations`)
              },
              {
                label: 'Contact driver',
                icon: Phone,
                action: () => alert(`TODO: contact ${vehicle.driver}`)
              },
              {
                label: 'View on full map',
                icon: MapPin,
                action: () => {}
              },
            ].map(action => (
              <button
                key={action.label}
                onClick={action.action}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium transition-all text-left
                  ${isDark ? 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'}`}
              >
                <action.icon size={13} className="text-purple-500 shrink-0" />
                {action.label}
                <ChevronRight size={12} className="ml-auto text-gray-400" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
