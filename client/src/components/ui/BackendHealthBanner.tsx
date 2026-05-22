import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Server } from 'lucide-react'
import { API_BASE } from '../../lib/config'

type HealthStatus = 'unknown' | 'ok' | 'unhealthy' | 'offline'

const formatMessage = (status: HealthStatus, details: string) => {
  if (status === 'offline') {
    return `Backend offline: ${details}`
  }

  if (status === 'unhealthy') {
    return `Backend issue detected: ${details}`
  }

  return ''
}

export default function BackendHealthBanner() {
  const [status, setStatus] = useState<HealthStatus>('unknown')
  const [message, setMessage] = useState('Checking backend status...')

  const fetchHealth = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/health`, {
        cache: 'no-store',
      })
      const contentType = response.headers.get('content-type') || ''
      const isJson = contentType.includes('application/json')

      if (!response.ok) {
        const payload = isJson ? await response.json().catch(() => null) : null
        setStatus('unhealthy')
        setMessage(payload?.error || `Health check failed (${response.status})`)
        return
      }

      if (!isJson) {
        setStatus('offline')
        setMessage('Health endpoint returned non-JSON response')
        return
      }

      const data = await response.json()
      // Accept multiple health response shapes from the backend:
      // - { status: 'ok' }
      // - { success: true, server: 'online' }
      // - { detail: { healthy: true } }
      const healthy =
        data?.status === 'ok' || data?.success === true || data?.server === 'online' || data?.detail?.healthy === true

      if (healthy) {
        setStatus('ok')
        setMessage('Backend is healthy')
      } else {
        setStatus('unhealthy')
        setMessage(data?.database?.message || data?.detail?.message || 'Backend health reported an issue')
      }
    } catch (error: any) {
      setStatus('offline')
      setMessage(error?.message || 'Unable to reach backend')
    }
  }, [])

  useEffect(() => {
    fetchHealth()
    const interval = window.setInterval(fetchHealth, 30000)
    return () => window.clearInterval(interval)
  }, [fetchHealth])

  if (status === 'ok' || status === 'unknown') {
    return null
  }

  return (
    <div className="fixed inset-x-0 top-0 z-50 mx-auto w-full max-w-full px-4 py-3 sm:px-6">
      <div className="mx-auto flex max-w-[1400px] items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 shadow-sm shadow-rose-200/60 backdrop-blur-sm">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-100 text-rose-700">
          <AlertTriangle size={18} />
        </span>
        <div className="flex-1">
          <p className="font-bold">Backend connection issue</p>
          <p className="text-sm text-rose-700/90">{formatMessage(status, message)}</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-white/90 px-3 py-1 text-xs uppercase tracking-[0.18em] text-rose-700 shadow-sm">
          <Server size={14} />
          {status === 'offline' ? 'Offline' : 'Degraded'}
        </div>
      </div>
    </div>
  )
}
