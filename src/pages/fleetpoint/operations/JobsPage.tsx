// src/pages/fleetpoint/operations/JobsPage.tsx
// Jobs management — list view + calendar dispatch view
// Person-centric job system — works for drivers, field technicians, any mobile worker
//
// DEVELOPER NOTES:
// ─────────────────────────────────────────────────────────────────────────────
// Two views:
// 1. LIST VIEW — searchable, filterable table of all jobs
// 2. CALENDAR DISPATCH VIEW — time grid per driver, shows availability
//
// Calendar view data: GET /api/fleetpoint/jobs/calendar?date=YYYY-MM-DD&view=day|week
// Response: { drivers: [{ driverId, jobs: [{ id, start, end, status, ... }] }] }
//
// Job status flow:
// pending → assigned → in-progress → completed
//                   ↘ failed | cancelled
//
// POI Integration:
// GPS ping at pickupPoiId radius → auto status: in-progress
// GPS ping at dropoffPoiId radius → auto status: completed
// Server handles this — frontend just receives status update via WebSocket
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search, Plus, Download, Filter, Calendar, List,
  Clock, CheckCircle, AlertTriangle, XCircle, Truck,
  MapPin, ChevronRight, MoreHorizontal, Eye, Edit,
  Trash2, X, ChevronUp, ChevronDown, Play, Package
} from 'lucide-react'
import FleetpointLayout from '../../../layouts/FleetpointLayout'
import { jobs, drivers, vehicles } from '../../../data/fleetData'
import { useTheme } from '../../../hooks/useTheme'
import type { Job, JobStatus, JobType, JobPriority } from '../../../data/fleetData'

// ─── Config ───────────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<JobStatus, { label: string; color: string; bg: string; border: string; icon: any }> = {
  pending:     { label: 'Pending',     color: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-200',  icon: Clock },
  assigned:    { label: 'Assigned',    color: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-200',   icon: Truck },
  'in-progress': { label: 'In Progress', color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200', icon: Play },
  completed:   { label: 'Completed',   color: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-200',  icon: CheckCircle },
  failed:      { label: 'Failed',      color: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-200',    icon: XCircle },
  cancelled:   { label: 'Cancelled',   color: 'text-gray-600',   bg: 'bg-gray-100',  border: 'border-gray-200',   icon: XCircle },
}

const PRIORITY_CONFIG: Record<JobPriority, { label: string; color: string; dot: string }> = {
  high:   { label: 'High',   color: 'text-red-600',   dot: 'bg-red-500' },
  normal: { label: 'Normal', color: 'text-blue-600',  dot: 'bg-blue-400' },
  low:    { label: 'Low',    color: 'text-gray-500',  dot: 'bg-gray-300' },
}

const TYPE_CONFIG: Record<JobType, { label: string; color: string }> = {
  delivery:   { label: 'Delivery',   color: 'text-purple-600' },
  collection: { label: 'Collection', color: 'text-blue-600' },
  transfer:   { label: 'Transfer',   color: 'text-teal-600' },
  inspection: { label: 'Inspection', color: 'text-amber-600' },
  'ad-hoc':   { label: 'Ad Hoc',    color: 'text-rose-600' },
}

const formatTime = (iso: string) => {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

const formatDate = (iso: string) => {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

type ViewMode = 'list' | 'calendar'
type SortField = 'name' | 'status' | 'priority' | 'driver' | 'scheduledStart'

// ─── Calendar helpers ─────────────────────────────────────────────────────────
const HOURS = Array.from({ length: 14 }, (_, i) => i + 6) // 06:00 to 19:00

const getJobPosition = (job: Job) => {
  const start = new Date(job.scheduledStart)
  const end = new Date(job.scheduledEnd)
  const startHour = start.getHours() + start.getMinutes() / 60
  const endHour = end.getHours() + end.getMinutes() / 60
  const left = ((startHour - 6) / 14) * 100
  const width = ((endHour - startHour) / 14) * 100
  return { left: `${Math.max(0, left)}%`, width: `${Math.min(width, 100 - Math.max(0, left))}%` }
}

const STATUS_CALENDAR_COLOR: Record<JobStatus, string> = {
  pending: '#f59e0b',
  assigned: '#3b82f6',
  'in-progress': '#7c3aed',
  completed: '#22c55e',
  failed: '#ef4444',
  cancelled: '#6b7280',
}

export default function JobsPage() {
  const { isDark } = useTheme()
  const navigate = useNavigate()
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | JobStatus>('all')
  const [filterType, setFilterType] = useState<'all' | JobType>('all')
  const [filterDriver, setFilterDriver] = useState('all')
  const [showFilters, setShowFilters] = useState(false)
  const [sortField, setSortField] = useState<SortField>('scheduledStart')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [activeMenu, setActiveMenu] = useState<string | null>(null)
  const [editJob, setEditJob] = useState<Job | null>(null)

  // ── KPIs ────────────────────────────────────────────────────────────────────
  const total = jobs.length
  const pending = jobs.filter(j => j.status === 'pending').length
  const inProgress = jobs.filter(j => j.status === 'in-progress').length
  const completed = jobs.filter(j => j.status === 'completed').length
  const failed = jobs.filter(j => j.status === 'failed').length
  const highPriority = jobs.filter(j => j.priority === 'high' && j.status !== 'completed').length

  // ── Filtered + sorted ───────────────────────────────────────────────────────
  const filtered = jobs
    .filter(j => {
      const s = search.toLowerCase()
      const matchSearch = !search ||
        j.name.toLowerCase().includes(s) ||
        j.driverName.toLowerCase().includes(s) ||
        j.vehiclePlate.toLowerCase().includes(s) ||
        j.pickupAddress.toLowerCase().includes(s) ||
        j.dropoffAddress.toLowerCase().includes(s)
      const matchStatus = filterStatus === 'all' || j.status === filterStatus
      const matchType = filterType === 'all' || j.type === filterType
      const matchDriver = filterDriver === 'all' || j.driverId === filterDriver
      return matchSearch && matchStatus && matchType && matchDriver
    })
    .sort((a, b) => {
      let aVal: any, bVal: any
      switch (sortField) {
        case 'name': aVal = a.name; bVal = b.name; break
        case 'status': aVal = a.status; bVal = b.status; break
        case 'priority': aVal = a.priority; bVal = b.priority; break
        case 'driver': aVal = a.driverName; bVal = b.driverName; break
        case 'scheduledStart': aVal = a.scheduledStart; bVal = b.scheduledStart; break
        default: aVal = a.scheduledStart; bVal = b.scheduledStart
      }
      return sortDir === 'asc'
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal))
    })

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }

  const SortIcon = ({ field }: { field: SortField }) => (
    <span className="ml-1 inline-flex flex-col">
      <ChevronUp size={10} className={sortField === field && sortDir === 'asc' ? 'text-purple-600' : 'text-gray-300'} />
      <ChevronDown size={10} className={sortField === field && sortDir === 'desc' ? 'text-purple-600' : 'text-gray-300'} />
    </span>
  )

  // ── Calendar — group jobs by driver ─────────────────────────────────────────
  const calendarDrivers = drivers.map(d => ({
    driver: d,
    vehicle: vehicles.find(v => v.driverId === d.id),
    jobs: jobs.filter(j => j.driverId === d.id),
  }))

  return (
    <FleetpointLayout>
      <div className={`p-6 min-h-full ${isDark ? 'bg-gray-950' : 'bg-gray-50'}`}>

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Jobs</h1>
            <p className={`text-sm mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              {total} jobs today · {inProgress} in progress · {highPriority} high priority
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className={`flex rounded-xl border overflow-hidden ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
              {([
                { mode: 'list', icon: List, label: 'List' },
                { mode: 'calendar', icon: Calendar, label: 'Dispatch' },
              ] as { mode: ViewMode; icon: any; label: string }[]).map(v => (
                <button key={v.mode} onClick={() => setViewMode(v.mode)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors
                    ${viewMode === v.mode
                      ? 'bg-purple-600 text-white'
                      : `${isDark ? 'bg-gray-800 text-gray-400 hover:bg-gray-700' : 'bg-white text-gray-500 hover:bg-gray-50'}`
                    }`}>
                  <v.icon size={13} /> {v.label}
                </button>
              ))}
            </div>
            <button className={`flex items-center gap-2 text-sm px-3 py-2 rounded-xl border transition-colors
              ${isDark ? 'border-gray-700 text-gray-300 hover:bg-gray-800' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              <Download size={15} /> Export
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
              <Plus size={15} /> Create Job
            </button>
          </div>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-6 gap-3 mb-5">
          {[
            { label: 'Total', value: total, color: 'text-gray-600', bg: 'bg-gray-100', icon: Package, onClick: () => setFilterStatus('all') },
            { label: 'Pending', value: pending, color: 'text-amber-600', bg: 'bg-amber-50', icon: Clock, onClick: () => setFilterStatus('pending') },
            { label: 'In Progress', value: inProgress, color: 'text-purple-600', bg: 'bg-purple-50', icon: Play, onClick: () => setFilterStatus('in-progress') },
            { label: 'Completed', value: completed, color: 'text-green-600', bg: 'bg-green-50', icon: CheckCircle, onClick: () => setFilterStatus('completed') },
            { label: 'Failed', value: failed, color: 'text-red-600', bg: 'bg-red-50', icon: XCircle, onClick: () => setFilterStatus('failed') },
            { label: 'High Priority', value: highPriority, color: 'text-rose-600', bg: 'bg-rose-50', icon: AlertTriangle, onClick: () => {} },
          ].map((kpi, i) => (
            <button key={i} onClick={kpi.onClick}
              className={`border rounded-2xl p-3 text-left transition-all hover:shadow-md
                ${filterStatus === (['all', 'pending', 'in-progress', 'completed', 'failed'] as const)[i]
                  ? 'ring-2 ring-purple-500'
                  : ''
                }
                ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
              <div className={`w-7 h-7 rounded-lg ${kpi.bg} flex items-center justify-center mb-2`}>
                <kpi.icon size={14} className={kpi.color} />
              </div>
              <p className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{kpi.value}</p>
              <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{kpi.label}</p>
            </button>
          ))}
        </div>

        {/* ── LIST VIEW ──────────────────────────────────────────────────────── */}
        {viewMode === 'list' && (
          <>
            {/* Search + filters */}
            <div className={`rounded-2xl border p-4 mb-4 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
              <div className="flex items-center gap-3">
                <div className={`flex-1 flex items-center gap-2 border rounded-xl px-3 py-2
                  ${isDark ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-gray-50'}`}>
                  <Search size={14} className="text-gray-400 shrink-0" />
                  <input type="text" placeholder="Search job name, driver, vehicle, location..."
                    value={search} onChange={e => setSearch(e.target.value)}
                    className={`flex-1 text-sm outline-none bg-transparent
                      ${isDark ? 'text-white placeholder-gray-500' : 'text-gray-900 placeholder-gray-400'}`} />
                  {search && <button onClick={() => setSearch('')}><X size={12} className="text-gray-400" /></button>}
                </div>
                <button onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center gap-2 text-sm px-3 py-2 rounded-xl border transition-colors
                    ${showFilters ? 'border-purple-500 bg-purple-50 text-purple-600'
                      : `${isDark ? 'border-gray-700 text-gray-300' : 'border-gray-200 text-gray-600'}`}`}>
                  <Filter size={14} /> Filters
                </button>
              </div>
              {showFilters && (
                <div className="flex items-center gap-3 mt-3 flex-wrap">
                  <select value={filterType} onChange={e => setFilterType(e.target.value as any)}
                    className={`text-sm border rounded-xl px-3 py-2 outline-none ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200 text-gray-700'}`}>
                    <option value="all">All Types</option>
                    {Object.entries(TYPE_CONFIG).map(([val, cfg]) => <option key={val} value={val}>{cfg.label}</option>)}
                  </select>
                  <select value={filterDriver} onChange={e => setFilterDriver(e.target.value)}
                    className={`text-sm border rounded-xl px-3 py-2 outline-none ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200 text-gray-700'}`}>
                    <option value="all">All Drivers</option>
                    {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  <button onClick={() => { setFilterStatus('all'); setFilterType('all'); setFilterDriver('all'); setSearch('') }}
                    className="text-xs text-purple-600 hover:underline">Clear all</button>
                </div>
              )}
            </div>

            {/* Table + Detail panel */}
            <div className="flex gap-4">
              <div className={`flex-1 rounded-2xl border overflow-hidden ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className={`border-b text-xs font-semibold uppercase tracking-wide
                        ${isDark ? 'border-gray-700 bg-gray-900 text-gray-400' : 'border-gray-100 bg-gray-50 text-gray-500'}`}>
                        <th className="px-4 py-3 text-left cursor-pointer" onClick={() => toggleSort('name')}>
                          Job <SortIcon field="name" />
                        </th>
                        <th className="px-4 py-3 text-left cursor-pointer" onClick={() => toggleSort('driver')}>
                          Driver <SortIcon field="driver" />
                        </th>
                        <th className="px-4 py-3 text-left">Vehicle</th>
                        <th className="px-4 py-3 text-left">Type</th>
                        <th className="px-4 py-3 text-left cursor-pointer" onClick={() => toggleSort('priority')}>
                          Priority <SortIcon field="priority" />
                        </th>
                        <th className="px-4 py-3 text-left">Pickup</th>
                        <th className="px-4 py-3 text-left">Dropoff</th>
                        <th className="px-4 py-3 text-left cursor-pointer" onClick={() => toggleSort('scheduledStart')}>
                          Scheduled <SortIcon field="scheduledStart" />
                        </th>
                        <th className="px-4 py-3 text-left cursor-pointer" onClick={() => toggleSort('status')}>
                          Status <SortIcon field="status" />
                        </th>
                        <th className="px-4 py-3 text-left">Tasks</th>
                        <th className="px-4 py-3 text-left">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(job => {
                        const status = STATUS_CONFIG[job.status]
                        const priority = PRIORITY_CONFIG[job.priority]
                        const type = TYPE_CONFIG[job.type]
                        const doneTasks = job.tasks.filter(t => t.status === 'done').length
                        const isSelected = selectedJob?.id === job.id
                        return (
                          <tr key={job.id}
                            onClick={() => setSelectedJob(isSelected ? null : job)}
                            className={`border-b cursor-pointer transition-colors
                              ${isDark ? 'border-gray-700 hover:bg-gray-750' : 'border-gray-50 hover:bg-gray-50'}
                              ${isSelected ? (isDark ? 'bg-purple-900/20' : 'bg-purple-50') : ''}`}>

                            <td className="px-4 py-3">
                              <p className={`font-semibold text-xs ${isDark ? 'text-white' : 'text-gray-900'}`}>{job.name}</p>
                              <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{job.id}</p>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                                  {job.driverName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                </div>
                                <span className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{job.driverName}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`text-xs font-medium ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>
                                {job.vehiclePlate}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`text-xs font-medium ${type.color}`}>{type.label}</span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1.5">
                                <div className={`w-2 h-2 rounded-full ${priority.dot}`}></div>
                                <span className={`text-xs font-medium ${priority.color}`}>{priority.label}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 max-w-32">
                              <span className={`text-xs truncate block ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                {job.pickupAddress.split(',')[0]}
                              </span>
                            </td>
                            <td className="px-4 py-3 max-w-32">
                              <span className={`text-xs truncate block ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                {job.dropoffAddress.split(',')[0]}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <p className={`text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                {formatTime(job.scheduledStart)}
                              </p>
                              <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                → {formatTime(job.scheduledEnd)}
                              </p>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`text-xs px-2 py-0.5 rounded-full border font-medium
                                ${status.color} ${status.bg} ${status.border}`}>
                                {status.label}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1.5">
                                <div className={`flex-1 h-1.5 rounded-full overflow-hidden w-12 ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
                                  <div className="h-full rounded-full bg-purple-500"
                                    style={{ width: `${job.tasks.length > 0 ? (doneTasks / job.tasks.length) * 100 : 0}%` }} />
                                </div>
                                <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                  {doneTasks}/{job.tasks.length}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                              <div className="relative">
                                <button onClick={() => setActiveMenu(activeMenu === job.id ? null : job.id)}
                                  className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
                                  <MoreHorizontal size={14} />
                                </button>
                                {activeMenu === job.id && (
                                  <div className={`absolute right-0 top-8 z-10 rounded-xl shadow-lg border w-40 overflow-hidden
                                    ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                                    {[
                                      { icon: Eye, label: 'View Details', action: () => setSelectedJob(job) },
                                      { icon: MapPin, label: 'Track on Map', action: () => navigate('/fleetpoint/live-tracking') },
                                      { icon: Edit, label: 'Edit Job', action: () => {} },
                                      { icon: Trash2, label: 'Cancel Job', action: () => {}, danger: true },
                                    ].map(item => (
                                      <button key={item.label}
                                        onClick={() => { item.action(); setActiveMenu(null) }}
                                        className={`w-full flex items-center gap-2 px-3 py-2.5 text-xs transition-colors
                                          ${(item as any).danger
                                            ? 'text-red-600 hover:bg-red-50'
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
                </div>
                <div className={`px-4 py-3 border-t text-xs ${isDark ? 'border-gray-700 text-gray-400' : 'border-gray-100 text-gray-500'}`}>
                  Showing {filtered.length} of {jobs.length} jobs
                </div>
              </div>

              {/* Job detail panel */}
              {selectedJob && (
                <div className={`w-80 shrink-0 rounded-2xl border overflow-hidden flex flex-col
                  ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                  <div className={`flex items-center justify-between px-4 py-3 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                    <h3 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>Job Details</h3>
                    <button onClick={() => setSelectedJob(null)} className="text-gray-400 hover:text-gray-600">
                      <X size={16} />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
                    <div>
                      <p className={`font-bold text-sm mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>{selectedJob.name}</p>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium
                          ${STATUS_CONFIG[selectedJob.status].color} ${STATUS_CONFIG[selectedJob.status].bg} ${STATUS_CONFIG[selectedJob.status].border}`}>
                          {STATUS_CONFIG[selectedJob.status].label}
                        </span>
                        <span className={`text-xs font-medium ${PRIORITY_CONFIG[selectedJob.priority].color}`}>
                          {PRIORITY_CONFIG[selectedJob.priority].label} priority
                        </span>
                      </div>
                    </div>

                    {[
                      { label: 'Driver', value: selectedJob.driverName },
                      { label: 'Vehicle', value: selectedJob.vehiclePlate },
                      { label: 'Type', value: TYPE_CONFIG[selectedJob.type].label },
                      { label: 'Distance', value: `${selectedJob.distanceMiles} miles` },
                      { label: 'Est. Time', value: `${selectedJob.estimatedMinutes} mins` },
                      { label: 'Scheduled', value: `${formatTime(selectedJob.scheduledStart)} → ${formatTime(selectedJob.scheduledEnd)}` },
                      { label: 'Started', value: formatTime(selectedJob.actualStart) },
                      { label: 'Completed', value: formatTime(selectedJob.actualEnd) },
                    ].map(item => (
                      <div key={item.label} className="flex items-start justify-between gap-2">
                        <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{item.label}</span>
                        <span className={`text-xs font-medium text-right ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{item.value}</span>
                      </div>
                    ))}

                    <div className={`rounded-xl p-3 ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <MapPin size={12} className="text-purple-500 shrink-0" />
                        <span className={`text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Pickup</span>
                      </div>
                      <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{selectedJob.pickupAddress}</p>
                      <div className="flex items-center gap-2 mt-2 mb-1">
                        <MapPin size={12} className="text-green-500 shrink-0" />
                        <span className={`text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Dropoff</span>
                      </div>
                      <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{selectedJob.dropoffAddress}</p>
                    </div>

                    {/* Tasks */}
                    <div>
                      <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        Tasks ({selectedJob.tasks.filter(t => t.status === 'done').length}/{selectedJob.tasks.length})
                      </p>
                      <div className="flex flex-col gap-1.5">
                        {selectedJob.tasks.map(task => (
                          <div key={task.id} className={`flex items-start gap-2 p-2 rounded-lg
                            ${task.status === 'done'
                              ? `${isDark ? 'bg-green-900/20' : 'bg-green-50'}`
                              : `${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}`}>
                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5
                              ${task.status === 'done' ? 'bg-green-500 border-green-500' : `${isDark ? 'border-gray-500' : 'border-gray-300'}`}`}>
                              {task.status === 'done' && <CheckCircle size={10} className="text-white" />}
                            </div>
                            <p className={`text-xs leading-snug ${task.status === 'done'
                              ? `line-through ${isDark ? 'text-gray-500' : 'text-gray-400'}`
                              : `${isDark ? 'text-gray-300' : 'text-gray-700'}`}`}>
                              {task.description}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {selectedJob.notes && (
                      <div className={`rounded-xl p-3 ${isDark ? 'bg-amber-900/20 border border-amber-800' : 'bg-amber-50 border border-amber-200'}`}>
                        <p className={`text-xs font-medium mb-1 ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>Notes</p>
                        <p className={`text-xs ${isDark ? 'text-amber-300' : 'text-amber-800'}`}>{selectedJob.notes}</p>
                      </div>
                    )}

                    <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      Created by {selectedJob.createdBy} · {formatDate(selectedJob.createdAt)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── CALENDAR DISPATCH VIEW ─────────────────────────────────────────── */}
        {viewMode === 'calendar' && (
          <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>

            {/* Calendar header */}
            <div className={`flex items-center justify-between px-5 py-3 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
              <div className="flex items-center gap-3">
                <h3 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Dispatch Calendar — Today
                </h3>
                <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
                </span>
              </div>
              {/* Status legend */}
              <div className="flex items-center gap-3">
                {Object.entries(STATUS_CALENDAR_COLOR).slice(0, 4).map(([status, color]) => (
                  <div key={status} className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }}></div>
                    <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'} capitalize`}>
                      {STATUS_CONFIG[status as JobStatus].label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Time grid */}
            <div className="overflow-x-auto">
              <div style={{ minWidth: '900px' }}>

                {/* Hour labels */}
                <div className={`flex border-b ${isDark ? 'border-gray-700' : 'border-gray-100'}`}>
                  <div className="w-44 shrink-0" />
                  <div className="flex-1 flex">
                    {HOURS.map(hour => (
                      <div key={hour} className={`flex-1 text-center py-2 text-xs border-l
                        ${isDark ? 'border-gray-700 text-gray-400' : 'border-gray-100 text-gray-500'}`}>
                        {String(hour).padStart(2, '0')}:00
                      </div>
                    ))}
                  </div>
                </div>

                {/* Driver rows */}
                {calendarDrivers.map(({ driver, vehicle, jobs: driverJobs }) => (
                  <div key={driver.id}
                    className={`flex border-b ${isDark ? 'border-gray-700' : 'border-gray-100'}`}
                    style={{ minHeight: '56px' }}>

                    {/* Driver info */}
                    <div className={`w-44 shrink-0 px-3 py-2 flex items-center gap-2 border-r
                      ${isDark ? 'border-gray-700' : 'border-gray-100'}`}>
                      <div className="relative shrink-0">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-xs font-bold">
                          {driver.avatar}
                        </div>
                        <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2
                          ${isDark ? 'border-gray-800' : 'border-white'}
                          ${driver.status === 'on-duty' ? 'bg-green-400' : driver.status === 'on-break' ? 'bg-amber-400' : 'bg-gray-300'}`}>
                        </div>
                      </div>
                      <div className="min-w-0">
                        <p className={`text-xs font-semibold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          {driver.name.split(' ')[0]}
                        </p>
                        <p className={`text-xs truncate ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          {vehicle ? vehicle.plate : 'No vehicle'}
                        </p>
                      </div>
                    </div>

                    {/* Time slots */}
                    <div className="flex-1 relative" onClick={() => { setEditJob(null); setShowCreateModal(true) }}>
                      {/* Hour grid lines */}
                      <div className="absolute inset-0 flex pointer-events-none">
                        {HOURS.map(hour => (
                          <div key={hour} className={`flex-1 border-l ${isDark ? 'border-gray-700/50' : 'border-gray-100'}`} />
                        ))}
                      </div>

                      {/* Job blocks */}
                      {driverJobs.map(job => {
                        const pos = getJobPosition(job)
                        const color = STATUS_CALENDAR_COLOR[job.status]
                        return (
                          <div
                            key={job.id}
                            onClick={() => { setSelectedJob(job); setEditJob(job); setShowCreateModal(true) }}
                            className="absolute top-1 bottom-1 rounded-lg cursor-pointer hover:opacity-90 transition-opacity flex items-center px-2 overflow-hidden"
                            style={{
                              left: pos.left,
                              width: pos.width,
                              background: color + 'dd',
                              border: `1px solid ${color}`,
                            }}
                          >
                            <div className="min-w-0">
                              <p className="text-white text-xs font-semibold truncate leading-tight">
                                {job.name.split('—')[1]?.trim() || job.name}
                              </p>
                              <p className="text-white/80 text-xs truncate">
                                {formatTime(job.scheduledStart)} → {formatTime(job.scheduledEnd)}
                              </p>
                            </div>
                          </div>
                        )
                      })}

                      {/* Empty state */}
                      {driverJobs.length === 0 && (
                        <div className="absolute inset-0 flex items-center px-3">
                          <span className={`text-xs ${isDark ? 'text-gray-600' : 'text-gray-300'}`}>No jobs scheduled</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Calendar footer note */}
            <div className={`px-5 py-3 border-t text-xs ${isDark ? 'border-gray-700 text-gray-500' : 'border-gray-100 text-gray-400'}`}>
              💡 Click any job block to see details · Click an empty slot to create a job (drag-and-drop coming in Sprint 2)
            </div>
          </div>
        )}
      </div>

      {/* Create Job Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-md">
          <div className={`rounded-3xl shadow-2xl w-full max-w-lg mx-4 p-6 ${isDark ? 'bg-gray-900' : 'bg-white'}`}>
            <div className="flex items-center justify-between mb-5">
              <h2 className={`font-bold text-lg ${isDark ? 'text-white' : 'text-gray-900'}`}>{editJob ? 'Edit Job' : 'Create Job'}</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            {/* DEVELOPER NOTE: POST /api/fleetpoint/jobs with all fields below */}
            {/* On success: add to local state, close modal, show success toast */}
            <div className="flex flex-col gap-3">
              <div>
                <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Job Name *</label>
                <input placeholder="e.g. Amazon BHX2 Morning Delivery" defaultValue={editJob?.name || ""}
                  className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-purple-500
                    ${isDark ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'}`} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Job Type *</label>
                  <select className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none ${isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-700'}`}>
                    {Object.entries(TYPE_CONFIG).map(([val, cfg]) => <option key={val} value={val}>{cfg.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Priority *</label>
                  <select className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none ${isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-700'}`}>
                    <option value="high">High</option>
                    <option value="normal" selected>Normal</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Assign Driver *</label>
                  {/* DEVELOPER NOTE: fetch drivers from GET /api/fleetpoint/drivers?status=available */}
                  <select className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none ${isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-700'}`}>
                    <option value="">Select driver...</option>
                    {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Vehicle (optional)</label>
                  <select className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none ${isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-700'}`}>
                    <option value="">Select vehicle...</option>
                    {vehicles.map(v => <option key={v.id} value={v.id}>{v.plate} — {v.make} {v.model}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Pickup Location *</label>
                <input placeholder="Address or select from POI..." defaultValue={editJob?.pickupAddress || ""} className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-purple-500 ${isDark ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'}`} />



              </div>
              <div>
                <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Dropoff Location *</label>
                <input placeholder="Address or select from POI..." defaultValue={editJob?.dropoffAddress || ""}
                  className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-purple-500
                    ${isDark ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'}`} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Start Time *</label>
                  <input type="datetime-local" defaultValue={editJob?.scheduledStart?.slice(0,16) || ""}
                    className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-purple-500
                      ${isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-700'}`} />
                </div>
                <div>
                  <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>End Time *</label>
                  <input type="datetime-local" defaultValue={editJob?.scheduledEnd?.slice(0,16) || ""}
                    className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-purple-500
                      ${isDark ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' : 'bg-white border-gray-200 text-gray-700'}`} />
                </div>
              </div>
              <div>
                <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Notes</label>
                <textarea rows={2} placeholder="Any special instructions..." defaultValue={editJob?.notes || ""}
                  className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-purple-500 resize-none
                    ${isDark ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'}`} />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowCreateModal(false)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium border ${isDark ? 'border-gray-700 text-gray-300' : 'border-gray-200 text-gray-600'}`}>
                Cancel
              </button>
              <button onClick={() => setShowCreateModal(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-purple-600 hover:bg-purple-700 text-white transition-colors">
                {editJob ? 'Save Changes' : 'Create Job'}
              </button>
            </div>
          </div>
        </div>
      )}
    </FleetpointLayout>
  )
}
