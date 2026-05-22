import { useCallback, useEffect, useMemo, useState } from 'react'
import { API_BASE } from '../../lib/config'
import { useAuth } from '../../context/AuthContext'
import { useAdminRealtime } from '../../hooks/useAdminRealtime'
import { useDebouncedRefetch } from '../../hooks/useDebouncedRefetch'
import { shouldRefreshOverview } from './admin-realtime.matchers'
import {
  AdminEmptyState,
  AdminLoadingState,
  AdminPageHeader,
  AdminStatusBadge,
  AdminTableContainer,
  MetricCard,
  SectionCard,
} from '../../components/admin/AdminUI'
import { AdminAnalyticsCharts } from '../../components/admin/AdminAnalyticsCharts'

type OverviewData = {
  metrics: Record<string, number>
  recentSchoolRegistrations: Array<{
    id: string
    name: string
    status: string
    accessState: string
    createdAt: string
    trial: { isActive: boolean; endsAt: string }
    subscription: { hasActive: boolean; activeTerm: string | null; expiryDate: string | null }
  }>
  recentSupportActivity: Array<{
    id: string
    subject: string
    status: string
    lastMessageAt: string
    school: { id: string; name: string }
    owner: { fullName: string; role: string } | null
  }>
  recentPayments: Array<{
    id: string
    amount: number
    status: string
    type: string
    reference: string
    createdAt: string
    school: { id: string; name: string }
  }>
  schoolsNearingExpiry: Array<{
    id: string
    name: string
    subscription: { expiryDate: string | null }
  }>
}

type AnalyticsData = {
  users: Array<{ createdAt: string }>
  payments: Array<{ createdAt: string; amount: number }>
  schools: Array<{ createdAt: string }>
  roleDistribution: Array<{ role: 'DIRECTOR' | 'TEACHER' | 'STUDENT'; count: number }>
}

const primaryMetrics: Array<{ key: string; label: string; currency?: boolean }> = [
  { key: 'totalSchools', label: 'Total Schools' },
  { key: 'activeSchools', label: 'Active Schools' },
  { key: 'schoolsOnTrial', label: 'Trial Schools' },
  { key: 'activeSubscribedSchools', label: 'Subscribed Schools' },
  { key: 'expiredSchools', label: 'Expired Schools' },
  { key: 'pendingSubscriptionApprovals', label: 'Pending Approvals' },
  { key: 'activeUsers', label: 'Active Users (30d)' },
  { key: 'totalRevenue', label: 'Total Revenue', currency: true },
]

const secondaryMetrics: Array<{ key: string; label: string }> = [
  { key: 'totalDirectors', label: 'Directors' },
  { key: 'totalPrincipals', label: 'Principals' },
  { key: 'totalTeachers', label: 'Teachers' },
  { key: 'totalStudents', label: 'Students' },
  { key: 'totalFeedbackSubmissions', label: 'Feedback' },
  { key: 'totalSupportRequests', label: 'Support Requests' },
]

function formatCurrency(value: number) {
  return `N${value.toLocaleString()}`
}

const AdminOverviewPage = () => {
  const { token } = useAuth()
  const [data, setData] = useState<OverviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)

  const loadOverview = useCallback(async (showLoader = true) => {
    if (!token) return
    if (showLoader) setLoading(true)
    setError(null)
    try {
      const [overviewRes, analyticsRes] = await Promise.all([
        fetch(`${API_BASE}/api/admin/overview`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE}/api/admin/analytics`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ])

      const [overviewPayload, analyticsPayload] = await Promise.all([
        overviewRes.json(),
        analyticsRes.json(),
      ])

      if (!overviewRes.ok) throw new Error(overviewPayload?.error || 'Failed to load admin overview')
      if (!analyticsRes.ok) throw new Error(analyticsPayload?.error || 'Failed to load admin analytics')

      setData(overviewPayload)
      setAnalytics(analyticsPayload)
    } catch (err: any) {
      setError(err?.message || 'Failed to load admin overview')
    } finally {
      if (showLoader) setLoading(false)
    }
  }, [token])

  const { connectionLabel, lastEventAt, subscribe } = useAdminRealtime()
  const debouncedRefetch = useDebouncedRefetch(() => {
    void loadOverview(false)
  })

  useEffect(() => {
    if (token) void loadOverview()
  }, [token, loadOverview])

  useEffect(() => {
    return subscribe((event) => {
      if (shouldRefreshOverview(event.type)) {
        debouncedRefetch()
      }
    })
  }, [debouncedRefetch, subscribe])

  const metricMap = useMemo(() => data?.metrics || {}, [data])

  if (loading) return <AdminLoadingState />
  if (error) return <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Platform Overview"
        description="Cross-tenant metrics for schools, subscriptions, users, support, and revenue."
        liveLabel={connectionLabel}
        lastUpdatedAt={lastEventAt}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {primaryMetrics.map(item => (
          <MetricCard
            key={item.key}
            label={item.label}
            value={item.currency ? formatCurrency(metricMap[item.key] || 0) : (metricMap[item.key] || 0)}
          />
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        {secondaryMetrics.map(item => (
          <MetricCard key={item.key} label={item.label} value={metricMap[item.key] || 0} />
        ))}
      </div>

      {analytics ? <AdminAnalyticsCharts analytics={analytics} /> : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard title="Recent School Registrations">
          {data?.recentSchoolRegistrations?.length ? (
            <div className="space-y-3">
              {data.recentSchoolRegistrations.map(school => (
                <div key={school.id} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-800/60">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-black text-slate-900 dark:text-slate-100">{school.name}</p>
                    <AdminStatusBadge value={school.status} />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <AdminStatusBadge value={school.accessState} />
                    <p className="text-xs font-semibold text-slate-500">{new Date(school.createdAt).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <AdminEmptyState message="No recent school registrations yet." />
          )}
        </SectionCard>

        <SectionCard title="Recent Support Activity">
          {data?.recentSupportActivity?.length ? (
            <div className="space-y-3">
              {data.recentSupportActivity.map(item => (
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
            <AdminEmptyState message="No support activity found." />
          )}
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard title="Recent Payments">
          {data?.recentPayments?.length ? (
            <AdminTableContainer>
              <table className="min-w-[720px] w-full text-left">
                <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800/80">
                  <tr>
                    {['School', 'Type', 'Status', 'Amount', 'When'].map(head => (
                      <th key={head} className="px-4 py-3 text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">{head}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data.recentPayments.map(item => (
                    <tr key={item.id}>
                      <td className="px-4 py-3 text-sm font-bold text-slate-900 dark:text-slate-100">{item.school.name}</td>
                      <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">{item.type}</td>
                      <td className="px-4 py-3"><AdminStatusBadge value={item.status} /></td>
                      <td className="px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200">{formatCurrency(item.amount)}</td>
                      <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">{new Date(item.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </AdminTableContainer>
          ) : (
            <AdminEmptyState message="No recent payments yet." />
          )}
        </SectionCard>

        <SectionCard title="Schools Nearing Expiry">
          {data?.schoolsNearingExpiry?.length ? (
            <div className="space-y-3">
              {data.schoolsNearingExpiry.map(item => (
                <div key={item.id} className="rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-800/60 dark:bg-amber-900/20">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-black text-slate-900 dark:text-slate-100">{item.name}</p>
                    <AdminStatusBadge value="EXPIRING SOON" />
                  </div>
                  <p className="mt-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Expires {item.subscription.expiryDate ? new Date(item.subscription.expiryDate).toLocaleDateString() : '-'}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <AdminEmptyState message="No schools are near expiry right now." />
          )}
        </SectionCard>
      </div>
    </div>
  )
}

export default AdminOverviewPage
