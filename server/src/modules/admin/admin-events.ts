import { publishAdminRealtimeEvent, subscribeAdminRealtime } from './admin-realtime.service.js'
import type { AdminEventMeta, AdminEventType, AdminRealtimeEvent } from './admin-realtime.types.js'

export type { AdminEventType, AdminRealtimeEvent }

export function emitAdminEvent(type: AdminEventType, payload?: Record<string, unknown>, meta?: AdminEventMeta) {
  publishAdminRealtimeEvent(type, payload, meta)
}

export function subscribeAdminEvents(listener: (event: AdminRealtimeEvent) => void) {
  return subscribeAdminRealtime(listener)
}
