// src/pages/fleetpoint/FleetDashboard.tsx
// Fleetpoint command center — tabbed dashboard with widget library
// Widgets are filtered by module, use case and role
// TODO: fetch user widget preferences from GET /api/users/me/dashboard-config
// TODO: fetch active use case from GET /api/users/me/context

import { useState } from 'react'
import { Settings2, X, Check } from 'lucide-react'
import FleetpointLayout from '../../layouts/FleetpointLayout'
import { widgetRegistry, getWidgetsForContext } from '../../data/dashboardConfig'
import { useTheme } from '../../hooks/useTheme'

// Widget component map — add new chart components here
// TODO: when adding a new chart, import it and add to this map
import LiveFleetStatus from '../../components/charts/LiveFleetStatus'
import TopActions from '../../components/charts/TopActions'
import CO2TrendChart from '../../components/charts/CO2TrendChart'
import DriverOfWeek from '../../components/charts/DriverOfWeek'
import FleetUtilisationChart from '../../components/charts/FleetUtilisationChart'
import FuelConsumptionChart from '../../components/charts/FuelConsumptionChart'
import DriverSafetyScorecard from '../../components/charts/DriverSafetyScorecard'
import AggressiveDrivingChart from '../../components/charts/AggressiveDrivingChart'
import DriverViolationsChart from '../../components/charts/DriverViolationsChart'
import DashcamEventsChart from '../../components/charts/DashcamEventsChart'
import MaintenanceStatusChart from '../../components/charts/MaintenanceStatusChart'
import MaintenanceProbabilityChart from '../../components/charts/MaintenanceProbabilityChart'
import VehiclesDueService from '../../components/charts/VehiclesDueService'
import JobsByLocationChart from '../../components/charts/JobsByLocationChart'
import JobStatisticsChart from '../../components/charts/JobStatisticsChart'
import DriverTasksChart from '../../components/charts/DriverTasksChart'
import StaffStatisticsChart from '../../components/charts/StaffStatisticsChart'

const widgetComponents: Record<string, React.ComponentType> = {
  LiveFleetStatus,
  TopActions,
  CO2TrendChart,
  DriverOfWeek,
  FleetUtilisationChart,
  FuelConsumptionChart,
  DriverSafetyScorecard,
  AggressiveDrivingChart,
  DriverViolationsChart,
  DashcamEventsChart,
  MaintenanceStatusChart,
  MaintenanceProbabilityChart,
  VehiclesDueService,
  JobsByLocationChart,
  JobStatisticsChart,
  DriverTasksChart,
  StaffStatisticsChart,
}

// Current user context — TODO: fetch from auth context
const USER_CONTEXT = {
  moduleId: 'fleetpoint',
  useCaseId: 'b2b-logistics',
  role: 'super-admin',
}

const tabs: { id: DashboardTab; label: string; emoji: string }[] = [
  { id: 'overview', label: 'Overview', emoji: '📊' },
  { id: 'safety', label: 'Safety', emoji: '🛡️' },
  { id: 'maintenance', label: 'Maintenance', emoji: '🔧' },
  { id: 'jobs', label: 'Jobs', emoji: '📋' },
  { id: 'reports', label: 'Reports', emoji: '📈' },
]

const sizeClasses: Record<string, string> = {
  full: 'col-span-3',
  half: 'col-span-3 lg:col-span-1',
  third: 'col-span-3 lg:col-span-1',
}

export default function FleetDashboard() {
  const { isDark } = useTheme()
  const [activeTab, setActiveTab] = useState<"overview" | "safety" | "maintenance" | "jobs" | "reports">('overview')
  const [showCustomise, setShowCustomise] = useState(false)
  const [visibleWidgets, setVisibleWidgets] = useState<string[]>(
    widgetRegistry.filter(w => w.defaultVisible).map(w => w.id)
  )
  const [pendingWidgets, setPendingWidgets] = useState<string[]>(visibleWidgets)

  const widgets = getWidgetsForContext(
    USER_CONTEXT.moduleId,
    USER_CONTEXT.useCaseId,
    USER_CONTEXT.role,
    activeTab,
    visibleWidgets
  )

  const allTabWidgets = widgetRegistry.filter(w =>
    w.modules.includes(USER_CONTEXT.moduleId) &&
    (w.useCases.includes('all') || w.useCases.includes(USER_CONTEXT.useCaseId)) &&
    w.roles.includes(USER_CONTEXT.role) &&
    w.tab === activeTab
  )

  const togglePending = (id: string) => {
    setPendingWidgets(prev =>
      prev.includes(id) ? prev.filter(w => w !== id) : [...prev, id]
    )
  }

  const saveCustomise = () => {
    setVisibleWidgets(pendingWidgets)
    setShowCustomise(false)
  }

  const halfWidgets = widgets.filter(w => w.size === 'half' || w.size === 'third')
  const fullWidgets = widgets.filter(w => w.size === 'full')

  return (
    <FleetpointLayout>
      <div className="p-6">

        {/* DASHBOARD HEADER */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Dashboard
            </h1>
            <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              LogisticsPro · B2B Logistics · {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
          <button
            onClick={() => { setPendingWidgets(visibleWidgets); setShowCustomise(true) }}
            className="flex items-center gap-2 text-xs border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-gray-600 dark:text-gray-300 hover:border-purple-400 hover:text-purple-600 transition-all"
          >
            <Settings2 size={14} /> Customise Dashboard
          </button>
        </div>

        {/* TABS */}
        <div className={`flex items-center gap-1 mb-5 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-all border-b-2 -mb-px
                ${activeTab === tab.id
                  ? 'border-purple-600 text-purple-600'
                  : `border-transparent ${isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'}`
                }`}
            >
              <span>{tab.emoji}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* REPORTS TAB — placeholder */}
        {activeTab === 'reports' && (
          <div className={`rounded-2xl border border-dashed p-12 text-center
            ${isDark ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-white'}`}>
            <p className="text-4xl mb-3">📈</p>
            <h3 className={`font-semibold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>Reports Coming Soon</h3>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              Scheduled reports, exports and custom report builder will be available here.
            </p>
          </div>
        )}

        {/* WIDGET GRID */}
        {activeTab !== 'reports' && widgets.length === 0 && (
          <div className={`rounded-2xl border border-dashed p-12 text-center
            ${isDark ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-white'}`}>
            <p className="text-4xl mb-3">🎛️</p>
            <h3 className={`font-semibold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>No widgets visible</h3>
            <p className={`text-sm mb-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              Use Customise Dashboard to add widgets to this tab.
            </p>
            <button
              onClick={() => { setPendingWidgets(visibleWidgets); setShowCustomise(true) }}
              className="text-xs bg-purple-600 text-white px-4 py-2 rounded-full hover:bg-purple-700 transition-colors"
            >
              Customise Dashboard
            </button>
          </div>
        )}

        {activeTab !== 'reports' && widgets.length > 0 && (
          <div className="flex flex-col gap-4">
            {/* Full width widgets first */}
            {fullWidgets.map(widget => {
              const Component = widgetComponents[widget.component]
              if (!Component) return null
              return <Component key={widget.id} />
            })}

            {/* Half/third widgets in grid */}
            {halfWidgets.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {halfWidgets.map(widget => {
                  const Component = widgetComponents[widget.component]
                  if (!Component) return null
                  return (
                    <div key={widget.id} className={widget.size === 'full' ? 'lg:col-span-2 xl:col-span-3' : ''}>
                      <Component />
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* CUSTOMISE DASHBOARD MODAL */}
      {showCustomise && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className={`rounded-3xl shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] flex flex-col
            ${isDark ? 'bg-gray-900' : 'bg-white'}`}>

            {/* Modal header */}
            <div className={`flex items-center justify-between px-6 py-4 border-b
              ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
              <div>
                <h2 className={`font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Customise Dashboard</h2>
                <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  Toggle widgets for the {tabs.find(t => t.id === activeTab)?.label} tab
                </p>
              </div>
              <button onClick={() => setShowCustomise(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Widget list */}
            <div className="overflow-y-auto flex-1 p-4 flex flex-col gap-2">
              {allTabWidgets.map(widget => {
                const isVisible = pendingWidgets.includes(widget.id)
                return (
                  <button
                    key={widget.id}
                    onClick={() => togglePending(widget.id)}
                    className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all
                      ${isVisible
                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                        : `border-gray-200 dark:border-gray-700 ${isDark ? 'hover:border-gray-500' : 'hover:border-gray-300'}`
                      }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors
                      ${isVisible ? 'bg-purple-600' : 'bg-gray-100 dark:bg-gray-700'}`}>
                      <Check size={14} className={isVisible ? 'text-white' : 'text-gray-400'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{widget.title}</p>
                      <p className={`text-xs truncate ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{widget.description}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full shrink-0
                      ${widget.size === 'full' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>
                      {widget.size}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Footer */}
            <div className={`flex items-center justify-between px-6 py-4 border-t
              ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
              <button
                onClick={() => setPendingWidgets(allTabWidgets.map(w => w.id))}
                className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              >
                Select all
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowCustomise(false)}
                  className="text-xs px-4 py-2 rounded-full border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-gray-400 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={saveCustomise}
                  className="text-xs px-4 py-2 rounded-full bg-purple-600 hover:bg-purple-700 text-white font-semibold transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </FleetpointLayout>
  )
}
