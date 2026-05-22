import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { Loader2, AlertCircle } from 'lucide-react'
import { API_BASE } from '../../lib/config'

interface AttendanceStat {
  date: string
  percentage: number
  fullDate: string
}

const AttendanceChart = () => {
  const { token } = useAuth()
  const [stats, setStats] = useState<AttendanceStat[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const chartHeight = 160
  const barWidth = 40
  const maxVal = 100

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      setLoading(true)
      const res = await fetch(`${API_BASE}/api/attendance/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (res.ok) {
        setStats(data)
      } else {
        setError(data.error || 'Failed to load stats')
      }
    } catch (err) {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 h-[380px] flex flex-col items-center justify-center">
        <Loader2 className="animate-spin text-brand-500 mb-2" size={32} />
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Crunching Numbers...</p>
      </div>
    )
  }

  if (error || stats.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 h-[380px] flex flex-col items-center justify-center text-center">
        <AlertCircle size={32} className="text-slate-300 mb-3" />
        <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Attendance Data Unavailable</p>
        <p className="text-[10px] text-slate-400 mt-1 max-w-[200px]">Start marking attendance to see insights here.</p>
      </div>
    )
  }

  const values = stats.map(s => s.percentage)
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 transition-colors">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight italic">Analytics</h3>
          <p className="text-[10px] text-brand-600 dark:text-brand-400 font-black uppercase tracking-[0.2em]">Attendance Pipeline</p>
        </div>
        <div className="flex items-center gap-2 text-xs font-bold">
          <span className="inline-block w-3 h-3 rounded-full bg-brand-500 shadow-sm shadow-brand-500/50"></span>
          <span className="text-slate-500 dark:text-slate-400 uppercase tracking-tighter">Student %</span>
        </div>
      </div>

      {/* Chart */}
      <div className="flex items-end justify-center gap-4 sm:gap-6" style={{ height: chartHeight + 40 }}>
        {stats.map((stat, i) => {
          const barHeight = (stat.percentage / maxVal) * chartHeight
          const isHighest = stat.percentage > 0 && stat.percentage === Math.max(...values)

          return (
            <div key={stat.date + i} className="flex flex-col items-center gap-2 group">
              <span className={`text-[10px] font-black transition-all group-hover:scale-110 ${isHighest ? 'text-brand-600 dark:text-brand-400' : 'text-slate-500 dark:text-slate-500'}`}>
                {stat.percentage}%
              </span>
              <div
                className="relative rounded-xl overflow-hidden transition-all duration-500 group-hover:scale-[1.05]"
                style={{ width: barWidth, height: Math.max(barHeight, 4) }}
              >
                <div
                  className={`absolute inset-0 ${
                    stat.percentage === 0 
                      ? 'bg-slate-50 dark:bg-slate-800'
                      : isHighest 
                        ? 'bg-gradient-to-t from-brand-600 to-brand-400'
                        : 'bg-brand-100 dark:bg-slate-800'
                  } rounded-xl`}
                />
              </div>
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-600 uppercase">{stat.date}</span>
            </div>
          )
        })}
      </div>

      {/* Summary */}
      <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <div>
          <p className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider">Weekly Average</p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold italic">Dynamic stats from DB</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-black text-brand-600 dark:text-brand-400 italic">
            {values.filter(v => v > 0).length > 0
              ? Math.round(values.filter(v => v > 0).reduce((a, b) => a + b, 0) / values.filter(v => v > 0).length)
              : 0}%
          </p>
        </div>
      </div>
    </div>
  )
}

export default AttendanceChart
