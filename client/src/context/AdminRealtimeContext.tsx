import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { API_BASE } from '../lib/config'

export type AdminRealtimeEventType =
  | 'admin:overview-updated'
  | 'admin:support-updated'
  | 'admin:schools-updated'
  | 'admin:subscriptions-updated'
  | 'admin:users-updated'
  | 'admin:activity-updated'

export type AdminRealtimeEvent = {
  type: AdminRealtimeEventType
  timestamp: string
  payload?: Record<string, unknown>
  meta?: {
    scope?: string
    reason?: string
  }
}

type RealtimeStatus = 'connecting' | 'live' | 'reconnecting' | 'offline'
type RealtimeListener = (event: AdminRealtimeEvent) => void

type AdminRealtimeContextValue = {
  connectionStatus: RealtimeStatus
  connectionLabel: string
  lastEventAt: string | null
  subscribe: (listener: RealtimeListener) => () => void
}

const EVENT_TYPES: AdminRealtimeEventType[] = [
  'admin:overview-updated',
  'admin:support-updated',
  'admin:schools-updated',
  'admin:subscriptions-updated',
  'admin:users-updated',
  'admin:activity-updated',
]

const AdminRealtimeContext = createContext<AdminRealtimeContextValue | undefined>(undefined)

function parseRealtimeData(raw: string): AdminRealtimeEvent | null {
  try {
    const parsed = JSON.parse(raw) as AdminRealtimeEvent
    if (!parsed?.type || !parsed?.timestamp) return null
    return parsed
  } catch {
    return null
  }
}

type Props = {
  token: string | null
  enabled?: boolean
  children: ReactNode
}

export function AdminRealtimeProvider({ token, enabled = true, children }: Props) {
  const [status, setStatus] = useState<RealtimeStatus>('offline')
  const [lastEventAt, setLastEventAt] = useState<string | null>(null)
  const listenersRef = useRef(new Set<RealtimeListener>())

  const subscribe = useCallback((listener: RealtimeListener) => {
    listenersRef.current.add(listener)
    return () => {
      listenersRef.current.delete(listener)
    }
  }, [])

  useEffect(() => {
    if (!enabled || !token) {
      setStatus('offline')
      return
    }

    let disposed = false
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let eventSource: EventSource | null = null
    let reconnectDelay = 2000

    const notify = (event: AdminRealtimeEvent) => {
      setLastEventAt(event.timestamp)
      for (const listener of listenersRef.current) {
        listener(event)
      }
    }

    const connect = async () => {
      if (disposed) return
      setStatus(prev => (prev === 'offline' ? 'connecting' : 'reconnecting'))

      try {
        const tokenRes = await fetch(`${API_BASE}/api/admin/stream-token`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        })

        if (!tokenRes.ok) {
          throw new Error(`Failed to fetch stream token (${tokenRes.status})`)
        }

        const tokenPayload = await tokenRes.json() as { streamToken?: string }
        if (!tokenPayload?.streamToken) {
          throw new Error('Invalid stream token response')
        }

        eventSource = new EventSource(`${API_BASE}/api/admin/stream?token=${encodeURIComponent(tokenPayload.streamToken)}`)
        const currentSource = eventSource

        const handleEvent = (event: MessageEvent) => {
          const parsed = parseRealtimeData(event.data)
          if (!parsed) return
          notify(parsed)
        }

        currentSource.onopen = () => {
          setStatus('live')
          reconnectDelay = 2000
        }

        for (const eventType of EVENT_TYPES) {
          currentSource.addEventListener(eventType, handleEvent as EventListener)
        }

        currentSource.onerror = () => {
          for (const eventType of EVENT_TYPES) {
            currentSource.removeEventListener(eventType, handleEvent as EventListener)
          }
          currentSource.close()
          eventSource = null

          if (disposed) return
          setStatus('reconnecting')
          reconnectTimer = setTimeout(() => {
            reconnectDelay = Math.min(reconnectDelay * 2, 10000)
            void connect()
          }, reconnectDelay)
        }
      } catch {
        if (disposed) return
        setStatus('reconnecting')
        reconnectTimer = setTimeout(() => {
          reconnectDelay = Math.min(reconnectDelay * 2, 10000)
          void connect()
        }, reconnectDelay)
      }
    }

    void connect()

    return () => {
      disposed = true
      if (reconnectTimer) clearTimeout(reconnectTimer)
      if (eventSource) {
        eventSource.close()
      }
      setStatus('offline')
    }
  }, [enabled, token])

  const connectionLabel = useMemo(() => {
    if (status === 'live') return 'Live'
    if (status === 'connecting') return 'Connecting'
    if (status === 'reconnecting') return 'Reconnecting'
    return 'Offline'
  }, [status])

  const value = useMemo<AdminRealtimeContextValue>(() => ({
    connectionStatus: status,
    connectionLabel,
    lastEventAt,
    subscribe,
  }), [connectionLabel, lastEventAt, status, subscribe])

  return (
    <AdminRealtimeContext.Provider value={value}>
      {children}
    </AdminRealtimeContext.Provider>
  )
}

export function useAdminRealtime() {
  const context = useContext(AdminRealtimeContext)
  if (!context) {
    throw new Error('useAdminRealtime must be used within AdminRealtimeProvider')
  }
  return context
}
