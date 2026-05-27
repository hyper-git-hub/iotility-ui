import { useNavigate } from 'react-router-dom'
// src/pages/HomePage.tsx
// Main home page after login — shows use case cards + onboarding guide
// TODO: fetch user subscriptions from GET /api/subscriptions/user/:userId

import { useState } from 'react'
import { Star, Plus, Minus, ChevronRight, ShoppingCart } from 'lucide-react'
import AppLayout from '../layouts/AppLayout'
import DeviceInstallModal from '../components/DeviceInstallModal'
import { modules } from '../data/modules'

const onboardingSteps = [
  {
    id: 1,
    title: 'Step 1: You are on the Free Tier of IoTility Fleetpoint',
    content: 'You have full access to the Fleetpoint demo environment. Explore live tracking, driver management, route planning and reporting with up to 5 demo vehicles. Upgrade anytime to connect your real fleet.',
  },
  {
    id: 2,
    title: 'Step 2: Get your IoT devices installed',
    content: 'Install your GPS trackers and IoT sensors on your vehicles. Choose self-installation or book a certified IoTility engineer to visit your site.',
    hasAction: true,
  },
  {
    id: 3,
    title: 'Step 3: Configure your preferences',
    content: 'Set your timezone, units of measurement, alert thresholds, geofence zones, and notification preferences for your fleet.',
  },
  {
    id: 4,
    title: 'Step 4: Add vehicles',
    content: 'Register your vehicle fleet — add registration plates, vehicle types, fuel types, and assign them to depots or groups.',
  },
  {
    id: 5,
    title: 'Step 5: Add drivers',
    content: 'Create driver profiles, assign driver IDs, set working hours, licence categories and link them to vehicles for live attribution.',
  },
  {
    id: 6,
    title: 'Step 6: Setup your dashboard',
    content: 'Customise your Fleetpoint dashboard — choose your widgets, set up KPI tiles, and configure your reporting schedule.',
  },
]

export default function HomePage() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('fleetpoint')
  const [expandedStep, setExpandedStep] = useState<number | null>(1)
  const [showDeviceModal, setShowDeviceModal] = useState(false)

  const activeModule = modules.find(m => m.id === activeTab)
  const userHasAccess = activeTab === 'fleetpoint'

  return (
    <AppLayout>
      <div className="flex h-full">

        {/* LEFT — main content */}
        <div className="flex-1 p-8 overflow-y-auto">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Welcome to IoTility</h1>
          <p className="text-gray-500 text-sm mb-6 max-w-2xl">
            Introducing IoTility, a cutting-edge SaaS solution designed to revolutionize your operations.
            With versatile use cases including fleet management, asset management, sustainability management,
            and smart building solutions, IoTility empowers businesses to optimize resources, enhance efficiency,
            and drive sustainable growth.
          </p>

          {/* Module cards grid */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="grid grid-cols-2 xl:grid-cols-3 gap-4 mb-4">
              {modules.slice(0, 5).map(mod => (
                <div key={mod.id} className="border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow flex flex-col justify-between min-h-36">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-900 text-sm">{mod.name}</h3>
                      <p className="text-xs text-gray-500 mt-0.5">{mod.tagline}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 mb-3">
                    <Star size={12} className="text-yellow-400 fill-yellow-400" />
                    <span className="text-xs text-gray-600">{mod.rating.toFixed(1)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    {mod.status === 'trial' ? (
                      <button onClick={() => navigate(`/${mod.id}`)} className="flex items-center gap-1 text-xs border border-gray-300 rounded-lg px-3 py-1.5 hover:border-purple-500 hover:text-purple-600 transition-colors">
                        Try for Free <ChevronRight size={12} />
                      </button>
                    ) : (
                      <button className="flex items-center gap-1 text-xs border border-gray-300 rounded-lg px-3 py-1.5 hover:border-purple-500 hover:text-purple-600 transition-colors">
                        <ShoppingCart size={12} /> Buy
                      </button>
                    )}
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${mod.bgGradient} flex items-center justify-center text-white text-xs font-bold`}>
                      {mod.initials}
                    </div>
                  </div>
                </div>
              ))}

              {/* Browse all card */}
              <div className="border border-dashed border-gray-300 rounded-xl p-4 flex items-center justify-center hover:border-purple-400 cursor-pointer transition-colors">
                <span className="text-sm text-gray-500 font-medium flex items-center gap-1">
                  Browse All <ChevronRight size={14} />
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT — onboarding guide */}
        <div className="w-96 border-l border-gray-200 bg-white p-6 overflow-y-auto shrink-0">
          <h2 className="text-lg font-bold text-gray-900 mb-1">Step-by-step guide</h2>
          <p className="text-gray-500 text-sm mb-4">Here is your step by step guide to our IoTility System</p>

          {/* Module tabs */}
          <div className="flex gap-1 mb-5 overflow-x-auto pb-1">
            {modules.map(mod => (
              <button
                key={mod.id}
                onClick={() => setActiveTab(mod.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all
                  ${activeTab === mod.id
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                {mod.name}
              </button>
            ))}
          </div>

          {/* Access gate for non-subscribed modules */}
          {!userHasAccess ? (
            <div className="border-2 border-dashed border-gray-200 rounded-2xl p-6 text-center">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${activeModule?.bgGradient} flex items-center justify-center text-white text-sm font-bold mx-auto mb-3`}>
                {activeModule?.initials}
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">You don't have access to {activeModule?.name}</h3>
              <p className="text-sm text-gray-500 mb-4">Subscribe to IoTility {activeModule?.name} to unlock full onboarding and features</p>
              <button className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold px-5 py-2.5 rounded-full mx-auto transition-colors">
                <ShoppingCart size={14} /> Buy Now
              </button>
            </div>
          ) : (
            /* Accordion steps */
            <div className="flex flex-col gap-2">
              {onboardingSteps.map(step => (
                <div key={step.id} className="border border-gray-200 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setExpandedStep(expandedStep === step.id ? null : step.id)}
                    className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                  >
                    <span className="text-sm font-medium text-gray-900">{step.title}</span>
                    {expandedStep === step.id
                      ? <Minus size={16} className="text-gray-400 shrink-0" />
                      : <Plus size={16} className="text-gray-400 shrink-0" />
                    }
                  </button>

                  {expandedStep === step.id && (
                    <div className="px-4 pb-4 text-sm text-gray-600 border-t border-gray-100 pt-3">
                      <p>{step.content}</p>
                      {step.hasAction && (
                        <button
                          onClick={() => setShowDeviceModal(true)}
                          className="mt-3 flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold px-4 py-2 rounded-full transition-colors"
                        >
                          Start device setup <ChevronRight size={12} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Device install modal */}
      {showDeviceModal && <DeviceInstallModal onClose={() => setShowDeviceModal(false)} />}
    </AppLayout>
  )
}