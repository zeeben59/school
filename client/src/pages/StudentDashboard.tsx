import { useState, useEffect } from 'react'
import { API_BASE } from '../lib/config'
import { Link } from 'react-router-dom'
import {
  Sparkles,
  CheckCircle2,
  BookOpen,
  CalendarDays,
  Target,
  Trophy,
  Loader2,
  Printer,
  FileText,
  AlertCircle
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import StatCard from '../components/dashboard/StatCard'

interface Result {
  id: string
  firstTest: number | null
  secondTest: number | null
  exam: number | null
  total: number | null
  grade: string | null
  term: string
  academicYear: string
  subject: { name: string, code: string }
}

interface Attendance {
  id: string
  date: string
  status: string
  note: string | null
  markedBy: { firstName: string, lastName: string, role: string }
}

interface ResultDocument {
  id: string
  term: string
  academicYear: string
  originalFileName: string
  viewUrl: string
  downloadUrl: string
  subject?: { name: string, code?: string | null }
  class?: { name: string }
}

const TERM_RANK: Record<string, number> = {
  Third: 3,
  Second: 2,
  First: 1,
}

const getAcademicYearStart = (value: string) => {
  const [start] = value.split('/')
  const parsed = Number(start)
  return Number.isFinite(parsed) ? parsed : 0
}

const getLatestPeriod = <T extends { academicYear: string; term: string }>(records: T[]) => {
  if (records.length === 0) return null

  return [...records].sort((a, b) => {
    const yearDelta = getAcademicYearStart(b.academicYear) - getAcademicYearStart(a.academicYear)
    if (yearDelta !== 0) return yearDelta
    return (TERM_RANK[b.term] || 0) - (TERM_RANK[a.term] || 0)
  })[0]
}

const StudentDashboard = () => {
  const { user, token } = useAuth()
  
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'RESULTS' | 'ATTENDANCE'>('OVERVIEW')
  
  const [results, setResults] = useState<Result[]>([])
  const [resultDocuments, setResultDocuments] = useState<ResultDocument[]>([])
  const [attendance, setAttendance] = useState<Attendance[]>([])
  const [loading, setLoading] = useState(true)
  const [documentActionId, setDocumentActionId] = useState<string | null>(null)
  const [documentError, setDocumentError] = useState<string | null>(null)
  
  // Filters for results
  const [academicYear, setAcademicYear] = useState('2024/2025')
  const [term, setTerm] = useState('First')
  
  useEffect(() => {
    fetchStudentData()
  }, [])

  const fetchStudentData = async () => {
    setLoading(true)
    try {
      // Fetch user's results
      const resResults = await fetch(`${API_BASE}/api/results`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const dataResults = await resResults.json()
      if (resResults.ok) {
        setResults(dataResults)
        const latestResult = getLatestPeriod(dataResults)
        if (latestResult) {
          setAcademicYear(latestResult.academicYear)
          setTerm(latestResult.term)
        }
      }

      const resDocuments = await fetch(`${API_BASE}/api/results/documents`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const dataDocuments = await resDocuments.json()
      if (resDocuments.ok) setResultDocuments(dataDocuments)
      
      // Fetch user's attendance
      const resAtt = await fetch(`${API_BASE}/api/attendance`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const dataAtt = await resAtt.json()
      if (resAtt.ok) setAttendance(dataAtt)
      
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const handleResultDocumentAction = async (resultDocument: ResultDocument, action: 'view' | 'download' | 'print') => {
    setDocumentActionId(resultDocument.id)
    setDocumentError(null)
    try {
      const endpoint = action === 'download' ? resultDocument.downloadUrl : resultDocument.viewUrl
      const res = await fetch(`${API_BASE}${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || 'Failed to fetch result PDF')
      }

      const blob = await res.blob()
      const objectUrl = window.URL.createObjectURL(blob)

      if (action === 'download') {
        const link = document.createElement('a')
        link.href = objectUrl
        link.download = resultDocument.originalFileName
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      } else {
        const newWindow = window.open(objectUrl, '_blank', 'noopener,noreferrer')
        if (!newWindow) {
          throw new Error('Your browser blocked the PDF window. Please allow pop-ups and try again.')
        }
        if (action === 'print') {
          setTimeout(() => {
            newWindow.focus()
            newWindow.print()
          }, 800)
        }
      }

      setTimeout(() => window.URL.revokeObjectURL(objectUrl), 60_000)
    } catch (error: any) {
      setDocumentError(error.message || 'Failed to open the result PDF')
    } finally {
      setDocumentActionId(null)
    }
  }

  const studentName = (user?.firstName && user?.lastName) 
    ? `${user.firstName} ${user.lastName}` 
    : user?.firstName || 'Student'
    
  // Derived state
  const filteredResults = results.filter(r => r.term === term && r.academicYear === academicYear)
  const filteredResultDocuments = resultDocuments.filter((doc) => doc.term === term && doc.academicYear === academicYear)
  
  // Dynamic academic years from data
  const availableYears = Array.from(new Set(results.map(r => r.academicYear)))
  if (availableYears.length > 0 && !availableYears.includes('2024/2025')) {
    // Ensure current year is always an option or at least documented
  }
  const displayYears = availableYears.length > 0 ? availableYears : ['2024/2025']

  const gpaVal = filteredResults.length > 0 
    ? (filteredResults.reduce((acc, curr) => acc + (curr.total || 0), 0) / filteredResults.length / 20).toFixed(1) 
    : 'N/A'
    
  const presentCount = attendance.filter(a => a.status === 'PRESENT').length
  const attendanceRate = attendance.length > 0 ? Math.round((presentCount / attendance.length) * 100) + '%' : 'N/A'

  return (
    <div className="space-y-8 max-w-[1400px] mx-auto print:bg-white print:p-0">
      
      {/* Navigation Tabs - Hidden in Print */}
      <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl w-fit print:hidden">
         <button onClick={() => setActiveTab('OVERVIEW')} className={`px-6 py-2.5 font-black uppercase tracking-widest text-xs rounded-xl transition-all ${activeTab === 'OVERVIEW' ? 'bg-white dark:bg-slate-700 text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Overview</button>
         <button onClick={() => setActiveTab('RESULTS')} className={`px-6 py-2.5 font-black uppercase tracking-widest text-xs rounded-xl transition-all ${activeTab === 'RESULTS' ? 'bg-white dark:bg-slate-700 text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>My Results</button>
         <button onClick={() => setActiveTab('ATTENDANCE')} className={`px-6 py-2.5 font-black uppercase tracking-widest text-xs rounded-xl transition-all ${activeTab === 'ATTENDANCE' ? 'bg-white dark:bg-slate-700 text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Attendance Log</button>
      </div>

      {loading ? (
           <div className="p-16 flex justify-center print:hidden"><Loader2 className="animate-spin text-brand-600" size={32} /></div>
      ) : activeTab === 'OVERVIEW' ? (
        <div className="space-y-8 animate-in fade-in duration-500 print:hidden">
          {/* Welcome Section */}
          <div className="bg-gradient-to-r from-sky-600 via-sky-500 to-indigo-400 rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden shadow-xl shadow-sky-100 dark:shadow-none transition-all duration-300">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4"></div>
            <div className="absolute bottom-0 left-1/2 w-40 h-40 bg-white/5 rounded-full translate-y-1/2"></div>
    
            <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 font-mono italic">
                  <Sparkles size={18} className="text-sky-200" />
                  <span className="text-xs font-bold text-sky-200 uppercase tracking-widest">Student Portal</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight italic">
                  Welcome back, {studentName}!
                </h1>
                <p className="text-sm sm:text-base text-white/70 font-medium max-w-lg">
                  Check your latest grades, stay on top of assignments, and manage your learning path.
                </p>
              </div>
              <div className="flex items-center gap-2 bg-white/15 backdrop-blur-sm px-4 py-2 rounded-xl border border-white/10">
                <CheckCircle2 size={16} />
                <span className="text-sm font-bold uppercase tracking-wider">
                   Active
                </span>
              </div>
            </div>
          </div>
    
          {/* Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            <StatCard icon={<BookOpen size={22} />} label="Total Records" value={results.length} bgColor="bg-brand-50" iconColor="text-brand-600" />
            <StatCard icon={<Target size={22} />} label="Approx. Score Index" value={gpaVal} bgColor="bg-emerald-50" iconColor="text-emerald-600" />
            <StatCard icon={<CalendarDays size={22} />} label="Attendance Rate" value={attendanceRate} bgColor="bg-amber-50" iconColor="text-amber-600" />
            <StatCard icon={<Trophy size={22} />} label="Classes Attended" value={presentCount} bgColor="bg-sky-50" iconColor="text-sky-600" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-8">
              <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-6 sm:p-8 shadow-sm border border-slate-100 dark:border-slate-800">
                 <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 italic mb-6">Recent Result Updates</h3>
                 <div className="space-y-4">
                    {results.length === 0 ? (
                      <div className="p-6 text-center text-slate-500 font-bold italic text-sm">No recent results found.</div>
                    ) : results.slice(0, 3).map((r) => (
                        <div key={r.id} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 transition-all hover:translate-x-1">
                            <div className="flex items-center gap-4">
                                <div className="p-2 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl text-emerald-600">
                                   <FileText size={18} />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{r.subject.name}</p>
                                    <p className="text-[10px] text-slate-400 font-medium">{r.term} Term - {r.academicYear}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-black text-emerald-600">{r.grade}</p>
                                <p className="text-[10px] text-slate-400 font-medium">{r.total}/100</p>
                            </div>
                        </div>
                    ))}
                 </div>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-6 sm:p-8 shadow-sm border border-slate-100 dark:border-slate-800">
                 <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 italic mb-6">Latest Attendance Logs</h3>
                 <div className="space-y-4">
                    {attendance.length === 0 ? (
                      <div className="p-6 text-center text-slate-500 font-bold italic text-sm">No attendance records found.</div>
                    ) : attendance.slice(0, 5).map((a) => (
                        <div key={a.id} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-800">
                           <div className="flex items-center gap-3">
                             {a.status === 'PRESENT' ? <CheckCircle2 size={16} className="text-emerald-500" /> : <AlertCircle size={16} className="text-red-500" />}
                             <p className="text-xs font-bold text-slate-600">{new Date(a.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })}</p>
                           </div>
                           <span className={`text-[10px] font-black tracking-widest uppercase px-2 py-1 rounded-md ${a.status === 'PRESENT' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                             {a.status}
                           </span>
                        </div>
                    ))}
                 </div>
              </div>
          </div>
        </div>
      ) : activeTab === 'RESULTS' ? (
        <div className="space-y-6 animate-in fade-in duration-500">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100 dark:bg-slate-900 dark:border-slate-800">
             <div className="flex gap-4">
               <select value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} className="px-4 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-brand-500 text-sm font-bold border-none">
                  {displayYears.map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
               </select>
               <select value={term} onChange={(e) => setTerm(e.target.value)} className="px-4 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-brand-500 text-sm font-bold border-none">
                  <option value="First">First Term</option>
                  <option value="Second">Second Term</option>
                  <option value="Third">Third Term</option>
               </select>
             </div>
             
             <button onClick={handlePrint} className="bg-brand-600 text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-brand-700 transition">
               <Printer size={16} /> Print Result
             </button>
             <Link to="/dashboard/result-slip" className="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-slate-800 transition">
               <FileText size={16} /> Full Result Slip
             </Link>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-[2rem] sm:rounded-[2.5rem] border border-slate-100 dark:border-slate-800 p-6 sm:p-10 shadow-sm print:shadow-none print:border-none print:p-0">
             <div className="text-center mb-10 pb-6 border-b-2 border-slate-100 dark:border-slate-800">
                <h1 className="text-3xl font-black italic tracking-widest uppercase mb-2">Student Term Report</h1>
                <p className="text-sm font-bold text-slate-500">{studentName} • {term} Term • {academicYear}</p>
             </div>

             {documentError && (
               <div className="mb-6 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700 print:hidden">
                 {documentError}
               </div>
             )}

             {filteredResultDocuments.length > 0 && (
               <div className="mb-8 rounded-[2rem] border border-slate-100 bg-slate-50 p-5 print:hidden dark:border-slate-800 dark:bg-slate-800/40">
                 <div className="flex items-center justify-between gap-4">
                   <div>
                     <h2 className="text-lg font-black text-slate-900 dark:text-slate-100 italic">Uploaded Result PDFs</h2>
                     <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Open, download, or print your official uploaded result files.</p>
                   </div>
                 </div>
                 <div className="mt-4 space-y-3">
                   {filteredResultDocuments.map((doc) => (
                     <div key={doc.id} className="rounded-2xl border border-slate-200/70 bg-white px-4 py-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                       <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                         <div>
                           <p className="text-sm font-black text-slate-900 dark:text-slate-100">{doc.originalFileName}</p>
                           <p className="mt-1 text-xs font-medium text-slate-500">
                             {doc.subject?.name || 'Result PDF'} • {doc.class?.name || 'Class'} • {doc.term} Term • {doc.academicYear}
                           </p>
                         </div>
                         <div className="flex flex-wrap gap-2">
                           <button
                             type="button"
                             onClick={() => handleResultDocumentAction(doc, 'view')}
                             disabled={documentActionId === doc.id}
                             className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-black uppercase tracking-widest text-white transition hover:bg-slate-800"
                           >
                             {documentActionId === doc.id ? 'Opening...' : 'View PDF'}
                           </button>
                           <button
                             type="button"
                             onClick={() => handleResultDocumentAction(doc, 'download')}
                             disabled={documentActionId === doc.id}
                             className="rounded-xl bg-brand-600 px-4 py-2 text-xs font-black uppercase tracking-widest text-white transition hover:bg-brand-700"
                           >
                             Download
                           </button>
                           <button
                             type="button"
                             onClick={() => handleResultDocumentAction(doc, 'print')}
                             disabled={documentActionId === doc.id}
                             className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black uppercase tracking-widest text-white transition hover:bg-emerald-700"
                           >
                             Print
                           </button>
                         </div>
                       </div>
                     </div>
                   ))}
                 </div>
               </div>
             )}

             {filteredResults.length === 0 ? (
                <div className="p-16 text-center text-slate-500 font-bold border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-2xl italic print:hidden">No score results have been uploaded for you this term.</div>
             ) : (
               <div className="overflow-x-auto">
                  <table className="w-full text-left">
                     <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800 focus:outline-none">
                           <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest rounded-l-xl">Subject</th>
                           <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest text-right">CA 1 (20)</th>
                           <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest text-right">CA 2 (20)</th>
                           <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest text-right">Exam (60)</th>
                           <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest text-right bg-slate-100 dark:bg-slate-700">Total (100)</th>
                           <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest text-center rounded-r-xl">Grade</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {filteredResults.map(r => (
                          <tr key={r.id}>
                             <td className="px-6 py-4 font-bold text-slate-900 dark:text-white text-sm">{r.subject.name}</td>
                             <td className="px-6 py-4 font-bold text-slate-600 text-right">{r.firstTest ?? '-'}</td>
                             <td className="px-6 py-4 font-bold text-slate-600 text-right">{r.secondTest ?? '-'}</td>
                             <td className="px-6 py-4 font-bold text-slate-600 text-right">{r.exam ?? '-'}</td>
                             <td className="px-6 py-4 font-black text-brand-600 dark:text-brand-400 text-right text-lg bg-slate-50 dark:bg-slate-800/50 print:bg-slate-50">{r.total ?? '-'}</td>
                             <td className="px-6 py-4 text-center">
                                <span className="font-black text-lg">{r.grade ?? '-'}</span>
                             </td>
                          </tr>
                        ))}
                     </tbody>
                  </table>
               </div>
             )}
             
             <div className="mt-8 pt-6 border-t-2 border-slate-100 dark:border-slate-800 text-right print:block hidden">
               <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-10">Official Result Slip - Generated by EduNexus Pro</p>
             </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6 animate-in fade-in duration-500 print:hidden">
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-6 sm:p-10 shadow-sm border border-slate-100 dark:border-slate-800">
             <div className="flex items-center gap-4 mb-8">
                <div className="p-3 bg-brand-50 dark:bg-brand-500/10 rounded-2xl text-brand-600">
                   <CalendarDays size={26} />
                </div>
                <div>
                   <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 italic">Attendance History</h2>
                   <p className="text-xs text-slate-400 font-black uppercase tracking-widest">Your chronological roll call logs</p>
                </div>
             </div>

             {attendance.length === 0 ? (
                 <div className="p-16 text-center text-slate-500 font-bold border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-2xl italic">No attendance records found for you.</div>
             ) : (
                 <div className="space-y-4">
                   {attendance.map((a) => (
                      <div key={a.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-5 rounded-2xl bg-slate-50 dark:bg-slate-800 gap-4">
                         <div>
                            <p className="text-sm font-bold text-slate-900 dark:text-white mb-1">
                               {new Date(a.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                            </p>
                            <p className="text-[10px] uppercase font-black tracking-widest text-slate-400">Marked by {a.markedBy.firstName} {a.markedBy.lastName} ({a.markedBy.role})</p>
                         </div>
                         <div className={`px-4 py-2 rounded-xl text-xs font-black tracking-widest uppercase text-center min-w-[120px] ${
                            a.status === 'PRESENT' ? 'bg-emerald-100 text-emerald-700' :
                            a.status === 'ABSENT' ? 'bg-red-100 text-red-700' :
                            'bg-amber-100 text-amber-700'
                         }`}>
                            {a.status}
                         </div>
                      </div>
                   ))}
                 </div>
             )}
          </div>
        </div>
      )}
    </div>
  )
}

export default StudentDashboard
