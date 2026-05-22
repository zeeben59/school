import { useState, useEffect } from 'react'
import { API_BASE } from '../../lib/config'
import {
  Users,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Plus,
  Search,
  UserPlus
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

interface Student {
  id: string
  admissionNo: string
  gender: string | null
  dateOfBirth: string | null
  user: {
    id: string
    firstName: string
    lastName: string
    email: string
    status: string
  }
}

interface AvailableStudent {
  id: string
  admissionNo: string
  gender: string | null
  user: {
    firstName: string
    lastName: string
    email: string
  }
}

interface Enrollment {
  id: string
  classId: string
  academicYear: string
  class: { id: string, name: string }
  student: Student
}

const TeacherStudentsPage = () => {
  const { token, user } = useAuth()
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [myClasses, setMyClasses] = useState<{id: string, name: string}[]>([])
  const [selectedClassId, setSelectedClassId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [mode, setMode] = useState<'CREATE' | 'ENROLL'>('CREATE')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [availableStudents, setAvailableStudents] = useState<AvailableStudent[]>([])
  const [availableStudentSearch, setAvailableStudentSearch] = useState('')

  // Form Data
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    admissionNo: '',
    classId: '',
    studentId: '', // For ENROLL
  })

  useEffect(() => {
    if (token && user?.role === 'TEACHER') {
      fetchInitialData()
    } else {
      setLoading(false)
      setError('Access restricted to teaching faculty')
    }
  }, [token, user])

  const fetchInitialData = async () => {
    setLoading(true)
    setError(null)
    try {
      // 1. Get Teacher's Classes
      const clsRes = await fetch(`${API_BASE}/api/teacher/my-classes`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const clsData = await clsRes.json()

      if (clsRes.ok) {
        setMyClasses(clsData)
        const initialClass = clsData.length > 0 ? clsData[0].id : ''
        setSelectedClassId(initialClass)
        
        if (initialClass) {
          fetchStudents(initialClass)
        } else {
          setLoading(false)
        }
      } else {
         setError(clsData.error || 'Failed to fetch assigned classes')
         setLoading(false)
      }
    } catch (err) {
      setError('Network sync failure')
      setLoading(false)
    }
  }

  const fetchStudents = async (classId: string) => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/teacher/my-students?classId=${classId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (res.ok) {
        setEnrollments(data)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleClassChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const cid = e.target.value
    setSelectedClassId(cid)
    if (cid) fetchStudents(cid)
  }

  const openModal = (m: 'CREATE' | 'ENROLL') => {
    setMode(m)
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      admissionNo: '',
      classId: selectedClassId,
      studentId: '',
    })
    setAvailableStudentSearch('')
    setMessage(null)
    setIsModalOpen(true)
    if (m === 'ENROLL' && selectedClassId) {
      fetchAvailableStudents(selectedClassId)
    }
  }

  const fetchAvailableStudents = async (classId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/teacher/available-students?classId=${classId}&search=${encodeURIComponent(availableStudentSearch)}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (res.ok) {
        setAvailableStudents(data)
        setFormData((prev) => ({
          ...prev,
          studentId: data.length > 0 ? prev.studentId || data[0].id : ''
        }))
      } else {
        setAvailableStudents([])
        setMessage({ type: 'error', text: data.error || 'Failed to fetch available students' })
      }
    } catch (err) {
      setAvailableStudents([])
      setMessage({ type: 'error', text: 'Failed to fetch available students' })
    }
  }

  useEffect(() => {
    if (isModalOpen && mode === 'ENROLL' && formData.classId) {
      fetchAvailableStudents(formData.classId)
    }
  }, [availableStudentSearch])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setMessage(null)

    const endpoint = mode === 'CREATE' 
      ? `${API_BASE}/api/teacher/students` 
      : `${API_BASE}/api/teacher/enroll`

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify(formData)
      })

      const data = await response.json()
      if (response.ok) {
        setMessage({ type: 'success', text: data.message || 'Operation successful' })
        setTimeout(() => {
          setIsModalOpen(false)
          fetchStudents(selectedClassId)
        }, 1500)
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed' })
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Network error occurred' })
    } finally {
      setSubmitting(false)
    }
  }

  const filteredEnrollments = enrollments.filter(e => 
    `${e.student.user.firstName} ${e.student.user.lastName} ${e.student.admissionNo}`
    .toLowerCase().includes(search.toLowerCase())
  )

  if (error) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center text-center p-6">
        <div className="w-16 h-16 bg-red-50 dark:bg-red-500/10 rounded-2xl flex items-center justify-center text-red-600 mb-4">
          <AlertCircle size={32} />
        </div>
        <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 mb-2">Access Denied</h2>
        <p className="text-slate-500 max-w-xs mb-6 font-medium">{error}</p>
        <button onClick={fetchInitialData} className="px-6 py-3 bg-slate-900 text-white rounded-xl font-bold">Retry</button>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-[1400px]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight italic">My Class Roster</h1>
          <p className="text-sm text-slate-500 font-medium tracking-tight">Manage students in your assigned classes</p>
        </div>
        
        {myClasses.length > 0 && (
          <div className="flex items-center gap-3">
             <button 
                onClick={() => openModal('ENROLL')}
                className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 px-4 py-2.5 rounded-xl font-bold transition-all text-sm"
              >
                <UserPlus size={16} /> Enroll Existing
             </button>
             <button 
                onClick={() => openModal('CREATE')}
                className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-lg text-sm"
              >
                <Plus size={16} /> New Student
             </button>
          </div>
        )}
      </div>

      {myClasses.length === 0 && !loading ? (
        <div className="p-16 bg-white dark:bg-slate-900 rounded-[2.5rem] text-center border border-slate-100 dark:border-slate-800">
           <div className="p-5 bg-slate-50 dark:bg-slate-800 rounded-full w-fit mx-auto mb-4">
             <Users size={32} className="text-slate-400" />
           </div>
           <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 italic">No Class Assigned</h3>
           <p className="text-sm text-slate-500 font-medium max-w-sm mx-auto mt-2">You have not been assigned as a class teacher for any classes yet. Contact the Director or Principal.</p>
        </div>
      ) : (
        <>
          <div className="flex flex-col md:flex-row gap-4">
            <select 
              value={selectedClassId}
              onChange={handleClassChange}
              className="px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-bold text-sm w-full md:w-64 outline-none focus:ring-2 focus:ring-brand-500/20"
            >
              {myClasses.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            
            <div className="relative flex-grow">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text"
                placeholder="Search students..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-brand-500/20 text-sm font-bold"
              />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
            {loading ? (
              <div className="p-16 flex justify-center"><Loader2 className="animate-spin text-brand-600" size={32} /></div>
            ) : filteredEnrollments.length === 0 ? (
              <div className="p-16 text-center text-slate-500 font-bold italic text-sm">No students found in this class.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Student</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Admission No</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Gender</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                    {filteredEnrollments.map((e) => (
                      <tr key={e.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-bold text-slate-900 dark:text-slate-100 text-sm">{e.student.user.firstName} {e.student.user.lastName}</p>
                          <p className="text-xs text-slate-400">{e.student.user.email}</p>
                        </td>
                        <td className="px-6 py-4 text-sm font-bold text-slate-600">{e.student.admissionNo}</td>
                        <td className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">{e.student.gender || '-'}</td>
                        <td className="px-6 py-4">
                          <span className="px-2.5 py-1 bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 rounded-lg text-[10px] font-black uppercase tracking-widest">Active</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
          <div className="relative bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-8 pb-6 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 italic">
                {mode === 'CREATE' ? 'Create New Student' : 'Enroll Existing Student'}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-4">
              {message && (
                <div className={`p-4 rounded-xl flex items-center gap-3 text-sm font-bold ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                  {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                  {message.text}
                </div>
              )}

              {mode === 'CREATE' ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <input required placeholder="First Name" className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-sm font-bold outline-none border border-transparent focus:border-brand-500/30" value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} />
                    <input required placeholder="Last Name" className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-sm font-bold outline-none border border-transparent focus:border-brand-500/30" value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} />
                  </div>
                  <input required type="email" placeholder="Student Email" className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-sm font-bold outline-none border border-transparent focus:border-brand-500/30" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                  <input required placeholder="Admission Number" className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-sm font-bold outline-none border border-transparent focus:border-brand-500/30" value={formData.admissionNo} onChange={e => setFormData({...formData, admissionNo: e.target.value})} />
                </>
              ) : (
                <div className="space-y-4">
                  <input
                    type="text"
                    placeholder="Search existing students by name, email, or admission number"
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-sm font-bold outline-none border border-transparent focus:border-brand-500/30"
                    value={availableStudentSearch}
                    onChange={e => setAvailableStudentSearch(e.target.value)}
                  />
                  <select
                    required
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-sm font-bold outline-none border border-transparent focus:border-brand-500/30"
                    value={formData.studentId}
                    onChange={e => setFormData({...formData, studentId: e.target.value})}
                  >
                    <option value="">Select Existing Student</option>
                    {availableStudents.map((student) => (
                      <option key={student.id} value={student.id}>
                        {student.user.firstName} {student.user.lastName} - {student.admissionNo} - {student.user.email}
                      </option>
                    ))}
                  </select>
                  {availableStudents.length === 0 && (
                    <p className="text-xs font-medium text-slate-500">
                      No available existing students were found for this class and academic year.
                    </p>
                  )}
                </div>
              )}

              <select required className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-sm font-bold outline-none border border-transparent focus:border-brand-500/30" value={formData.classId} onChange={e => {
                const classId = e.target.value
                setFormData({...formData, classId})
                if (mode === 'ENROLL' && classId) {
                  fetchAvailableStudents(classId)
                }
              }}>
                <option value="">Select Class Configuration</option>
                {myClasses.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>

              <button disabled={submitting} className="w-full bg-brand-600 hover:bg-brand-700 text-white font-black py-4 rounded-xl shadow-lg transition-all flex justify-center disabled:opacity-50 uppercase tracking-widest text-xs mt-6">
                {submitting ? <Loader2 className="animate-spin" size={18} /> : 'Confirm Action'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default TeacherStudentsPage
