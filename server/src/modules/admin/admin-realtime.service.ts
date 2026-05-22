import { randomBytes } from 'crypto'
import { EventEmitter } from 'events'
import type { AdminEventMeta, AdminEventType, AdminRealtimeEvent } from './admin-realtime.types.js'

type AdminStreamSession = {
  token: string
  userId: string
  role: 'SUPERADMIN'
  expiresAt: number
  consumedAt?: number
}

const STREAM_TOKEN_TTL_MS = 2 * 60 * 1000
const MAX_STREAM_SESSIONS = 500

const adminEventEmitter = new EventEmitter()
adminEventEmitter.setMaxListeners(500)

const streamSessions = new Map<string, AdminStreamSession>()

function nowMs() {
  return Date.now()
}

function pruneExpiredSessions() {
  const now = nowMs()
  for (const [token, session] of streamSessions.entries()) {
    if (session.expiresAt <= now || session.consumedAt) {
      streamSessions.delete(token)
    }
  }
}

export function issueAdminStreamToken(input: { userId: string; role: 'SUPERADMIN' }) {
  pruneExpiredSessions()

  if (streamSessions.size >= MAX_STREAM_SESSIONS) {
    // best-effort pressure relief: remove oldest entries
    const tokens = Array.from(streamSessions.keys()).slice(0, Math.floor(MAX_STREAM_SESSIONS / 4))
    for (const token of tokens) {
      streamSessions.delete(token)
    }
  }

  const token = randomBytes(24).toString('hex')
  const session: AdminStreamSession = {
    token,
    userId: input.userId,
    role: input.role,
    expiresAt: nowMs() + STREAM_TOKEN_TTL_MS,
  }
  streamSessions.set(token, session)

  return {
    streamToken: token,
    expiresInSeconds: Math.floor(STREAM_TOKEN_TTL_MS / 1000),
  }
}

export function consumeAdminStreamToken(token: string) {
  pruneExpiredSessions()
  const session = streamSessions.get(token)
  if (!session) return null
  if (session.expiresAt <= nowMs()) {
    streamSessions.delete(token)
    return null
  }
  if (session.consumedAt) {
    streamSessions.delete(token)
    return null
  }

  session.consumedAt = nowMs()
  streamSessions.set(token, session)
  return session
}

export function publishAdminRealtimeEvent(type: AdminEventType, payload?: Record<string, unknown>, meta?: AdminEventMeta) {
  const event: AdminRealtimeEvent = {
    type,
    timestamp: new Date().toISOString(),
    payload: payload || {},
    meta: meta || {},
  }
  adminEventEmitter.emit('admin-event', event)
}

export function subscribeAdminRealtime(listener: (event: AdminRealtimeEvent) => void) {
  adminEventEmitter.on('admin-event', listener)
  return () => {
    adminEventEmitter.off('admin-event', listener)
  }
}
