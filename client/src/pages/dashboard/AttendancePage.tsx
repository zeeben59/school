import { useState, useEffect } from 'react'
import { API_BASE } from '../../lib/config'
import { 
  CalendarCheck, 
  Search, 
  Loader2,
  Filter,
  Check,
  X,
  RefreshCw,
  Users,
  CheckCircle2,
  AlertCircle,
  Calendar
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

interface AttendanceRecord {
  id: string
  date: string
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED'
  note: string | null
  user: {
    firstName: string
    lastName: string
    role: string
    email: string
  }
  markedBy: {
    firstName: string
    lastName: string
  }
}

const AttendancePage = () => {
  const { user, token } = useAuth()
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<'VIEW' | 'MARK'>('VIEW')
  
  // Configuration based on role
  const roleConfig: Record<string, any> = {
    DIRECTOR: {
      title: 'Principal Attendance Reports',
      description: 'View principal attendance history and reporting trends',
      markTitle: 'Principal Attendance',
      markDescription: 'Direct attendance entry is disabled for directors in this workflow',
      selectionLabel: 'Principal Selection',
      selectPlaceholder: 'Select Principal',
      emptyMessage: 'No principals found for this school',
      apiEndpoint: `${API_BASE}/api/principals`,
      targetRole: 'PRINCIPAL',
      allowBulk: false,
      readOnly: false
    },
    PRINCIPAL: {
      title: 'Teacher Attendance',
      description: 'Record and track teacher presence',
      markTitle: 'Mark Teacher Attendance',
      markDescription: 'Official system entry for faculty',
      selectionLabel: 'Teacher Selection',
      selectPlaceholder: 'Select Teacher',
      emptyMessage: 'No teachers found for this school',
      apiEndpoint: `${API_BASE}/api/teachers`,
      targetRole: 'TEACHER',
      allowBulk: false,
      readOnly: false
    },
    TEACHER: {
      title: 'Student Attendance',
      description: 'Manage daily attendance for your classes',
      markTitle: 'Bulk Mark Class Attendance',
      markDescription: 'Record attendance for all students in a class',
      selectionLabel: 'Class Selection',
      selectPlaceholder: 'Select Class',
      emptyMessage: 'No assigned classes found',
      apiEndpoint: `${API_BASE}/api/teacher/my-classes`,
      targetRole: 'STUDENT',
      allowBulk: true,
      readOnly: false
    }
  }

  const currentConfig = roleConfig[user?.role || 'PRINCIPAL'] || roleConfig.PRINCIPAL
  
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0])
  const [filterRole, setFilterRole] = useState(currentConfig.targetRole)
  
  // Single mark state
  const [targetUsers, setTargetUsers] = useState<any[]>([])
  const [markingData, setMarkingData] = useState({
    userId: '',
    status: 'PRESENT' as const,
    date: new Date().toISOString().split('T')[0],
    note: ''
  })
  
  // Bulk mark state (Teacher)
  const [bulkClassId, setBulkClassId] = useState('')
  const [bulkStudents, setBulkStudents] = useState<any[]>([])
  const [bulkAttendance, setBulkAttendance] = useState<Record<string, {status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED', note: ''}>>({})
  const [bulkDate, setBulkDate] = useState(new Date().toISOString().split('T')[0])
  
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  useEffect(() => {
    fetchRecords()
    if (activeTab === 'MARK' && !currentConfig.readOnly) fetchTargetUsers()
  }, [activeTab, filterDate, filterRole])

  useEffect(() => {
    setFilterRole(currentConfig.targetRole)
  }, [user?.role])

  useEffect(() => {
    if (currentConfig.readOnly && activeTab === 'MARK') {
      setActiveTab('VIEW')
    }
  }, [currentConfig.readOnly, activeTab])

  const fetchRecords = async () => {
    setLoading(true)
    setError(null)
    try {
      const url = `${API_BASE}/api/attendance?date=${filterDate}&targetRole=${filterRole}`
      
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      
      if (res.ok) {
        setRecords(Array.isArray(data) ? data : [])
      } else {
        setError(data.error || 'Failed to sync attendance logs')
      }
    } catch (err) {
      console.error('Fetch error:', err)
      setError('Network telemetry failure. Attendance server unreachable.')
    } finally {
      setLoading(false)
    }
  }

  const fetchTargetUsers = async () => {
    try {
      const res = await fetch(currentConfig.apiEndpoint, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (res.ok && Array.isArray(data)) {
        setTargetUsers(data)
        if (currentConfig.allowBulk && data.length > 0) {
          const defaultClassId = data[0].id
          setBulkClassId(defaultClassId)
          fetchBulkStudents(defaultClassId)
        }
      }
    } catch (err) {
      console.error('Fetch users error:', err)
    }
  }

  const fetchBulkStudents = async (classId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/teacher/my-students?classId=${classId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (res.ok) {
        setBulkStudents(data)
        // Initialize default presence state
        const initialStatus: Record<string, any> = {}
        data.forEach((e: any) => {
          initialStatus[e.student.user.id] = { status: 'PRESENT', note: '' }
        })
        setBulkAttendance(initialStatus)
      }
    } catch (err) {
      console.error('Error fetching students', err)
    }
  }

  const handleClassChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const classId = e.target.value
    setBulkClassId(classId)
    if (classId) {
      fetchBulkStudents(classId)
    } else {
      setBulkStudents([])
    }
  }

  const toggleBulkStatus = (userId: string, newStatus: any) => {
    setBulkAttendance(prev => ({
      ...prev,
      [userId]: { ...prev[userId], status: newStatus }
    }))
  }

  const handleMark = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setMessage(null)

    try {
      const isBulk = currentConfig.allowBulk
      let endpoint = `${API_BASE}/api/attendance`
      let payload = null

      if (isBulk) {
        endpoint = `${API_BASE}/api/attendance/bulk`
        const records = Object.entries(bulkAttendance).map(([userId, data]) => ({
          userId,
          status: data.status,
          note: data.note
        }))
        payload = {
          classId: bulkClassId,
          date: bulkDate,
          records
        }
      } else {
        payload = markingData
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify(payload)
      })

      const data = await res.json()
      if (res.ok) {
        setMessage({ type: 'success', text: data.message || 'Attendance conditionally committed successfully' })
        setTimeout(() => {
          setActiveTab('VIEW')
          setFilterRole(currentConfig.targetRole)
          fetchRecords()
        }, 1000)
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to save' })
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Network error' })
    } finally {
      setSubmitting(false)
    }
  }

  const safeRecords = Array.isArray(records) ? records : []
  const filteredRecords = safeRecords.filter(r => {
    const firstName = r.user?.firstName || ''
    const lastName = r.user?.lastName || ''
    return `${firstName} ${lastName}`.toLowerCase().includes(search.toLowerCase())
  })

  // Render components chunk
  if (error) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center text-center p-6">
        <div className="w-16 h-16 bg-red-50 dark:bg-red-500/10 rounded-2xl flex items-center justify-center text-red-600 mb-4">
          <AlertCircle size={32} />
        </div>
        <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 mb-2">Attendance Sync Failed</h2>
        <p className="text-slate-500 max-w-xs mb-6 font-medium">{error}</p>
        <button onClick={fetchRecords} className="flex items-center gap-2 px-6 py-3 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-bold rounded-xl"><RefreshCw size={18} /> Retry Connection</button>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-[1400px]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight italic">{currentConfig.title}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium tracking-tight whitespace-pre-line">{currentConfig.description}</p>
        </div>
        {currentConfig.readOnly ? (
          <div className="px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-black uppercase tracking-widest text-slate-500">
            Read Only
          </div>
        ) : (
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <button onClick={() => setActiveTab('VIEW')} className={`px-4 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${activeTab === 'VIEW' ? 'bg-white dark:bg-slate-700 text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>History</button>
            <button onClick={() => setActiveTab('MARK')} className={`px-4 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${activeTab === 'MARK' ? 'bg-white dark:bg-slate-700 text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Mark New</button>
          </div>
        )}
      </div>

      {activeTab === 'VIEW' ? (
        <>
          <div className="flex flex-col lg:flex-row gap-4 items-end bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
            <div className="space-y-1.5 flex-1 min-w-[200px]">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 ml-1"><Calendar size={12} className="text-brand-500" /> Filter Date</label>
              <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-xl outline-none focus:ring-2 focus:ring-brand-500 text-sm font-bold" />
            </div>
            <div className="space-y-1.5 flex-1 min-w-[200px]">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 ml-1"><Filter size={12} className="text-emerald-500" /> Filter Role</label>
              <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)} className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-xl outline-none focus:ring-2 focus:ring-brand-500 text-sm font-bold">
                <option value={currentConfig.targetRole}>{user?.role === 'DIRECTOR' ? 'All Principals' : user?.role === 'TEACHER' ? 'All Students' : 'All Teachers'}</option>
              </select>
            </div>
            <div className="relative flex-[2] min-w-[250px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input type="text" placeholder="Search by name..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-xl outline-none focus:ring-2 focus:ring-brand-500 text-sm font-medium" />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
            {loading ? (
              <div className="p-12 flex flex-col items-center justify-center gap-2">
                <Loader2 className="animate-spin text-brand-500" size={32} />
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Polling logs...</p>
              </div>
            ) : filteredRecords.length === 0 ? (
              <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-3">
                <CalendarCheck size={48} className="text-slate-100 dark:text-slate-800" />
                <p className="text-sm font-medium italic">No attendance records found for this criteria.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Entity Name</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Role</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Authenticator</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                    {filteredRecords.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group">
                        <td className="px-6 py-4 font-bold text-slate-900 dark:text-slate-100 text-sm italic group-hover:text-brand-600 transition-colors">
                          {r.user?.firstName || 'Unknown'} {r.user?.lastName || ''}
                        </td>
                        <td className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{r.user?.role || '---'}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 w-fit ${r.status === 'PRESENT' ? 'bg-emerald-50 text-emerald-600' : r.status === 'ABSENT' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
                            {r.status === 'PRESENT' ? <Check size={10} /> : <X size={10} />} {r.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-500 font-medium italic">By {r.markedBy?.firstName || 'System'}</td>
                        <td className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase">{new Date(r.date).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        currentConfig.allowBulk ? (
          // Bulk Mark Attendance (Teacher Workflow)
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm p-6 sm:p-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
              <div className="flex items-center gap-4">
                <div className="p-3.5 bg-brand-50 dark:bg-brand-500/10 rounded-2xl text-brand-600">
                  <Users size={26} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 italic">{currentConfig.markTitle}</h2>
                  <p className="text-xs text-slate-400 font-black uppercase tracking-widest">{currentConfig.markDescription}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <input 
                  type="date"
                  value={bulkDate}
                  onChange={e => setBulkDate(e.target.value)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-xl font-bold outline-none focus:ring-2 focus:ring-brand-500/20 text-sm"
                />
                <select 
                  value={bulkClassId}
                  onChange={handleClassChange}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-xl font-bold outline-none focus:ring-2 focus:ring-brand-500/20 text-sm"
                >
                  <option value="">{targetUsers.length > 0 ? "Select Class" : "No Classes Available"}</option>
                  {targetUsers.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {message && (
               <div className={`p-4 rounded-xl flex items-center gap-3 text-sm font-bold animate-in mb-6 ${
                 message.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
               }`}>
                 {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                 {message.text}
               </div>
            )}

            {bulkClassId && bulkStudents.length === 0 ? (
               <div className="p-12 text-center text-slate-500 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-2xl font-bold italic">No students found in this class.</div>
            ) : bulkClassId ? (
              <form onSubmit={handleMark}>
                <div className="border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden mb-6">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-800">
                       <tr>
                         <th className="px-6 py-4 text-xs font-black uppercase text-slate-500 tracking-widest w-1/3">Student</th>
                         <th className="px-6 py-4 text-xs font-black uppercase text-slate-500 tracking-widest text-center">Status</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                       {bulkStudents.map(e => {
                         const sid = e.student.user.id
                         const currentStatus = bulkAttendance[sid]?.status || 'PRESENT'
                         return (
                           <tr key={sid} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                             <td className="px-6 py-4">
                               <p className="font-bold text-sm text-slate-900 dark:text-slate-100">{e.student.user.firstName} {e.student.user.lastName}</p>
                               <p className="text-xs text-slate-400 font-medium">{e.student.admissionNo}</p>
                             </td>
                             <td className="px-6 py-4 text-center">
                                <div className="inline-flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                                  <button type="button" onClick={() => toggleBulkStatus(sid, 'PRESENT')} className={`px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-widest transition-all ${currentStatus === 'PRESENT' ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Present</button>
                                  <button type="button" onClick={() => toggleBulkStatus(sid, 'ABSENT')} className={`px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-widest transition-all ${currentStatus === 'ABSENT' ? 'bg-red-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Absent</button>
                                  <button type="button" onClick={() => toggleBulkStatus(sid, 'LATE')} className={`px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-widest transition-all ${currentStatus === 'LATE' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Late</button>
                                </div>
                             </td>
                           </tr>
                         )
                       })}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-end">
                  <button disabled={submitting} type="submit" className="bg-brand-600 hover:bg-brand-700 text-white px-8 py-3 rounded-xl font-black text-sm uppercase tracking-widest shadow-lg flex items-center gap-2 transition-all">
                    {submitting ? <Loader2 size={18} className="animate-spin" /> : <><CheckCircle2 size={18} /> Submit Attendance</>}
                  </button>
                </div>
              </form>
            ) : null}
          </div>
        ) : (
          // Single Mark Attendance (Director/Principal Workflow)
          <div className="max-w-xl mx-auto bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-brand-500/5 dark:bg-brand-500/10 rounded-full translate-x-1/2 -translate-y-1/2"></div>
            
            <div className="flex items-center gap-4 mb-10 relative z-10">
              <div className="p-3.5 bg-brand-50 dark:bg-brand-500/10 rounded-2xl text-brand-600 border border-brand-100 dark:border-brand-500/20">
                <CalendarCheck size={26} />
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight italic">{currentConfig.markTitle}</h2>
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">{currentConfig.markDescription}</p>
              </div>
            </div>

            <form onSubmit={handleMark} className="space-y-6 relative z-10">
              {message && (
                <div className={`p-4 rounded-xl flex items-center gap-3 text-sm font-bold animate-in slide-in-from-top-2 duration-300 ${
                  message.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                }`}>
                  {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                  {message.text}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">{currentConfig.selectionLabel}</label>
                <select 
                  required
                  value={markingData.userId}
                  onChange={(e) => setMarkingData({...markingData, userId: e.target.value})}
                  className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border border-transparent focus:border-brand-500/30 rounded-2xl outline-none focus:ring-4 focus:ring-brand-500/5 text-sm font-bold transition-all appearance-none italic"
                >
                  <option value="">{targetUsers.length > 0 ? currentConfig.selectPlaceholder : currentConfig.emptyMessage}</option>
                  {targetUsers.map(u => (
                    <option key={u.id} value={u.id}>{u.firstName || (u.user && u.user.firstName)} {u.lastName || (u.user && u.user.lastName)}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Reporting Date</label>
                  <input 
                    type="date"
                    value={markingData.date}
                    onChange={(e) => setMarkingData({...markingData, date: e.target.value})}
                    className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border border-transparent focus:border-brand-500/30 rounded-2xl outline-none focus:ring-4 focus:ring-brand-500/5 text-sm font-bold transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Status</label>
                  <select 
                    value={markingData.status}
                    onChange={(e) => setMarkingData({...markingData, status: e.target.value as any})}
                    className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border border-transparent focus:border-brand-500/30 rounded-2xl outline-none focus:ring-4 focus:ring-brand-500/5 text-sm font-bold transition-all appearance-none"
                  >
                    <option value="PRESENT">PRESENT</option>
                    <option value="ABSENT">ABSENT</option>
                    <option value="LATE">LATE</option>
                    <option value="EXCUSED">EXCUSED</option>
                  </select>
                </div>
              </div>

              <button disabled={submitting} className="w-full bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-black py-4.5 rounded-2xl shadow-xl hover:scale-[1.02] flex items-center justify-center gap-2 uppercase tracking-[0.3em] text-xs">
                {submitting ? <Loader2 className="animate-spin" size={20} /> : 'Commit Record'}
              </button>
            </form>
          </div>
        )
      )}
    </div>
  )
}

export default AttendancePage
