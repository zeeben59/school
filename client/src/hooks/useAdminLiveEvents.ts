import { useEffect, useMemo, useRef, useState } from 'react'
import { API_BASE } from '../lib/config'

export type AdminLiveEventType =
  | 'admin:overview-updated'
  | 'admin:support-updated'
  | 'admin:schools-updated'
  | 'admin:subscriptions-updated'
  | 'admin:users-updated'
  | 'admin:activity-updated'

export type AdminLiveEvent = {
  type: AdminLiveEventType
  timestamp: string
  payload?: Record<string, unknown>
}

type LiveStatus = 'connecting' | 'live' | 'reconnecting' | 'offline'

type UseAdminLiveEventsOptions = {
  token: string | null
  enabled?: boolean
  reconnectMs?: number
  onEvent?: (event: AdminLiveEvent) => void
}

function parseEventBlock(rawBlock: string): AdminLiveEvent | null {
  let eventType = ''
  const dataLines: string[] = []

  for (const rawLine of rawBlock.split(/\r?\n/)) {
    const line = rawLine.trimEnd()
    if (!line || line.startsWith(':')) continue
    if (line.startsWith('event:')) {
      eventType = line.slice('event:'.length).trim()
      continue
    }
    if (line.startsWith('data:')) {
      dataLines.push(line.slice('data:'.length).trimStart())
    }
  }

  if (!eventType || dataLines.length === 0) return null

  try {
    const parsed = JSON.parse(dataLines.join('\n')) as AdminLiveEvent
    if (!parsed?.type || !parsed?.timestamp) return null
    return parsed
  } catch {
    return null
  }
}

export function useAdminLiveEvents({
  token,
  enabled = true,
  reconnectMs = 3000,
  onEvent,
}: UseAdminLiveEventsOptions) {
  const [status, setStatus] = useState<LiveStatus>('offline')
  const [lastEventAt, setLastEventAt] = useState<string | null>(null)
  const onEventRef = useRef<typeof onEvent>(undefined)
  onEventRef.current = onEvent

  useEffect(() => {
    if (!enabled || !token) {
      setStatus('offline')
      return
    }

    let disposed = false
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let controller: AbortController | null = null

    const connect = async () => {
      if (disposed) return
      setStatus(prev => (prev === 'offline' ? 'connecting' : 'reconnecting'))

      controller = new AbortController()

      try {
        const response = await fetch(`${API_BASE}/api/admin/stream`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'text/event-stream',
          },
          signal: controller.signal,
        })

        if (!response.ok || !response.body) {
          throw new Error(`Stream unavailable (${response.status})`)
        }

        setStatus('live')
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (!disposed) {
          const { done, value } = await reader.read()
          if (done) {
            throw new Error('Stream closed')
          }

          buffer += decoder.decode(value, { stream: true })
          let splitIndex = buffer.indexOf('\n\n')
          while (splitIndex >= 0) {
            const block = buffer.slice(0, splitIndex)
            buffer = buffer.slice(splitIndex + 2)
            const parsed = parseEventBlock(block)
            if (parsed) {
              setLastEventAt(parsed.timestamp)
              onEventRef.current?.(parsed)
            }
            splitIndex = buffer.indexOf('\n\n')
          }
        }
      } catch {
        if (disposed) return
        setStatus('reconnecting')
        reconnectTimer = setTimeout(connect, reconnectMs)
      }
    }

    void connect()

    return () => {
      disposed = true
      if (reconnectTimer) clearTimeout(reconnectTimer)
      if (controller) controller.abort()
      setStatus('offline')
    }
  }, [enabled, token, reconnectMs])

  const connectionLabel = useMemo(() => {
    if (status === 'live') return 'Live'
    if (status === 'connecting') return 'Connecting'
    if (status === 'reconnecting') return 'Reconnecting'
    return 'Offline'
  }, [status])

  return {
    connectionStatus: status,
    connectionLabel,
    lastEventAt,
  }
}
