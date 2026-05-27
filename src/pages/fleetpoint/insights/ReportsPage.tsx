import React from 'react'
// src/pages/fleetpoint/insights/ReportsPage.tsx
// Reports — Standard pre-built reports with inline preview + export
//
// DEVELOPER NOTES:
// ─────────────────────────────────────────────────────────────────────────────
// SPRINT 1: Standard reports — server generates, frontend renders with Recharts
// SPRINT 2/3: Self-service drag-and-drop report builder
//
// REPORT GENERATION:
// POST /api/fleetpoint/reports/generate
// Body: { reportType, dateFrom, dateTo, fleetId?, driverId?, vehicleId?, format }
// Response: { reportId, data: {...}, generatedAt }
// Frontend renders data inline with Recharts
//
// EXPORT:
// GET /api/fleetpoint/reports/:id/export?format=pdf|xlsx|csv
// Backend generates file, returns pre-signed S3 URL for download
//
// HSE REPORT:
// Special compliance report for UK Operator Licence
// Export as PDF for Traffic Commissioner submission
// Includes: incidents, near misses, fatigue, miles, driver hours
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import {
  Search, Download, Filter, X, ChevronRight,
  FileText, Shield, Truck, Wrench, Briefcase,
  Clock, AlertTriangle, CheckCircle, TrendingUp,
  TrendingDown, BarChart2, Calendar, Users,
  RefreshCw, Star, Bot
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, PieChart, Pie,
  Cell, RadarChart, PolarGrid, PolarAngleAxis, Radar,
  Legend
} from 'recharts'
import FleetpointLayout from '../../../layouts/FleetpointLayout'
import {
  reportDefinitions, drivers, vehicles, fleets,
  violations, workOrders, dashcamEvents, trips,
  fleetDocuments
} from '../../../data/fleetData'
import { useTheme } from '../../../hooks/useTheme'
import type { ReportCategory } from '../../../data/fleetData'

// ─── Config ───────────────────────────────────────────────────────────────────
const CATEGORY_CONFIG: Record<ReportCategory, {
  label: string; icon: any; color: string; bg: string
}> = {
  safety:      { label: 'Safety',      icon: Shield,    color: 'text-red-600',    bg: 'bg-red-50' },
  fleet:       { label: 'Fleet Ops',   icon: Truck,     color: 'text-purple-600', bg: 'bg-purple-50' },
  maintenance: { label: 'Maintenance', icon: Wrench,    color: 'text-amber-600',  bg: 'bg-amber-50' },
  jobs:        { label: 'Jobs',        icon: Briefcase, color: 'text-blue-600',   bg: 'bg-blue-50' },
  compliance:  { label: 'Compliance',  icon: FileText,  color: 'text-teal-600',   bg: 'bg-teal-50' },
}

// ── Dummy report data for inline preview ─────────────────────────────────────
const driverScoreData = drivers.map(d => ({
  name: d.name.split(' ')[0],
  score: d.score,
  violations: d.violations,
  fill: d.score >= 90 ? '#22c55e' : d.score >= 75 ? '#f59e0b' : '#ef4444',
})).sort((a, b) => b.score - a.score)

const violationsByType = [
  { name: 'Speeding', count: 4, fill: '#ef4444' },
  { name: 'Harsh Braking', count: 2, fill: '#f97316' },
  { name: 'Safety Critical', count: 3, fill: '#dc2626' },
  { name: 'Compliance', count: 2, fill: '#7c3aed' },
  { name: 'Geozone', count: 1, fill: '#2563eb' },
]

const fleetUtilData = fleets.map(f => ({
  name: f.name.split(' ')[0],
  moving: Math.round(Math.random() * 6 + 4),
  idle: Math.round(Math.random() * 2 + 1),
  offline: Math.round(Math.random() * 2),
}))

const weeklyTrendData = [
  { day: 'Mon', violations: 8, trips: 22, score: 88 },
  { day: 'Tue', violations: 12, trips: 28, score: 84 },
  { day: 'Wed', violations: 6, trips: 24, score: 91 },
  { day: 'Thu', violations: 9, trips: 26, score: 87 },
  { day: 'Fri', violations: 14, trips: 30, score: 82 },
  { day: 'Sat', violations: 4, trips: 12, score: 93 },
  { day: 'Sun', violations: 2, trips: 8, score: 95 },
]

const maintenanceCostData = [
  { month: 'Jan', scheduled: 1240, corrective: 680, predictive: 420 },
  { month: 'Feb', scheduled: 980, corrective: 1200, predictive: 380 },
  { month: 'Mar', scheduled: 1450, corrective: 520, predictive: 610 },
  { month: 'Apr', scheduled: 1100, corrective: 890, predictive: 440 },
  { month: 'May', scheduled: 680, corrective: 2140, predictive: 890 },
]

const hseData = {
  totalMiles: trips.reduce((a, t) => a + t.distanceMiles, 0),
  incidents: 0,
  nearMisses: dashcamEvents.filter(e => e.eventType.includes('Collision') || e.eventType.includes('Departure')).length,
  fatigueEvents: dashcamEvents.filter(e => e.category === 'fatigue').length,
  speedingEvents: violations.filter(v => v.category === 'speed').length,
  driversWithViolations: [...new Set(violations.map(v => v.driverId))].length,
  actionsCompleted: violations.filter(v => v.reviewStatus === 'reviewed').length,
}

const radarData = [
  { subject: 'Speed', A: 78 },
  { subject: 'Braking', A: 85 },
  { subject: 'Accel', A: 82 },
  { subject: 'Cornering', A: 88 },
  { subject: 'Fatigue', A: 72 },
  { subject: 'Distraction', A: 80 },
]

export default function ReportsPage() {
  const { isDark } = useTheme()
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState<'all' | ReportCategory>('all')
  const [selectedReport, setSelectedReport] = useState<string | null>('RPT001')
  const [dateFrom, setDateFrom] = useState('2026-05-01')
  const [dateTo, setDateTo] = useState('2026-05-21')
  const [filterFleet, setFilterFleet] = useState('all')
  const [generating, setGenerating] = useState(false)
  const [generated, setGenerated] = useState(true)

  const filteredReports = reportDefinitions.filter(r => {
    const s = search.toLowerCase()
    const matchSearch = !search || r.name.toLowerCase().includes(s) || r.description.toLowerCase().includes(s)
    const matchCat = filterCategory === 'all' || r.category === filterCategory
    return matchSearch && matchCat
  })

  const selected = reportDefinitions.find(r => r.id === selectedReport)

  const handleGenerate = () => {
    setGenerating(true)
    setTimeout(() => { setGenerating(false); setGenerated(true) }, 1200)
  }

  return (
    <FleetpointLayout>
      <div className={`flex h-full min-h-screen ${isDark ? 'bg-gray-950' : 'bg-gray-50'}`}>

        {/* Left — Report list */}
        <div className={`w-72 shrink-0 border-r flex flex-col ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'}`}>

          {/* Header */}
          <div className={`p-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            <h1 className={`text-lg font-bold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>Reports</h1>
            <div className={`flex items-center gap-2 border rounded-xl px-3 py-2 mb-3
              ${isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'}`}>
              <Search size={13} className="text-gray-400 shrink-0" />
              <input type="text" placeholder="Search reports..."
                value={search} onChange={e => setSearch(e.target.value)}
                className={`flex-1 text-xs outline-none bg-transparent
                  ${isDark ? 'text-white placeholder-gray-500' : 'text-gray-900 placeholder-gray-400'}`} />
              {search && <button onClick={() => setSearch('')}><X size={11} className="text-gray-400" /></button>}
            </div>

            {/* Category filter */}
            <div className="flex flex-wrap gap-1">
              <button onClick={() => setFilterCategory('all')}
                className={`text-xs px-2 py-1 rounded-lg font-medium transition-colors
                  ${filterCategory === 'all' ? 'bg-purple-600 text-white' : `${isDark ? 'text-gray-400 hover:bg-gray-800' : 'text-gray-500 hover:bg-gray-100'}`}`}>
                All
              </button>
              {Object.entries(CATEGORY_CONFIG).map(([cat, cfg]) => (
                <button key={cat} onClick={() => setFilterCategory(cat as ReportCategory)}
                  className={`text-xs px-2 py-1 rounded-lg font-medium transition-colors
                    ${filterCategory === cat ? 'bg-purple-600 text-white' : `${isDark ? 'text-gray-400 hover:bg-gray-800' : 'text-gray-500 hover:bg-gray-100'}`}`}>
                  {cfg.label}
                </button>
              ))}
            </div>
          </div>

          {/* Report list */}
          <div className="flex-1 overflow-y-auto">
            {filteredReports.map(report => {
              const cat = CATEGORY_CONFIG[report.category]
              const isSelected = selectedReport === report.id
              return (
                <button key={report.id}
                  onClick={() => { setSelectedReport(report.id); setGenerated(false) }}
                  className={`w-full px-4 py-3 text-left border-b transition-colors
                    ${isDark ? 'border-gray-800' : 'border-gray-50'}
                    ${isSelected ? 'bg-purple-600' : `${isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-50'}`}`}>
                  <div className="flex items-start gap-2">
                    <span className="text-base shrink-0 mt-0.5">{report.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <p className={`text-xs font-semibold truncate ${isSelected ? 'text-white' : isDark ? 'text-white' : 'text-gray-900'}`}>
                          {report.name}
                        </p>
                        {report.isCompliance && (
                          <span className={`text-xs px-1 py-0.5 rounded font-medium shrink-0 ${isSelected ? 'bg-purple-500 text-white' : 'bg-teal-50 text-teal-700'}`}>
                            UK
                          </span>
                        )}
                      </div>
                      <p className={`text-xs truncate ${isSelected ? 'text-purple-200' : isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        {report.description.split('.')[0]}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs ${isSelected ? 'text-purple-200' : cat.color} font-medium`}>
                          {cat.label}
                        </span>
                        <span className={`text-xs ${isSelected ? 'text-purple-300' : isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                          · {report.formats.join('/')}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Sprint 2 teaser */}
          <div className={`p-4 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            <div className={`rounded-xl p-3 ${isDark ? 'bg-purple-900/30 border border-purple-800' : 'bg-purple-50 border border-purple-200'}`}>
              <div className="flex items-center gap-2 mb-1">
                <Bot size={13} className="text-purple-500" />
                <p className={`text-xs font-semibold ${isDark ? 'text-purple-300' : 'text-purple-800'}`}>
                  Sprint 2 — Report Builder
                </p>
              </div>
              <p className={`text-xs ${isDark ? 'text-purple-400' : 'text-purple-700'}`}>
                Drag-and-drop self-service report builder coming in Sprint 2.
              </p>
            </div>
          </div>
        </div>

        {/* Right — Report viewer */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {selected ? (
            <>
              {/* Report header */}
              <div className={`flex items-center justify-between px-6 py-4 border-b shrink-0
                ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'}`}>
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{selected.icon}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className={`font-bold text-lg ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {selected.name}
                      </h2>
                      {selected.isCompliance && (
                        <span className="text-xs bg-teal-50 text-teal-700 border border-teal-200 px-2 py-0.5 rounded-full font-medium">
                          🏛️ UK Compliance
                        </span>
                      )}
                    </div>
                    <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      {selected.description}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {selected.formats.map(fmt => (
                    <button key={fmt}
                      className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl border font-medium transition-colors
                        ${isDark ? 'border-gray-700 text-gray-300 hover:bg-gray-800' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                      <Download size={12} /> {fmt.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Filters bar */}
              <div className={`flex items-center gap-3 px-6 py-3 border-b shrink-0
                ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'}`}>
                {selected.supportsDateRange && (
                  <div className="flex items-center gap-2">
                    <Calendar size={13} className="text-gray-400" />
                    <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                      className={`text-xs border rounded-lg px-2 py-1.5 outline-none
                        ${isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-700'}`} />
                    <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>to</span>
                    <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                      className={`text-xs border rounded-lg px-2 py-1.5 outline-none
                        ${isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-700'}`} />
                    {/* Quick ranges */}
                    <div className={`flex rounded-lg border overflow-hidden ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                      {['Today', '7d', '30d', '90d'].map(range => (
                        <button key={range}
                          className={`px-2 py-1 text-xs transition-colors
                            ${isDark ? 'bg-gray-800 text-gray-400 hover:bg-gray-700' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
                          {range}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {selected.supportsFleetFilter && (
                  <select value={filterFleet} onChange={e => setFilterFleet(e.target.value)}
                    className={`text-xs border rounded-lg px-2 py-1.5 outline-none
                      ${isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-700'}`}>
                    <option value="all">All Fleets</option>
                    {fleets.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                )}
                <button onClick={handleGenerate}
                  className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-colors ml-auto">
                  {generating ? <RefreshCw size={12} className="animate-spin" /> : <BarChart2 size={12} />}
                  {generating ? 'Generating...' : 'Generate Report'}
                </button>
              </div>

              {/* Report content */}
              <div className="flex-1 overflow-y-auto p-6">
                {!generated && !generating && (
                  <div className={`rounded-2xl border-2 border-dashed p-16 text-center
                    ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                    <BarChart2 size={32} className="text-gray-400 mx-auto mb-3" />
                    <p className={`font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Configure filters and click Generate Report
                    </p>
                    <p className={`text-sm mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      Results will appear here
                    </p>
                  </div>
                )}

                {generating && (
                  <div className="flex items-center justify-center h-64">
                    <div className="text-center">
                      <RefreshCw size={28} className="text-purple-500 animate-spin mx-auto mb-3" />
                      <p className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        Generating report...
                      </p>
                    </div>
                  </div>
                )}

                {generated && !generating && (
                  <div className="flex flex-col gap-6">

                    {/* ── DRIVER SAFETY SCORECARD ──────────────────────────── */}
                    {selected.id === 'RPT001' && (
                      <>
                        <div className="grid grid-cols-4 gap-4">
                          {[
                            { label: 'Fleet Avg Score', value: Math.round(drivers.reduce((a, d) => a + d.score, 0) / drivers.length), icon: Star, color: 'text-purple-600', bg: 'bg-purple-50' },
                            { label: 'Top Driver', value: drivers.reduce((a, d) => d.score > a.score ? d : a).name.split(' ')[0], icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
                            { label: 'Total Violations', value: drivers.reduce((a, d) => a + d.violations, 0), icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
                            { label: 'Drivers Below 75', value: drivers.filter(d => d.score < 75).length, icon: TrendingDown, color: 'text-amber-600', bg: 'bg-amber-50' },
                          ].map((kpi, i) => (
                            <div key={i} className={`border rounded-2xl p-4 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                              <div className={`w-8 h-8 rounded-xl ${kpi.bg} flex items-center justify-center mb-2`}>
                                <kpi.icon size={15} className={kpi.color} />
                              </div>
                              <p className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{kpi.value}</p>
                              <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{kpi.label}</p>
                            </div>
                          ))}
                        </div>
                        <div className={`rounded-2xl border p-5 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                          <h3 className={`font-bold text-sm mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Driver Safety Scores — Ranked</h3>
                          <ResponsiveContainer width="100%" height={260}>
                            <BarChart data={driverScoreData} layout="vertical" margin={{ left: 0, right: 40, top: 0, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#f3f4f6'} />
                              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={70} />
                              <Tooltip formatter={(val) => [`${val}/100`, 'Score']} />
                              <Bar dataKey="score" radius={[0, 4, 4, 0]}>
                                {driverScoreData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className={`rounded-2xl border p-5 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                            <h3 className={`font-bold text-sm mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Fleet Behaviour Radar</h3>
                            <ResponsiveContainer width="100%" height={200}>
                              <RadarChart data={radarData}>
                                <PolarGrid stroke={isDark ? '#374151' : '#e5e7eb'} />
                                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10 }} />
                                <Radar dataKey="A" stroke="#7c3aed" fill="#7c3aed" fillOpacity={0.3} strokeWidth={2} />
                              </RadarChart>
                            </ResponsiveContainer>
                          </div>
                          <div className={`rounded-2xl border p-5 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                            <h3 className={`font-bold text-sm mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Weekly Score Trend</h3>
                            <ResponsiveContainer width="100%" height={200}>
                              <LineChart data={weeklyTrendData}>
                                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#f3f4f6'} />
                                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                                <YAxis domain={[75, 100]} tick={{ fontSize: 11 }} />
                                <Tooltip />
                                <Line type="monotone" dataKey="score" stroke="#7c3aed" strokeWidth={2.5} dot={{ r: 3 }} />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                        {/* Driver table */}
                        <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                          <table className="w-full text-sm">
                            <thead>
                              <tr className={`border-b text-xs font-semibold uppercase tracking-wide
                                ${isDark ? 'border-gray-700 bg-gray-900 text-gray-400' : 'border-gray-100 bg-gray-50 text-gray-500'}`}>
                                <th className="px-4 py-3 text-left">Rank</th>
                                <th className="px-4 py-3 text-left">Driver</th>
                                <th className="px-4 py-3 text-left">Fleet</th>
                                <th className="px-4 py-3 text-left">Score</th>
                                <th className="px-4 py-3 text-left">Violations</th>
                                <th className="px-4 py-3 text-left">Trips</th>
                                <th className="px-4 py-3 text-left">Fines</th>
                                <th className="px-4 py-3 text-left">Trend</th>
                              </tr>
                            </thead>
                            <tbody>
                              {drivers.sort((a, b) => b.score - a.score).map((driver, i) => {
                                const fleet = fleets.find(f => f.id === driver.fleetId)
                                return (
                                  <tr key={driver.id} className={`border-b ${isDark ? 'border-gray-700' : 'border-gray-50'}`}>
                                    <td className="px-4 py-3">
                                      <span className={`text-sm font-bold ${i === 0 ? 'text-amber-500' : isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3">
                                      <div className="flex items-center gap-2">
                                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-xs font-bold">
                                          {driver.avatar}
                                        </div>
                                        <span className={`text-xs font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{driver.name}</span>
                                      </div>
                                    </td>
                                    <td className="px-4 py-3">
                                      <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{fleet?.name}</span>
                                    </td>
                                    <td className="px-4 py-3">
                                      <span className={`text-xs font-bold ${driver.score >= 90 ? 'text-green-600' : driver.score >= 75 ? 'text-amber-600' : 'text-red-600'}`}>
                                        {driver.score}/100
                                      </span>
                                    </td>
                                    <td className="px-4 py-3">
                                      <span className={`text-xs font-medium ${driver.violations > 10 ? 'text-red-600' : isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                        {driver.violations}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3">
                                      <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{driver.trips}</span>
                                    </td>
                                    <td className="px-4 py-3">
                                      <span className={`text-xs ${driver.finesPending > 0 ? 'text-red-600 font-bold' : isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                        {driver.finesPending > 0 ? `£${driver.finesPending}` : '—'}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3">
                                      <span className={driver.score >= 85 ? 'text-green-500' : 'text-red-500'}>
                                        {driver.score >= 85 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                                      </span>
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}

                    {/* ── VIOLATIONS SUMMARY ───────────────────────────────── */}
                    {selected.id === 'RPT002' && (
                      <>
                        <div className="grid grid-cols-4 gap-4">
                          {[
                            { label: 'Total Violations', value: violations.length, color: 'text-gray-600', bg: 'bg-gray-100' },
                            { label: 'Critical', value: violations.filter(v => v.severity === 'critical').length, color: 'text-red-600', bg: 'bg-red-50' },
                            { label: 'Fines Issued', value: `£${violations.reduce((a, v) => a + v.fineAmount, 0)}`, color: 'text-purple-600', bg: 'bg-purple-50' },
                            { label: 'Pending Review', value: violations.filter(v => v.reviewStatus === 'pending').length, color: 'text-amber-600', bg: 'bg-amber-50' },
                          ].map((kpi, i) => (
                            <div key={i} className={`border rounded-2xl p-4 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                              <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{kpi.value}</p>
                              <p className={`text-xs mt-1 ${kpi.color}`}>{kpi.label}</p>
                            </div>
                          ))}
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className={`rounded-2xl border p-5 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                            <h3 className={`font-bold text-sm mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Violations by Type</h3>
                            <ResponsiveContainer width="100%" height={200}>
                              <PieChart>
                                <Pie data={violationsByType} cx="50%" cy="50%" outerRadius={75} dataKey="count" label={({ name, count }) => `${name}: ${count}`}>
                                  {violationsByType.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                                </Pie>
                                <Tooltip />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                          <div className={`rounded-2xl border p-5 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                            <h3 className={`font-bold text-sm mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Daily Violations Trend</h3>
                            <ResponsiveContainer width="100%" height={200}>
                              <BarChart data={weeklyTrendData}>
                                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#f3f4f6'} />
                                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                                <YAxis tick={{ fontSize: 11 }} />
                                <Tooltip />
                                <Bar dataKey="violations" fill="#ef4444" radius={[4, 4, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      </>
                    )}

                    {/* ── HSE REPORT ───────────────────────────────────────── */}
                    {selected.id === 'RPT003' && (
                      <>
                        <div className={`rounded-2xl border p-5 ${isDark ? 'bg-teal-900/20 border-teal-800' : 'bg-teal-50 border-teal-200'}`}>
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-2xl">🏛️</span>
                            <div>
                              <p className={`font-bold ${isDark ? 'text-teal-300' : 'text-teal-800'}`}>
                                HSE Report — LogisticsPro Ltd
                              </p>
                              <p className={`text-xs ${isDark ? 'text-teal-400' : 'text-teal-700'}`}>
                                For UK Operator Licence compliance · Traffic Commissioner · FORS Accreditation
                              </p>
                            </div>
                          </div>
                          <p className={`text-xs ${isDark ? 'text-teal-400' : 'text-teal-700'}`}>
                            Period: {dateFrom} to {dateTo} · Operator Licence: OB2034451
                          </p>
                        </div>
                        <div className="grid grid-cols-4 gap-4">
                          {[
                            { label: 'Total Miles Driven', value: `${hseData.totalMiles} mi`, color: 'text-purple-600', bg: 'bg-purple-50' },
                            { label: 'Reportable Incidents', value: hseData.incidents, color: 'text-green-600', bg: 'bg-green-50' },
                            { label: 'Near Misses', value: hseData.nearMisses, color: 'text-amber-600', bg: 'bg-amber-50' },
                            { label: 'Fatigue Events', value: hseData.fatigueEvents, color: 'text-red-600', bg: 'bg-red-50' },
                          ].map((kpi, i) => (
                            <div key={i} className={`border rounded-2xl p-4 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                              <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
                              <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{kpi.label}</p>
                            </div>
                          ))}
                        </div>
                        <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                          <div className={`px-5 py-3 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                            <h3 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>HSE Summary — Key Metrics</h3>
                          </div>
                          <table className="w-full text-sm">
                            <tbody>
                              {[
                                { section: 'INCIDENTS & NEAR MISSES', rows: [
                                  { label: 'Reportable accidents (RIDDOR)', value: hseData.incidents, status: 'good' },
                                  { label: 'Near misses (ADAS forward collision events)', value: hseData.nearMisses, status: hseData.nearMisses > 0 ? 'warn' : 'good' },
                                  { label: 'Fatigue events (DMS camera detections)', value: hseData.fatigueEvents, status: hseData.fatigueEvents > 0 ? 'warn' : 'good' },
                                  { label: 'Mobile phone use while driving', value: dashcamEvents.filter(e => e.eventType.includes('Phone')).length, status: 'bad' },
                                ]},
                                { section: 'DRIVER PERFORMANCE', rows: [
                                  { label: 'Total speeding events', value: hseData.speedingEvents, status: 'warn' },
                                  { label: 'Drivers with violations', value: hseData.driversWithViolations, status: 'warn' },
                                  { label: 'Actions completed (coaching, warnings)', value: hseData.actionsCompleted, status: 'good' },
                                  { label: 'Fleet average safety score', value: `${Math.round(drivers.reduce((a, d) => a + d.score, 0) / drivers.length)}/100`, status: 'good' },
                                ]},
                                { section: 'VEHICLE COMPLIANCE', rows: [
                                  { label: 'Vehicles with expired MOT', value: vehicles.filter(v => !v.mot || new Date(v.mot) < new Date()).length, status: 'bad' },
                                  { label: 'Drivers with expired licence', value: drivers.filter(d => new Date(d.licenceExpiry) < new Date()).length, status: 'bad' },
                                  { label: 'Active work orders (maintenance)', value: workOrders.filter(w => w.status !== 'completed').length, status: 'warn' },
                                ]},
                              ].map(section => (
                                <React.Fragment key={section.section}>
                                  <tr className={`${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
                                    <td colSpan={3} className={`px-4 py-2 text-xs font-bold uppercase tracking-wide ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                      {section.section}
                                    </td>
                                  </tr>
                                  {section.rows.map((row, i) => (
                                    <tr key={i} className={`border-b ${isDark ? 'border-gray-700' : 'border-gray-100'}`}>
                                      <td className={`px-4 py-2.5 text-xs ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{row.label}</td>
                                      <td className="px-4 py-2.5 text-right">
                                        <span className={`text-sm font-bold ${row.status === 'good' ? 'text-green-600' : row.status === 'warn' ? 'text-amber-600' : 'text-red-600'}`}>
                                          {row.value}
                                        </span>
                                      </td>
                                      <td className="px-4 py-2.5 text-center">
                                        {row.status === 'good' ? <CheckCircle size={14} className="text-green-500 mx-auto" /> : <AlertTriangle size={14} className={`mx-auto ${row.status === 'bad' ? 'text-red-500' : 'text-amber-500'}`} />}
                                      </td>
                                    </tr>
                                  ))}
                                </React.Fragment>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}

                    {/* ── FLEET UTILISATION ────────────────────────────────── */}
                    {selected.id === 'RPT005' && (
                      <>
                        <div className={`rounded-2xl border p-5 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                          <h3 className={`font-bold text-sm mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Fleet Utilisation — Hours per Day</h3>
                          <ResponsiveContainer width="100%" height={280}>
                            <BarChart data={fleetUtilData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#f3f4f6'} />
                              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                              <YAxis tick={{ fontSize: 11 }} />
                              <Tooltip />
                              <Legend />
                              <Bar dataKey="moving" name="Moving (hrs)" fill="#22c55e" radius={[4, 4, 0, 0]} stackId="a" />
                              <Bar dataKey="idle" name="Idle (hrs)" fill="#f59e0b" radius={[0, 0, 0, 0]} stackId="a" />
                              <Bar dataKey="offline" name="Offline (hrs)" fill="#6b7280" radius={[4, 4, 0, 0]} stackId="a" />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </>
                    )}

                    {/* ── MAINTENANCE COST ─────────────────────────────────── */}
                    {selected.id === 'RPT009' && (
                      <>
                        <div className="grid grid-cols-3 gap-4">
                          {[
                            { label: 'Total Spend', value: `£${workOrders.reduce((a, w) => a + (w.actualCost || w.estimatedCost), 0).toLocaleString()}` },
                            { label: 'Avg per Vehicle', value: `£${Math.round(workOrders.reduce((a, w) => a + w.estimatedCost, 0) / vehicles.length)}` },
                            { label: 'Predictive Savings', value: '£2,840' },
                          ].map((kpi, i) => (
                            <div key={i} className={`border rounded-2xl p-4 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                              <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{kpi.value}</p>
                              <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{kpi.label}</p>
                            </div>
                          ))}
                        </div>
                        <div className={`rounded-2xl border p-5 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                          <h3 className={`font-bold text-sm mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Maintenance Cost by Month</h3>
                          <ResponsiveContainer width="100%" height={260}>
                            <BarChart data={maintenanceCostData}>
                              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#f3f4f6'} />
                              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                              <YAxis tick={{ fontSize: 11 }} />
                              <Tooltip formatter={(val) => [`£${val}`, '']} />
                              <Legend />
                              <Bar dataKey="scheduled" name="Scheduled" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                              <Bar dataKey="corrective" name="Corrective" fill="#ef4444" radius={[4, 4, 0, 0]} />
                              <Bar dataKey="predictive" name="Predictive (AI)" fill="#22c55e" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </>
                    )}

                    {/* ── DOCUMENT EXPIRY ──────────────────────────────────── */}
                    {selected.id === 'RPT011' && (
                      <>
                        <div className="grid grid-cols-3 gap-4">
                          {[
                            { label: 'Expired Now', value: fleetDocuments.filter(d => d.status === 'expired').length, color: 'text-red-600' },
                            { label: 'Expiring < 30 days', value: fleetDocuments.filter(d => d.status === 'expiring').length, color: 'text-amber-600' },
                            { label: 'Valid', value: fleetDocuments.filter(d => d.status === 'valid').length, color: 'text-green-600' },
                          ].map((kpi, i) => (
                            <div key={i} className={`border rounded-2xl p-4 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                              <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
                              <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{kpi.label}</p>
                            </div>
                          ))}
                        </div>
                        <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                          <div className={`px-4 py-3 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                            <h3 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>Document Status — Traffic Light View</h3>
                          </div>
                          <table className="w-full text-sm">
                            <thead>
                              <tr className={`border-b text-xs font-semibold uppercase tracking-wide ${isDark ? 'border-gray-700 bg-gray-900 text-gray-400' : 'border-gray-100 bg-gray-50 text-gray-500'}`}>
                                <th className="px-4 py-3 text-left">Document</th>
                                <th className="px-4 py-3 text-left">Linked To</th>
                                <th className="px-4 py-3 text-left">Expiry</th>
                                <th className="px-4 py-3 text-left">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {fleetDocuments
                                .sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry)
                                .map(doc => (
                                  <tr key={doc.id} className={`border-b ${isDark ? 'border-gray-700' : 'border-gray-50'}`}>
                                    <td className={`px-4 py-2.5 text-xs font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{doc.name.split('—')[1]?.trim() || doc.name}</td>
                                    <td className={`px-4 py-2.5 text-xs ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>{doc.linkedName}</td>
                                    <td className={`px-4 py-2.5 text-xs ${doc.status === 'expired' ? 'text-red-600 font-bold' : doc.status === 'expiring' ? 'text-amber-600 font-medium' : isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                      {doc.expiryDate || 'No expiry'}
                                    </td>
                                    <td className="px-4 py-2.5">
                                      <span className={`w-3 h-3 rounded-full inline-block ${doc.status === 'expired' ? 'bg-red-500' : doc.status === 'expiring' ? 'bg-amber-400' : 'bg-green-500'}`}></span>
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}

                    {/* ── DEFAULT — OTHER REPORTS ──────────────────────────── */}
                    {!['RPT001', 'RPT002', 'RPT003', 'RPT005', 'RPT009', 'RPT011'].includes(selected.id) && (
                      <>
                        <div className="grid grid-cols-3 gap-4">
                          {[
                            { label: 'Total Records', value: '247' },
                            { label: 'Date Range', value: `${dateFrom} → ${dateTo}` },
                            { label: 'Generated', value: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) },
                          ].map((kpi, i) => (
                            <div key={i} className={`border rounded-2xl p-4 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                              <p className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{kpi.value}</p>
                              <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{kpi.label}</p>
                            </div>
                          ))}
                        </div>
                        <div className={`rounded-2xl border p-5 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                          <h3 className={`font-bold text-sm mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {selected.name} — Weekly Trend
                          </h3>
                          <ResponsiveContainer width="100%" height={240}>
                            <LineChart data={weeklyTrendData}>
                              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#f3f4f6'} />
                              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                              <YAxis tick={{ fontSize: 11 }} />
                              <Tooltip />
                              <Line type="monotone" dataKey="trips" name="Trips" stroke="#7c3aed" strokeWidth={2.5} dot={{ r: 3 }} />
                              <Line type="monotone" dataKey="violations" name="Violations" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                        <div className={`rounded-2xl border-2 border-dashed p-6 text-center ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                          <BarChart2 size={24} className="text-gray-400 mx-auto mb-2" />
                          <p className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            Full {selected.name} data table
                          </p>
                          <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                            Export as {selected.formats.join(' or ')} to view complete dataset
                          </p>
                          <div className="flex items-center justify-center gap-2 mt-3">
                            {selected.formats.map(fmt => (
                              <button key={fmt} className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-medium
                                ${isDark ? 'border-gray-700 text-gray-300 hover:bg-gray-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                                <Download size={11} /> {fmt.toUpperCase()}
                              </button>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <BarChart2 size={40} className="text-gray-300 mx-auto mb-4" />
                <p className={`font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Select a report to get started</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </FleetpointLayout>
  )
}
