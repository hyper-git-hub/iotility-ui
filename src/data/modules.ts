// src/data/modules.ts
// Dummy data for IoTility modules / use cases
// TODO: replace with real API call to subscription microservice
// GET /api/subscriptions/user/:userId

export type ModuleStatus = 'active' | 'trial' | 'inactive'

export interface Module {
  id: string
  name: string
  fullName: string
  tagline: string
  status: ModuleStatus
  rating: number
  color: string
  bgGradient: string
  initials: string
}

export const modules: Module[] = [
  {
    id: 'fleetpoint',
    name: 'Fleetpoint',
    fullName: 'IoTility Fleetpoint',
    tagline: 'Seamless fleet operations',
    status: 'trial',
    rating: 5.0,
    color: '#7c3aed',
    bgGradient: 'from-purple-500 to-blue-500',
    initials: 'FP',
  },
  {
    id: 'assetrack',
    name: 'Assetrack',
    fullName: 'IoTility Assetrack',
    tagline: 'Manage your assets smoothly',
    status: 'inactive',
    rating: 5.0,
    color: '#f59e0b',
    bgGradient: 'from-orange-400 to-pink-500',
    initials: 'AR',
  },
  {
    id: 'sustainex',
    name: 'Sustainex',
    fullName: 'IoTility Sustainex',
    tagline: 'Contribute to a sustainable earth',
    status: 'inactive',
    rating: 5.0,
    color: '#10b981',
    bgGradient: 'from-green-400 to-teal-500',
    initials: 'SX',
  },
  {
    id: 'twinscape',
    name: 'Twinscape',
    fullName: 'IoTility Twinscape',
    tagline: 'Smarter solution for smarter buildings',
    status: 'inactive',
    rating: 5.0,
    color: '#f59e0b',
    bgGradient: 'from-yellow-400 to-orange-500',
    initials: 'TS',
  },
  {
    id: 'wasterack',
    name: 'Wasterack',
    fullName: 'IoTility Wasterack',
    tagline: 'Manage your waste, without mess',
    status: 'inactive',
    rating: 5.0,
    color: '#f97316',
    bgGradient: 'from-orange-500 to-red-500',
    initials: 'WR',
  },
]