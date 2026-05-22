import { useCallback, useEffect, useState } from 'react'
import { API_BASE } from '../../lib/config'
import { useAuth } from '../../context/AuthContext'
import { useAdminRealtime } from '../../hooks/useAdminRealtime'
import { useDebouncedRefetch } from '../../hooks/useDebouncedRefetch'
import { shouldRefreshActivity } from './admin-realtime.matchers'
import { Clock3, Building2, MessageSquareMore, AlertTriangle } from 'lucide-react'
import {
  AdminEmptyState,
  AdminLoadingState,
  AdminPageHeader,
  AdminStatusBadge,
  MetricCard,
  SectionCard,
} from '../../components/admin/AdminUI'

type ActivityPayload = {
  recentRegistrations: Array<{ id: string; name: string; createdAt: string; accessState: string }>
  schoolsNearingExpiry: Array<{ id: string; name: string; subscription: { expiryDate: string | null } }>
  schoolsExpired: Array<{ id: string; name: string; status: string; accessState: string }>
  recentFeedback: Array<{
    id: string
    category: string
    status: string
    createdAt: string
    school: { id: string; name: string }
    user: { id: string; firstName: string; lastName: string; role: string }
  }>
  recentSupportThreads: Array<{ id: string; subject: string; status: string; lastMessageAt: string; school: { id: string; name: string } }>
  recentPayments: Array<{ id: string; type: string; status: string; amount: number; reference: string; createdAt: string; school: { id: string; name: string } }>
  volume: { feedbackLast15: number; supportThreadsLast15: number }
}

const AdminActivityPage = () => {
  const { token } = useAuth()
  const [data, setData] = useState<ActivityPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadActivity = useCallback(async (showLoader = true) => {
    if (!token) return
    if (showLoader) setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/admin/activity`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload?.error || 'Failed to load activity health')
      setData(payload)
    } catch (err: any) {
      setError(err?.message || 'Failed to load activity health')
    } finally {
      if (showLoader) setLoading(false)
    }
  }, [token])

  const { connectionLabel, lastEventAt, subscribe } = useAdminRealtime()
  const debouncedRefetch = useDebouncedRefetch(() => {
    void loadActivity(false)
  })

  useEffect(() => {
    if (token) void loadActivity()
  }, [token, loadActivity])

  useEffect(() => {
    return subscribe((event) => {
      if (shouldRefreshActivity(event.type)) {
        debouncedRefetch()
      }
    })
  }, [debouncedRefetch, subscribe])

  if (loading) return <AdminLoadingState />
  if (error) return <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Platform Activity / Health"
        description="Registration momentum, support load, payment movement, and expiry risk windows."
        liveLabel={connectionLabel}
        lastUpdatedAt={lastEventAt}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Feedback Volume (15)" value={data?.volume.feedbackLast15 || 0} icon={<MessageSquareMore size={15} />} />
        <MetricCard label="Support Volume (15)" value={data?.volume.supportThreadsLast15 || 0} icon={<MessageSquareMore size={15} />} />
        <MetricCard label="Nearing Expiry" value={data?.schoolsNearingExpiry.length || 0} tone="warning" icon={<Clock3 size={15} />} />
        <MetricCard label="Expired Schools" value={data?.schoolsExpired.length || 0} tone="danger" icon={<AlertTriangle size={15} />} />
      </div>

      <SectionCard title="Activity Timeline" subtitle="Latest cross-platform events grouped by source.">
        <div className="grid gap-6 xl:grid-cols-2">
          <div>
            <p className="mb-3 text-xs font-black uppercase tracking-[0.14em] text-slate-500">Registrations</p>
            {data?.recentRegistrations?.length ? (
              <div className="space-y-3">
                {data.recentRegistrations.map(item => (
                  <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800/40">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 rounded-lg bg-brand-100 p-2 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300"><Building2 size={14} /></span>
                      <div>
                        <p className="text-sm font-black text-slate-900 dark:text-slate-100">{item.name}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <AdminStatusBadge value={item.accessState} />
                          <p className="text-xs font-semibold text-slate-500">{new Date(item.createdAt).toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <AdminEmptyState message="No registrations recorded recently." />
            )}
          </div>
          <div>
            <p className="mb-3 text-xs font-black uppercase tracking-[0.14em] text-slate-500">Expiry Signals</p>
            {data?.schoolsNearingExpiry?.length ? (
              <div className="space-y-3">
                {data.schoolsNearingExpiry.map(item => (
                  <div key={item.id} className="rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-800/60 dark:bg-amber-900/20">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 rounded-lg bg-amber-100 p-2 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"><Clock3 size={14} /></span>
                      <div>
                        <p className="text-sm font-black text-slate-900 dark:text-slate-100">{item.name}</p>
                        <p className="mt-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
                          Expires {item.subscription.expiryDate ? new Date(item.subscription.expiryDate).toLocaleDateString() : '-'}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <AdminEmptyState message="No schools currently near expiry." />
            )}
          </div>
        </div>
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard title="Recent Support Threads">
          {data?.recentSupportThreads?.length ? (
            <div className="space-y-3">
              {data.recentSupportThreads.map(item => (
                <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-800/60">
                  <p className="text-sm font-black text-slate-900 dark:text-slate-100">{item.subject}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <AdminStatusBadge value={item.status} />
                    <p className="text-xs font-semibold text-slate-500">{item.school.name}</p>
                    <p className="text-xs font-semibold text-slate-500">{new Date(item.lastMessageAt).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <AdminEmptyState message="No support thread activity yet." />
          )}
        </SectionCard>

        <SectionCard title="Recent Payment Activity">
          {data?.recentPayments?.length ? (
            <div className="space-y-3">
              {data.recentPayments.map(item => (
                <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-800/60">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-black text-slate-900 dark:text-slate-100">{item.school.name}</p>
                    <AdminStatusBadge value={item.status} />
                  </div>
                  <p className="mt-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
                    {item.type} | N{item.amount.toLocaleString()} | {new Date(item.createdAt).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <AdminEmptyState message="No recent payment activity." />
          )}
        </SectionCard>
      </div>
    </div>
  )
}

export default AdminActivityPage
