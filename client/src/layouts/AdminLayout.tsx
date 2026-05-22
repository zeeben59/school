import { Link, Navigate, Outlet, useLocation } from 'react-router-dom'
import { Activity, BadgeCheck, Building2, CreditCard, LayoutDashboard, LifeBuoy, LogOut, Search, Settings, Users } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { AdminRealtimeProvider } from '../context/AdminRealtimeContext'
import { useAdminRealtime } from '../hooks/useAdminRealtime'

const navGroups = [
  {
    title: 'Overview',
    items: [{ label: 'Platform Overview', path: '/admin', icon: LayoutDashboard }],
  },
  {
    title: 'Management',
    items: [
      { label: 'Schools', path: '/admin/schools', icon: Building2 },
      { label: 'Users', path: '/admin/users', icon: Users },
      { label: 'Subscriptions', path: '/admin/subscriptions', icon: CreditCard },
    ],
  },
  {
    title: 'Operations',
    items: [
      { label: 'Support Inbox', path: '/admin/support', icon: LifeBuoy },
      { label: 'Activity Health', path: '/admin/activity', icon: Activity },
      { label: 'Settings', path: '/admin/settings', icon: Settings },
    ],
  },
]

const navItems = navGroups.flatMap(group => group.items)

const AdminLayoutShell = () => {
  const location = useLocation()
  const { user, logout } = useAuth()
  const { connectionLabel, connectionStatus } = useAdminRealtime()

  const activeItem = navItems.find(item => item.path === '/admin'
    ? location.pathname === '/admin'
    : location.pathname.startsWith(item.path))

  const handleLogout = () => {
    logout()
    window.location.href = '/login'
  }

  const liveClasses = connectionStatus === 'live'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-900/30 dark:text-emerald-300'
    : connectionStatus === 'reconnecting' || connectionStatus === 'connecting'
    ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/60 dark:bg-amber-900/30 dark:text-amber-300'
    : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#e2e8f0,_#f8fafc_42%)] dark:bg-slate-950">
      <header className="sticky top-0 z-30 border-b border-slate-200/90 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
        <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-brand-600">Platform Admin</p>
            <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-slate-100">
              {activeItem?.label || 'Overview'}
            </h1>
          </div>

          <div className="hidden items-center rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-500 md:flex dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
            <Search size={14} className="mr-2" />
            Search schools, users, tickets
          </div>

          <div className="flex items-center gap-3">
            <span className={`hidden rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] sm:inline ${liveClasses}`}>
              {connectionLabel}
            </span>
            <span className="hidden items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-slate-600 sm:inline-flex dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
              <BadgeCheck size={12} />
              SUPERADMIN
            </span>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-wider text-slate-700 transition hover:-translate-y-0.5 hover:shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <LogOut size={14} /> Logout
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-[1600px] gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[280px_1fr]">
        {user?.mustChangePassword && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 lg:col-span-2">
            Temporary password in use. Go to Settings and change your admin password.
          </div>
        )}
        <aside className="sticky top-24 h-fit rounded-2xl border border-slate-200/90 bg-white p-3 shadow-sm shadow-slate-200/40 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/20">
          <div className="mb-4 rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white px-3 py-3 dark:border-slate-700 dark:from-slate-800 dark:to-slate-900">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Control Center</p>
            <p className="mt-1 text-sm font-bold text-slate-800 dark:text-slate-200">{user?.firstName} {user?.lastName}</p>
          </div>
          <nav className="space-y-4">
            {navGroups.map(group => (
              <div key={group.title}>
                <p className="mb-1 px-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{group.title}</p>
                <div className="space-y-1.5">
                  {group.items.map(item => {
                    const active = item.path === '/admin' ? location.pathname === '/admin' : location.pathname.startsWith(item.path)
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        className={`group flex items-center gap-2 rounded-xl border-l-2 px-3 py-2.5 text-sm font-bold transition ${
                          active
                            ? 'border-l-brand-600 bg-brand-50 text-brand-700 shadow-sm dark:border-l-brand-400 dark:bg-brand-500/10 dark:text-brand-300'
                            : 'border-l-transparent text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'
                        }`}
                      >
                        <item.icon size={16} className={`${active ? '' : 'opacity-80 group-hover:opacity-100'}`} />
                        {item.label}
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 pb-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

const AdminLayout = () => {
  const { token, user } = useAuth()

  if (!token) {
    return <Navigate to="/login" replace />
  }

  if (!user || user.role !== 'SUPERADMIN') {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <AdminRealtimeProvider token={token} enabled={user?.role === 'SUPERADMIN'}>
      <AdminLayoutShell />
    </AdminRealtimeProvider>
  )
}

export default AdminLayout
