import { useEffect, useState } from 'react'
import { API_BASE } from '../lib/config'
import { Link } from 'react-router-dom'
import {
  Users,
  GraduationCap,
  School,
  UserPlus,
  BookOpen,
  Megaphone,
  ArrowRight,
  Sparkles,
  AlertCircle,
  RefreshCw,
  Clock,
  CheckCircle2,
  CalendarCheck,
  Info
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import StatCard from '../components/dashboard/StatCard'
import QuickAction from '../components/dashboard/QuickAction'
import AttendanceChart from '../components/dashboard/AttendanceChart'

// ═══════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════
interface DashboardData {
  school: { name: string; status: string; createdAt: string }
  stats: {
    totalStudents: number
    totalTeachers: number
    totalClasses: number
    totalSubjects: number
  }
  checklist: Array<{
    id: string
    title: string
    message: string
  }>
  notices?: Array<{
    id: string
    title: string
    author: string
    createdAt: string
  }>
}

const PrincipalDashboard = () => {
  const { token, user } = useAuth()
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchDashboardSummary()
  }, [])

  const fetchDashboardSummary = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/dashboard/summary`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      
      if (res.ok) {
        setDashboardData(data)
      } else {
        setError(data.error || 'Failed to load dashboard statistics')
      }
    } catch (err) {
      console.error('Dashboard fetch error:', err)
      setError('Network error. Unable to connect to server.')
    } finally {
      setLoading(false)
    }
  }

  const principalName = (user?.firstName && user?.lastName) 
    ? `${user.firstName} ${user.lastName}` 
    : user?.firstName || 'Principal'
    
  const stats = dashboardData?.stats
  const notices = Array.isArray(dashboardData?.notices) ? dashboardData.notices : []

  if (error) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center text-center p-6">
        <div className="w-16 h-16 bg-red-50 dark:bg-red-500/10 rounded-2xl flex items-center justify-center text-red-600 mb-4">
          <AlertCircle size={32} />
        </div>
        <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 mb-2">Dashboard Unavailable</h2>
        <p className="text-slate-500 max-w-xs mb-6 font-medium">{error}</p>
        <button 
          onClick={fetchDashboardSummary}
          className="flex items-center gap-2 px-6 py-3 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-bold rounded-xl transition-transform hover:scale-105"
        >
          <RefreshCw size={18} />
          Retry Connection
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-8 max-w-[1400px]">
      {/* ─── Welcome Section ─── */}
      <div className="bg-gradient-to-r from-teal-600 via-teal-500 to-emerald-400 rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden shadow-xl shadow-teal-100 dark:shadow-none transition-all duration-300">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4"></div>
        <div className="absolute bottom-0 left-1/2 w-40 h-40 bg-white/5 rounded-full translate-y-1/2"></div>

        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 font-mono italic">
              <Sparkles size={18} className="text-teal-200" />
              <span className="text-xs font-bold text-teal-200 uppercase tracking-widest">Academic Operations</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight italic">
              Welcome back, {principalName}!
            </h1>
            <p className="text-sm sm:text-base text-white/70 font-medium max-w-lg">
              Manage your school's daily operations, staff, and student progress efficiently.
            </p>
          </div>
          <div className="flex items-center gap-2 bg-white/15 backdrop-blur-sm px-4 py-2 rounded-xl border border-white/10">
            <CheckCircle2 size={16} />
            <span className="text-sm font-bold uppercase tracking-wider">
               Principal Dashboard
            </span>
          </div>
        </div>
      </div>

      {/* ─── Stat Cards ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {loading ? Array(4).fill(0).map((_, i) => (
          <div key={i} className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 animate-pulse">
            <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-xl mb-4"></div>
            <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-1/2 mb-2"></div>
            <div className="h-8 bg-slate-100 dark:bg-slate-800 rounded w-3/4"></div>
          </div>
        )) : (
          <>
            <StatCard
              icon={<GraduationCap size={22} />}
              label="Total Students"
              value={stats?.totalStudents ?? 0}
              bgColor="bg-brand-50"
              iconColor="text-brand-600"
            />
            <StatCard
              icon={<Users size={22} />}
              label="Total Teachers"
              value={stats?.totalTeachers ?? 0}
              bgColor="bg-emerald-50"
              iconColor="text-emerald-600"
            />
            <StatCard
              icon={<School size={22} />}
              label="Total Classes"
              value={stats?.totalClasses ?? 0}
              bgColor="bg-amber-50"
              iconColor="text-amber-600"
            />
            <StatCard
              icon={<BookOpen size={22} />}
              label="Total Subjects"
              value={stats?.totalSubjects ?? 0}
              bgColor="bg-sky-50"
              iconColor="text-sky-600"
            />
          </>
        )}
      </div>

      {/* ─── Quick Actions ─── */}
      <div className="animate-in slide-in-from-bottom-5 duration-500">
        <h2 className="text-lg font-black text-slate-900 dark:text-slate-100 mb-4 transition-colors uppercase tracking-widest italic flex items-center gap-2">
          <ArrowRight size={18} className="text-brand-500" />
          School Management
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
          <Link to="/dashboard/teachers">
            <QuickAction
              icon={<UserPlus size={20} />}
              label="Add Teacher"
              description="New staff"
              color="brand"
            />
          </Link>
          <Link to="/dashboard/students">
            <QuickAction
              icon={<GraduationCap size={20} />}
              label="Add Student"
              description="Enroll student"
              color="emerald"
            />
          </Link>
          <Link to="/dashboard/classes">
            <QuickAction
              icon={<School size={20} />}
              label="Create Class"
              description="Assign rooms"
              color="amber"
            />
          </Link>
          <Link to="/dashboard/attendance">
            <QuickAction
              icon={<CalendarCheck size={20} />}
              label="Attendance"
              description="Staff records"
              color="violet"
            />
          </Link>
          <Link to="/dashboard/notices">
            <QuickAction
              icon={<Megaphone size={20} />}
              label="Post Notice"
              description="Bulletin"
              color="sky"
            />
          </Link>
        </div>
      </div>

      {/* ─── Charts + Activity + Alerts ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 sm:gap-6 pb-8">
        {/* Attendance Chart - 2 cols */}
        <div className="lg:col-span-2">
          <AttendanceChart />
        </div>

        {/* Recent Activity - 2 cols */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 h-full transition-colors">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 italic">Announcements</h3>
              <button className="text-xs font-bold text-brand-600 hover:text-brand-700 flex items-center gap-1 transition-colors uppercase tracking-widest">
                All Notices <ArrowRight size={12} />
              </button>
            </div>
            <div className="space-y-4">
              {(notices.length === 0) ? (
                <div className="py-12 flex flex-col items-center justify-center text-center">
                  <Megaphone className="text-slate-200 dark:text-slate-800 mb-3" size={40} />
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest italic">No messages sent</p>
                </div>
              ) : (
                notices.map((notice) => (
                  <div key={notice.id} className="group p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-2xl transition-all flex items-start gap-4 border border-transparent hover:border-slate-100 dark:hover:border-slate-800">
                    <div className="bg-brand-50 dark:bg-brand-500/10 p-2.5 rounded-xl shrink-0 text-brand-600">
                      <Megaphone size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate group-hover:text-brand-600 transition-colors uppercase tracking-tight">{notice.title || 'Untitled Notice'}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 font-black uppercase">By {notice.author || 'System'}</p>
                        <div className="flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500 font-black uppercase">
                          <Clock size={10} />
                          {notice.createdAt ? new Date(notice.createdAt).toLocaleDateString() : 'Recent'}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Alerts - 1 col */}
        <div className="lg:col-span-1">
          <div className="bg-slate-900 dark:bg-black rounded-3xl p-6 shadow-2xl h-full border border-slate-800">
            <h3 className="text-sm font-black text-white mb-5 uppercase tracking-[0.2em] italic flex items-center gap-2">
              <Sparkles size={14} className="text-brand-400" />
              Checklist
            </h3>
            <div className="space-y-4">
              {dashboardData?.checklist && dashboardData.checklist.length > 0 ? (
                dashboardData.checklist.map((item) => {
                  const pathMap: Record<string, string> = {
                    'setup-principal': '/dashboard/principals',
                    'setup-classes': '/dashboard/classes',
                    'setup-teachers': '/dashboard/teachers',
                    'setup-subjects': '/dashboard/subjects',
                    'setup-students': '/dashboard/students',
                  }
                  
                  return (
                    <Link 
                      to={pathMap[item.id] || '/dashboard'}
                      key={item.id}
                      className="block p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all group"
                    >
                      <div className="flex items-start gap-3 mb-2">
                        <Info size={14} className="text-brand-400 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <p className="text-[10px] font-black text-brand-400 uppercase tracking-widest mb-1">{item.title}</p>
                          <p className="text-[11px] font-bold text-slate-300 leading-snug tracking-tight uppercase">{item.message}</p>
                        </div>
                      </div>
                      <span className="text-[10px] font-black text-brand-400 uppercase tracking-widest group-hover:pl-1 transition-all">
                        Action Required →
                      </span>
                    </Link>
                  )
                })
              ) : (
                <div className="py-8 text-center flex flex-col items-center">
                  <div className="w-10 h-10 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-400 mb-3">
                    <CheckCircle2 size={20} />
                  </div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Operations Optimal</p>
                  <p className="text-[11px] text-slate-500 font-bold mt-1 uppercase">Ready for instruction.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PrincipalDashboard
