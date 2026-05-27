import { useLocation } from 'react-router-dom'
import { Construction } from 'lucide-react'
import FleetpointLayout from '../../layouts/FleetpointLayout'
import { useTheme } from '../../hooks/useTheme'

const pageNames: Record<string, string> = {
  '/fleetpoint/devices': 'Devices',
  '/fleetpoint/poi': 'Points of Interest',
  '/fleetpoint/jobs': 'Jobs',
  '/fleetpoint/trip-replay': 'Trip Replay',
  '/fleetpoint/corridors': 'Corridors',
  '/fleetpoint/dashcam': 'DashCam',
  '/fleetpoint/maintenance': 'Maintenance',
  '/fleetpoint/violations': 'Violations',
  '/fleetpoint/geozones': 'Geozones',
  '/fleetpoint/reports': 'Reports',
  '/fleetpoint/documents': 'Documents',
  '/fleetpoint/users': 'Users & Roles',
  '/fleetpoint/settings': 'Settings',
}

export default function PlaceholderPage() {
  const { isDark } = useTheme()
  const location = useLocation()
  const pageName = pageNames[location.pathname] || 'This Page'

  return (
    <FleetpointLayout>
      <div className={`flex items-center justify-center h-full ${isDark ? 'bg-gray-950' : 'bg-gray-50'}`}>
        <div className="text-center">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 ${isDark ? 'bg-gray-800' : 'bg-white'} shadow-sm`}>
            <Construction size={28} className="text-purple-500" />
          </div>
          <h2 className={`text-xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>{pageName}</h2>
          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            Coming in the next sprint.
          </p>
        </div>
      </div>
    </FleetpointLayout>
  )
}
