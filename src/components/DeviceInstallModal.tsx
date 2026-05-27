// src/components/DeviceInstallModal.tsx
// Device installation onboarding modal
// Triggered from Step 2 of the onboarding guide on HomePage
// Two paths: Self Install or Engineer Visit
// TODO: on completion, call POST /api/devices/register with IMEI + vehicle data

import { useState } from 'react'
import { X, ChevronRight, ChevronLeft, Wifi, Wrench, QrCode, Truck, CheckCircle, Calendar, Clock } from 'lucide-react'

type Path = 'choose' | 'self' | 'engineer'
type SelfStep = 'device' | 'imei' | 'confirm'
type EngineerStep = 'fleet-details' | 'contact' | 'schedule' | 'confirmed'

const DEVICES = [
  {
    id: 'fmc920',
    name: 'Teltonika FMC920',
    description: 'Compact GNSS/GSM tracker with Bluetooth. Ideal for cars and light vehicles.',
    features: ['GPS + GLONASS', 'Bluetooth 4.0', '2G connectivity', 'Compact form factor'],
    image: '📡',
  },
  {
    id: 'tr3120',
    name: 'BSJIOT TR3120',
    description: 'Heavy duty 4G LTE tracker with CAN bus support. Ideal for trucks and HGVs.',
    features: ['4G LTE Cat-1', 'CAN Bus support', 'Harsh environment rated', 'Remote configuration'],
    image: '🛰️',
  },
]

const VEHICLE_TYPES = ['Car', 'Van', 'Truck', 'HGV', 'Refrigerated Truck', 'Bus', 'Motorcycle', 'Other']

const TIME_SLOTS = ['09:00 AM', '10:00 AM', '11:00 AM', '01:00 PM', '02:00 PM', '03:00 PM', '04:00 PM']

const CALENDAR_DAYS = Array.from({ length: 14 }, (_, i) => {
  const d = new Date()
  d.setDate(d.getDate() + i + 1)
  return d
})

interface Props {
  onClose: () => void
}

export default function DeviceInstallModal({ onClose }: Props) {
  const [path, setPath] = useState<Path>('choose')

  // Self install state
  const [selfStep, setSelfStep] = useState<SelfStep>('device')
  const [selectedDevice, setSelectedDevice] = useState<string>('')
  const [imeiInput, setImeiInput] = useState<string>('')
  const [imeiMethod, setImeiMethod] = useState<'manual' | 'scan'>('manual')

  // Engineer visit state
  const [engStep, setEngStep] = useState<EngineerStep>('fleet-details')
  const [vehicleCount, setVehicleCount] = useState<string>('')
  const [selectedVehicleTypes, setSelectedVehicleTypes] = useState<string[]>([])
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<string>('')

  const toggleVehicleType = (type: string) => {
    setSelectedVehicleTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    )
  }

  const progressSteps = {
    self: { device: 1, imei: 2, confirm: 3 },
    engineer: { 'fleet-details': 1, contact: 2, schedule: 3, confirmed: 4 },
  }

  const renderProgress = (total: number, current: number) => (
    <div className="flex items-center gap-2 mb-6">
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className={`h-1.5 flex-1 rounded-full transition-all duration-300
          ${i < current ? 'bg-purple-600' : 'bg-gray-200'}`} />
      ))}
    </div>
  )

  // ─── CHOOSE PATH ────────────────────────────────────────────────
  const renderChoosePath = () => (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-1">Get your IoT devices installed</h2>
      <p className="text-gray-500 text-sm mb-6">How would you like to proceed with device installation?</p>

      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => setPath('self')}
          className="border-2 border-gray-200 hover:border-purple-500 rounded-2xl p-6 text-left transition-all duration-200 group"
        >
          <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center mb-4 group-hover:bg-purple-600 transition-colors">
            <Wifi size={24} className="text-purple-600 group-hover:text-white transition-colors" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-1">I'll install myself</h3>
          <p className="text-sm text-gray-500">Self-guided installation with step by step instructions</p>
          <div className="mt-4 text-purple-600 text-sm font-medium flex items-center gap-1">
            Get started <ChevronRight size={14} />
          </div>
        </button>

        <button
          onClick={() => setPath('engineer')}
          className="border-2 border-gray-200 hover:border-purple-500 rounded-2xl p-6 text-left transition-all duration-200 group"
        >
          <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center mb-4 group-hover:bg-purple-600 transition-colors">
            <Wrench size={24} className="text-blue-600 group-hover:text-white transition-colors" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-1">IoTility engineer visit</h3>
          <p className="text-sm text-gray-500">Our certified engineers come to you and handle everything</p>
          <div className="mt-4 text-purple-600 text-sm font-medium flex items-center gap-1">
            Book visit <ChevronRight size={14} />
          </div>
        </button>
      </div>
    </div>
  )

  // ─── SELF INSTALL ────────────────────────────────────────────────
  const renderSelfInstall = () => {
    if (selfStep === 'device') return (
      <div>
        {renderProgress(3, 1)}
        <h2 className="text-xl font-bold text-gray-900 mb-1">Select your device</h2>
        <p className="text-gray-500 text-sm mb-6">Choose the IoT tracker you have purchased</p>

        <div className="flex flex-col gap-4">
          {DEVICES.map(device => (
            <button
              key={device.id}
              onClick={() => setSelectedDevice(device.id)}
              className={`border-2 rounded-2xl p-5 text-left transition-all duration-200
                ${selectedDevice === device.id ? 'border-purple-600 bg-purple-50' : 'border-gray-200 hover:border-purple-300'}`}
            >
              <div className="flex items-start gap-4">
                <span className="text-3xl">{device.image}</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900">{device.name}</h3>
                    {selectedDevice === device.id && (
                      <CheckCircle size={20} className="text-purple-600" />
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">{device.description}</p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {device.features.map(f => (
                      <span key={f} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">{f}</span>
                    ))}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="flex justify-between mt-6">
          <button onClick={() => setPath('choose')} className="flex items-center gap-1 text-gray-500 hover:text-gray-700 text-sm">
            <ChevronLeft size={16} /> Back
          </button>
          <button
            onClick={() => selectedDevice && setSelfStep('imei')}
            disabled={!selectedDevice}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-6 py-2.5 rounded-full transition-colors"
          >
            Next <ChevronRight size={16} />
          </button>
        </div>
      </div>
    )

    if (selfStep === 'imei') return (
      <div>
        {renderProgress(3, 2)}
        <h2 className="text-xl font-bold text-gray-900 mb-1">Enter device IMEI</h2>
        <p className="text-gray-500 text-sm mb-6">
          The IMEI is printed on your {DEVICES.find(d => d.id === selectedDevice)?.name} device label
        </p>

        <div className="flex gap-3 mb-6">
          <button
            onClick={() => setImeiMethod('manual')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium border-2 transition-all
              ${imeiMethod === 'manual' ? 'border-purple-600 bg-purple-50 text-purple-700' : 'border-gray-200 text-gray-500'}`}
          >
            ✏️ Enter manually
          </button>
          <button
            onClick={() => setImeiMethod('scan')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium border-2 transition-all
              ${imeiMethod === 'scan' ? 'border-purple-600 bg-purple-50 text-purple-700' : 'border-gray-200 text-gray-500'}`}
          >
            <span className="flex items-center justify-center gap-1"><QrCode size={14} /> Scan barcode</span>
          </button>
        </div>

        {imeiMethod === 'manual' ? (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">IMEI Number</label>
            <input
              type="text"
              placeholder="e.g. 352099001761481"
              maxLength={15}
              value={imeiInput}
              onChange={e => setImeiInput(e.target.value.replace(/\D/g, ''))}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 font-mono tracking-widest"
            />
            <p className="text-xs text-gray-400 mt-2">15-digit number — found on device label or box</p>
          </div>
        ) : (
          <div className="border-2 border-dashed border-gray-300 rounded-2xl h-40 flex flex-col items-center justify-center gap-2 bg-gray-50">
            <QrCode size={32} className="text-gray-400" />
            <p className="text-sm text-gray-500">Camera scan not available in demo</p>
            <p className="text-xs text-gray-400">TODO: integrate device camera API</p>
          </div>
        )}

        <div className="flex justify-between mt-6">
          <button onClick={() => setSelfStep('device')} className="flex items-center gap-1 text-gray-500 hover:text-gray-700 text-sm">
            <ChevronLeft size={16} /> Back
          </button>
          <button
            onClick={() => imeiInput.length === 15 && setSelfStep('confirm')}
            disabled={imeiInput.length !== 15}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-6 py-2.5 rounded-full transition-colors"
          >
            Next <ChevronRight size={16} />
          </button>
        </div>
      </div>
    )

    if (selfStep === 'confirm') return (
      <div>
        {renderProgress(3, 3)}
        <div className="text-center py-4">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-green-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">Device registered!</h2>
          <p className="text-gray-500 text-sm mb-6">Your device has been successfully linked to your fleet</p>
        </div>

        <div className="bg-gray-50 rounded-2xl p-5 mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Registration Summary</h3>
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Device</span>
              <span className="font-medium text-gray-900">{DEVICES.find(d => d.id === selectedDevice)?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">IMEI</span>
              <span className="font-mono font-medium text-gray-900">{imeiInput}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Status</span>
              <span className="text-green-600 font-medium">● Active</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Module</span>
              <span className="font-medium text-gray-900">IoTility Fleetpoint</span>
            </div>
          </div>
        </div>

        {/* TODO: on confirm call POST /api/devices/register { imei, deviceType: selectedDevice, moduleId: 'fleetpoint' } */}
        <button
          onClick={onClose}
          className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 rounded-full transition-colors"
        >
          Go to Fleetpoint Dashboard
        </button>
      </div>
    )
  }

  // ─── ENGINEER VISIT ──────────────────────────────────────────────
  const renderEngineerVisit = () => {
    if (engStep === 'fleet-details') return (
      <div>
        {renderProgress(4, 1)}
        <h2 className="text-xl font-bold text-gray-900 mb-1">Tell us about your fleet</h2>
        <p className="text-gray-500 text-sm mb-6">Our engineers will prepare the right equipment for your visit</p>

        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-700 mb-2">Number of vehicles</label>
          <input
            type="number"
            min="1"
            placeholder="e.g. 12"
            value={vehicleCount}
            onChange={e => setVehicleCount(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
          />
        </div>

        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-700 mb-2">Vehicle types <span className="text-gray-400">(select all that apply)</span></label>
          <div className="flex flex-wrap gap-2">
            {VEHICLE_TYPES.map(type => (
              <button
                key={type}
                onClick={() => toggleVehicleType(type)}
                className={`px-4 py-2 rounded-full text-sm font-medium border-2 transition-all
                  ${selectedVehicleTypes.includes(type)
                    ? 'border-purple-600 bg-purple-50 text-purple-700'
                    : 'border-gray-200 text-gray-600 hover:border-purple-300'}`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-between mt-6">
          <button onClick={() => setPath('choose')} className="flex items-center gap-1 text-gray-500 hover:text-gray-700 text-sm">
            <ChevronLeft size={16} /> Back
          </button>
          <button
            onClick={() => vehicleCount && selectedVehicleTypes.length > 0 && setEngStep('contact')}
            disabled={!vehicleCount || selectedVehicleTypes.length === 0}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-6 py-2.5 rounded-full transition-colors"
          >
            Next <ChevronRight size={16} />
          </button>
        </div>
      </div>
    )

    if (engStep === 'contact') return (
      <div>
        {renderProgress(4, 2)}
        <h2 className="text-xl font-bold text-gray-900 mb-1">Confirm your details</h2>
        <p className="text-gray-500 text-sm mb-6">We'll use these to confirm your engineer booking</p>

        <div className="bg-gray-50 rounded-2xl p-5 mb-5">
          {/* TODO: pre-fill from logged in user profile — GET /api/users/me */}
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Full Name</label>
              <input defaultValue="Ali Mujtaba" className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-purple-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
              <input defaultValue="admin@hypernym.io" className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-purple-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Phone</label>
              <input placeholder="+44 7700 000000" className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-purple-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Site Address</label>
              <input placeholder="Where should the engineer visit?" className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-purple-500" />
            </div>
          </div>
        </div>

        <div className="flex justify-between mt-2">
          <button onClick={() => setEngStep('fleet-details')} className="flex items-center gap-1 text-gray-500 hover:text-gray-700 text-sm">
            <ChevronLeft size={16} /> Back
          </button>
          <button
            onClick={() => setEngStep('schedule')}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold px-6 py-2.5 rounded-full transition-colors"
          >
            Next <ChevronRight size={16} />
          </button>
        </div>
      </div>
    )

    if (engStep === 'schedule') return (
      <div>
        {renderProgress(4, 3)}
        <h2 className="text-xl font-bold text-gray-900 mb-1">Schedule your visit</h2>
        <p className="text-gray-500 text-sm mb-4">Pick a date and time slot for your engineer visit</p>

        {/* Calendar */}
        <div className="mb-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
            <Calendar size={12} /> Select date
          </p>
          <div className="grid grid-cols-7 gap-1.5">
            {CALENDAR_DAYS.map((day, i) => {
              const isSelected = selectedDate?.toDateString() === day.toDateString()
              return (
                <button
                  key={i}
                  onClick={() => setSelectedDate(day)}
                  className={`flex flex-col items-center py-2 rounded-xl text-xs transition-all
                    ${isSelected ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-purple-100'}`}
                >
                  <span className="font-medium">{day.toLocaleDateString('en', { weekday: 'short' })}</span>
                  <span className="font-bold text-sm">{day.getDate()}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Time slots */}
        {selectedDate && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
              <Clock size={12} /> Select time slot
            </p>
            <div className="grid grid-cols-4 gap-2">
              {TIME_SLOTS.map(slot => (
                <button
                  key={slot}
                  onClick={() => setSelectedSlot(slot)}
                  className={`py-2 rounded-xl text-xs font-medium border-2 transition-all
                    ${selectedSlot === slot
                      ? 'border-purple-600 bg-purple-50 text-purple-700'
                      : 'border-gray-200 text-gray-600 hover:border-purple-300'}`}
                >
                  {slot}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-between mt-4">
          <button onClick={() => setEngStep('contact')} className="flex items-center gap-1 text-gray-500 hover:text-gray-700 text-sm">
            <ChevronLeft size={16} /> Back
          </button>
          <button
            onClick={() => selectedDate && selectedSlot && setEngStep('confirmed')}
            disabled={!selectedDate || !selectedSlot}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-6 py-2.5 rounded-full transition-colors"
          >
            Confirm Booking <ChevronRight size={16} />
          </button>
        </div>
      </div>
    )

    if (engStep === 'confirmed') return (
      <div>
        {renderProgress(4, 4)}
        <div className="text-center py-4">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-green-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">Engineer visit booked!</h2>
          <p className="text-gray-500 text-sm mb-6">You'll receive a confirmation email shortly</p>
        </div>

        <div className="bg-gray-50 rounded-2xl p-5 mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Booking Summary</h3>
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Date</span>
              <span className="font-medium text-gray-900">{selectedDate?.toLocaleDateString('en', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Time</span>
              <span className="font-medium text-gray-900">{selectedSlot}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Vehicles</span>
              <span className="font-medium text-gray-900">{vehicleCount} vehicles</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Types</span>
              <span className="font-medium text-gray-900">{selectedVehicleTypes.join(', ')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Engineer</span>
              <span className="font-medium text-gray-900">Will be assigned</span>
            </div>
          </div>
        </div>

        {/* TODO: POST /api/engineer-visits with booking details */}
        <button onClick={onClose} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 rounded-full transition-colors">
          Done
        </button>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">

        {/* Modal header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-purple-600 flex items-center justify-center">
              <span className="text-white text-xs font-black">FP</span>
            </div>
            <span className="text-sm font-semibold text-gray-700">IoTility Fleetpoint — Device Setup</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          {path === 'choose' && renderChoosePath()}
          {path === 'self' && renderSelfInstall()}
          {path === 'engineer' && renderEngineerVisit()}
        </div>

      </div>
    </div>
  )
}