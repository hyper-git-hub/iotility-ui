// src/layouts/FleetpointLayout.tsx
// Fleetpoint module layout — sidebar + topbar
// Sidebar is configurable per use case via sidebarConfig.ts
// To add a new menu item: add to the menu array below
// To add a new section: add a new object to the menu array
// TODO: fetch active use case + permissions from GET /api/users/me/context

import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, MapPin, Play, Truck, Users, Monitor,
  Camera, Wrench, AlertTriangle, Circle, BarChart2,
  FileText, UserCog, Settings, ChevronLeft, ChevronRight,
  Moon, Sun, Route, ClipboardList, MapPinned, Navigation,
  Shield, Building2
} from 'lucide-react'
import { useTheme } from '../hooks/useTheme'

const iconMap: Record<string, any> = {
  LayoutDashboard, MapPin, Play, Truck, Users, Monitor,
  Camera, Wrench, AlertTriangle, Circle, BarChart2,
  FileText, UserCog, Settings, Route, ClipboardList,
  MapPinned, Navigation, Shield, Building2
}

const menu = [
  {
    section: 'Overview',
    items: [
      { id: 'fp-dashboard', label: 'Dashboard', icon: 'LayoutDashboard', path: '/fleetpoint', badge: null },
      { id: 'fp-live', label: 'Live Tracking', icon: 'MapPin', path: '/fleetpoint/live-tracking', badge: null },
      { id: 'fp-replay', label: 'Trip Replay', icon: 'Play', path: '/fleetpoint/trip-replay', badge: null },
    ],
  },
  {
    section: 'Fleet Management',
    items: [
      { id: 'fp-fleets', label: 'Fleets', icon: 'Building2', path: '/fleetpoint/fleets', badge: null },
      { id: 'fp-vehicles', label: 'Vehicles', icon: 'Truck', path: '/fleetpoint/vehicles', badge: null },
      { id: 'fp-drivers', label: 'Drivers', icon: 'Users', path: '/fleetpoint/drivers', badge: null },
      { id: 'fp-devices', label: 'Devices', icon: 'Monitor', path: '/fleetpoint/devices', badge: null },
      { id: 'fp-poi', label: 'POI', icon: 'MapPinned', path: '/fleetpoint/poi', badge: null },
    ],
  },
  {
    section: 'Operations',
    items: [
      { id: 'fp-jobs', label: 'Jobs', icon: 'ClipboardList', path: '/fleetpoint/jobs', badge: 3 },
      { id: 'fp-routes', label: 'Routes', icon: 'Navigation', path: '/fleetpoint/routes', badge: null },
      { id: 'fp-dashcam', label: 'DashCam', icon: 'Camera', path: '/fleetpoint/dashcam', badge: 3 },
      { id: 'fp-maintenance', label: 'Maintenance', icon: 'Wrench', path: '/fleetpoint/maintenance', badge: 2 },
      { id: 'fp-violations', label: 'Violations', icon: 'AlertTriangle', path: '/fleetpoint/violations', badge: 65 },
      { id: 'fp-geozones', label: 'Geozones', icon: 'Shield', path: '/fleetpoint/geozones', badge: null },
    ],
  },
  {
    section: 'Insights',
    items: [
      { id: 'fp-reports', label: 'Reports', icon: 'BarChart2', path: '/fleetpoint/reports', badge: null },
      { id: 'fp-documents', label: 'Documents', icon: 'FileText', path: '/fleetpoint/documents', badge: null },
    ],
  },
  {
    section: 'Admin',
    items: [
      { id: 'fp-users', label: 'Users & Roles', icon: 'UserCog', path: '/fleetpoint/users', badge: null },
      { id: 'fp-settings', label: 'Settings', icon: 'Settings', path: '/fleetpoint/settings', badge: null },
    ],
  },
]

interface Props {
  children: React.ReactNode
  fullscreen?: boolean
}

export default function FleetpointLayout({ children, fullscreen = false }: Props) {
  const navigate = useNavigate()
  const location = useLocation()
  const { isDark, toggleTheme } = useTheme()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className={`flex h-screen w-screen overflow-hidden ${isDark ? 'bg-gray-950' : 'bg-gray-50'}`}>

      {/* SIDEBAR — hidden in fullscreen */}
      {!fullscreen && (
        <div
          className={`flex flex-col shrink-0 transition-all duration-300 ${collapsed ? 'w-16' : 'w-56'}`}
          style={{ background: 'linear-gradient(180deg, #0a0a0f 0%, #1e0a3c 50%, #4c1d95 100%)' }}
        >
          {/* Module header */}
          <div className="flex items-center gap-2.5 px-3 py-4 border-b border-purple-900/50 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-xs font-black shrink-0">
              FP
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-white text-xs font-bold truncate">Fleetpoint</p>
                <p className="text-purple-300 text-xs truncate">LogisticsPro</p>
              </div>
            )}
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="text-purple-400 hover:text-white transition-colors shrink-0"
            >
              {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            </button>
          </div>

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto py-3 px-2">
            {menu.map(section => (
              <div key={section.section} className="mb-4">
                {!collapsed && (
                  <p className="text-purple-400/60 text-xs font-semibold uppercase tracking-wider px-2 mb-1">
                    {section.section}
                  </p>
                )}
                {section.items.map(item => {
                  const Icon = iconMap[item.icon]
                  const active = location.pathname === item.path
                  return (
                    <button
                      key={item.id}
                      onClick={() => navigate(item.path)}
                      className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-lg mb-0.5 transition-all duration-150
                        ${active
                          ? 'bg-purple-600 text-white'
                          : 'text-purple-300 hover:bg-purple-900/40 hover:text-white'
                        }`}
                    >
                      <Icon size={16} className="shrink-0" />
                      {!collapsed && (
                        <span className="text-xs font-medium flex-1 text-left truncate">{item.label}</span>
                      )}
                      {!collapsed && item.badge && (
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold shrink-0
                          ${active ? 'bg-white/20 text-white' : 'bg-red-500 text-white'}`}>
                          {item.badge > 99 ? '99+' : item.badge}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            ))}
          </nav>

          {/* Bottom */}
          <div className="px-2 py-3 border-t border-purple-900/50 shrink-0 flex flex-col gap-1">
            <button
              onClick={toggleTheme}
              className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-purple-300 hover:bg-purple-900/40 hover:text-white transition-all"
            >
              {isDark ? <Sun size={16} className="shrink-0" /> : <Moon size={16} className="shrink-0" />}
              {!collapsed && <span className="text-xs font-medium">{isDark ? 'Light Mode' : 'Dark Mode'}</span>}
            </button>
            <button
              onClick={() => navigate('/home')}
              className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-purple-300 hover:bg-purple-900/40 hover:text-white transition-all"
            >
              <ChevronLeft size={16} className="shrink-0" />
              {!collapsed && <span className="text-xs font-medium">Back to IoTility</span>}
            </button>
          </div>
        </div>
      )}

      {/* MAIN AREA */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* TOP BAR — hidden in fullscreen */}
        {!fullscreen && (
          <header className={`h-14 flex items-center justify-between px-6 shrink-0 border-b
            ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'}`}>
            <div className="flex items-center gap-2">
              <h1 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                IoTility Fleetpoint
              </h1>
              <span className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>— LogisticsPro</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-xs text-green-600 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 px-3 py-1.5 rounded-full font-medium">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                Live
              </span>
              <div className="flex items-center gap-2 cursor-pointer">
                <div className="text-right">
                  <p className={`text-xs font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Ali Mujtaba</p>
                  {/* TODO: replace with logged in user from auth context */}
                  <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Super Admin</p>
                </div>
                <div className="relative">
                  <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white text-xs font-bold">AM</div>
                  <span className="absolute bottom-0 right-0 w-2 h-2 bg-green-400 rounded-full border-2 border-white dark:border-gray-900"></span>
                </div>
              </div>
            </div>
          </header>
        )}

        {/* PAGE CONTENT */}
        <main className={`flex-1 overflow-y-auto ${isDark ? 'bg-gray-950' : 'bg-gray-50'}`}>
          {children}
        </main>

      </div>
    </div>
  )
}
