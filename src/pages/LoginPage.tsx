// src/pages/LoginPage.tsx

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mail, Lock, ChevronRight } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleContinue = (e: React.FormEvent) => {
    e.preventDefault()
// TODO: Replace this block with real API call to auth microservice
    // POST /api/auth/login  { email, password }
    // On success: store JWT token, redirect to /home
    // On failure: show error message from API response
    const DEMO_EMAIL = 'admin@hypernym.io'
    const DEMO_PASSWORD = 'test1234'

    if (email === DEMO_EMAIL && password === DEMO_PASSWORD) {
      navigate('/home')
    } else {
      setError('Invalid email or password. Try admin@hypernym.io / test1234')
    }
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden">

      {/* LEFT PANEL — dark background with placeholder illustration */}
      <div className="hidden lg:flex w-3/5 bg-black relative flex-col justify-between p-10"
        style={{ background: 'radial-gradient(ellipse at center bottom, #4c1d95 0%, #1e0a3c 40%, #000000 100%)' }}>

        {/* Top logos */}
        <div className="flex items-center gap-3">
          <span className="text-white font-bold text-xl tracking-tight">Hypernym</span>
          <span className="text-gray-500 text-xl">|</span>
          <span className="text-white font-bold text-xl tracking-tight">
            <span className="text-purple-400">io</span>Tility
          </span>
        </div>

        {/* Center placeholder for illustration */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="border border-purple-800 border-dashed rounded-2xl w-96 h-72 flex items-center justify-center">
            <p className="text-purple-500 text-sm">[ Module network illustration ]</p>
          </div>
        </div>

        {/* Bottom tagline */}
        <div className="relative z-10">
          <h2 className="text-white text-3xl font-bold leading-snug">
            Your ultimate toolkit for<br />everything you need!
          </h2>
          <p className="text-purple-300 mt-2 text-sm">
            Tailored just for your wild IoT adventures!
          </p>
        </div>

      </div>

      {/* RIGHT PANEL — login form */}
      <div className="flex-1 bg-gray-50 flex items-center justify-center px-8">
        <div className="w-full max-w-md">

          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Welcome to IoTlitity</h1>
            <p className="text-gray-500 text-sm mt-1">Streamline and automate your operations with IoTility.</p>
          </div>

          {/* Form */}
          <form onSubmit={handleContinue} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-1">Login to your account</h2>
            <p className="text-sm text-gray-500 mb-6">
              Are you new here?{' '}
              <a href="#" className="text-purple-600 font-medium hover:underline">Get Started!</a>
            </p>

            {/* Email */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Address <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center border border-gray-300 rounded-lg px-3 py-2.5 focus-within:border-purple-500 focus-within:ring-1 focus-within:ring-purple-500 bg-white">
                <Mail size={16} className="text-gray-400 mr-2 shrink-0" />
                <input
                  type="email"
                  placeholder="Your email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="flex-1 text-sm outline-none bg-transparent text-gray-900 placeholder-gray-400"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className="mb-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center border border-gray-300 rounded-lg px-3 py-2.5 focus-within:border-purple-500 focus-within:ring-1 focus-within:ring-purple-500 bg-white">
                <Lock size={16} className="text-gray-400 mr-2 shrink-0" />
                <input
                  type="password"
                  placeholder="••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="flex-1 text-sm outline-none bg-transparent text-gray-900 placeholder-gray-400"
                  required
                />
              </div>
            </div>

            {/* Forgot password */}
            <div className="text-right mb-6">
              <a href="#" className="text-sm text-purple-600 hover:underline">Forgotten Password?</a>
            </div>
{/* Error message */}
{error && (
              <p className="text-red-500 text-sm mb-4 text-center">{error}</p>
            )}
            {/* Submit */}
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 rounded-full transition-colors duration-200"
            >
              CONTINUE <ChevronRight size={18} />
            </button>
          </form>

        </div>
      </div>
    </div>
  )
}