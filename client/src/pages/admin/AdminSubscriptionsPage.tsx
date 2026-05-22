import { useCallback, useEffect, useState } from 'react'
import { API_BASE } from '../../lib/config'
import { useAuth } from '../../context/AuthContext'
import { useAdminRealtime } from '../../hooks/useAdminRealtime'
import { useDebouncedRefetch } from '../../hooks/useDebouncedRefetch'
import { shouldRefreshSubscriptions } from './admin-realtime.matchers'
import { BadgeCheck, Clock3, WalletCards, CircleX } from 'lucide-react'
import {
  AdminEmptyState,
  AdminLoadingState,
  AdminPageHeader,
  AdminStatusBadge,
  AdminTableContainer,
  MetricCard,
  SectionCard,
} from '../../components/admin/AdminUI'

type SubscriptionsPayload = {
  summary: {
    schoolsOnTrial: number
    activePaidSchools: number
    expiredSchools: number
    pendingSubscriptionApprovals: number
    totalRevenue: number
  }
  schools: Array<{
    id: string
    name: string
    accessState: string
    trial: { isActive: boolean; endsAt: string }
    subscription: {
      hasActive: boolean
      activeTerm: string | null
      amount: number | null
      status: string
      expiryDate: string | null
      paymentReference: string | null
    }
  }>
  recentPayments: Array<{
    id: string
    type: string
    status: string
    amount: number
    reference: string
    createdAt: string
    school: { id: string; name: string }
  }>
  pendingSubscriptions: Array<{
    id: string
    schoolId: string
    planName: string
    termName: string
    amount: number
    status: string
    paymentReference: string | null
    startDate: string
    endDate: string
    createdAt: string
    school: { id: string; name: string; status: string }
  }>
}

const groups = [
  { key: '', label: 'All' },
  { key: 'trial', label: 'Trial' },
  { key: 'active', label: 'Active Paid' },
  { key: 'expired', label: 'Expired' },
]

function formatCurrency(value: number) {
  return `N${value.toLocaleString()}`
}

const AdminSubscriptionsPage = () => {
  const { token } = useAuth()
  const [group, setGroup] = useState('')
  const [data, setData] = useState<SubscriptionsPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pendingActionId, setPendingActionId] = useState<string | null>(null)

  const loadData = useCallback(async (showLoader = true) => {
    if (!token) return
    if (showLoader) setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (group) params.set('group', group)
      const res = await fetch(`${API_BASE}/api/admin/subscriptions?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload?.error || 'Failed to load subscription overview')
      setData(payload)
    } catch (err: any) {
      setError(err?.message || 'Failed to load subscription overview')
    } finally {
      if (showLoader) setLoading(false)
    }
  }, [group, token])

  const updateSubscriptionStatus = async (id: string, action: 'APPROVE' | 'REJECT') => {
    const confirmed = window.confirm(
      action === 'APPROVE'
        ? 'Approve this subscription request and activate school term access?'
        : 'Reject this subscription request? This keeps term access inactive.'
    )
    if (!confirmed) return

    setPendingActionId(id)
    try {
      const res = await fetch(`${API_BASE}/api/admin/subscriptions/${id}/status`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload?.error || `Failed to ${action.toLowerCase()} subscription`)
      await loadData(false)
    } catch (err: any) {
      setError(err?.message || `Failed to ${action.toLowerCase()} subscription`)
    } finally {
      setPendingActionId(null)
    }
  }

  const { connectionLabel, lastEventAt, subscribe } = useAdminRealtime()
  const debouncedRefetch = useDebouncedRefetch(() => {
    void loadData(false)
  })

  useEffect(() => {
    if (token) void loadData()
  }, [token, loadData])

  useEffect(() => {
    return subscribe((event) => {
      if (shouldRefreshSubscriptions(event.type)) {
        debouncedRefetch()
      }
    })
  }, [debouncedRefetch, subscribe])

  if (loading) return <AdminLoadingState />
  if (error) return <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Subscription Management"
        description="Monitor trial, paid, expired schools, and process pending term-subscription approvals."
        liveLabel={connectionLabel}
        lastUpdatedAt={lastEventAt}
      />

      <div className="flex flex-wrap gap-2">
        {groups.map(item => (
          <button
            key={item.key}
            onClick={() => setGroup(item.key)}
            className={`rounded-xl px-4 py-2 text-xs font-black uppercase tracking-[0.12em] transition ${
              group === item.key
                ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Schools On Trial" value={data?.summary.schoolsOnTrial || 0} icon={<Clock3 size={15} />} />
        <MetricCard label="Active Paid Schools" value={data?.summary.activePaidSchools || 0} tone="success" icon={<BadgeCheck size={15} />} />
        <MetricCard label="Expired Schools" value={data?.summary.expiredSchools || 0} tone="danger" icon={<CircleX size={15} />} />
        <MetricCard label="Pending Approvals" value={data?.summary.pendingSubscriptionApprovals || 0} tone="warning" icon={<Clock3 size={15} />} />
        <MetricCard label="Total Revenue" value={formatCurrency(data?.summary.totalRevenue || 0)} icon={<WalletCards size={15} />} />
      </div>

      <SectionCard title="Pending Approval Queue" subtitle="Approve or reject pending term subscription requests safely.">
        {data?.pendingSubscriptions?.length ? (
          <AdminTableContainer>
            <table className="min-w-[980px] w-full text-left">
              <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800/80">
                <tr>
                  {['School', 'Term Plan', 'Status', 'Amount', 'Payment Ref', 'Requested', 'Action'].map(head => (
                    <th key={head} className="px-4 py-3 text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">{head}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.pendingSubscriptions.map(item => (
                  <tr key={item.id} className="align-top odd:bg-white even:bg-slate-50/45 hover:bg-amber-50/45 dark:odd:bg-slate-900 dark:even:bg-slate-800/30 dark:hover:bg-amber-500/10">
                    <td className="px-4 py-3 text-sm font-black text-slate-900 dark:text-slate-100">{item.school.name}</td>
                    <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">{item.termName}</td>
                    <td className="px-4 py-3"><AdminStatusBadge value={item.status} /></td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200">{formatCurrency(item.amount)}</td>
                    <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">{item.paymentReference || '-'}</td>
                    <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">{new Date(item.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => updateSubscriptionStatus(item.id, 'APPROVE')}
                          disabled={pendingActionId === item.id}
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-white disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => updateSubscriptionStatus(item.id, 'REJECT')}
                          disabled={pendingActionId === item.id}
                          className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-red-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-800/60 dark:text-red-300"
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </AdminTableContainer>
        ) : (
          <AdminEmptyState message="No pending subscription requests at the moment." />
        )}
      </SectionCard>

      <SectionCard title="Schools by Subscription State">
        <AdminTableContainer>
          <table className="min-w-[920px] w-full text-left">
            <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800/80">
              <tr>
                {['School', 'Access', 'Trial', 'Current Plan', 'Amount', 'Expiry', 'Payment Ref'].map(head => (
                  <th key={head} className="px-4 py-3 text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">{head}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {data?.schools?.map(school => (
                <tr key={school.id} className="odd:bg-white even:bg-slate-50/45 hover:bg-brand-50/35 dark:odd:bg-slate-900 dark:even:bg-slate-800/30 dark:hover:bg-brand-500/10">
                  <td className="px-4 py-3 text-sm font-black text-slate-900 dark:text-slate-100">{school.name}</td>
                  <td className="px-4 py-3"><AdminStatusBadge value={school.accessState} /></td>
                  <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">
                    {school.trial.isActive ? `Active until ${new Date(school.trial.endsAt).toLocaleDateString()}` : 'Inactive'}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">
                    {school.subscription.activeTerm || school.subscription.status}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">
                    {school.subscription.amount ? formatCurrency(school.subscription.amount) : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">
                    {school.subscription.expiryDate ? new Date(school.subscription.expiryDate).toLocaleDateString() : '-'}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">{school.subscription.paymentReference || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </AdminTableContainer>
      </SectionCard>

      <SectionCard title="Recent Payment Activity">
        {data?.recentPayments?.length ? (
          <AdminTableContainer>
            <table className="min-w-[760px] w-full text-left">
              <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800/80">
                <tr>
                  {['School', 'Type', 'Status', 'Amount', 'Reference', 'Date'].map(head => (
                    <th key={head} className="px-4 py-3 text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">{head}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.recentPayments.map(item => (
                  <tr key={item.id} className="odd:bg-white even:bg-slate-50/45 hover:bg-emerald-50/30 dark:odd:bg-slate-900 dark:even:bg-slate-800/30 dark:hover:bg-emerald-500/10">
                    <td className="px-4 py-3 text-sm font-bold text-slate-900 dark:text-slate-100">{item.school.name}</td>
                    <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">{item.type}</td>
                    <td className="px-4 py-3"><AdminStatusBadge value={item.status} /></td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200">{formatCurrency(item.amount)}</td>
                    <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">{item.reference}</td>
                    <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">{new Date(item.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </AdminTableContainer>
        ) : (
          <AdminEmptyState message="No recent payments available." />
        )}
      </SectionCard>
    </div>
  )
}

export default AdminSubscriptionsPage
