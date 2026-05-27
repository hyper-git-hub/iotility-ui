// src/pages/fleetpoint/operations/MaintenancePage.tsx
// Maintenance management — Overview, Schedule, Work Orders, Workshop, Log, Predictions
//
// DEVELOPER NOTES:
// ─────────────────────────────────────────────────────────────────────────────
// Six tabs in one page — no sub-menu needed
//
// DATA FLOW:
// Overview    → GET /api/fleetpoint/vehicles/health-summary
//               GET /api/fleetpoint/maintenance/schedule?days=30
// Work Orders → GET /api/fleetpoint/work-orders
//               POST /api/fleetpoint/work-orders
//               PATCH /api/fleetpoint/work-orders/:id/status
// Workshop    → GET /api/fleetpoint/workshops
// Log         → GET /api/fleetpoint/maintenance/log
// Predictions → GET /api/fleetpoint/maintenance/predictions
//               POST /api/fleetpoint/work-orders/from-prediction/:id
//
// PREDICTIVE MAINTENANCE:
// ML model runs as Python/FastAPI microservice (separate service)
// Backend calls ML microservice — frontend NEVER calls ML directly
// Frontend just displays predictions from REST API
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import {
  Wrench, AlertTriangle, CheckCircle, Clock, Plus,
  Download, Search, Filter, X, ChevronRight,
  MoreHorizontal, Edit, Trash2, MapPin, Phone,
  Cpu, Activity, Battery, Circle, BarChart2,
  Bot, Zap, Eye, RefreshCw, Building2, User
} from 'lucide-react'
import FleetpointLayout from '../../../layouts/FleetpointLayout'
import {
  workOrders, workshops, vehicleHealthScores,
  maintenancePredictions, vehicles, fleets
} from '../../../data/fleetData'
import { useTheme } from '../../../hooks/useTheme'
import type {
  WorkOrder, WorkOrderStatus, WorkOrderType,
  WorkOrderPriority, MaintenanceUrgency
} from '../../../data/fleetData'

// ─── Config ───────────────────────────────────────────────────────────────────
const WO_STATUS_CONFIG: Record<WorkOrderStatus, {
  label: string; color: string; bg: string; border: string; step: number
}> = {
  'raised':          { label: 'Raised',          color: 'text-gray-600',   bg: 'bg-gray-100',   border: 'border-gray-200',   step: 1 },
  'assigned':        { label: 'Assigned',         color: 'text-blue-700',   bg: 'bg-blue-50',    border: 'border-blue-200',   step: 2 },
  'accepted':        { label: 'Accepted',         color: 'text-cyan-700',   bg: 'bg-cyan-50',    border: 'border-cyan-200',   step: 3 },
  'diagnosing':      { label: 'Diagnosing',       color: 'text-purple-700', bg: 'bg-purple-50',  border: 'border-purple-200', step: 4 },
  'awaiting-parts':  { label: 'Awaiting Parts',   color: 'text-amber-700',  bg: 'bg-amber-50',   border: 'border-amber-200',  step: 5 },
  'in-progress':     { label: 'In Progress',      color: 'text-orange-700', bg: 'bg-orange-50',  border: 'border-orange-200', step: 6 },
  'quality-check':   { label: 'Quality Check',    color: 'text-teal-700',   bg: 'bg-teal-50',    border: 'border-teal-200',   step: 7 },
  'completed':       { label: 'Completed',        color: 'text-green-700',  bg: 'bg-green-50',   border: 'border-green-200',  step: 8 },
  'cancelled':       { label: 'Cancelled',        color: 'text-red-700',    bg: 'bg-red-50',     border: 'border-red-200',    step: 0 },
}

const WO_TYPE_CONFIG: Record<WorkOrderType, { label: string; color: string; icon: any }> = {
  'scheduled':       { label: 'Scheduled',       color: 'text-blue-600',   icon: Clock },
  'corrective':      { label: 'Corrective',      color: 'text-orange-600', icon: Wrench },
  'predictive':      { label: 'Predictive (AI)', color: 'text-purple-600', icon: Bot },
  'driver-reported': { label: 'Driver Reported', color: 'text-amber-600',  icon: User },
}

const PRIORITY_CONFIG: Record<WorkOrderPriority, { label: string; color: string; bg: string }> = {
  critical: { label: 'Critical', color: 'text-red-700',    bg: 'bg-red-50' },
  high:     { label: 'High',     color: 'text-orange-700', bg: 'bg-orange-50' },
  normal:   { label: 'Normal',   color: 'text-blue-700',   bg: 'bg-blue-50' },
  low:      { label: 'Low',      color: 'text-gray-600',   bg: 'bg-gray-100' },
}

const URGENCY_CONFIG: Record<MaintenanceUrgency, { label: string; color: string; bg: string; border: string }> = {
  critical: { label: 'Critical', color: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-300' },
  high:     { label: 'High',     color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-300' },
  medium:   { label: 'Medium',   color: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-300' },
  low:      { label: 'Low',      color: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-300' },
}

const SCORE_COLOR = (s: number) =>
  s >= 85 ? '#22c55e' : s >= 65 ? '#f59e0b' : s >= 40 ? '#ef4444' : '#7f1d1d'
const SCORE_TEXT = (s: number) =>
  s >= 85 ? 'text-green-600' : s >= 65 ? 'text-amber-600' : s >= 40 ? 'text-red-600' : 'text-red-900'
const SCORE_LABEL = (s: number) =>
  s >= 85 ? 'Good' : s >= 65 ? 'Fair' : s >= 40 ? 'Poor' : 'Critical'

type TabId = 'overview' | 'workorders' | 'workshop' | 'log' | 'predictions'

const WO_WORKFLOW_STEPS: WorkOrderStatus[] = [
  'raised', 'assigned', 'accepted', 'diagnosing',
  'awaiting-parts', 'in-progress', 'quality-check', 'completed'
]

export default function MaintenancePage() {
  const { isDark } = useTheme()
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | WorkOrderStatus>('all')
  const [filterPriority, setFilterPriority] = useState<'all' | WorkOrderPriority>('all')
  const [filterType, setFilterType] = useState<'all' | WorkOrderType>('all')
  const [selectedWO, setSelectedWO] = useState<WorkOrder | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showWorkshopModal, setShowWorkshopModal] = useState(false)
  const [activeMenu, setActiveMenu] = useState<string | null>(null)

  // ── KPIs ────────────────────────────────────────────────────────────────────
  const totalWOs = workOrders.length
  const activeWOs = workOrders.filter(w => !['completed', 'cancelled'].includes(w.status)).length
  const criticalWOs = workOrders.filter(w => w.priority === 'critical' && w.status !== 'completed').length
  const completedWOs = workOrders.filter(w => w.status === 'completed').length
  const criticalHealth = vehicleHealthScores.filter(v => v.overallScore < 50).length
  const totalPredictions = maintenancePredictions.filter(p => !p.workOrderRaised).length
  const totalCost = workOrders.filter(w => w.status === 'completed').reduce((a, w) => a + w.actualCost, 0)

  // ── Filtered work orders ────────────────────────────────────────────────────
  const filteredWOs = workOrders.filter(w => {
    const s = search.toLowerCase()
    const matchSearch = !search ||
      w.vehiclePlate.toLowerCase().includes(s) ||
      w.serviceType.toLowerCase().includes(s) ||
      w.driverName.toLowerCase().includes(s) ||
      w.workshopName.toLowerCase().includes(s)
    const matchStatus = filterStatus === 'all' || w.status === filterStatus
    const matchPriority = filterPriority === 'all' || w.priority === filterPriority
    const matchType = filterType === 'all' || w.type === filterType
    return matchSearch && matchStatus && matchPriority && matchType
  })

  const tabs: { id: TabId; label: string; emoji: string; count?: number }[] = [
    { id: 'overview',    label: 'Overview',     emoji: '📊' },
    { id: 'workorders',  label: 'Work Orders',  emoji: '🔧', count: activeWOs },
    { id: 'workshop',    label: 'Workshops',    emoji: '🏭', count: workshops.length },
    { id: 'log',         label: 'Service Log',  emoji: '📋' },
    { id: 'predictions', label: 'AI Predictions', emoji: '🤖', count: maintenancePredictions.filter(p => p.urgency === 'critical').length },
  ]

  // ── Health score donut ──────────────────────────────────────────────────────
  const ScoreDonut = ({ score, size = 48 }: { score: number; size?: number }) => {
    const r = size * 0.38
    const circ = 2 * Math.PI * r
    const dash = (score / 100) * circ
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size/2} cy={size/2} r={r} fill="none"
          stroke={isDark ? '#374151' : '#f3f4f6'} strokeWidth={size * 0.1} />
        <circle cx={size/2} cy={size/2} r={r} fill="none"
          stroke={SCORE_COLOR(score)} strokeWidth={size * 0.1}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
      </svg>
    )
  }

  return (
    <FleetpointLayout>
      <div className={`p-6 min-h-full ${isDark ? 'bg-gray-950' : 'bg-gray-50'}`}>

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Maintenance
            </h1>
            <p className={`text-sm mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              {activeWOs} active work orders · {criticalWOs} critical · {criticalHealth} vehicles need attention
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button className={`flex items-center gap-2 text-sm px-3 py-2 rounded-xl border transition-colors
              ${isDark ? 'border-gray-700 text-gray-300 hover:bg-gray-800' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              <Download size={15} /> Export
            </button>
            <button onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
              <Plus size={15} /> New Work Order
            </button>
          </div>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-6 gap-3 mb-5">
          {[
            { label: 'Active WOs', value: activeWOs, icon: Wrench, color: 'text-purple-600', bg: 'bg-purple-50' },
            { label: 'Critical', value: criticalWOs, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
            { label: 'Completed', value: completedWOs, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
            { label: 'Poor Health', value: criticalHealth, icon: Activity, color: 'text-orange-600', bg: 'bg-orange-50' },
            { label: 'AI Predictions', value: maintenancePredictions.length, icon: Bot, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Cost This Month', value: `£${totalCost.toLocaleString()}`, icon: BarChart2, color: 'text-teal-600', bg: 'bg-teal-50' },
          ].map((kpi, i) => (
            <div key={i} className={`border rounded-2xl p-3 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
              <div className={`w-7 h-7 rounded-lg ${kpi.bg} flex items-center justify-center mb-2`}>
                <kpi.icon size={14} className={kpi.color} />
              </div>
              <p className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{kpi.value}</p>
              <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{kpi.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className={`flex items-center gap-1 mb-5 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 -mb-px transition-all
                ${activeTab === tab.id
                  ? 'border-purple-600 text-purple-600'
                  : `border-transparent ${isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'}`}`}>
              <span>{tab.emoji}</span>
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full
                  ${activeTab === tab.id ? 'bg-purple-100 text-purple-700' : `${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-500'}`}`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW TAB ──────────────────────────────────────────────────── */}
        {activeTab === 'overview' && (
          <div className="flex flex-col gap-5">

            {/* Vehicle health grid */}
            <div className={`rounded-2xl border p-5 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Fleet Health Scores
                </h3>
                <div className={`text-xs flex items-center gap-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  <Bot size={12} className="text-purple-500" />
                  Calculated by ML microservice
                  {/* DEVELOPER NOTE: POST /api/ml/vehicle-health/:id/recalculate */}
                </div>
              </div>
              <div className="grid grid-cols-4 gap-3">
                {vehicleHealthScores.map(vh => (
                  <div key={vh.vehicleId}
                    className={`rounded-xl border p-3 transition-all hover:shadow-md cursor-pointer
                      ${vh.overallScore < 50
                        ? `${isDark ? 'border-red-800 bg-red-900/10' : 'border-red-200 bg-red-50'}`
                        : vh.overallScore < 70
                        ? `${isDark ? 'border-amber-800 bg-amber-900/10' : 'border-amber-200 bg-amber-50'}`
                        : `${isDark ? 'border-gray-700 bg-gray-700/30' : 'border-gray-200 bg-gray-50'}`
                      }`}>
                    <div className="flex items-center gap-2 mb-2">
                      <ScoreDonut score={vh.overallScore} size={36} />
                      <div>
                        <p className={`text-xs font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{vh.vehiclePlate}</p>
                        <p className={`text-xs font-semibold ${SCORE_TEXT(vh.overallScore)}`}>
                          {vh.overallScore}/100 — {SCORE_LABEL(vh.overallScore)}
                        </p>
                      </div>
                    </div>

                    {/* Component scores */}
                    <div className="flex flex-col gap-1">
                      {[
                        { label: 'Engine', score: vh.engineScore },
                        { label: 'Brakes', score: vh.brakeScore },
                        { label: 'Tyres', score: vh.tyreScore },
                        { label: 'Battery', score: vh.batteryScore },
                      ].map(comp => (
                        <div key={comp.label} className="flex items-center gap-1.5">
                          <span className={`text-xs w-12 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{comp.label}</span>
                          <div className={`flex-1 h-1 rounded-full overflow-hidden ${isDark ? 'bg-gray-600' : 'bg-gray-200'}`}>
                            <div className="h-full rounded-full"
                              style={{ width: `${comp.score}%`, background: SCORE_COLOR(comp.score) }} />
                          </div>
                          <span className="text-xs font-medium w-6 text-right" style={{ color: SCORE_COLOR(comp.score) }}>
                            {comp.score}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* CAN bus fault codes */}
                    {vh.canBusFaultCodes.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {vh.canBusFaultCodes.map(code => (
                          <span key={code}
                            className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-mono font-bold">
                            {code}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Recent + upcoming */}
            <div className="grid grid-cols-2 gap-5">

              {/* Active work orders */}
              <div className={`rounded-2xl border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                <div className={`flex items-center justify-between px-4 py-3 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                  <h3 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>Active Work Orders</h3>
                  <button onClick={() => setActiveTab('workorders')}
                    className="text-xs text-purple-600 hover:underline">View all</button>
                </div>
                <div className="flex flex-col">
                  {workOrders.filter(w => w.status !== 'completed' && w.status !== 'cancelled').slice(0, 5).map(wo => {
                    const status = WO_STATUS_CONFIG[wo.status]
                    const priority = PRIORITY_CONFIG[wo.priority]
                    return (
                      <div key={wo.id}
                        onClick={() => { setSelectedWO(wo); setActiveTab('workorders') }}
                        className={`flex items-center gap-3 px-4 py-3 border-b cursor-pointer transition-colors
                          ${isDark ? 'border-gray-700 hover:bg-gray-750' : 'border-gray-50 hover:bg-gray-50'}`}>
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${priority.bg}`}>
                          <Wrench size={14} className={priority.color} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-semibold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {wo.vehiclePlate} — {wo.serviceType}
                          </p>
                          <p className={`text-xs truncate ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            {wo.workshopName}
                          </p>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium shrink-0
                          ${status.color} ${status.bg} ${status.border}`}>
                          {status.label}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Top predictions */}
              <div className={`rounded-2xl border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                <div className={`flex items-center justify-between px-4 py-3 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                  <div className="flex items-center gap-2">
                    <Bot size={14} className="text-purple-500" />
                    <h3 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>Top AI Predictions</h3>
                  </div>
                  <button onClick={() => setActiveTab('predictions')}
                    className="text-xs text-purple-600 hover:underline">View all</button>
                </div>
                <div className="flex flex-col">
                  {maintenancePredictions.slice(0, 5).map(pred => {
                    const urgency = URGENCY_CONFIG[pred.urgency]
                    return (
                      <div key={pred.id}
                        className={`flex items-center gap-3 px-4 py-3 border-b
                          ${isDark ? 'border-gray-700' : 'border-gray-50'}`}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className={`text-xs font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                              {pred.vehiclePlate}
                            </span>
                            <span className={`text-xs px-1.5 py-0.5 rounded-full border font-medium
                              ${urgency.color} ${urgency.bg} ${urgency.border}`}>
                              {urgency.label}
                            </span>
                          </div>
                          <p className={`text-xs truncate ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            {pred.component} — {pred.daysUntilFailure}d · {pred.confidence}% confidence
                          </p>
                        </div>
                        {!pred.workOrderRaised && (
                          <button
                            onClick={() => setShowCreateModal(true)}
                            className="text-xs bg-purple-600 hover:bg-purple-700 text-white px-2 py-1 rounded-lg font-medium shrink-0">
                            Raise WO
                          </button>
                        )}
                        {pred.workOrderRaised && (
                          <span className="text-xs text-green-600 font-medium shrink-0">WO Raised ✓</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── WORK ORDERS TAB ───────────────────────────────────────────────── */}
        {activeTab === 'workorders' && (
          <>
            {/* Search + filters */}
            <div className={`rounded-2xl border p-4 mb-4 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
              <div className="flex items-center gap-3">
                <div className={`flex-1 flex items-center gap-2 border rounded-xl px-3 py-2
                  ${isDark ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-gray-50'}`}>
                  <Search size={14} className="text-gray-400 shrink-0" />
                  <input type="text" placeholder="Search vehicle, service type, workshop..."
                    value={search} onChange={e => setSearch(e.target.value)}
                    className={`flex-1 text-sm outline-none bg-transparent
                      ${isDark ? 'text-white placeholder-gray-500' : 'text-gray-900 placeholder-gray-400'}`} />
                  {search && <button onClick={() => setSearch('')}><X size={12} className="text-gray-400" /></button>}
                </div>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}
                  className={`text-sm border rounded-xl px-3 py-2 outline-none ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200 text-gray-700'}`}>
                  <option value="all">All Status</option>
                  {Object.entries(WO_STATUS_CONFIG).map(([val, cfg]) => (
                    <option key={val} value={val}>{cfg.label}</option>
                  ))}
                </select>
                <select value={filterPriority} onChange={e => setFilterPriority(e.target.value as any)}
                  className={`text-sm border rounded-xl px-3 py-2 outline-none ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200 text-gray-700'}`}>
                  <option value="all">All Priority</option>
                  {Object.entries(PRIORITY_CONFIG).map(([val, cfg]) => (
                    <option key={val} value={val}>{cfg.label}</option>
                  ))}
                </select>
                <select value={filterType} onChange={e => setFilterType(e.target.value as any)}
                  className={`text-sm border rounded-xl px-3 py-2 outline-none ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200 text-gray-700'}`}>
                  <option value="all">All Types</option>
                  {Object.entries(WO_TYPE_CONFIG).map(([val, cfg]) => (
                    <option key={val} value={val}>{cfg.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Work orders + detail panel */}
            <div className="flex gap-4">

              {/* Table */}
              <div className={`flex-1 rounded-2xl border overflow-hidden ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                <table className="w-full text-sm">
                  <thead>
                    <tr className={`border-b text-xs font-semibold uppercase tracking-wide
                      ${isDark ? 'border-gray-700 bg-gray-900 text-gray-400' : 'border-gray-100 bg-gray-50 text-gray-500'}`}>
                      <th className="px-4 py-3 text-left">Work Order</th>
                      <th className="px-4 py-3 text-left">Vehicle</th>
                      <th className="px-4 py-3 text-left">Type</th>
                      <th className="px-4 py-3 text-left">Priority</th>
                      <th className="px-4 py-3 text-left">Workshop</th>
                      <th className="px-4 py-3 text-left">Status</th>
                      <th className="px-4 py-3 text-left">Est. Cost</th>
                      <th className="px-4 py-3 text-left">Due</th>
                      <th className="px-4 py-3 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredWOs.map(wo => {
                      const status = WO_STATUS_CONFIG[wo.status]
                      const priority = PRIORITY_CONFIG[wo.priority]
                      const type = WO_TYPE_CONFIG[wo.type]
                      const isSelected = selectedWO?.id === wo.id
                      return (
                        <tr key={wo.id}
                          onClick={() => setSelectedWO(isSelected ? null : wo)}
                          className={`border-b cursor-pointer transition-colors
                            ${isDark ? 'border-gray-700 hover:bg-gray-750' : 'border-gray-50 hover:bg-gray-50'}
                            ${isSelected ? (isDark ? 'bg-purple-900/20' : 'bg-purple-50') : ''}`}>
                          <td className="px-4 py-3">
                            <p className={`font-semibold text-xs ${isDark ? 'text-white' : 'text-gray-900'}`}>{wo.id}</p>
                            <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{wo.serviceType}</p>
                          </td>
                          <td className="px-4 py-3">
                            <p className={`text-xs font-medium ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>{wo.vehiclePlate}</p>
                            <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{wo.vehicleMake}</p>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <type.icon size={11} className={type.color} />
                              <span className={`text-xs font-medium ${type.color}`}>{type.label}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${priority.color} ${priority.bg}`}>
                              {priority.label}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <p className={`text-xs truncate max-w-32 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                              {wo.workshopName || 'Unassigned'}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium
                              ${status.color} ${status.bg} ${status.border}`}>
                              {status.label}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                              £{wo.estimatedCost.toLocaleString()}
                            </span>
                            {wo.actualCost > 0 && (
                              <p className={`text-xs ${wo.actualCost > wo.estimatedCost ? 'text-red-600' : 'text-green-600'}`}>
                                Actual: £{wo.actualCost}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                              {wo.estimatedCompletionDate || '—'}
                            </span>
                          </td>
                          <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                            <div className="relative">
                              <button onClick={() => setActiveMenu(activeMenu === wo.id ? null : wo.id)}
                                className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
                                <MoreHorizontal size={14} />
                              </button>
                              {activeMenu === wo.id && (
                                <div className={`absolute right-0 top-8 z-10 rounded-xl shadow-lg border w-44 overflow-hidden
                                  ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                                  {[
                                    { icon: Eye, label: 'View Details', action: () => setSelectedWO(wo) },
                                    { icon: RefreshCw, label: 'Update Status', action: () => {} },
                                    { icon: Building2, label: 'Reassign Workshop', action: () => {} },
                                    { icon: Edit, label: 'Edit Work Order', action: () => {} },
                                    { icon: Trash2, label: 'Cancel WO', action: () => {}, danger: true },
                                  ].map(item => (
                                    <button key={item.label}
                                      onClick={() => { item.action(); setActiveMenu(null) }}
                                      className={`w-full flex items-center gap-2 px-3 py-2.5 text-xs transition-colors
                                        ${(item as any).danger ? 'text-red-600 hover:bg-red-50'
                                          : `${isDark ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-50'}`}`}>
                                      <item.icon size={12} />{item.label}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                <div className={`px-4 py-3 border-t text-xs ${isDark ? 'border-gray-700 text-gray-400' : 'border-gray-100 text-gray-500'}`}>
                  Showing {filteredWOs.length} of {workOrders.length} work orders
                </div>
              </div>

              {/* WO Detail panel */}
              {selectedWO && (
                <div className={`w-80 shrink-0 rounded-2xl border overflow-hidden flex flex-col
                  ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                  <div className={`flex items-center justify-between px-4 py-3 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                    <h3 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>{selectedWO.id}</h3>
                    <button onClick={() => setSelectedWO(null)} className="text-gray-400 hover:text-gray-600">
                      <X size={16} />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">

                    {/* Status workflow */}
                    <div>
                      <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        Workflow
                      </p>
                      <div className="flex items-center gap-0.5">
                        {WO_WORKFLOW_STEPS.map((step, i) => {
                          const cfg = WO_STATUS_CONFIG[step]
                          const currentStep = WO_STATUS_CONFIG[selectedWO.status].step
                          const isDone = cfg.step <= currentStep
                          const isCurrent = cfg.step === currentStep
                          return (
                            <div key={step} className="flex items-center flex-1">
                              <div className={`h-1.5 flex-1 rounded-full ${
                                isDone ? 'bg-purple-500' : isDark ? 'bg-gray-700' : 'bg-gray-200'
                              } ${i === 0 ? 'rounded-l-full' : ''}`}>
                              </div>
                              {isCurrent && (
                                <div className="w-3 h-3 rounded-full bg-purple-600 border-2 border-white shrink-0 -mx-1.5 z-10" />
                              )}
                            </div>
                          )
                        })}
                      </div>
                      <p className={`text-xs mt-1 text-center font-medium text-purple-600`}>
                        {WO_STATUS_CONFIG[selectedWO.status].label}
                      </p>
                    </div>

                    {/* Key details */}
                    <div className="flex flex-col gap-2">
                      {[
                        { label: 'Vehicle', value: `${selectedWO.vehiclePlate} — ${selectedWO.vehicleMake}` },
                        { label: 'Service', value: selectedWO.serviceType },
                        { label: 'Type', value: WO_TYPE_CONFIG[selectedWO.type].label },
                        { label: 'Priority', value: PRIORITY_CONFIG[selectedWO.priority].label },
                        { label: 'Workshop', value: selectedWO.workshopName || 'Unassigned' },
                        { label: 'Driver', value: selectedWO.driverName || '—' },
                        { label: 'Est. Cost', value: `£${selectedWO.estimatedCost.toLocaleString()}` },
                        { label: 'Actual Cost', value: selectedWO.actualCost > 0 ? `£${selectedWO.actualCost}` : '—' },
                        { label: 'Mileage', value: `${selectedWO.mileageAtService.toLocaleString()} mi` },
                        { label: 'Due', value: selectedWO.estimatedCompletionDate || '—' },
                        { label: 'Raised by', value: selectedWO.raisedBy },
                      ].map(item => (
                        <div key={item.label} className="flex items-start justify-between gap-2">
                          <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{item.label}</span>
                          <span className={`text-xs font-medium text-right ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{item.value}</span>
                        </div>
                      ))}
                    </div>

                    {/* Description + Diagnosis */}
                    {selectedWO.description && (
                      <div className={`rounded-xl p-3 ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
                        <p className={`text-xs font-semibold mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Description</p>
                        <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{selectedWO.description}</p>
                      </div>
                    )}
                    {selectedWO.diagnosis && (
                      <div className={`rounded-xl p-3 ${isDark ? 'bg-amber-900/20 border border-amber-800' : 'bg-amber-50 border border-amber-200'}`}>
                        <p className={`text-xs font-semibold mb-1 ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>Diagnosis</p>
                        <p className={`text-xs ${isDark ? 'text-amber-300' : 'text-amber-800'}`}>{selectedWO.diagnosis}</p>
                      </div>
                    )}

                    {/* Parts */}
                    {selectedWO.parts.length > 0 && (
                      <div>
                        <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          Parts Required
                        </p>
                        <div className="flex flex-col gap-1.5">
                          {selectedWO.parts.map((part, i) => (
                            <div key={i} className={`flex items-center justify-between px-3 py-2 rounded-lg
                              ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
                              <div>
                                <p className={`text-xs font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{part.name}</p>
                                <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Qty: {part.quantity}</p>
                              </div>
                              <span className={`text-xs font-bold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                £{(part.quantity * part.unitCost).toLocaleString()}
                              </span>
                            </div>
                          ))}
                          <div className={`flex items-center justify-between px-3 py-2 rounded-lg font-bold
                            ${isDark ? 'bg-gray-600' : 'bg-gray-100'}`}>
                            <span className={`text-xs ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>Parts Total</span>
                            <span className={`text-xs ${isDark ? 'text-white' : 'text-gray-900'}`}>
                              £{selectedWO.parts.reduce((a, p) => a + p.quantity * p.unitCost, 0).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Timeline */}
                    <div>
                      <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        Timeline
                      </p>
                      <div className="flex flex-col gap-2">
                        {selectedWO.timeline.map((entry, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <div className="flex flex-col items-center shrink-0">
                              <div className="w-2 h-2 rounded-full bg-purple-500 mt-1"></div>
                              {i < selectedWO.timeline.length - 1 && (
                                <div className={`w-px flex-1 mt-1 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`} style={{ minHeight: 16 }}></div>
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className={`text-xs font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                                  {WO_STATUS_CONFIG[entry.status]?.label || entry.status}
                                </span>
                                <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                  {new Date(entry.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{entry.note}</p>
                              <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>by {entry.by}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── WORKSHOP TAB ──────────────────────────────────────────────────── */}
        {activeTab === 'workshop' && (
          <>
            <div className="flex items-center justify-between mb-4">
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                {workshops.length} workshops registered — {workshops.filter(w => w.type === 'internal').length} internal · {workshops.filter(w => w.type === 'vendor').length} vendor
              </p>
              <button onClick={() => setShowWorkshopModal(true)}
                className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
                <Plus size={15} /> Add Workshop
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {workshops.map(ws => {
                const loadPct = Math.round((ws.currentLoad / ws.capacity) * 100)
                return (
                  <div key={ws.id}
                    className={`rounded-2xl border p-5 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0
                          ${ws.type === 'internal' ? 'bg-purple-50' : 'bg-blue-50'}`}>
                          <Building2 size={18} className={ws.type === 'internal' ? 'text-purple-600' : 'text-blue-600'} />
                        </div>
                        <div>
                          <p className={`font-bold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>{ws.name}</p>
                          <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{ws.location}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium mt-1 inline-block
                            ${ws.type === 'internal'
                              ? 'bg-purple-50 text-purple-700 border border-purple-200'
                              : 'bg-blue-50 text-blue-700 border border-blue-200'}`}>
                            {ws.type === 'internal' ? '🏭 Internal' : '🔧 Vendor'}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
                          <Edit size={13} />
                        </button>
                        <button className="p-1.5 rounded-lg hover:bg-red-50 text-red-500">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Capacity */}
                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          Capacity — {ws.currentLoad}/{ws.capacity} bays
                        </span>
                        <span className={`text-xs font-bold ${loadPct > 80 ? 'text-red-600' : loadPct > 60 ? 'text-amber-600' : 'text-green-600'}`}>
                          {loadPct}% full
                        </span>
                      </div>
                      <div className={`h-2 rounded-full overflow-hidden ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
                        <div className="h-full rounded-full transition-all"
                          style={{ width: `${loadPct}%`, background: loadPct > 80 ? '#ef4444' : loadPct > 60 ? '#f59e0b' : '#22c55e' }} />
                      </div>
                    </div>

                    {/* Contact */}
                    <div className="flex flex-col gap-1.5 mb-3">
                      <div className="flex items-center gap-2">
                        <MapPin size={12} className="text-gray-400 shrink-0" />
                        <span className={`text-xs truncate ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{ws.address}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone size={12} className="text-gray-400 shrink-0" />
                        <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{ws.phone}</span>
                      </div>
                    </div>

                    {/* Specialisations */}
                    <div className="flex flex-wrap gap-1.5">
                      {ws.specialisations.map(spec => (
                        <span key={spec} className={`text-xs px-2 py-0.5 rounded-full
                          ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
                          {spec}
                        </span>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* ── SERVICE LOG TAB ───────────────────────────────────────────────── */}
        {activeTab === 'log' && (
          <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
            {/* DEVELOPER NOTE: GET /api/fleetpoint/maintenance/log
                Filter by: vehicleId, fleetId, serviceType, dateFrom, dateTo
                Export: GET /api/fleetpoint/maintenance/log/export?format=pdf|xlsx */}
            <div className={`flex items-center justify-between px-4 py-3 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
              <h3 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>Service History</h3>
              <div className="flex items-center gap-2">
                <button className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border ${isDark ? 'border-gray-700 text-gray-300' : 'border-gray-200 text-gray-600'}`}>
                  <Download size={12} /> XLS
                </button>
                <button className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border ${isDark ? 'border-gray-700 text-gray-300' : 'border-gray-200 text-gray-600'}`}>
                  <Download size={12} /> PDF
                </button>
              </div>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className={`border-b text-xs font-semibold uppercase tracking-wide
                  ${isDark ? 'border-gray-700 bg-gray-900 text-gray-400' : 'border-gray-100 bg-gray-50 text-gray-500'}`}>
                  <th className="px-4 py-3 text-left">WO ID</th>
                  <th className="px-4 py-3 text-left">Vehicle</th>
                  <th className="px-4 py-3 text-left">Service Type</th>
                  <th className="px-4 py-3 text-left">Workshop</th>
                  <th className="px-4 py-3 text-left">Completed</th>
                  <th className="px-4 py-3 text-left">Mileage</th>
                  <th className="px-4 py-3 text-left">Next Service</th>
                  <th className="px-4 py-3 text-left">Actual Cost</th>
                </tr>
              </thead>
              <tbody>
                {workOrders.filter(w => w.status === 'completed').map(wo => (
                  <tr key={wo.id}
                    className={`border-b ${isDark ? 'border-gray-700 hover:bg-gray-750' : 'border-gray-50 hover:bg-gray-50'}`}>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-mono ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{wo.id}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>{wo.vehiclePlate}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{wo.serviceType}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{wo.workshopName}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{wo.actualCompletionDate}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        {wo.mileageAtService.toLocaleString()} mi
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{wo.nextServiceDate || '—'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium ${wo.actualCost > wo.estimatedCost ? 'text-red-600' : 'text-green-600'}`}>
                        £{wo.actualCost.toLocaleString()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── PREDICTIONS TAB ───────────────────────────────────────────────── */}
        {activeTab === 'predictions' && (
          <div className="flex flex-col gap-4">

            {/* ML disclaimer */}
            <div className={`rounded-2xl p-4 flex items-start gap-3
              ${isDark ? 'bg-purple-900/20 border border-purple-800' : 'bg-purple-50 border border-purple-200'}`}>
              <Bot size={18} className="text-purple-500 mt-0.5 shrink-0" />
              <div>
                <p className={`text-sm font-semibold ${isDark ? 'text-purple-300' : 'text-purple-800'}`}>
                  AI-Powered Predictive Maintenance
                </p>
                <p className={`text-xs mt-0.5 ${isDark ? 'text-purple-400' : 'text-purple-700'}`}>
                  Predictions generated by ML microservice combining: telematics data, driving behaviour scores,
                  CAN bus fault codes, service history, and manufacturer intervals.
                  Confidence scores shown per prediction.
                </p>
                {/* DEVELOPER NOTE:
                    ML microservice: Python/FastAPI — separate deployment
                    Backend calls: POST /api/ml/vehicle-health/:id/recalculate
                    Frontend reads: GET /api/fleetpoint/maintenance/predictions
                    Retrain model: POST /api/ml/model/retrain (admin only)
                    CAN bus inputs: parsed by separate CAN bus parser microservice
                */}
              </div>
            </div>

            {/* Predictions list */}
            <div className="flex flex-col gap-3">
              {maintenancePredictions.map(pred => {
                const urgency = URGENCY_CONFIG[pred.urgency]
                return (
                  <div key={pred.id}
                    className={`rounded-2xl border p-4 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}
                      ${pred.urgency === 'critical' ? 'border-l-4 border-l-red-500' : pred.urgency === 'high' ? 'border-l-4 border-l-orange-400' : ''}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className={`font-bold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {pred.vehiclePlate}
                          </span>
                          <span className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            — {pred.component}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium
                            ${urgency.color} ${urgency.bg} ${urgency.border}`}>
                            {urgency.label}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                            ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
                            {pred.confidence}% confidence
                          </span>
                          {pred.workOrderRaised && (
                            <span className="text-xs text-green-600 font-medium">✓ WO Raised</span>
                          )}
                        </div>

                        <div className="flex items-center gap-4 mb-2 flex-wrap">
                          <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            📅 Predicted failure: <strong>{pred.predictedFailureDate}</strong>
                            ({pred.daysUntilFailure} days)
                          </span>
                          <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            💰 Est. cost: <strong>£{pred.estimatedCost.toLocaleString()}</strong>
                          </span>
                        </div>

                        <p className={`text-xs mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                          <span className="font-medium">ML Reasoning: </span>
                          {pred.reasoning}
                        </p>

                        {/* Data points used */}
                        <div className="flex flex-wrap gap-1.5">
                          {pred.dataPoints.mileageSinceLastService && (
                            <span className={`text-xs px-2 py-0.5 rounded-full ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
                              🛣️ {pred.dataPoints.mileageSinceLastService.toLocaleString()} mi since service
                            </span>
                          )}
                          {pred.dataPoints.drivingBehaviourScore && (
                            <span className={`text-xs px-2 py-0.5 rounded-full ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
                              🚗 Driver score: {pred.dataPoints.drivingBehaviourScore}
                            </span>
                          )}
                          {pred.dataPoints.canBusFaultCode && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-700 font-mono font-bold">
                              ⚠️ {pred.dataPoints.canBusFaultCode}
                            </span>
                          )}
                          {pred.dataPoints.daysSinceLastService && (
                            <span className={`text-xs px-2 py-0.5 rounded-full ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
                              📆 {pred.dataPoints.daysSinceLastService} days since service
                            </span>
                          )}
                        </div>

                        <div className={`mt-2 text-xs font-medium ${pred.urgency === 'critical' ? 'text-red-600' : 'text-amber-600'}`}>
                          ⚡ Action: {pred.actionRequired}
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 shrink-0">
                        {!pred.workOrderRaised && (
                          <button
                            onClick={() => setShowCreateModal(true)}
                            className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold px-3 py-2 rounded-xl transition-colors">
                            <Zap size={12} /> Raise Work Order
                          </button>
                        )}
                        <button className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl border transition-colors
                          ${isDark ? 'border-gray-700 text-gray-300 hover:bg-gray-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                          <Eye size={12} /> View Vehicle
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Create Work Order Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-md">
          <div className={`rounded-3xl shadow-2xl w-full max-w-lg mx-4 p-6 ${isDark ? 'bg-gray-900' : 'bg-white'}`}>
            <div className="flex items-center justify-between mb-5">
              <h2 className={`font-bold text-lg ${isDark ? 'text-white' : 'text-gray-900'}`}>New Work Order</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            {/* DEVELOPER NOTE:
                POST /api/fleetpoint/work-orders
                Body: { vehicleId, workshopId, type, priority, serviceType,
                        description, estimatedCost, estimatedCompletionDate,
                        raisedFromPredictionId? }
                On success: add to local state, show toast, close modal
                If raisedFromPredictionId set: mark prediction.workOrderRaised = true
            */}
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Vehicle *</label>
                  <select className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none ${isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-700'}`}>
                    <option value="">Select vehicle...</option>
                    {vehicles.map(v => <option key={v.id} value={v.id}>{v.plate} — {v.make} {v.model}</option>)}
                  </select>
                </div>
                <div>
                  <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Priority *</label>
                  <select className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none ${isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-700'}`}>
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="normal" selected>Normal</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Type *</label>
                  <select className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none ${isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-700'}`}>
                    {Object.entries(WO_TYPE_CONFIG).map(([val, cfg]) => <option key={val} value={val}>{cfg.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Workshop</label>
                  <select className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none ${isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-700'}`}>
                    <option value="">Unassigned</option>
                    {workshops.map(ws => <option key={ws.id} value={ws.id}>{ws.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Service Type *</label>
                <input placeholder="e.g. Oil Change, Brake Inspection, Full Service..."
                  className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-purple-500
                    ${isDark ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'}`} />
              </div>
              <div>
                <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Description</label>
                <textarea rows={2} placeholder="Describe the issue or service required..."
                  className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-purple-500 resize-none
                    ${isDark ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'}`} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Est. Cost (£)</label>
                  <input type="number" placeholder="0"
                    className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none ${isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-700'}`} />
                </div>
                <div>
                  <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Target Date</label>
                  <input type="date"
                    className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none ${isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-700'}`} />
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowCreateModal(false)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium border ${isDark ? 'border-gray-700 text-gray-300' : 'border-gray-200 text-gray-600'}`}>
                Cancel
              </button>
              <button onClick={() => setShowCreateModal(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-purple-600 hover:bg-purple-700 text-white transition-colors">
                Raise Work Order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Workshop Modal */}
      {showWorkshopModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-md">
          <div className={`rounded-3xl shadow-2xl w-full max-w-lg mx-4 p-6 ${isDark ? 'bg-gray-900' : 'bg-white'}`}>
            <div className="flex items-center justify-between mb-5">
              <h2 className={`font-bold text-lg ${isDark ? 'text-white' : 'text-gray-900'}`}>Add Workshop</h2>
              <button onClick={() => setShowWorkshopModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            {/* DEVELOPER NOTE: POST /api/fleetpoint/workshops */}
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Workshop Name *</label>
                  <input placeholder="e.g. Volvo Truck Centre"
                    className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-purple-500
                      ${isDark ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'}`} />
                </div>
                <div>
                  <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Type *</label>
                  <select className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none ${isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-700'}`}>
                    <option value="internal">Internal</option>
                    <option value="vendor">Vendor</option>
                  </select>
                </div>
              </div>
              <div>
                <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Address *</label>
                <input placeholder="Full address"
                  className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-purple-500
                    ${isDark ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'}`} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Phone</label>
                  <input placeholder="+44..."
                    className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none ${isDark ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'}`} />
                </div>
                <div>
                  <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Capacity (bays)</label>
                  <input type="number" placeholder="e.g. 6"
                    className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none ${isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-700'}`} />
                </div>
              </div>
              <div>
                <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Specialisations (comma separated)</label>
                <input placeholder="e.g. HGV Service, Tyres, Brake Systems"
                  className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-purple-500
                    ${isDark ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'}`} />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowWorkshopModal(false)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium border ${isDark ? 'border-gray-700 text-gray-300' : 'border-gray-200 text-gray-600'}`}>
                Cancel
              </button>
              <button onClick={() => setShowWorkshopModal(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-purple-600 hover:bg-purple-700 text-white transition-colors">
                Add Workshop
              </button>
            </div>
          </div>
        </div>
      )}
    </FleetpointLayout>
  )
}
