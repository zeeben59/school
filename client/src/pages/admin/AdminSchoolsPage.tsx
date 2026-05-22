import { useCallback, useEffect, useMemo, useState } from 'react'
import { API_BASE } from '../../lib/config'
import { useAuth } from '../../context/AuthContext'
import { useAdminRealtime } from '../../hooks/useAdminRealtime'
import { useDebouncedRefetch } from '../../hooks/useDebouncedRefetch'
import { shouldRefreshSchools } from './admin-realtime.matchers'
import { Eye, School2, Users, CircleAlert } from 'lucide-react'
import {
  AdminEmptyState,
  AdminLoadingState,
  AdminPageHeader,
  AdminStatusBadge,
  AdminTableContainer,
  MetricCard,
} from '../../components/admin/AdminUI'

type SchoolItem = {
  id: string
  name: string
  email: string | null
  phone: string | null
  status: string
  totalUsers: number
  accessState: string
  createdAt: string
  trial: { isActive: boolean; endsAt: string }
  subscription: { hasActive: boolean; activeTerm: string | null; expiryDate: string | null; status: string }
  director: { fullName: string; email: string } | null
}

const statusOptions = ['', 'PENDING_PAYMENT', 'ACTIVE', 'EXPIRED', 'SUSPENDED']
const accessOptions = ['', 'PENDING_PAYMENT', 'ACTIVE', 'EXPIRED', 'SUBSCRIPTION_REQUIRED', 'SUSPENDED']

const AdminSchoolsPage = () => {
  const { token } = useAuth()
  const [items, setItems] = useState<SchoolItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [accessState, setAccessState] = useState('')

  const fetchSchools = useCallback(async (showLoader = true) => {
    if (!token) return
    if (showLoader) setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (query.trim()) params.set('q', query.trim())
      if (status) params.set('status', status)
      if (accessState) params.set('accessState', accessState)

      const res = await fetch(`${API_BASE}/api/admin/schools?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload?.error || 'Failed to load schools')
      setItems(Array.isArray(payload?.items) ? payload.items : [])
    } catch (err: any) {
      setError(err?.message || 'Failed to load schools')
    } finally {
      if (showLoader) setLoading(false)
    }
  }, [accessState, query, status, token])

  const { connectionLabel, lastEventAt, subscribe } = useAdminRealtime()
  const debouncedRefetch = useDebouncedRefetch(() => {
    void fetchSchools(false)
  })

  useEffect(() => {
    if (token) void fetchSchools()
  }, [token, fetchSchools])

  useEffect(() => {
    return subscribe((event) => {
      if (shouldRefreshSchools(event.type)) {
        debouncedRefetch()
      }
    })
  }, [debouncedRefetch, subscribe])

  const hasFilters = useMemo(() => Boolean(query || status || accessState), [query, status, accessState])
  const activeCount = useMemo(() => items.filter(item => item.status === 'ACTIVE').length, [items])
  const expiredCount = useMemo(() => items.filter(item => item.accessState === 'EXPIRED').length, [items])

  if (loading) return <AdminLoadingState />
  if (error) return <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="School Management"
        description="Search and monitor tenant schools, director ownership, trial/subscription state, and lifecycle status."
        liveLabel={connectionLabel}
        lastUpdatedAt={lastEventAt}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Visible Schools" value={items.length} icon={<School2 size={15} />} />
        <MetricCard label="Active Schools" value={activeCount} tone="success" icon={<School2 size={15} />} />
        <MetricCard label="Expired Schools" value={expiredCount} tone="danger" icon={<CircleAlert size={15} />} />
        <MetricCard label="Total Users (Visible)" value={items.reduce((sum, school) => sum + school.totalUsers, 0)} icon={<Users size={15} />} />
      </div>

      <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm shadow-slate-200/40 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/20">
        <div className="grid gap-3 lg:grid-cols-[1.5fr_1fr_1fr_auto]">
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search school, email, director..."
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800"
          />
          <select
            value={status}
            onChange={event => setStatus(event.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800"
          >
            {statusOptions.map(option => <option key={option} value={option}>{option || 'All School Statuses'}</option>)}
          </select>
          <select
            value={accessState}
            onChange={event => setAccessState(event.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800"
          >
            {accessOptions.map(option => <option key={option} value={option}>{option || 'All Access States'}</option>)}
          </select>
          <div className="flex gap-2">
            <button onClick={() => { void fetchSchools() }} className="rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-black uppercase tracking-[0.12em] text-white dark:bg-slate-100 dark:text-slate-900">
              Apply
            </button>
            {hasFilters && (
              <button
                onClick={() => {
                  setQuery('')
                  setStatus('')
                  setAccessState('')
                  setTimeout(() => { void fetchSchools() }, 0)
                }}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-black uppercase tracking-[0.12em] text-slate-700 dark:border-slate-700 dark:text-slate-200"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {items.length === 0 ? (
        <AdminEmptyState message="No schools found for the current filters." />
      ) : (
        <AdminTableContainer>
          <table className="min-w-[1100px] w-full text-left">
            <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800/80">
              <tr>
                {['School', 'Director', 'Users', 'Status', 'Access', 'Trial', 'Subscription', 'Created', 'Action'].map(head => (
                  <th key={head} className="px-4 py-3 text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">{head}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {items.map(item => (
                <tr key={item.id} className="align-top odd:bg-white even:bg-slate-50/45 hover:bg-brand-50/40 dark:odd:bg-slate-900 dark:even:bg-slate-800/30 dark:hover:bg-brand-500/10">
                  <td className="px-4 py-3">
                    <p className="text-sm font-black text-slate-900 dark:text-slate-100">{item.name}</p>
                    <p className="mt-1 text-xs text-slate-500">{item.email || '-'} | {item.phone || '-'}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">
                    {item.director ? `${item.director.fullName} (${item.director.email})` : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200">{item.totalUsers}</td>
                  <td className="px-4 py-3"><AdminStatusBadge value={item.status} /></td>
                  <td className="px-4 py-3"><AdminStatusBadge value={item.accessState} /></td>
                  <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">
                    {item.trial.isActive ? `Active until ${new Date(item.trial.endsAt).toLocaleDateString()}` : 'Inactive'}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">
                    {item.subscription.hasActive
                      ? `${item.subscription.activeTerm || '-'} (expires ${item.subscription.expiryDate ? new Date(item.subscription.expiryDate).toLocaleDateString() : '-'})`
                      : item.subscription.status}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">{new Date(item.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <button className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                      <Eye size={12} />
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </AdminTableContainer>
      )}
    </div>
  )
}

export default AdminSchoolsPage
