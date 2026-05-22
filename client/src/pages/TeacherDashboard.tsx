import { useEffect, useState } from 'react'
import { API_BASE } from '../lib/config'
import { Link } from 'react-router-dom'
import {
  Users,
  School,
  ArrowRight,
  Sparkles,
  Loader2,
  AlertCircle,
  Megaphone,
  CheckCircle2,
  BookOpen,
  CalendarDays,
  FileCheck,
  UserPlus
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import StatCard from '../components/dashboard/StatCard'
import QuickAction from '../components/dashboard/QuickAction'
import AttendanceChart from '../components/dashboard/AttendanceChart'

const TeacherDashboard = () => {
  const { token, user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  
  const teacherName = (user?.firstName && user?.lastName) 
    ? `${user.firstName} ${user.lastName}` 
    : user?.firstName || 'Teacher'

  useEffect(() => {
    if (token) fetchDashboard()
  }, [token])

  const fetchDashboard = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/teacher/dashboard`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const dashboardData = await res.json()
      
      if (res.ok) {
        setData(dashboardData)
      } else {
        setError(dashboardData.error || 'Failed to sync telemetry')
      }
    } catch (err) {
      setError('Network synchronization failure. Server unreachable.')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-brand-600" size={32} />
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest italic">Polling faculty telemetry...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center text-center p-6">
        <div className="w-16 h-16 bg-red-50 dark:bg-red-500/10 rounded-2xl flex items-center justify-center text-red-600 mb-4">
          <AlertCircle size={32} />
        </div>
        <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 mb-2">Network Desync</h2>
        <p className="text-slate-500 max-w-xs mb-6 font-medium">{error}</p>
        <button 
          onClick={fetchDashboard}
          className="px-6 py-3 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-bold rounded-xl transition-transform hover:scale-105"
        >
          Retry Connection
        </button>
      </div>
    )
  }

  const {
    totalClasses = 0,
    totalSubjects = 0,
    totalStudents = 0,
    isClassTeacher = false,
    classTeacherOf = [],
    attendanceToday = { present: 0, total: 0 },
    notices = []
  } = data || {}

  const attendanceRate = attendanceToday.total > 0 
    ? Math.round((attendanceToday.present / attendanceToday.total) * 100) 
    : 0

  return (
    <div className="space-y-8 max-w-[1400px]">
      {/* ─── Class Teacher Banner (Conditional) ─── */}
      {isClassTeacher && (
        <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-2xl p-4 sm:p-5 flex items-start sm:items-center justify-between gap-4 animate-in slide-in-from-top-4 duration-500 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 sm:p-3 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <CheckCircle2 size={24} />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black text-emerald-900 dark:text-emerald-100 uppercase tracking-widest italic">
                Class Teacher Assignment Active
              </h2>
              <p className="text-xs sm:text-sm text-emerald-700 dark:text-emerald-400 font-medium">
                You are assigned as the form teacher for: <strong className="text-emerald-900 dark:text-emerald-300 font-black">{classTeacherOf.join(', ')}</strong>
              </p>
            </div>
          </div>
          <Link to="/dashboard/my-students" className="hidden sm:flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest transition-all">
            <Users size={14} /> My Class
          </Link>
        </div>
      )}

      {/* ─── Welcome Section ─── */}
      <div className="bg-gradient-to-r from-violet-600 via-violet-500 to-purple-400 rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden shadow-xl shadow-violet-100 dark:shadow-none transition-all duration-300">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4"></div>
        <div className="absolute bottom-0 left-1/2 w-40 h-40 bg-white/5 rounded-full translate-y-1/2"></div>

        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 font-mono italic">
              <Sparkles size={18} className="text-violet-200" />
              <span className="text-xs font-bold text-violet-200 uppercase tracking-widest">Faculty Management</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight italic">
              Welcome back, {teacherName}!
            </h1>
            <p className="text-sm sm:text-base text-white/70 font-medium max-w-lg">
              Manage your daily classes, track student progress, and organize your subjects.
            </p>
          </div>
          <div className="flex items-center gap-2 bg-white/15 backdrop-blur-sm px-4 py-2 rounded-xl border border-white/10">
            <CheckCircle2 size={16} />
            <span className="text-sm font-bold uppercase tracking-wider">
               Teacher Dashboard
            </span>
          </div>
        </div>
      </div>

      {/* ─── Stat Cards ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <StatCard
          icon={<School size={22} />}
          label="My Classes"
          value={totalClasses}
          bgColor="bg-brand-50"
          iconColor="text-brand-600"
        />
        <StatCard
          icon={<BookOpen size={22} />}
          label="My Subjects"
          value={totalSubjects}
          bgColor="bg-sky-50"
          iconColor="text-sky-600"
        />
        <StatCard
          icon={<Users size={22} />}
          label="My Students"
          value={totalStudents}
          bgColor="bg-emerald-50"
          iconColor="text-emerald-600"
        />
        <StatCard
          icon={<FileCheck size={22} />}
          label="Class Attendance"
          value={`${attendanceRate}%`}
          bgColor="bg-amber-50"
          iconColor="text-amber-600"
        />
      </div>

      {/* ─── Quick Actions ─── */}
      <div className="animate-in slide-in-from-bottom-5 duration-500">
        <h2 className="text-lg font-black text-slate-900 dark:text-slate-100 mb-4 transition-colors uppercase tracking-widest italic flex items-center gap-2">
          <ArrowRight size={18} className="text-brand-500" />
          Academic Actions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
          <Link to="/dashboard/attendance">
            <QuickAction
              icon={<CalendarDays size={20} />}
              label="Mark Attendance"
              description="Today's rollup"
              color="emerald"
            />
          </Link>
          <Link to="/dashboard/results">
            <QuickAction
              icon={<FileCheck size={20} />}
              label="Upload Results"
              description="Score entry"
              color="brand"
            />
          </Link>
          <Link to="/dashboard/my-students">
            <QuickAction
              icon={<UserPlus size={20} />}
              label="My Students"
              description="Class roster"
              color="violet"
            />
          </Link>
          <Link to="/dashboard/subjects">
            <QuickAction
              icon={<BookOpen size={20} />}
              label="My Subjects"
              description="View materials"
              color="sky"
            />
          </Link>
          <Link to="/dashboard/notices">
            <QuickAction
              icon={<Megaphone size={20} />}
              label="Staff Bulletin"
              description="View signals"
              color="amber"
            />
          </Link>
        </div>
      </div>

      {/* ─── Charts + Feed ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 sm:gap-6 pb-8">
        <div className="lg:col-span-3">
          <AttendanceChart /> {/* Still mock for now, will be updated via distinct task if needed */}
        </div>

        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 shadow-sm border border-slate-100 dark:border-slate-800 h-full transition-colors flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 italic">Recent Bulletin</h3>
              <Link to="/dashboard/notices" className="text-xs font-bold text-brand-600 hover:text-brand-700 flex items-center gap-1 transition-colors uppercase tracking-widest">
                 View Engine <ArrowRight size={12} />
              </Link>
            </div>
            
            {notices.length === 0 ? (
              <div className="flex flex-col items-center justify-center flex-grow text-slate-400 gap-3">
                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-full">
                  <Megaphone size={24} className="text-slate-300 dark:text-slate-600" />
                </div>
                <p className="text-xs font-bold uppercase tracking-wider">No active directives.</p>
              </div>
            ) : (
               <div className="space-y-4">
                 {notices.map((notice: any) => (
                   <div key={notice.id} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 group hover:border-brand-500/30 transition-colors">
                     <p className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1 group-hover:text-brand-600 transition-colors">{notice.title}</p>
                     <div className="flex items-center justify-between mt-2">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{notice.author?.firstName} {notice.author?.lastName}</p>
                        <p className="text-[10px] text-slate-400 font-medium italic">{new Date(notice.createdAt).toLocaleDateString()}</p>
                     </div>
                   </div>
                 ))}
               </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default TeacherDashboard
