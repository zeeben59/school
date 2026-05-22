import { useCallback, useEffect, useState } from 'react'
import { API_BASE } from '../../lib/config'
import { useAuth } from '../../context/AuthContext'
import { useAdminRealtime } from '../../hooks/useAdminRealtime'
import { useDebouncedRefetch } from '../../hooks/useDebouncedRefetch'
import { shouldRefreshSupport } from './admin-realtime.matchers'
import { Inbox, MessageSquareMore, MessageCircleDashed, CheckCircle2 } from 'lucide-react'
import {
  AdminEmptyState,
  AdminLoadingState,
  AdminPageHeader,
  AdminStatusBadge,
  MetricCard,
  SectionCard,
} from '../../components/admin/AdminUI'

type FeedbackItem = {
  id: string
  category: string
  message: string
  rating: number | null
  status: 'NEW' | 'REVIEWED' | 'CLOSED'
  role: string
  createdAt: string
  school: { id: string; name: string }
  user: { id: string; firstName: string; lastName: string; email: string; role: string }
}

type ThreadItem = {
  id: string
  subject: string
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED'
  role: string
  createdAt: string
  lastMessageAt: string
  school: { id: string; name: string }
  user: { id: string; firstName: string; lastName: string; email: string; role: string }
  messages: Array<{ id: string; content: string; senderType: string; createdAt: string }>
  _count: { messages: number }
}

type SupportPayload = {
  feedback: FeedbackItem[]
  threads: ThreadItem[]
  summary: {
    feedback: { total: number; new: number; reviewed: number; closed: number }
    threads: { total: number; open: number; inProgress: number; resolved: number }
  }
}

const AdminSupportPage = () => {
  const { token } = useAuth()
  const [data, setData] = useState<SupportPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [view, setView] = useState<'all' | 'feedback' | 'threads'>('all')

  const loadData = useCallback(async (showLoader = true) => {
    if (!token) return
    if (showLoader) setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set('view', view)
      if (query.trim()) params.set('q', query.trim())

      const res = await fetch(`${API_BASE}/api/admin/support?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload?.error || 'Failed to load support inbox')
      setData(payload)
    } catch (err: any) {
      setError(err?.message || 'Failed to load support inbox')
    } finally {
      if (showLoader) setLoading(false)
    }
  }, [query, token, view])

  const { connectionLabel, lastEventAt, subscribe } = useAdminRealtime()
  const debouncedRefetch = useDebouncedRefetch(() => {
    void loadData(false)
  })

  useEffect(() => {
    if (token) void loadData()
  }, [token, loadData])

  useEffect(() => {
    return subscribe((event) => {
      if (shouldRefreshSupport(event.type)) {
        debouncedRefetch()
      }
    })
  }, [debouncedRefetch, subscribe])

  const updateFeedbackStatus = async (id: string, status: 'NEW' | 'REVIEWED' | 'CLOSED') => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/support/feedback/${id}/status`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload?.error || 'Failed to update feedback status')
      setData(prev => prev ? { ...prev, feedback: prev.feedback.map(item => (item.id === id ? { ...item, status } : item)) } : prev)
    } catch (err: any) {
      setError(err?.message || 'Failed to update feedback status')
    }
  }

  const updateThreadStatus = async (id: string, status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED') => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/support/threads/${id}/status`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload?.error || 'Failed to update support status')
      setData(prev => prev ? { ...prev, threads: prev.threads.map(item => (item.id === id ? { ...item, status } : item)) } : prev)
    } catch (err: any) {
      setError(err?.message || 'Failed to update support status')
    }
  }

  if (loading) return <AdminLoadingState />
  if (error) return <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Support / Feedback Inbox"
        description="Platform-level queue for feedback submissions and support conversations across schools."
        liveLabel={connectionLabel}
        lastUpdatedAt={lastEventAt}
        actions={
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
            <Inbox size={12} />
            Unified Inbox
          </span>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <MetricCard label="Feedback Total" value={data?.summary.feedback.total || 0} icon={<MessageSquareMore size={15} />} />
        <MetricCard label="Feedback New" value={data?.summary.feedback.new || 0} tone="warning" icon={<MessageCircleDashed size={15} />} />
        <MetricCard label="Feedback Closed" value={data?.summary.feedback.closed || 0} tone="success" icon={<CheckCircle2 size={15} />} />
        <MetricCard label="Threads Total" value={data?.summary.threads.total || 0} icon={<MessageSquareMore size={15} />} />
        <MetricCard label="Threads Open" value={data?.summary.threads.open || 0} tone="warning" icon={<MessageCircleDashed size={15} />} />
        <MetricCard label="Threads Resolved" value={data?.summary.threads.resolved || 0} tone="success" icon={<CheckCircle2 size={15} />} />
      </div>

      <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm shadow-slate-200/40 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/20">
        <div className="grid gap-3 lg:grid-cols-[1.4fr_220px_auto]">
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search school, user, subject, message..."
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800"
          />
          <select
            value={view}
            onChange={event => setView(event.target.value as 'all' | 'feedback' | 'threads')}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800"
          >
            <option value="all">All</option>
            <option value="feedback">Feedback</option>
            <option value="threads">Support Threads</option>
          </select>
          <button onClick={() => { void loadData() }} className="rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-black uppercase tracking-[0.12em] text-white dark:bg-slate-100 dark:text-slate-900">
            Refresh
          </button>
        </div>
      </div>

      {(view === 'all' || view === 'feedback') && (
        <SectionCard title="Feedback Submissions">
          {data?.feedback?.length ? (
            <div className="space-y-3">
              {data.feedback.map(item => (
                <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 transition hover:shadow-sm dark:border-slate-700 dark:bg-slate-800/60">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-black text-slate-900 dark:text-slate-100">{item.category} - {item.school.name}</p>
                    <AdminStatusBadge value={item.status} />
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">{item.message}</p>
                  <p className="mt-2 text-xs font-semibold text-slate-500">
                    {item.user.firstName} {item.user.lastName} ({item.user.role}) | {new Date(item.createdAt).toLocaleString()}
                  </p>
                  <div className="mt-3">
                    <select
                      value={item.status}
                      onChange={event => updateFeedbackStatus(item.id, event.target.value as 'NEW' | 'REVIEWED' | 'CLOSED')}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                    >
                      <option value="NEW">New</option>
                      <option value="REVIEWED">Reviewed</option>
                      <option value="CLOSED">Closed</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <AdminEmptyState message="No feedback items found." />
          )}
        </SectionCard>
      )}

      {(view === 'all' || view === 'threads') && (
        <SectionCard title="Support Threads">
          {data?.threads?.length ? (
            <div className="space-y-3">
              {data.threads.map(item => (
                <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 transition hover:shadow-sm dark:border-slate-700 dark:bg-slate-800/60">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-black text-slate-900 dark:text-slate-100">{item.subject} - {item.school.name}</p>
                    <AdminStatusBadge value={item.status} />
                  </div>
                  <p className="mt-2 text-xs font-semibold text-slate-500">
                    {item.user.firstName} {item.user.lastName} ({item.user.role}) | Last activity {new Date(item.lastMessageAt).toLocaleString()}
                  </p>
                  {item.messages[0] && (
                    <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">{item.messages[0].content}</p>
                  )}
                  <div className="mt-3">
                    <select
                      value={item.status}
                      onChange={event => updateThreadStatus(item.id, event.target.value as 'OPEN' | 'IN_PROGRESS' | 'RESOLVED')}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                    >
                      <option value="OPEN">Open</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="RESOLVED">Resolved</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <AdminEmptyState message="No support threads found." />
          )}
        </SectionCard>
      )}
    </div>
  )
}

export default AdminSupportPage
