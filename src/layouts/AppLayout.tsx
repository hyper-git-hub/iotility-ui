// src/layouts/AppLayout.tsx
// Main app shell — sidebar + topbar + content area
// Wraps all authenticated pages

import { useState } from 'react'
import { useTheme } from '../hooks/useTheme'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutGrid, Home, Users, Settings, CreditCard, HelpCircle
} from 'lucide-react'

const navItems = [
  { icon: LayoutGrid, label: 'Use Cases', path: '/home' },
  { icon: Home, label: 'Home', path: '/fleetpoint' },
  { icon: Users, label: 'Users', path: '/users' },
  { icon: Settings, label: 'Settings', path: '/settings' },
  { icon: CreditCard, label: 'Billing', path: '/billing' },
  { icon: HelpCircle, label: 'Help', path: '/help' },
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { isDark, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-50 dark:bg-gray-950">

      {/* SIDEBAR */}
      <div
        className="w-20 flex flex-col items-center py-6 gap-6 shrink-0"
        style={{ background: 'linear-gradient(180deg, #0a0a0f 0%, #1e0a3c 50%, #4c1d95 100%)' }}
      >
        {/* Logo */}
        <div className="w-12 h-12 rounded-xl bg-purple-600 flex items-center justify-center mb-2 shrink-0">
          <span className="text-white font-black text-xl">H</span>
        </div>

        {/* Nav items */}
        <nav className="flex flex-col items-center gap-1 flex-1">
          {navItems.map(({ icon: Icon, label, path }) => {
            const active = location.pathname === path
            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                className={`flex flex-col items-center gap-1 w-16 py-3 rounded-xl transition-all duration-150 cursor-pointer
                  ${active
                    ? 'bg-purple-600 text-white'
                    : 'text-purple-300 hover:bg-purple-900/40 hover:text-white'
                  }`}
              >
                <Icon size={20} />
                <span className="text-[10px] font-medium">{label}</span>
              </button>
            )
          })}
        </nav>

        {/* Bottom module pills — active subscriptions */}
        <div className="flex flex-col items-center gap-2">
          {/* TODO: render dynamically from user subscription data */}
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-xs font-bold shadow-lg">FP</div>
        </div>
      </div>

      {/* MAIN AREA */}
      <div className="flex-1 flex flex-col overflow-hidden dark:bg-gray-900">

        {/* TOP BAR */}
        <header className="h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-6 shrink-0">
          {/* IoTility logo */}
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-purple-600 flex items-center justify-center">
              <span className="text-white text-xs font-black">io</span>
            </div>
            <span className="font-bold text-gray-900 text-lg">
              io<span className="text-purple-600">T</span>ility
            </span>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {/* Dark mode toggle — TODO: wire up theme context */}
            <button className="flex items-center gap-2 border border-gray-200 rounded-full px-3 py-1.5 text-sm text-gray-600 hover:border-purple-400 transition-colors" onClick={toggleTheme}>
              { isDark ? '☀️ Light' : '🌙 Dark' }
            </button>

            {/* User */}
            <div className="flex items-center gap-2 cursor-pointer">
              <div className="text-right">
                <p className="text-sm font-semibold text-gray-900">Ali Mujtaba</p>
                {/* TODO: replace with logged in user name from auth context */}
                <p className="text-xs text-gray-500">Super Admin</p>
              </div>
              <div className="relative">
                <div className="w-9 h-9 rounded-full bg-purple-600 flex items-center justify-center text-white text-sm font-bold">
                  AM
                </div>
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-white"></span>
              </div>
            </div>
          </div>
        </header>

        {/* PAGE CONTENT */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>

      </div>
    </div>
  )
}