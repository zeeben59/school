import { useEffect, useState } from 'react'
import { API_BASE } from '../lib/config'
import { Link, useLocation, Outlet } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  School,
  BookOpen,
  CalendarCheck,
  Megaphone,
  FileCheck,
  Settings,
  Printer,
  Search,
  ChevronDown,
  Menu,
  X,
  LogOut,
  User,
  ShieldCheck,
  Moon,
  Sun,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  LifeBuoy,
} from 'lucide-react'
import { useTheme } from '../context/ThemeContext'
import { useAuth } from '../context/AuthContext'
import NotificationBell from '../components/notifications/NotificationBell'
import SubscriptionPlanModal from '../components/dashboard/SubscriptionPlanModal'
import ExpiredSchoolPanel from '../components/dashboard/ExpiredSchoolPanel'
import SubscriptionRequiredPanel from '../components/dashboard/SubscriptionRequiredPanel'

const menuItems = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { label: 'Principals', icon: ShieldCheck, path: '/dashboard/principals', roles: ['DIRECTOR'] },
  { label: 'Teachers', icon: Users, path: '/dashboard/teachers', roles: ['DIRECTOR', 'PRINCIPAL'] },
  { label: 'Students', icon: GraduationCap, path: '/dashboard/students', roles: ['DIRECTOR', 'PRINCIPAL'] },
  { label: 'My Students', icon: Users, path: '/dashboard/my-students', roles: ['TEACHER'] },
  { label: 'Classes', icon: School, path: '/dashboard/classes', roles: ['DIRECTOR', 'PRINCIPAL'] },
  { label: 'Subjects', icon: BookOpen, path: '/dashboard/subjects', roles: ['DIRECTOR', 'PRINCIPAL'] },
  { label: 'Attendance', icon: CalendarCheck, path: '/dashboard/attendance', roles: ['PRINCIPAL', 'TEACHER'] },
  { label: 'Results', icon: FileCheck, path: '/dashboard/results', roles: ['TEACHER'] },
  { label: 'Result Slip', icon: Printer, path: '/dashboard/result-slip', roles: ['STUDENT'] },
  { label: 'Notices', icon: Megaphone, path: '/dashboard/notices', roles: ['DIRECTOR', 'PRINCIPAL', 'TEACHER'] },
  { label: 'Subscription Plan', icon: CreditCard, action: 'subscription', roles: ['DIRECTOR'] },
  { label: 'Support', icon: LifeBuoy, path: '/dashboard/support' },
  { label: 'Settings', icon: Settings, path: '/dashboard/settings', roles: ['DIRECTOR', 'PRINCIPAL', 'TEACHER'] },
]

const lockedLabelsForDirector = new Set([
  'Principals',
  'Teachers',
  'Students',
  'My Students',
  'Classes',
  'Subjects',
  'Attendance',
  'Results',
  'Result Slip',
  'Notices',
])

const DashboardLayout = () => {
  const location = useLocation()
  const { theme, toggleTheme } = useTheme()
  const { user, logout } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [subscriptionModalOpen, setSubscriptionModalOpen] = useState(false)

  useEffect(() => {
    const openModal = () => setSubscriptionModalOpen(true)
    window.addEventListener('open-subscription-modal', openModal)
    return () => window.removeEventListener('open-subscription-modal', openModal)
  }, [])

  const accessState = user?.accessState || (user?.status === 'EXPIRED' ? 'EXPIRED' : 'ACTIVE')
  const schoolExpired = accessState === 'EXPIRED'
  const subscriptionRequired = accessState === 'SUBSCRIPTION_REQUIRED'

  const filteredMenuItems = menuItems.filter(item => {
    const role = user?.role || ''
    if (item.roles && !item.roles.includes(role)) return false

    if (schoolExpired) {
      if (role === 'DIRECTOR') {
        return ['Dashboard', 'Subscription Plan', 'Settings', 'Support'].includes(item.label)
      }

      return item.label === 'Dashboard' || item.label === 'Support'
    }

    if (subscriptionRequired && role !== 'DIRECTOR') {
      return item.label === 'Dashboard' || item.label === 'Support'
    }

    return true
  })

  const handleLogout = () => {
    logout()
    window.location.href = '/login'
  }

  const directorName = (user?.firstName && user?.lastName) 
    ? `${user.firstName} ${user.lastName}` 
    : user?.firstName || 'Director'
    
  const schoolName = user?.school || 'School Management System'
  const isDirector = user?.role === 'DIRECTOR'
  const canAccessSupportRoute = location.pathname === '/dashboard/support'
  const limitedDirectorRoutes = ['/dashboard', '/dashboard/director', '/dashboard/settings']
  const canAccessLimitedRoute = canAccessSupportRoute || (isDirector && limitedDirectorRoutes.includes(location.pathname))
  const isDark = theme === 'dark'
  
  const initials = (user?.firstName && user?.lastName)
    ? `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`
    : user?.firstName 
      ? user.firstName.charAt(0) 
      : 'SC' // Default for School Center

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-500 flex">
      <SubscriptionPlanModal open={subscriptionModalOpen} onClose={() => setSubscriptionModalOpen(false)} />
      {/* ─── Mobile Overlay ─── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ─── Collapsible Sidebar ─── */}
      <aside
        className={`
          fixed top-0 left-0 h-screen z-50
          ${isDark
            ? 'bg-gradient-to-b from-brand-950 via-brand-900 to-brand-800 dark:from-slate-900 dark:via-slate-900 dark:to-brand-950'
            : 'bg-white border-r border-slate-200'
          }
          flex flex-col shadow-2xl transition-all duration-500 ease-in-out
          ${isCollapsed ? 'w-[80px]' : 'w-[260px]'}
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Toggle Button (Desktop Only) */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="hidden lg:flex absolute -right-3 top-20 w-6 h-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full items-center justify-center shadow-md text-slate-500 dark:text-slate-400 hover:text-brand-600 transition-colors z-50"
        >
          {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

        {/* Logo */}
        <div className={`px-6 py-6 flex items-center justify-between overflow-hidden whitespace-nowrap ${isDark ? 'border-b border-white/10' : 'border-b border-slate-200'}`}>
          <Link to="/" className="flex items-center gap-3">
            <div className={`p-1.5 rounded-xl shrink-0 overflow-hidden w-10 h-10 flex items-center justify-center ${isDark ? 'bg-white/10 dark:bg-brand-500/20' : 'bg-slate-100'}`}>
              {user?.logoUrl ? (
                <img 
                  src={
                    user.logoUrl.startsWith('http')
                      ? user.logoUrl
                      : `${API_BASE}${user.logoUrl.startsWith('/uploads/') ? user.logoUrl.replace('/uploads/', '/api/uploads/') : user.logoUrl}`
                  } 
                  alt="School Logo" 
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const parent = target.parentElement;
                    if (parent) {
                      const placeholder = document.createElement('div');
                      placeholder.className = 'w-full h-full flex items-center justify-center text-white dark:text-brand-400';
                      placeholder.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-school"><path d="M14 22v-4a2 2 0 1 0-4 0v4"/><path d="m18 10 4 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-8l4-2"/><path d="M18 5v5"/><path d="m4 12 8-4 8 4"/><path d="M6 5v7"/><path d="m8 3 4-2 4 2"/></svg>';
                      parent.appendChild(placeholder);
                    }
                  }}
                />
              ) : (
                <School size={22} className={isDark ? 'text-white dark:text-brand-400' : 'text-brand-600'} />
              )}
            </div>
            {!isCollapsed && (
              <span className={`text-lg font-black tracking-tight animate-in fade-in slide-in-from-left-2 duration-300 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                EduNexus <span className={isDark ? 'text-brand-300' : 'text-brand-600'}>Pro</span>
              </span>
            )}
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className={`lg:hidden transition-colors ${isDark ? 'text-white/60 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1 scrollbar-hide">
          {filteredMenuItems.map((item) => {
              const menuItemLocked = subscriptionRequired
                && user?.role === 'DIRECTOR'
                && lockedLabelsForDirector.has(item.label)
              const isActive = item.path === '/dashboard' 
                ? location.pathname === '/dashboard' 
                : item.path
                  ? location.pathname.startsWith(item.path)
                  : false

              const itemClass = `
                w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-300 group/item text-left
                ${
                  isActive
                    ? (isDark ? 'bg-white/15 text-white shadow-lg shadow-black/10' : 'bg-brand-50 text-brand-700 shadow-sm border border-brand-100')
                    : (isDark ? 'text-white/60 hover:bg-white/8 hover:text-white/90' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900')
                }
                ${menuItemLocked ? 'opacity-60' : ''}
                ${isCollapsed ? 'justify-center px-0' : ''}
              `

              const itemContent = (
                <>
                  <item.icon size={18} className={`shrink-0 transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover/item:scale-110'}`} />
                  {!isCollapsed && (
                    <span className="animate-in fade-in slide-in-from-left-2 duration-300">
                      {item.label}{menuItemLocked ? ' (Locked)' : ''}
                    </span>
                  )}
                </>
              )

              if (item.action === 'subscription') {
                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => {
                      setSidebarOpen(false)
                      setSubscriptionModalOpen(true)
                    }}
                    title={isCollapsed ? item.label : undefined}
                    className={itemClass}
                  >
                    {itemContent}
                  </button>
                )
              }

              if (menuItemLocked) {
                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => {
                      setSidebarOpen(false)
                      setSubscriptionModalOpen(true)
                    }}
                    title={isCollapsed ? `${item.label} (Locked)` : undefined}
                    className={itemClass}
                  >
                    {itemContent}
                  </button>
                )
              }

              return (
                <Link
                  key={item.label}
                  to={item.path || '/dashboard'}
                  onClick={() => setSidebarOpen(false)}
                  title={isCollapsed ? item.label : undefined}
                  className={itemClass}
                >
                  {itemContent}
                </Link>
              )
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className={`px-4 py-4 overflow-hidden whitespace-nowrap ${isDark ? 'border-t border-white/10' : 'border-t border-slate-200'}`}>
          <div className={`flex items-center gap-3 px-3 py-2 ${isCollapsed ? 'justify-center px-0' : ''}`}>
            <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${isDark ? 'bg-brand-400/30 text-white' : 'bg-brand-100 text-brand-700'}`}>
              {initials}
            </div>
            {!isCollapsed && (
              <div className="min-w-0 animate-in fade-in slide-in-from-left-2 duration-300">
                <p className={`text-sm font-bold truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>{directorName}</p>
                <p className={`text-xs font-medium truncate ${isDark ? 'text-white/50' : 'text-slate-500'}`}>{user?.role || 'Director'}</p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* ─── Main Area — Dynamically adjusting offset ─── */}
      <div 
        className={`flex-1 flex flex-col min-w-0 transition-all duration-500 ease-in-out ${
          isCollapsed ? 'lg:pl-[80px]' : 'lg:pl-[260px]'
        }`}
      >
        {/* Top Header */}
        <header className="sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-100 dark:border-slate-800 px-4 sm:px-6 lg:px-8 py-4 transition-colors duration-500">
          <div className="flex items-center justify-between gap-4">
            {/* Left: Hamburger + Search */}
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
              >
                <Menu size={22} />
              </button>

              <div className="hidden sm:flex items-center gap-2 bg-slate-50 dark:bg-slate-800 rounded-xl px-4 py-2.5 flex-1 max-w-md border border-slate-100 dark:border-slate-700 transition-colors opacity-0 pointer-events-none">
                <Search size={16} className="text-slate-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Search students, teachers, classes..."
                  className="bg-transparent text-sm font-medium text-slate-700 dark:text-slate-200 placeholder:text-slate-400 outline-none w-full"
                />
              </div>
            </div>

            {/* Right: Theme + School + Profile */}
            <div className="flex items-center gap-3 sm:gap-5 shrink-0">
              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 transition-all border border-transparent hover:border-slate-200 dark:hover:border-slate-700 shadow-sm"
                title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
              >
                {theme === 'light' ? <Moon size={19} /> : <Sun size={19} />}
              </button>

              <div className={`hidden md:flex items-center gap-2 px-4 py-2 rounded-xl transition-colors ${
                schoolExpired
                  ? 'bg-red-50 text-red-700'
                  : subscriptionRequired
                    ? 'bg-amber-50 text-amber-700'
                    : 'bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-400'
              }`}>
                <School size={14} />
                <span className="text-xs font-bold truncate max-w-[220px]">
                  {schoolExpired
                    ? `${schoolName} - Renewal Required`
                    : subscriptionRequired
                      ? `${schoolName} - Subscription Required`
                      : schoolName}
                </span>
              </div>

              {/* Notifications */}
              {!schoolExpired && !subscriptionRequired && <NotificationBell />}

              {/* Profile Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white font-bold text-sm shadow-md shadow-brand-200">
                    {initials}
                  </div>
                  <div className="hidden sm:block text-left">
                    <p className="text-xs font-bold text-slate-900 dark:text-slate-100 leading-tight transition-colors">{directorName}</p>
                    <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">{user?.role}</p>
                  </div>
                  <ChevronDown size={14} className="text-slate-400 hidden sm:block" />
                </button>

                {profileOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
                    <div className="absolute right-0 top-14 w-56 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 py-2 z-50 animate-in zoom-in-95 duration-200 origin-top-right">
                      <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 transition-colors">
                        <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{directorName}</p>
                        <p className="text-xs text-slate-400 font-medium truncate">{schoolName}</p>
                      </div>
                      <Link
                        to="/dashboard/settings"
                        onClick={() => setProfileOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                      >
                        <User size={15} />
                        My Profile
                      </Link>
                      <Link
                        to="/dashboard/settings"
                        onClick={() => setProfileOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                      >
                        <Settings size={15} />
                        Settings
                      </Link>
                      <hr className="my-1 border-slate-100 dark:border-slate-800 transition-colors" />
                      <button
                        onClick={handleLogout}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors w-full"
                      >
                        <LogOut size={15} />
                        Sign Out
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 dark:bg-slate-950 transition-colors duration-500">
          {schoolExpired ? (
            <ExpiredSchoolPanel
              role={user?.role}
              onRenew={user?.role === 'DIRECTOR' ? () => setSubscriptionModalOpen(true) : undefined}
            />
          ) : subscriptionRequired && !canAccessLimitedRoute ? (
            <SubscriptionRequiredPanel
              role={user?.role}
              onSubscribe={user?.role === 'DIRECTOR' ? () => setSubscriptionModalOpen(true) : undefined}
            />
          ) : (
            <Outlet />
          )}
        </main>
      </div>
    </div>
  )
}

export default DashboardLayout
