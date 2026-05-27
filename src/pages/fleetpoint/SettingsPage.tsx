// src/pages/fleetpoint/SettingsPage.tsx
// Settings — Organisation, Notifications, Map & Display, Integrations
// Users & Mobile App placeholders for Sprint 2
//
// DEVELOPER NOTES:
// ─────────────────────────────────────────────────────────────────────────────
// GET  /api/settings/org           — load org settings
// PUT  /api/settings/org           — save org settings (debounced 2s)
// GET  /api/settings/notifications — load notification preferences
// PUT  /api/settings/notifications — save notification preferences
// GET  /api/settings/integrations  — load integration status
// POST /api/settings/integrations/:id/test — test connection
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import {
  Building2, Bell, Map, Plug, Users, Smartphone,
  CheckCircle, AlertTriangle, Clock, X, Save,
  RefreshCw, ChevronRight, Search, Eye, EyeOff,
  Mail, MessageSquare, Zap, Globe, DollarSign,
  Shield, Truck, Briefcase, Cpu, Copy, ExternalLink,
  ToggleLeft, ToggleRight, Info
} from 'lucide-react'
import FleetpointLayout from '../../layouts/FleetpointLayout'
import {
  orgSettings, notificationSettings,
  integrationSettings
} from '../../data/fleetData'
import { useTheme } from '../../hooks/useTheme'
import type { NotificationSetting } from '../../data/fleetData'

// ─── Section config ───────────────────────────────────────────────────────────
type SectionId = 'organisation' | 'notifications' | 'display' | 'integrations' | 'users' | 'mobile'

const SECTIONS: { id: SectionId; label: string; icon: any; sprint2?: boolean }[] = [
  { id: 'organisation',   label: 'Organisation',         icon: Building2 },
  { id: 'notifications',  label: 'Notifications',        icon: Bell },
  { id: 'display',        label: 'Map & Display',        icon: Map },
  { id: 'integrations',   label: 'Integrations',         icon: Plug },
  { id: 'users',          label: 'Users & Access',       icon: Users,      sprint2: true },
  { id: 'mobile',         label: 'Mobile App',           icon: Smartphone, sprint2: true },
]

const NOTIF_CATEGORY_CONFIG = {
  vehicle:    { label: 'Vehicle',     icon: Truck,    color: 'text-purple-600', bg: 'bg-purple-50' },
  driver:     { label: 'Driver',      icon: Users,    color: 'text-blue-600',   bg: 'bg-blue-50' },
  job:        { label: 'Jobs',        icon: Briefcase,color: 'text-teal-600',   bg: 'bg-teal-50' },
  system:     { label: 'System',      icon: Cpu,      color: 'text-gray-600',   bg: 'bg-gray-100' },
  compliance: { label: 'Compliance',  icon: Shield,   color: 'text-amber-600',  bg: 'bg-amber-50' },
}

const INT_STATUS_CONFIG = {
  connected:     { label: 'Connected',     color: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-200', dot: 'bg-green-500' },
  disconnected:  { label: 'Disconnected',  color: 'text-gray-600',   bg: 'bg-gray-100',  border: 'border-gray-200',  dot: 'bg-gray-400' },
  error:         { label: 'Error',         color: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-200',   dot: 'bg-red-500' },
  coming_soon:   { label: 'Coming Soon',   color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200',dot: 'bg-purple-400' },
}

export default function SettingsPage() {
  const { isDark, toggleTheme } = useTheme()
  const [activeSection, setActiveSection] = useState<SectionId>('organisation')
  const [unsavedChanges, setUnsavedChanges] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [testingIntegration, setTestingIntegration] = useState<string | null>(null)
  const [showApiKey, setShowApiKey] = useState(false)
  const [notifications, setNotifications] = useState(notificationSettings)
  const [distanceUnit, setDistanceUnit] = useState(orgSettings.distanceUnit)
  const [speedUnit, setSpeedUnit] = useState(orgSettings.speedUnit)
  const [dateFormat, setDateFormat] = useState(orgSettings.dateFormat)
  const [timeFormat, setTimeFormat] = useState(orgSettings.timeFormat)
  const [filterNotifCategory, setFilterNotifCategory] = useState<'all' | string>('all')
  const [mapToggles, setMapToggles] = useState<Record<string, boolean>>({
    cluster: true, trails: true, geozones: true, autopan: false, speed: false, drivername: true
  })
  const [dashToggles, setDashToggles] = useState<Record<string, boolean>>({
    welcome: true, autorefresh: true, vehiclecount: true
  })

  const handleSave = () => {
    setSaving(true)
    setTimeout(() => {
      setSaving(false)
      setSaved(true)
      setUnsavedChanges(0)
      setTimeout(() => setSaved(false), 3000)
    }, 1000)
  }

  const handleChange = () => setUnsavedChanges(c => c + 1)

  const toggleNotif = (id: string, channel: 'inApp' | 'email' | 'sms' | 'push') => {
    setNotifications(prev => prev.map(n =>
      n.id === id ? { ...n, [channel]: !n[channel] } : n
    ))
    handleChange()
  }

  const testIntegration = (id: string) => {
    setTestingIntegration(id)
    setTimeout(() => setTestingIntegration(null), 2000)
  }

  const filteredNotifs = notifications.filter(n =>
    filterNotifCategory === 'all' || n.category === filterNotifCategory
  )

  return (
    <FleetpointLayout>
      <div className={`flex h-full min-h-screen ${isDark ? 'bg-gray-950' : 'bg-gray-50'}`}>

        {/* Left sidebar */}
        <div className={`w-56 shrink-0 border-r flex flex-col
          ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className={`px-4 py-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            <h1 className={`font-bold text-lg ${isDark ? 'text-white' : 'text-gray-900'}`}>Settings</h1>
            {unsavedChanges > 0 && (
              <p className="text-xs text-amber-600 font-medium mt-0.5">
                {unsavedChanges} unsaved change{unsavedChanges > 1 ? 's' : ''}
              </p>
            )}
          </div>
          <nav className="flex-1 py-2">
            {SECTIONS.map(section => (
              <button key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors
                  ${activeSection === section.id
                    ? 'bg-purple-600 text-white'
                    : `${isDark ? 'text-gray-300 hover:bg-gray-800' : 'text-gray-700 hover:bg-gray-50'}`}`}>
                <section.icon size={15} />
                <span className="text-sm font-medium">{section.label}</span>
                {section.sprint2 && (
                  <span className={`ml-auto text-xs px-1.5 py-0.5 rounded font-medium
                    ${activeSection === section.id ? 'bg-purple-500 text-white' : `${isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-500'}`}`}>
                    S2
                  </span>
                )}
              </button>
            ))}
          </nav>

          {/* Save button */}
          <div className={`p-4 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            <button onClick={handleSave}
              disabled={unsavedChanges === 0}
              className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all
                ${unsavedChanges > 0
                  ? 'bg-purple-600 hover:bg-purple-700 text-white'
                  : saved
                  ? 'bg-green-600 text-white'
                  : `${isDark ? 'bg-gray-800 text-gray-500' : 'bg-gray-100 text-gray-400'}`}`}>
              {saving ? <RefreshCw size={14} className="animate-spin" />
                : saved ? <CheckCircle size={14} />
                : <Save size={14} />}
              {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
            </button>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-6 py-6">

            {/* ── ORGANISATION ─────────────────────────────────────────────── */}
            {activeSection === 'organisation' && (
              <div className="flex flex-col gap-6">
                <div>
                  <h2 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Organisation</h2>
                  <p className={`text-sm mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    Company profile, regional settings and billing information
                  </p>
                </div>

                {/* Company profile */}
                <div className={`rounded-2xl border p-5 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                  <h3 className={`font-semibold text-sm mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Company Profile</h3>
                  <div className="flex flex-col gap-4">
                    {/* Logo upload */}
                    <div className="flex items-center gap-4">
                      <div className={`w-16 h-16 rounded-2xl border-2 border-dashed flex items-center justify-center
                        ${isDark ? 'border-gray-600 bg-gray-700' : 'border-gray-200 bg-gray-50'}`}>
                        <Building2 size={24} className="text-gray-400" />
                      </div>
                      <div>
                        <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>Company Logo</p>
                        <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>PNG or SVG · max 2MB · shown in reports and emails</p>
                        <button className="text-xs text-purple-600 font-medium mt-1 hover:underline">Upload logo</button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { label: 'Company Name', value: orgSettings.companyName, type: 'text' },
                        { label: 'Industry', value: orgSettings.industry, type: 'text' },
                        { label: 'Country', value: orgSettings.country, type: 'text' },
                        { label: 'Billing Email', value: orgSettings.billingEmail, type: 'email' },
                      ].map(field => (
                        <div key={field.label}>
                          <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{field.label}</label>
                          <input type={field.type} defaultValue={field.value}
                            onChange={handleChange}
                            className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-purple-500
                              ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200 text-gray-900'}`} />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Regional settings */}
                <div className={`rounded-2xl border p-5 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                  <h3 className={`font-semibold text-sm mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Regional & Units</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {/* Distance unit */}
                    <div>
                      <label className={`block text-xs font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Distance Unit</label>
                      <div className={`flex rounded-xl border overflow-hidden ${isDark ? 'border-gray-600' : 'border-gray-200'}`}>
                        {(['miles', 'km'] as const).map(u => (
                          <button key={u} onClick={() => { setDistanceUnit(u); handleChange() }}
                            className={`flex-1 py-2 text-sm font-medium transition-colors
                              ${distanceUnit === u ? 'bg-purple-600 text-white' : `${isDark ? 'bg-gray-700 text-gray-300' : 'bg-white text-gray-600'}`}`}>
                            {u === 'miles' ? 'Miles' : 'Kilometres'}
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* Speed unit */}
                    <div>
                      <label className={`block text-xs font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Speed Unit</label>
                      <div className={`flex rounded-xl border overflow-hidden ${isDark ? 'border-gray-600' : 'border-gray-200'}`}>
                        {(['mph', 'kph'] as const).map(u => (
                          <button key={u} onClick={() => { setSpeedUnit(u); handleChange() }}
                            className={`flex-1 py-2 text-sm font-medium transition-colors
                              ${speedUnit === u ? 'bg-purple-600 text-white' : `${isDark ? 'bg-gray-700 text-gray-300' : 'bg-white text-gray-600'}`}`}>
                            {u.toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* Timezone */}
                    <div>
                      <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Timezone</label>
                      <select defaultValue={orgSettings.timezone} onChange={handleChange}
                        className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none
                          ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200 text-gray-700'}`}>
                        <option value="Europe/London">Europe/London (GMT+0)</option>
                        <option value="Europe/Paris">Europe/Paris (GMT+1)</option>
                        <option value="America/New_York">America/New_York (GMT-5)</option>
                        <option value="Asia/Dubai">Asia/Dubai (GMT+4)</option>
                        <option value="Asia/Karachi">Asia/Karachi (GMT+5)</option>
                      </select>
                    </div>
                    {/* Currency */}
                    <div>
                      <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Currency</label>
                      <select defaultValue={orgSettings.currency} onChange={handleChange}
                        className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none
                          ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200 text-gray-700'}`}>
                        <option value="GBP">GBP — British Pound (£)</option>
                        <option value="USD">USD — US Dollar ($)</option>
                        <option value="EUR">EUR — Euro (€)</option>
                        <option value="AED">AED — UAE Dirham (د.إ)</option>
                        <option value="PKR">PKR — Pakistani Rupee (₨)</option>
                      </select>
                    </div>
                    {/* Date format */}
                    <div>
                      <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Date Format</label>
                      <select value={dateFormat} onChange={e => { setDateFormat(e.target.value as any); handleChange() }}
                        className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none
                          ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200 text-gray-700'}`}>
                        <option value="DD/MM/YYYY">DD/MM/YYYY (UK)</option>
                        <option value="MM/DD/YYYY">MM/DD/YYYY (US)</option>
                        <option value="YYYY-MM-DD">YYYY-MM-DD (ISO)</option>
                      </select>
                    </div>
                    {/* Time format */}
                    <div>
                      <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Time Format</label>
                      <div className={`flex rounded-xl border overflow-hidden ${isDark ? 'border-gray-600' : 'border-gray-200'}`}>
                        {(['24h', '12h'] as const).map(t => (
                          <button key={t} onClick={() => { setTimeFormat(t); handleChange() }}
                            className={`flex-1 py-2 text-sm font-medium transition-colors
                              ${timeFormat === t ? 'bg-purple-600 text-white' : `${isDark ? 'bg-gray-700 text-gray-300' : 'bg-white text-gray-600'}`}`}>
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Plan */}
                <div className={`rounded-2xl border p-5 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>Plan & Billing</h3>
                    <span className="text-xs bg-purple-600 text-white px-2.5 py-1 rounded-full font-semibold capitalize">
                      {orgSettings.plan}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    {[
                      { label: 'Seats Used', value: `${orgSettings.seatsUsed} / ${orgSettings.seatsTotal}` },
                      { label: 'Vehicles', value: '15 / 50' },
                      { label: 'Renewal', value: orgSettings.renewalDate },
                    ].map(stat => (
                      <div key={stat.label} className={`rounded-xl p-3 ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
                        <p className={`text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{stat.value}</p>
                        <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{stat.label}</p>
                      </div>
                    ))}
                  </div>
                  {/* Seats bar */}
                  <div className="mb-3">
                    <div className="flex justify-between mb-1">
                      <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Seats used</span>
                      <span className={`text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        {orgSettings.seatsUsed} of {orgSettings.seatsTotal}
                      </span>
                    </div>
                    <div className={`h-2 rounded-full ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
                      <div className="h-full rounded-full bg-purple-600"
                        style={{ width: `${(orgSettings.seatsUsed / orgSettings.seatsTotal) * 100}%` }} />
                    </div>
                  </div>
                  <button className="text-xs text-purple-600 font-medium hover:underline">
                    Upgrade plan → add more seats or vehicles
                  </button>
                </div>
              </div>
            )}

            {/* ── NOTIFICATIONS ────────────────────────────────────────────── */}
            {activeSection === 'notifications' && (
              <div className="flex flex-col gap-6">
                <div>
                  <h2 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Notifications & Alerts</h2>
                  <p className={`text-sm mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    Configure what triggers alerts, who receives them and how they are delivered
                  </p>
                </div>

                {/* Alert channels info */}
                <div className={`rounded-2xl border p-5 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                  <h3 className={`font-semibold text-sm mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Alert Channels</h3>
                  <div className="grid grid-cols-4 gap-3">
                    {[
                      { icon: Bell, label: 'In-App', desc: 'Sidebar badge + toast', color: 'text-purple-600', bg: 'bg-purple-50', enabled: true },
                      { icon: Mail, label: 'Email', desc: orgSettings.billingEmail, color: 'text-blue-600', bg: 'bg-blue-50', enabled: true },
                      { icon: MessageSquare, label: 'SMS', desc: 'Configure phone number', color: 'text-green-600', bg: 'bg-green-50', enabled: false },
                      { icon: Zap, label: 'Push', desc: 'Mobile app required', color: 'text-amber-600', bg: 'bg-amber-50', enabled: false },
                    ].map(channel => (
                      <div key={channel.label} className={`rounded-xl p-3 border ${isDark ? 'border-gray-700' : 'border-gray-100'}`}>
                        <div className={`w-8 h-8 rounded-xl ${channel.bg} flex items-center justify-center mb-2`}>
                          <channel.icon size={15} className={channel.color} />
                        </div>
                        <p className={`text-xs font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{channel.label}</p>
                        <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'} mt-0.5`}>{channel.desc}</p>
                        <div className={`mt-2 text-xs font-medium ${channel.enabled ? 'text-green-600' : 'text-gray-400'}`}>
                          {channel.enabled ? '✓ Active' : '○ Not configured'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Quiet hours */}
                <div className={`rounded-2xl border p-5 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>Quiet Hours</h3>
                      <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        Suppress non-critical notifications during these hours
                      </p>
                    </div>
                    <button className="text-xs bg-green-50 text-green-700 border border-green-200 px-3 py-1.5 rounded-xl font-medium">
                      ✓ Enabled
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {['From', 'To'].map(label => (
                      <div key={label}>
                        <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{label}</label>
                        <input type="time" defaultValue={label === 'From' ? '22:00' : '07:00'}
                          onChange={handleChange}
                          className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none
                            ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200 text-gray-700'}`} />
                      </div>
                    ))}
                  </div>
                  <p className={`text-xs mt-3 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    ℹ️ Critical alerts (fatigue, collision warning) always send regardless of quiet hours
                  </p>
                </div>

                {/* Notification preferences per type */}
                <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                  <div className={`flex items-center justify-between px-5 py-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                    <h3 className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>Alert Preferences</h3>
                    <div className="flex gap-1">
                      <button onClick={() => setFilterNotifCategory('all')}
                        className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors
                          ${filterNotifCategory === 'all' ? 'bg-purple-600 text-white' : `${isDark ? 'text-gray-400 hover:bg-gray-700' : 'text-gray-500 hover:bg-gray-100'}`}`}>
                        All
                      </button>
                      {Object.entries(NOTIF_CATEGORY_CONFIG).map(([cat, cfg]) => (
                        <button key={cat} onClick={() => setFilterNotifCategory(cat)}
                          className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors
                            ${filterNotifCategory === cat ? 'bg-purple-600 text-white' : `${isDark ? 'text-gray-400 hover:bg-gray-700' : 'text-gray-500 hover:bg-gray-100'}`}`}>
                          {cfg.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className={`border-b text-xs font-semibold uppercase tracking-wide
                        ${isDark ? 'border-gray-700 bg-gray-900 text-gray-400' : 'border-gray-100 bg-gray-50 text-gray-500'}`}>
                        <th className="px-5 py-3 text-left">Alert</th>
                        <th className="px-3 py-3 text-center">In-App</th>
                        <th className="px-3 py-3 text-center">Email</th>
                        <th className="px-3 py-3 text-center">SMS</th>
                        <th className="px-3 py-3 text-center">Push</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredNotifs.map(notif => {
                        const cat = NOTIF_CATEGORY_CONFIG[notif.category]
                        return (
                          <tr key={notif.id}
                            className={`border-b ${isDark ? 'border-gray-700' : 'border-gray-50'}`}>
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-2">
                                <div className={`w-6 h-6 rounded-lg ${cat.bg} flex items-center justify-center shrink-0`}>
                                  <cat.icon size={11} className={cat.color} />
                                </div>
                                <div>
                                  <p className={`text-xs font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{notif.name}</p>
                                  <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{notif.description}</p>
                                </div>
                              </div>
                            </td>
                            {(['inApp', 'email', 'sms', 'push'] as const).map(channel => (
                              <td key={channel} className="px-3 py-3 text-center">
                                <button onClick={() => toggleNotif(notif.id, channel)}
                                  className={`w-8 h-5 rounded-full transition-all duration-200 relative inline-flex items-center
                                    ${notif[channel] ? 'bg-purple-600' : `${isDark ? 'bg-gray-600' : 'bg-gray-300'}`}`}>
                                  <span className={`w-3 h-3 bg-white rounded-full absolute transition-all duration-200 shadow-sm
                                    ${notif[channel] ? 'left-4' : 'left-1'}`} />
                                </button>
                              </td>
                            ))}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── MAP & DISPLAY ────────────────────────────────────────────── */}
            {activeSection === 'display' && (
              <div className="flex flex-col gap-6">
                <div>
                  <h2 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Map & Display</h2>
                  <p className={`text-sm mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    Visual preferences, map defaults and theme settings
                  </p>
                </div>

                {/* Theme */}
                <div className={`rounded-2xl border p-5 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                  <h3 className={`font-semibold text-sm mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Theme</h3>
                  <div className="flex gap-3">
                    {[
                      { id: 'light', label: 'Light', emoji: '☀️', active: !isDark },
                      { id: 'dark', label: 'Dark', emoji: '🌙', active: isDark },
                    ].map(theme => (
                      <button key={theme.id}
                        onClick={toggleTheme}
                        className={`flex-1 flex items-center gap-3 p-4 rounded-2xl border-2 transition-all
                          ${theme.active
                            ? 'border-purple-500 bg-purple-50'
                            : `${isDark ? 'border-gray-700 hover:border-gray-600' : 'border-gray-200 hover:border-gray-300'}`}`}>
                        <span className="text-2xl">{theme.emoji}</span>
                        <div className="text-left">
                          <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{theme.label}</p>
                          {theme.active && <p className="text-xs text-purple-600 font-medium">Active</p>}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Map defaults */}
                <div className={`rounded-2xl border p-5 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                  <h3 className={`font-semibold text-sm mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Map Defaults</h3>
                  <div className="flex flex-col gap-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Default Map View</label>
                        <select onChange={handleChange}
                          className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none
                            ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200 text-gray-700'}`}>
                          <option>Road Map</option>
                          <option>Satellite</option>
                          <option>Terrain</option>
                        </select>
                      </div>
                      <div>
                        <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Default Zoom Level</label>
                        <select onChange={handleChange}
                          className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none
                            ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200 text-gray-700'}`}>
                          <option>Country (zoom 6)</option>
                          <option>Region (zoom 8)</option>
                          <option>City (zoom 10)</option>
                          <option>Street (zoom 14)</option>
                        </select>
                      </div>
                    </div>
                    {[
                      { label: 'Cluster vehicles when zoomed out', key: 'cluster' },
                      { label: 'Show vehicle trails on Live Tracking', key: 'trails' },
                      { label: 'Show geozone boundaries on Live Tracking', key: 'geozones' },
                      { label: 'Auto-pan map to follow selected vehicle', key: 'autopan' },
                      { label: 'Show speed on vehicle markers', key: 'speed' },
                      { label: 'Show driver name on vehicle markers', key: 'drivername' },
                    ].map(setting => (
                      <div key={setting.label} className="flex items-center justify-between">
                        <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{setting.label}</span>
                        <button onClick={() => { setMapToggles(prev => ({ ...prev, [setting.key]: !prev[setting.key] })); handleChange() }}
                          className={`w-10 h-6 rounded-full transition-all duration-200 relative shrink-0
                            ${mapToggles[setting.key] ? 'bg-purple-600' : `${isDark ? 'bg-gray-600' : 'bg-gray-300'}`}`}>
                          <span className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all duration-200 shadow-sm
                            ${mapToggles[setting.key] ? 'left-5' : 'left-1'}`} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Dashboard */}
                <div className={`rounded-2xl border p-5 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                  <h3 className={`font-semibold text-sm mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Dashboard</h3>
                  <div className="flex flex-col gap-3">
                    {[
                      { label: 'Show welcome message on login', key: 'welcome' },
                      { label: 'Auto-refresh dashboard every 60 seconds', key: 'autorefresh' },
                      { label: 'Show live vehicle count in sidebar', key: 'vehiclecount' },
                    ].map(setting => (
                      <div key={setting.label} className="flex items-center justify-between">
                        <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{setting.label}</span>
                        <button onClick={() => { setDashToggles(prev => ({ ...prev, [setting.key]: !prev[setting.key] })); handleChange() }}
                          className={`w-10 h-6 rounded-full transition-all duration-200 relative shrink-0
                            ${dashToggles[setting.key] ? 'bg-purple-600' : `${isDark ? 'bg-gray-600' : 'bg-gray-300'}`}`}>
                          <span className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all duration-200 shadow-sm
                            ${dashToggles[setting.key] ? 'left-5' : 'left-1'}`} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── INTEGRATIONS ─────────────────────────────────────────────── */}
            {activeSection === 'integrations' && (
              <div className="flex flex-col gap-6">
                <div>
                  <h2 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Integrations</h2>
                  <p className={`text-sm mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    Connect IoTility with your other tools and systems
                  </p>
                </div>

                {/* Connected */}
                <div>
                  <h3 className={`text-xs font-semibold uppercase tracking-wide mb-3 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    Connected
                  </h3>
                  <div className="flex flex-col gap-3">
                    {integrationSettings.filter(i => i.status === 'connected').map(integration => {
                      const status = INT_STATUS_CONFIG[integration.status]
                      const isTesting = testingIntegration === integration.id
                      return (
                        <div key={integration.id}
                          className={`rounded-2xl border p-5 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <span className="text-2xl">{integration.icon}</span>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>{integration.name}</p>
                                  <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium
                                    ${status.color} ${status.bg} ${status.border}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`}></span>
                                    {status.label}
                                  </span>
                                </div>
                                <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{integration.description}</p>
                              </div>
                            </div>
                            <button onClick={() => testIntegration(integration.id)}
                              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border font-medium transition-colors
                                ${isDark ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                              {isTesting ? <RefreshCw size={11} className="animate-spin" /> : <Zap size={11} />}
                              {isTesting ? 'Testing...' : 'Test'}
                            </button>
                          </div>
                          <div className="flex items-center gap-4 flex-wrap">
                            {integration.deviceCount !== undefined && (
                              <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                📡 {integration.deviceCount} devices
                              </span>
                            )}
                            {integration.lastSync && (
                              <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                🕐 Last sync: {new Date(integration.lastSync).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                            {integration.apiEndpoint && (
                              <span className={`text-xs font-mono ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                {integration.apiEndpoint}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1.5 mt-3">
                            {integration.features.map(f => (
                              <span key={f} className={`text-xs px-2 py-0.5 rounded-full font-medium
                                ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
                                ✓ {f}
                              </span>
                            ))}
                          </div>
                          {/* API key for REST API integration */}
                          {integration.id === 'INT008' && (
                            <div className={`mt-3 p-3 rounded-xl ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
                              <p className={`text-xs font-semibold mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>API Key</p>
                              <div className="flex items-center gap-2">
                                <code className={`flex-1 text-xs font-mono px-2 py-1.5 rounded-lg ${isDark ? 'bg-gray-800 text-gray-300' : 'bg-white text-gray-700'}`}>
                                  {showApiKey ? 'iot_live_sk_4821_xK9mP2nQ7rL8wV3' : '••••••••••••••••••••••••••••••'}
                                </code>
                                <button onClick={() => setShowApiKey(!showApiKey)}
                                  className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-gray-600 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
                                  {showApiKey ? <EyeOff size={13} /> : <Eye size={13} />}
                                </button>
                                <button className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-gray-600 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
                                  <Copy size={13} />
                                </button>
                              </div>
                              <div className="flex items-center gap-2 mt-2">
                                <a href="https://docs.iotility.io" target="_blank" rel="noopener noreferrer"
                                  className="text-xs text-purple-600 hover:underline flex items-center gap-1">
                                  <ExternalLink size={10} /> API Documentation
                                </a>
                                <button className="text-xs text-red-600 hover:underline ml-auto">Regenerate key</button>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Available to connect */}
                <div>
                  <h3 className={`text-xs font-semibold uppercase tracking-wide mb-3 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    Available to Connect
                  </h3>
                  <div className="flex flex-col gap-3">
                    {integrationSettings.filter(i => i.status === 'disconnected').map(integration => (
                      <div key={integration.id}
                        className={`rounded-2xl border p-4 flex items-center gap-4
                          ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                        <span className="text-xl shrink-0">{integration.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{integration.name}</p>
                          <p className={`text-xs truncate ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{integration.description}</p>
                        </div>
                        <button className="shrink-0 flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold px-3 py-2 rounded-xl transition-colors">
                          Connect
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Coming soon */}
                <div>
                  <h3 className={`text-xs font-semibold uppercase tracking-wide mb-3 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    Coming Soon
                  </h3>
                  <div className="flex flex-col gap-3">
                    {integrationSettings.filter(i => i.status === 'coming_soon').map(integration => (
                      <div key={integration.id}
                        className={`rounded-2xl border p-4 flex items-center gap-4 opacity-60
                          ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                        <span className="text-xl shrink-0">{integration.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{integration.name}</p>
                          <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{integration.description}</p>
                        </div>
                        <span className="shrink-0 text-xs bg-purple-50 text-purple-700 border border-purple-200 px-3 py-1.5 rounded-xl font-medium">
                          Coming Soon
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── USERS — Sprint 2 placeholder ─────────────────────────────── */}
            {activeSection === 'users' && (
              <div className="flex flex-col gap-6">
                <div>
                  <h2 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Users & Access</h2>
                  <p className={`text-sm mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    Manage team members, roles and permissions
                  </p>
                </div>
                <div className={`rounded-2xl border-2 border-dashed p-12 text-center ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                  <Users size={36} className="text-gray-400 mx-auto mb-4" />
                  <p className={`font-bold text-lg mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    Users & Access Management
                  </p>
                  <p className={`text-sm mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    Coming in Sprint 2
                  </p>
                  <p className={`text-xs ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                    Role-based access control, team invites, permission groups, audit log
                  </p>
                  <div className="flex flex-wrap justify-center gap-2 mt-4">
                    {['Admin', 'Fleet Manager', 'Driver', 'Read Only', 'Workshop', 'Finance'].map(role => (
                      <span key={role} className={`text-xs px-3 py-1.5 rounded-full border font-medium
                        ${isDark ? 'border-gray-700 text-gray-400' : 'border-gray-200 text-gray-500'}`}>
                        {role}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── MOBILE APP — Sprint 2 placeholder ────────────────────────── */}
            {activeSection === 'mobile' && (
              <div className="flex flex-col gap-6">
                <div>
                  <h2 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Mobile App</h2>
                  <p className={`text-sm mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    Driver app settings and mobile configuration
                  </p>
                </div>
                <div className={`rounded-2xl border-2 border-dashed p-12 text-center ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                  <Smartphone size={36} className="text-gray-400 mx-auto mb-4" />
                  <p className={`font-bold text-lg mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    IoTility Driver App
                  </p>
                  <p className={`text-sm mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    Coming in Sprint 2 — React Native
                  </p>
                  <p className={`text-xs ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                    Driver checklist, job management, POD photos, navigation, messaging
                  </p>
                  <div className="flex flex-wrap justify-center gap-2 mt-4">
                    {['Pre-trip checklist', 'Job notifications', 'POD capture', 'Navigation', 'Chat with dispatcher', 'Tachograph'].map(f => (
                      <span key={f} className={`text-xs px-3 py-1.5 rounded-full border font-medium
                        ${isDark ? 'border-gray-700 text-gray-400' : 'border-gray-200 text-gray-500'}`}>
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </FleetpointLayout>
  )
}
