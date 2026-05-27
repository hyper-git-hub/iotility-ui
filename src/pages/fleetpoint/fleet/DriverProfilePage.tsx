// src/pages/fleetpoint/fleet/DriverProfilePage.tsx
// Driver profile — full score breakdown, violations, trip history, shift info
// Dynamic route — same component for all drivers, ID from URL params
// TODO: fetch from GET /api/fleetpoint/drivers/:id
// TODO: fetch score breakdown from GET /api/fleetpoint/drivers/:id/score
// TODO: fetch violations from GET /api/fleetpoint/drivers/:id/violations
// TODO: fetch trips from GET /api/fleetpoint/drivers/:id/trips

import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Phone, Mail, MapPin, Star, AlertTriangle,
  TrendingUp, TrendingDown, Minus, Shield, Zap,
  Navigation, RotateCcw, Clock, Truck, Calendar,
  Download, ChevronRight
} from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, RadarChart, PolarGrid,
  PolarAngleAxis, Radar
} from 'recharts'
import FleetpointLayout from '../../../layouts/FleetpointLayout'
import { drivers, vehicles, fleets, alerts } from '../../../data/fleetData'
import { useTheme } from '../../../hooks/useTheme'

// Dummy score trend — last 8 weeks
// TODO: fetch from GET /api/fleetpoint/drivers/:id/score-trend
const scoreTrend = [
  { week: 'Wk1', score: 81 },
  { week: 'Wk2', score: 78 },
  { week: 'Wk3', score: 83 },
  { week: 'Wk4', score: 80 },
  { week: 'Wk5', score: 85 },
  { week: 'Wk6', score: 82 },
  { week: 'Wk7', score: 88 },
  { week: 'Wk8', score: 91 },
]

// Dummy violation history
// TODO: fetch from GET /api/fleetpoint/drivers/:id/violations
const violationHistory = [
  { id: 'V001', type: 'Speeding', severity: 'high', date: '20 May 2026', location: 'A1(M) Northbound', speed: '74mph in 60mph', vehicle: 'LP-4821', points: 3200 },
  { id: 'V002', type: 'Harsh Braking', severity: 'medium', date: '18 May 2026', location: 'M25 Junction 6', speed: '—', vehicle: 'LP-4821', points: 1800 },
  { id: 'V003', type: 'Sharp Turn', severity: 'low', date: '15 May 2026', location: 'City of London', speed: '—', vehicle: 'LP-4821', points: 900 },
  { id: 'V004', type: 'Speeding', severity: 'medium', date: '12 May 2026', location: 'M11 Northbound', speed: '68mph in 60mph', vehicle: 'LP-4821', points: 2100 },
  { id: 'V005', type: 'Harsh Acceleration', severity: 'low', date: '10 May 2026', location: 'Stratford, London', speed: '—', vehicle: 'LP-4821', points: 1100 },
]

// Dummy recent trips
// TODO: fetch from GET /api/fleetpoint/drivers/:id/trips
const recentTrips = [
  { id: 'T001', date: '20 May 2026', from: 'Stratford Depot, London', to: 'Birmingham NEC', distance: '118 mi', duration: '2h 14m', score: 94, vehicle: 'LP-4821' },
  { id: 'T002', date: '19 May 2026', from: 'Birmingham NEC', to: 'Manchester Depot', distance: '87 mi', duration: '1h 52m', score: 88, vehicle: 'LP-4821' },
  { id: 'T003', date: '19 May 2026', from: 'Stratford Depot, London', to: 'Birmingham NEC', distance: '118 mi', duration: '2h 08m', score: 91, vehicle: 'LP-4821' },
  { id: 'T004', date: '18 May 2026', from: 'Leeds Depot', to: 'Stratford Depot, London', distance: '201 mi', duration: '3h 45m', score: 79, vehicle: 'LP-4821' },
  { id: 'T005', date: '17 May 2026', from: 'Stratford Depot, London', to: 'Leeds Depot', distance: '201 mi', duration: '3h 38m', score: 96, vehicle: 'LP-4821' },
]

const SEVERITY_BG: Record<string, string> = {
  high: 'bg-red-50 text-red-700 border-red-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  low: 'bg-blue-50 text-blue-700 border-blue-200',
}

const SCORE_COLOR = (s: number) => s >= 90 ? '#22c55e' : s >= 75 ? '#f59e0b' : '#ef4444'
const SCORE_TEXT = (s: number) => s >= 90 ? 'text-green-600' : s >= 75 ? 'text-amber-600' : 'text-red-600'

export default function DriverProfilePage() {
  const { isDark } = useTheme()
  const { id } = useParams()
  const navigate = useNavigate()

  // Find driver by ID or by name (for demo, plate is used as ID)
  const driver = drivers.find(d => d.id === id || d.name.replace(/\s+/g, '-').toLowerCase() === id)

  if (!driver) {
    return (
      <FleetpointLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <p className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Driver not found</p>
            <button onClick={() => navigate('/fleetpoint/drivers')} className="text-purple-600 text-sm mt-2 hover:underline">
              Back to Drivers
            </button>
          </div>
        </div>
      </FleetpointLayout>
    )
  }

  const vehicle = vehicles.find(v => v.driverId === driver.id)
  const fleet = fleets.find(f => f.id === driver.fleetId)
  const driverAlerts = alerts.filter(a => a.driverName === driver.name)

  // Score breakdown — weighted components
  // TODO: replace with real ML model output from GET /api/fleetpoint/drivers/:id/score
  const scoreComponents = [
    {
      label: 'Speed Compliance',
      icon: Navigation,
      score: Math.min(100, Math.round(driver.score * 0.95)),
      weight: 25,
      maxPoints: 25,
      color: '#7c3aed',
      description: 'Based on speed limit adherence across all trips',
    },
    {
      label: 'Harsh Braking',
      icon: Shield,
      score: Math.min(100, Math.round(driver.score * 0.88)),
      weight: 25,
      maxPoints: 25,
      color: '#ef4444',
      description: 'Frequency and severity of braking events',
    },
    {
      label: 'Harsh Acceleration',
      icon: Zap,
      score: Math.min(100, Math.round(driver.score * 0.92)),
      weight: 25,
      maxPoints: 25,
      color: '#f59e0b',
      description: 'Aggressive acceleration patterns detected',
    },
    {
      label: 'Cornering',
      icon: RotateCcw,
      score: Math.min(100, Math.round(driver.score * 0.97)),
      weight: 25,
      maxPoints: 25,
      color: '#06b6d4',
      description: 'Sharp turns and lateral g-force events',
    },
  ]

  // Radar chart data
  const radarData = scoreComponents.map(c => ({
    subject: c.label.split(' ')[0],
    score: c.score,
    fullMark: 100,
  }))

  // Score trend direction
  const trendDiff = scoreTrend[scoreTrend.length - 1].score - scoreTrend[0].score
  const TrendIcon = trendDiff > 0 ? TrendingUp : trendDiff < 0 ? TrendingDown : Minus
  const trendColor = trendDiff > 0 ? 'text-green-600' : trendDiff < 0 ? 'text-red-600' : 'text-gray-500'

  const licenceDays = Math.floor((new Date(driver.licenceExpiry).getTime() - Date.now()) / 86400000)
  const licenceColor = licenceDays < 0 ? 'text-red-600' : licenceDays < 30 ? 'text-red-600' : licenceDays < 90 ? 'text-amber-600' : 'text-green-600'

  return (
    <FleetpointLayout>
      <div className={`min-h-full ${isDark ? 'bg-gray-950' : 'bg-gray-50'}`}>

        {/* Page header */}
        <div className={`px-6 py-4 border-b flex items-center gap-4
          ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'}`}>
          <button
            onClick={() => navigate('/fleetpoint/drivers')}
            className={`p-2 rounded-xl transition-colors ${isDark ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1">
            <h1 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{driver.name}</h1>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              {driver.role} · {fleet?.name || 'No Fleet'}
            </p>
          </div>
          <button className={`flex items-center gap-2 text-sm px-3 py-2 rounded-xl border transition-colors
            ${isDark ? 'border-gray-700 text-gray-300 hover:bg-gray-800' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            <Download size={14} /> Export Report
          </button>
        </div>

        <div className="p-6 flex flex-col gap-5">

          {/* TOP ROW — profile + score card + radar */}
          <div className="grid grid-cols-3 gap-5">

            {/* Driver profile card */}
            <div className={`rounded-2xl border p-5 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
              <div className="flex items-start gap-4 mb-5">
                <div className="relative shrink-0">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-xl font-black">
                    {driver.avatar}
                  </div>
                  <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2
                    ${isDark ? 'border-gray-800' : 'border-white'}
                    ${driver.status === 'on-duty' ? 'bg-green-400' : driver.status === 'on-break' ? 'bg-amber-400' : 'bg-gray-300'}`}>
                  </div>
                </div>
                <div>
                  <h2 className={`font-bold text-lg ${isDark ? 'text-white' : 'text-gray-900'}`}>{driver.name}</h2>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{driver.role}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium mt-1 inline-block
                    ${driver.status === 'on-duty' ? 'bg-green-50 text-green-700 border border-green-200'
                    : driver.status === 'on-break' ? 'bg-amber-50 text-amber-700 border border-amber-200'
                    : 'bg-gray-100 text-gray-600 border border-gray-200'}`}>
                    {driver.status === 'on-duty' ? 'On Shift' : driver.status === 'on-break' ? 'On Break' : 'Off Shift'}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-2.5">
                {[
                  { icon: Phone, label: driver.phone },
                  { icon: Mail, label: driver.email },
                  { icon: MapPin, label: fleet?.depotLocation || 'No depot' },
                  { icon: Truck, label: vehicle ? `${vehicle.plate} — ${vehicle.make} ${vehicle.model}` : 'No vehicle assigned' },
                  { icon: Calendar, label: `Joined ${new Date(driver.joinedDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}` },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <item.icon size={14} className="text-gray-400 mt-0.5 shrink-0" />
                    <span className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{item.label}</span>
                  </div>
                ))}
              </div>

              <div className={`mt-4 pt-4 border-t ${isDark ? 'border-gray-700' : 'border-gray-100'}`}>
                <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  Licence
                </p>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-mono ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{driver.licence}</span>
                  <span className={`text-xs font-bold ${licenceColor}`}>
                    {licenceDays < 0 ? 'Expired' : `${licenceDays}d left`}
                  </span>
                </div>
                <div className="flex gap-1 flex-wrap">
                  {driver.licenceCategories.map(cat => (
                    <span key={cat} className={`text-xs px-2 py-0.5 rounded font-medium
                      ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
                      {cat}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Score card */}
            <div className={`rounded-2xl border p-5 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>Safety Score</h3>
                <div className={`flex items-center gap-1 text-xs font-medium ${trendColor}`}>
                  <TrendIcon size={14} />
                  {Math.abs(trendDiff)} pts {trendDiff >= 0 ? 'up' : 'down'} this month
                </div>
              </div>

              {/* Big score */}
              <div className="flex items-center justify-center mb-4">
                <div className="relative w-32 h-32">
                  <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                    <circle cx="60" cy="60" r="50" fill="none" stroke={isDark ? '#374151' : '#f3f4f6'} strokeWidth="12" />
                    <circle cx="60" cy="60" r="50" fill="none"
                      stroke={SCORE_COLOR(driver.score)} strokeWidth="12"
                      strokeDasharray={`${2 * Math.PI * 50 * driver.score / 100} ${2 * Math.PI * 50}`}
                      strokeLinecap="round" />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={`text-3xl font-black ${SCORE_TEXT(driver.score)}`}>{driver.score}</span>
                    <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>/ 100</span>
                  </div>
                </div>
              </div>

              {/* Score components */}
              <div className="flex flex-col gap-3">
                {scoreComponents.map(comp => (
                  <div key={comp.label}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <comp.icon size={12} className="text-gray-400" />
                        <span className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{comp.label}</span>
                      </div>
                      <span className="text-xs font-bold" style={{ color: SCORE_COLOR(comp.score) }}>{comp.score}</span>
                    </div>
                    <div className={`h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${comp.score}%`, background: SCORE_COLOR(comp.score) }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Quick stats */}
              <div className={`mt-4 pt-4 border-t grid grid-cols-3 gap-2 ${isDark ? 'border-gray-700' : 'border-gray-100'}`}>
                {[
                  { label: 'Total Trips', value: driver.totalMileage > 0 ? Math.round(driver.totalMileage / 180) : '—' },
                  { label: 'Violations', value: driver.violations },
                  { label: 'Fines', value: driver.finesPending > 0 ? `£${driver.finesPending}` : '£0' },
                ].map(stat => (
                  <div key={stat.label} className={`rounded-xl p-2 text-center ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
                    <p className={`text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{stat.value}</p>
                    <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Score trend + radar */}
            <div className="flex flex-col gap-4">

              {/* Trend chart */}
              <div className={`rounded-2xl border p-4 flex-1 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                <h3 className={`font-bold text-sm mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>Score Trend — 8 Weeks</h3>
                <ResponsiveContainer width="100%" height={120}>
                  <LineChart data={scoreTrend} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#f3f4f6'} />
                    <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                    <YAxis domain={[60, 100]} tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Line type="monotone" dataKey="score" stroke={SCORE_COLOR(driver.score)}
                      strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Radar chart */}
              <div className={`rounded-2xl border p-4 flex-1 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                <h3 className={`font-bold text-sm mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>Behaviour Radar</h3>
                <ResponsiveContainer width="100%" height={140}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke={isDark ? '#374151' : '#e5e7eb'} />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10 }} />
                    <Radar dataKey="score" stroke={SCORE_COLOR(driver.score)}
                      fill={SCORE_COLOR(driver.score)} fillOpacity={0.25} strokeWidth={2} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* BOTTOM ROW — violations + trips */}
          <div className="grid grid-cols-2 gap-5">

            {/* Violation history */}
            <div className={`rounded-2xl border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
              <div className={`flex items-center justify-between px-5 py-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-100'}`}>
                <div className="flex items-center gap-2">
                  <AlertTriangle size={16} className="text-red-500" />
                  <h3 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>Recent Violations</h3>
                  <span className="w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                    {violationHistory.length}
                  </span>
                </div>
                <button className="text-xs text-purple-600 hover:underline">View all</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className={`border-b ${isDark ? 'border-gray-700 bg-gray-900 text-gray-400' : 'border-gray-100 bg-gray-50 text-gray-500'}`}>
                      <th className="px-4 py-2.5 text-left font-semibold">Type</th>
                      <th className="px-4 py-2.5 text-left font-semibold">Date</th>
                      <th className="px-4 py-2.5 text-left font-semibold">Location</th>
                      <th className="px-4 py-2.5 text-left font-semibold">Points</th>
                      <th className="px-4 py-2.5 text-left font-semibold">Severity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {violationHistory.map(v => (
                      <tr key={v.id} className={`border-b ${isDark ? 'border-gray-700 hover:bg-gray-750' : 'border-gray-50 hover:bg-gray-50'}`}>
                        <td className="px-4 py-2.5">
                          <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{v.type}</span>
                          {v.speed !== '—' && <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{v.speed}</p>}
                        </td>
                        <td className={`px-4 py-2.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{v.date}</td>
                        <td className={`px-4 py-2.5 max-w-32 truncate ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{v.location}</td>
                        <td className="px-4 py-2.5">
                          <span className="text-red-600 font-bold">+{v.points.toLocaleString()}</span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`px-2 py-0.5 rounded-full border font-medium capitalize ${SEVERITY_BG[v.severity]}`}>
                            {v.severity}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recent trips */}
            <div className={`rounded-2xl border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
              <div className={`flex items-center justify-between px-5 py-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-100'}`}>
                <div className="flex items-center gap-2">
                  <Clock size={16} className="text-purple-500" />
                  <h3 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>Recent Trips</h3>
                </div>
                <button className="text-xs text-purple-600 hover:underline">View all trips</button>
              </div>
              <div className="flex flex-col">
                {recentTrips.map((trip, i) => (
                  <div key={trip.id}
                    className={`px-5 py-3 flex items-center gap-4 border-b cursor-pointer transition-colors
                      ${isDark ? 'border-gray-700 hover:bg-gray-750' : 'border-gray-50 hover:bg-gray-50'}`}>
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold
                      ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className={`text-xs font-medium truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          {trip.from}
                        </span>
                        <ChevronRight size={10} className="text-gray-400 shrink-0" />
                        <span className={`text-xs font-medium truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          {trip.to}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{trip.date}</span>
                        <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{trip.distance}</span>
                        <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{trip.duration}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-sm font-bold`} style={{ color: SCORE_COLOR(trip.score) }}>{trip.score}</p>
                      <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>score</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </FleetpointLayout>
  )
}
