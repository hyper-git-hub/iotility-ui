// src/pages/fleetpoint/fleet/FleetsPage.tsx
// Fleets management page — view, compare and manage fleet groups
// TODO: fetch from GET /api/fleetpoint/fleets
// TODO: POST /api/fleetpoint/fleets (create)
// TODO: PATCH /api/fleetpoint/fleets/:id (update)
// TODO: DELETE /api/fleetpoint/fleets/:id (delete)

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus, Truck, Users, MapPin,
  ChevronRight, AlertTriangle, Fuel, Shield,
  MoreHorizontal, Edit, Trash2, Eye
} from 'lucide-react'
import FleetpointLayout from '../../../layouts/FleetpointLayout'
import { fleets, vehicles, drivers } from '../../../data/fleetData'
import { useTheme } from '../../../hooks/useTheme'

const scoreColor = (score: number) =>
  score >= 85 ? 'text-green-600' : score >= 70 ? 'text-amber-600' : 'text-red-600'

const scoreBarColor = (score: number) =>
  score >= 85 ? '#22c55e' : score >= 70 ? '#f59e0b' : '#ef4444'

export default function FleetsPage() {
  const { isDark } = useTheme()
  const navigate = useNavigate()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [activeMenu, setActiveMenu] = useState<string | null>(null)

  const enrichedFleets = fleets.map(fleet => {
    const fleetVehicles = vehicles.filter(v => v.fleetId === fleet.id)
    const fleetDrivers = drivers.filter(d => d.fleetId === fleet.id)
    const activeVehicles = fleetVehicles.filter(v => v.status === 'moving' || v.status === 'idle').length
    const alertVehicles = fleetVehicles.filter(v => v.status === 'alert').length
    const avgFuel = Math.round(fleetVehicles.reduce((a, v) => a + v.fuel, 0) / (fleetVehicles.length || 1))
    return { ...fleet, fleetVehicles, fleetDrivers, activeVehicles, alertVehicles, avgFuel }
  })

  const totalAlerts = vehicles.filter(v => v.status === 'alert').length

  return (
    <FleetpointLayout>
      <div className={`p-6 ${isDark ? 'bg-gray-950' : 'bg-gray-50'} min-h-full`}>

        {/* Page header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Fleet Management</h1>
            <p className={`text-sm mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              {fleets.length} fleets · {vehicles.length} vehicles · {drivers.length} drivers
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
          >
            <Plus size={16} /> Create Fleet
          </button>
        </div>

        {/* Summary KPIs */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Fleets', value: fleets.length, icon: Shield, color: 'text-purple-600', bg: 'bg-purple-50' },
            { label: 'Total Vehicles', value: vehicles.length, icon: Truck, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Total Drivers', value: drivers.length, icon: Users, color: 'text-green-600', bg: 'bg-green-50' },
            { label: 'Active Alerts', value: totalAlerts, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
          ].map((kpi, i) => (
            <div key={i} className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border rounded-2xl p-4`}>
              <div className={`w-9 h-9 rounded-xl ${kpi.bg} flex items-center justify-center mb-3`}>
                <kpi.icon size={18} className={kpi.color} />
              </div>
              <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{kpi.value}</p>
              <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{kpi.label}</p>
            </div>
          ))}
        </div>

        {/* Fleet cards grid */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {enrichedFleets.map(fleet => (
            <div key={fleet.id} className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border rounded-2xl overflow-hidden hover:shadow-md transition-shadow`}>

              {/* Fleet header */}
              <div className={`flex items-center justify-between px-5 py-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-100'}`}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0"
                    style={{ background: fleet.color }}>
                    {fleet.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>{fleet.name}</h3>
                    <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{fleet.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {fleet.alertVehicles > 0 && (
                    <span className="flex items-center gap-1 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
                      <AlertTriangle size={10} /> {fleet.alertVehicles}
                    </span>
                  )}
                  <div className="relative">
                    <button
                      onClick={() => setActiveMenu(activeMenu === fleet.id ? null : fleet.id)}
                      className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
                    >
                      <MoreHorizontal size={16} />
                    </button>
                    {activeMenu === fleet.id && (
                      <div className={`absolute right-0 top-8 z-10 rounded-xl shadow-lg border w-40
                        ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                        {[
                          { icon: Eye, label: 'View on Map', action: () => navigate('/fleetpoint/live-tracking') },
                          { icon: Edit, label: 'Edit Fleet', action: () => {} },
                          { icon: Trash2, label: 'Delete Fleet', action: () => {} },
                        ].map(item => (
                          <button key={item.label} onClick={() => { item.action(); setActiveMenu(null) }}
                            className={`w-full flex items-center gap-2 px-3 py-2.5 text-xs transition-colors
                              ${item.label === 'Delete Fleet'
                                ? 'text-red-600 hover:bg-red-50'
                                : `${isDark ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-50'}`}`}>
                            <item.icon size={13} />{item.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="px-5 py-4">
                <div className="grid grid-cols-4 gap-3 mb-4">
                  {[
                    { label: 'Vehicles', value: fleet.fleetVehicles.length, icon: Truck },
                    { label: 'Drivers', value: fleet.fleetDrivers.length, icon: Users },
                    { label: 'Active', value: fleet.activeVehicles, icon: MapPin },
                    { label: 'Avg Fuel', value: `${fleet.avgFuel}%`, icon: Fuel },
                  ].map(stat => (
                    <div key={stat.label} className={`rounded-xl p-3 text-center ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
                      <stat.icon size={14} className="text-gray-400 mx-auto mb-1" />
                      <p className={`text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{stat.value}</p>
                      <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{stat.label}</p>
                    </div>
                  ))}
                </div>

                {/* Score bars */}
                <div className="flex flex-col gap-2 mb-4">
                  {[
                    { label: 'Safety Score', value: fleet.safetyScore },
                    { label: 'Fuel Efficiency', value: fleet.fuelEfficiency },
                    { label: 'Utilisation', value: fleet.utilisation },
                  ].map(kpi => (
                    <div key={kpi.label} className="flex items-center gap-3">
                      <span className={`text-xs w-28 shrink-0 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{kpi.label}</span>
                      <div className={`flex-1 h-2 rounded-full overflow-hidden ${isDark ? 'bg-gray-600' : 'bg-gray-100'}`}>
                        <div className="h-full rounded-full" style={{ width: `${kpi.value}%`, background: scoreBarColor(kpi.value) }} />
                      </div>
                      <span className={`text-xs font-bold w-8 text-right ${scoreColor(kpi.value)}`}>{kpi.value}%</span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <MapPin size={12} className="text-gray-400" />
                    <span className={`text-xs truncate max-w-48 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{fleet.depotLocation}</span>
                  </div>
                  <button onClick={() => navigate('/fleetpoint/live-tracking')}
                    className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-700 font-medium">
                    Track fleet <ChevronRight size={12} />
                  </button>
                </div>
              </div>

              {/* Vehicle pills */}
              <div className={`px-5 py-3 border-t flex items-center gap-2 flex-wrap ${isDark ? 'border-gray-700' : 'border-gray-100'}`}>
                {fleet.fleetVehicles.slice(0, 5).map(v => (
                  <span key={v.id} className={`text-xs px-2 py-0.5 rounded-full font-medium border
                    ${v.status === 'alert' ? 'bg-red-50 border-red-200 text-red-700'
                    : v.status === 'offline' ? 'bg-gray-100 border-gray-200 text-gray-500'
                    : v.status === 'moving' ? 'bg-green-50 border-green-200 text-green-700'
                    : 'bg-gray-50 border-gray-200 text-gray-600'}`}>
                    {v.plate}
                  </span>
                ))}
                {fleet.fleetVehicles.length > 5 && (
                  <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>+{fleet.fleetVehicles.length - 5} more</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Create Fleet Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className={`rounded-3xl shadow-2xl w-full max-w-md mx-4 p-6 ${isDark ? 'bg-gray-900' : 'bg-white'}`}>
            <h2 className={`text-lg font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Create New Fleet</h2>
            <div className="flex flex-col gap-3">
              {[
                { label: 'Fleet Name', placeholder: 'e.g. Executive Fleet' },
                { label: 'Description', placeholder: 'e.g. VIP and executive vehicles' },
                { label: 'Depot Location', placeholder: 'e.g. London HQ, EC1A 1BB' },
              ].map(field => (
                <div key={field.label}>
                  <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{field.label}</label>
                  <input placeholder={field.placeholder}
                    className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-purple-500
                      ${isDark ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'}`} />
                </div>
              ))}
              <div>
                <label className={`block text-xs font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Fleet Colour</label>
                <div className="flex gap-2">
                  {['#7c3aed', '#0284c7', '#f59e0b', '#16a34a', '#dc2626', '#0891b2', '#9333ea'].map(color => (
                    <button key={color} className="w-7 h-7 rounded-full border-2 border-white shadow-sm hover:scale-110 transition-transform"
                      style={{ background: color }} />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={() => setShowCreateModal(false)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium border ${isDark ? 'border-gray-700 text-gray-300' : 'border-gray-200 text-gray-600'}`}>
                Cancel
              </button>
              <button onClick={() => setShowCreateModal(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-purple-600 hover:bg-purple-700 text-white">
                Create Fleet
              </button>
            </div>
          </div>
        </div>
      )}
    </FleetpointLayout>
  )
}
