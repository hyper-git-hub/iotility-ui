// src/components/livemap/types.ts
// Shared types for live map components

export type ViewMode = 'vehicles' | 'drivers'
export type FilterStatus = 'all' | 'moving' | 'idle' | 'stopped' | 'alert' | 'offline'

export const STATUS_COLORS: Record<string, string> = {
  moving: '#22c55e',
  idle: '#f59e0b',
  stopped: '#6b7280',
  alert: '#ef4444',
  offline: '#374151',
}

export const STATUS_LABELS: Record<string, string> = {
  moving: 'Moving',
  idle: 'Idling',
  stopped: 'Stopped',
  alert: 'Alert',
  offline: 'Offline',
}
