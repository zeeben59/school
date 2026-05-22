export type AdminEventType =
  | 'admin:overview-updated'
  | 'admin:support-updated'
  | 'admin:schools-updated'
  | 'admin:subscriptions-updated'
  | 'admin:users-updated'
  | 'admin:activity-updated'

export type AdminEventMeta = {
  scope?: 'overview' | 'support' | 'schools' | 'subscriptions' | 'users' | 'activity'
  reason?: string
}

export type AdminRealtimeEvent = {
  type: AdminEventType
  timestamp: string
  payload?: Record<string, unknown>
  meta?: AdminEventMeta
}
