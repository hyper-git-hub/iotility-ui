// src/components/charts/TopActions.tsx
// Actions needed today — critical items for fleet manager
// TODO: fetch from GET /api/fleetpoint/actions-needed

import { AlertTriangle, Wrench, FileText, UserX, Thermometer, ChevronRight } from 'lucide-react'

const actions = [
  { id: 1, icon: AlertTriangle, color: 'text-red-500 bg-red-50', label: '3 vehicles in alert state', sub: 'LP-4821, LP-7734, LP-2201', urgency: 'high' },
  { id: 2, icon: Thermometer, color: 'text-orange-500 bg-orange-50', label: 'Cold chain breach detected', sub: 'LP-0392 — 12.4°C (limit: 4°C)', urgency: 'high' },
  { id: 3, icon: Wrench, color: 'text-amber-500 bg-amber-50', label: '2 vehicles due for service', sub: 'LP-7712, LP-9901 overdue', urgency: 'medium' },
  { id: 4, icon: FileText, color: 'text-blue-500 bg-blue-50', label: '3 unreviewed dashcam events', sub: 'Harsh braking · Near miss', urgency: 'medium' },
  { id: 5, icon: UserX, color: 'text-purple-500 bg-purple-50', label: '1 driver licence expiring', sub: 'Connor McBride — expires in 14 days', urgency: 'low' },
]

const urgencyBadge: Record<string, string> = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-blue-100 text-blue-700',
}

export default function TopActions() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 h-full">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Actions Needed Today</h3>
        <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full font-bold">{actions.filter(a => a.urgency === 'high').length} urgent</span>
      </div>
      <div className="flex flex-col gap-2">
        {actions.map(action => (
          <div key={action.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors group">
            <div className={`w-8 h-8 rounded-lg ${action.color} flex items-center justify-center shrink-0`}>
              <action.icon size={14} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-900 dark:text-white">{action.label}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{action.sub}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${urgencyBadge[action.urgency]}`}>{action.urgency}</span>
              <ChevronRight size={12} className="text-gray-300 group-hover:text-purple-500 transition-colors" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
