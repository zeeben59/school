import { useCallback, useEffect, useMemo, useState } from 'react'
import { API_BASE } from '../../lib/config'
import { useAuth } from '../../context/AuthContext'
import { useAdminRealtime } from '../../hooks/useAdminRealtime'
import { useDebouncedRefetch } from '../../hooks/useDebouncedRefetch'
import { shouldRefreshUsers } from './admin-realtime.matchers'
import { Users, UserCheck, GraduationCap, BriefcaseBusiness } from 'lucide-react'
import {
  AdminEmptyState,
  AdminLoadingState,
  AdminPageHeader,
  AdminStatusBadge,
  AdminTableContainer,
  MetricCard,
  SectionCard,
} from '../../components/admin/AdminUI'

type UserItem = {
  id: string
  email: string
  firstName: string
  lastName: string
  role: string
  schoolId: string
  status: string
  createdAt: string
  lastLoginAt: string | null
  school: { id: string; name: string }
}

type UsersPayload = {
  summary: {
    totalUsers: number
    activeUsers: number
    byRole: Record<string, number>
  }
  recentlyRegistered: UserItem[]
  usersBySchool: Array<{ schoolId: string; schoolName: string; count: number }>
  items: UserItem[]
}

type DeletedUsersPayload = {
  total: number
  items: Array<UserItem & { deletedAt: string | null; deletedBy: string | null }>
}

const roleOptions = ['', 'DIRECTOR', 'PRINCIPAL', 'TEACHER', 'STUDENT']

const AdminUsersPage = () => {
  const { token } = useAuth()
  const [role, setRole] = useState('')
  const [query, setQuery] = useState('')
  const [activeOnly, setActiveOnly] = useState(false)
  const [showTrash, setShowTrash] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<UsersPayload | null>(null)
  const [trash, setTrash] = useState<DeletedUsersPayload | null>(null)
  const [pendingUserActionId, setPendingUserActionId] = useState<string | null>(null)

  const loadData = useCallback(async (showLoader = true) => {
    if (!token) return
    if (showLoader) setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      if (role) params.set('role', role)
      if (query.trim()) params.set('q', query.trim())
      if (activeOnly) params.set('activeOnly', 'true')

      const targetPath = showTrash ? '/api/admin/users/trash' : '/api/admin/users'
      const res = await fetch(`${API_BASE}${targetPath}?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload?.error || 'Failed to load users')

      if (showTrash) {
        setTrash(payload)
        setData(null)
      } else {
        setData(payload)
        setTrash(null)
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load users')
    } finally {
      if (showLoader) setLoading(false)
    }
  }, [activeOnly, query, role, showTrash, token])

  const handleSoftDelete = async (id: string) => {
    if (!token) return
    const confirmed = window.confirm('Soft-delete this user? They will move to Trash and can be restored.')
    if (!confirmed) return

    try {
      setPendingUserActionId(id)
      const res = await fetch(`${API_BASE}/api/admin/users/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload?.error || 'Failed to delete user')
      await loadData(false)
    } catch (err: any) {
      setError(err?.message || 'Failed to delete user')
    } finally {
      setPendingUserActionId(null)
    }
  }

  const handleRestore = async (id: string) => {
    if (!token) return
    try {
      setPendingUserActionId(id)
      const res = await fetch(`${API_BASE}/api/admin/users/${id}/restore`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload?.error || 'Failed to restore user')
      await loadData(false)
    } catch (err: any) {
      setError(err?.message || 'Failed to restore user')
    } finally {
      setPendingUserActionId(null)
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
      if (shouldRefreshUsers(event.type)) {
        debouncedRefetch()
      }
    })
  }, [debouncedRefetch, subscribe])

  const totalByRole = useMemo(() => data?.summary.byRole || {}, [data])

  if (loading) return <AdminLoadingState />
  if (error) return <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="User Tracking"
        description="Platform users by role, school, registration recency, and login activity."
        liveLabel={connectionLabel}
        lastUpdatedAt={lastEventAt}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <MetricCard label="Total Users" value={data?.summary.totalUsers || 0} icon={<Users size={15} />} />
        <MetricCard label="Active Users" value={data?.summary.activeUsers || 0} tone="success" icon={<UserCheck size={15} />} />
        <MetricCard label="Directors" value={totalByRole.DIRECTOR || 0} icon={<BriefcaseBusiness size={15} />} />
        <MetricCard label="Principals" value={totalByRole.PRINCIPAL || 0} icon={<BriefcaseBusiness size={15} />} />
        <MetricCard label="Teachers" value={totalByRole.TEACHER || 0} icon={<BriefcaseBusiness size={15} />} />
        <MetricCard label="Students" value={totalByRole.STUDENT || 0} icon={<GraduationCap size={15} />} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setShowTrash(false)}
          className={`rounded-xl px-4 py-2 text-xs font-black uppercase tracking-[0.12em] transition ${
            !showTrash
              ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
              : 'border border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
          }`}
        >
          Active Users
        </button>
        <button
          onClick={() => setShowTrash(true)}
          className={`rounded-xl px-4 py-2 text-xs font-black uppercase tracking-[0.12em] transition ${
            showTrash
              ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
              : 'border border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
          }`}
        >
          Trash
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm shadow-slate-200/40 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/20">
        <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr_auto_auto]">
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search name, email, school..."
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800"
          />
          <select
            value={role}
            onChange={event => setRole(event.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800"
          >
            {roleOptions.map(item => (
              <option key={item} value={item}>{item || 'All Roles'}</option>
            ))}
          </select>
          <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-300">
            <input type="checkbox" checked={activeOnly} onChange={event => setActiveOnly(event.target.checked)} />
            Active only (30d)
          </label>
          <button onClick={() => { void loadData() }} className="rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-black uppercase tracking-[0.12em] text-white dark:bg-slate-100 dark:text-slate-900">
            Apply
          </button>
        </div>
      </div>

      <SectionCard title={showTrash ? 'Deleted Users (Trash)' : 'Users'}>
        {showTrash ? (
          trash?.items?.length ? (
            <AdminTableContainer>
              <table className="min-w-[980px] w-full text-left">
                <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800/80">
                  <tr>
                    {['Name', 'Email', 'Role', 'School', 'Deleted By', 'Deleted At', 'Action'].map(head => (
                      <th key={head} className="px-4 py-3 text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">{head}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {trash.items.map(item => (
                    <tr key={item.id} className="odd:bg-white even:bg-slate-50/45 hover:bg-brand-50/35 dark:odd:bg-slate-900 dark:even:bg-slate-800/30 dark:hover:bg-brand-500/10">
                      <td className="px-4 py-3 text-sm font-black text-slate-900 dark:text-slate-100">{item.firstName} {item.lastName}</td>
                      <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">{item.email}</td>
                      <td className="px-4 py-3"><AdminStatusBadge value={item.role} /></td>
                      <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">{item.school?.name || '-'}</td>
                      <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">{item.deletedBy || '-'}</td>
                      <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">{item.deletedAt ? new Date(item.deletedAt).toLocaleString() : '-'}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleRestore(item.id)}
                          disabled={pendingUserActionId === item.id}
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-white disabled:opacity-60"
                        >
                          Restore
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </AdminTableContainer>
          ) : (
            <AdminEmptyState message="Trash is empty." />
          )
        ) : data?.items?.length ? (
          <AdminTableContainer>
            <table className="min-w-[980px] w-full text-left">
              <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800/80">
                <tr>
                  {['Name', 'Email', 'Role', 'School', 'Status', 'Last Login', 'Created', 'Action'].map(head => (
                    <th key={head} className="px-4 py-3 text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">{head}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.items.map(item => (
                  <tr key={item.id} className="odd:bg-white even:bg-slate-50/45 hover:bg-brand-50/35 dark:odd:bg-slate-900 dark:even:bg-slate-800/30 dark:hover:bg-brand-500/10">
                    <td className="px-4 py-3 text-sm font-black text-slate-900 dark:text-slate-100">
                      {item.firstName} {item.lastName}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">{item.email}</td>
                    <td className="px-4 py-3"><AdminStatusBadge value={item.role} /></td>
                    <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">{item.school?.name || '-'}</td>
                    <td className="px-4 py-3"><AdminStatusBadge value={item.status} /></td>
                    <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">{item.lastLoginAt ? new Date(item.lastLoginAt).toLocaleString() : 'Never'}</td>
                    <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">{new Date(item.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleSoftDelete(item.id)}
                        disabled={pendingUserActionId === item.id}
                        className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-rose-700 disabled:opacity-60 dark:border-rose-800/60 dark:text-rose-300"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </AdminTableContainer>
        ) : (
          <AdminEmptyState message="No users found for current filters." />
        )}
      </SectionCard>

      <SectionCard title="Users Grouped by School">
        {data?.usersBySchool?.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {data.usersBySchool.map(item => (
              <div key={item.schoolId} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-800/60">
                <p className="text-sm font-black text-slate-900 dark:text-slate-100">{item.schoolName}</p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{item.count} users</p>
              </div>
            ))}
          </div>
        ) : (
          <AdminEmptyState message="No school grouping data available yet." />
        )}
      </SectionCard>
    </div>
  )
}

export default AdminUsersPage
