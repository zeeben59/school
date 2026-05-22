import { useState, useEffect } from 'react'
import { API_BASE } from '../../lib/config'
import { 
  GraduationCap, 
  Plus, 
  Search, 
  UserPlus,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  School,
  Fingerprint,
  Calendar,
  RefreshCw,
  Edit2,
  Trash2
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import PasswordField from '../../components/ui/PasswordField'

interface Enrollment {
  academicYear: string
  class: {
    id: string
    name: string
    section: string | null
  }
}

interface StudentProfile {
  admissionNo: string
  gender: string | null
  dateOfBirth: string | null
  enrollments: Enrollment[]
}

interface Student {
  id: string
  firstName: string
  lastName: string
  email: string
  status: 'ACTIVE' | 'INACTIVE' | 'DEACTIVATED'
  createdByRole: string | null
  createdAt: string
  studentProfile: StudentProfile | null
}

interface ClassOption {
  id: string
  name: string
}

const getFriendlyErrorMessage = (data: any, fallback = 'Action failed') => {
  let errorText = data?.error || data?.message || fallback

  if (data?.errors && Array.isArray(data.errors)) {
    errorText = data.errors.map((e: any) => e.message).join('. ')
  }

  if (
    typeof errorText === 'string' &&
    (errorText.includes('Unique constraint failed') || errorText.toLowerCase().includes('email already'))
  ) {
    return 'This email is already in use. Please use another email address.'
  }

  return errorText
}

const StudentsPage = () => {
  const { token } = useAuth()
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [classes, setClasses] = useState<ClassOption[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingStudent, setEditingStudent] = useState<Student | null>(null)
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    admissionNo: '',
    gender: 'MALE',
    dateOfBirth: '',
    classId: '',
    academicYear: `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`
  })
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  useEffect(() => {
    fetchStudents()
    fetchClasses()
  }, [])

  const fetchStudents = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/students`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      
      if (res.ok) {
        if (Array.isArray(data)) {
          setStudents(data)
        } else {
          console.error('Expected array but got:', data)
          setStudents([])
        }
      } else {
        setError(data.error || 'Failed to fetch students')
      }
    } catch (err) {
      console.error('Failed to fetch:', err)
      setError('Network error. Please check your connection.')
    } finally {
      setLoading(false)
    }
  }

  const fetchClasses = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/classes`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (res.ok && Array.isArray(data)) {
        setClasses(data.map((item: any) => ({ id: item.id, name: item.name })))
      }
    } catch (err) {
      console.error('Failed to fetch classes', err)
    }
  }

  const handleOpenCreateModal = () => {
    setEditingStudent(null)
    setFormData({ 
      firstName: '', 
      lastName: '', 
      email: '', 
      password: '', 
      admissionNo: '', 
      gender: 'MALE', 
      dateOfBirth: '',
      classId: '',
      academicYear: `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`
    })
    setMessage(null)
    setIsModalOpen(true)
  }

  const handleOpenEditModal = (student: Student) => {
    setEditingStudent(student)
    setFormData({
      firstName: student.firstName,
      lastName: student.lastName,
      email: student.email,
      password: '',
      admissionNo: student.studentProfile?.admissionNo || '',
      gender: student.studentProfile?.gender || 'MALE',
      dateOfBirth: student.studentProfile?.dateOfBirth ? student.studentProfile.dateOfBirth.split('T')[0] : '',
      classId: student.studentProfile?.enrollments?.[0]?.class?.id || '',
      academicYear: student.studentProfile?.enrollments?.[0]?.academicYear || `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`
    })
    setMessage(null)
    setIsModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setMessage(null)

    const url = editingStudent 
      ? `${API_BASE}/api/students/${editingStudent.id}`
      : `${API_BASE}/api/students`
    
    const method = editingStudent ? 'PUT' : 'POST'

    const payload: any = { ...formData }
    if (editingStudent && !formData.password) {
      delete payload.password
    }

    try {
      const res = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify(payload)
      })

      const data = await res.json()
      if (res.ok) {
        setMessage({ 
          type: 'success', 
          text: editingStudent ? 'Student records updated' : 'Student enrolled successfully' 
        })
        setTimeout(() => {
          setIsModalOpen(false)
          fetchStudents()
        }, 1500)
      } else {
        setMessage({ type: 'error', text: getFriendlyErrorMessage(data) })
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Network error' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('WARNING: Are you sure you want to PERMANENTLY delete this student record? This action cannot be undone.')) return

    try {
      const res = await fetch(`${API_BASE}/api/students/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })

      if (res.ok) {
        // Instant UI update
        setStudents(prev => prev.filter(s => s.id !== id))
        setMessage({ type: 'success', text: 'Student deleted successfully' })
        setTimeout(() => setMessage(null), 3000)
      } else {
        // Safe JSON parsing for specific backend errors
        let errorMsg = 'Failed to delete student'
        try {
          const data = await res.json()
          errorMsg = data.message || data.error || errorMsg
          if (data.errorCode) {
            console.error(`Backend Error [${data.errorCode}]:`, errorMsg)
          }
        } catch (parseErr) {
          errorMsg = `Server error (${res.status})`
        }
        
        setMessage({ type: 'error', text: errorMsg })
        setTimeout(() => setMessage(null), 5000)
      }
    } catch (err: any) {
      console.error('Deletion network error:', err)
      // Only thrown when network fails entirely or CORS blocks it
      setMessage({ type: 'error', text: `Network connection failed: ${err.message || 'Unable to reach server'}` })
      setTimeout(() => setMessage(null), 5000)
    }
  }

  const safeStudents = Array.isArray(students) ? students : []
  const filteredStudents = safeStudents.filter(s => {
    const firstName = s.firstName || ''
    const lastName = s.lastName || ''
    const email = s.email || ''
    const admissionNo = s.studentProfile?.admissionNo || ''
    return `${firstName} ${lastName} ${email} ${admissionNo}`.toLowerCase().includes(search.toLowerCase())
  })

  if (error) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center text-center p-6">
        <div className="w-16 h-16 bg-red-50 dark:bg-red-500/10 rounded-2xl flex items-center justify-center text-red-600 mb-4">
          <AlertCircle size={32} />
        </div>
        <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 mb-2">Failed to load data</h2>
        <p className="text-slate-500 max-w-xs mb-6 font-medium">{error}</p>
        <button 
          onClick={fetchStudents}
          className="flex items-center gap-2 px-6 py-3 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-bold rounded-xl transition-transform hover:scale-105"
        >
          <RefreshCw size={18} />
          Retry Request
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6 relative">
      {/* Toast Notification */}
      {message && !isModalOpen && (
        <div className="fixed top-24 right-8 z-[100] animate-in fade-in slide-in-from-right-4 duration-300">
           <div className={`flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl border backdrop-blur-md ${
             message.type === 'success' 
               ? 'bg-emerald-500/90 text-white border-emerald-400' 
               : 'bg-red-500/90 text-white border-red-400'
           }`}>
              {message.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
              <p className="font-bold text-sm tracking-tight">{message.text}</p>
           </div>
        </div>
      )}

      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight italic leading-tight">Students</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium tracking-tight uppercase">Registry & Enrollment Hub</p>
        </div>
        <button 
          onClick={handleOpenCreateModal}
          className="flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-brand-200 dark:shadow-none"
        >
          <Plus size={18} />
          Enroll New Student
        </button>
      </div>

      {/* Stats & Search */}
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
        <div className="relative w-full lg:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text"
            placeholder="Search by name, email, or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-brand-500 transition-all text-sm font-medium shadow-sm"
          />
        </div>
        {!loading && (
          <div className="flex items-center gap-3 text-xs font-black text-slate-400 uppercase tracking-widest italic">
            <span>Total Enrolled: {filteredStudents.length}</span>
            <span className="w-1.5 h-1.5 bg-brand-500 rounded-full animate-pulse"></span>
            <span className="text-brand-600 dark:text-brand-400">Active: {filteredStudents.filter(p => p.status === 'ACTIVE').length}</span>
          </div>
        )}
      </div>

      {/* List View */}
      <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm transition-colors duration-500">
        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center gap-4 text-center">
            <Loader2 className="animate-spin text-brand-500" size={40} />
            <p className="text-sm font-bold text-slate-500 uppercase tracking-[0.2em] italic">Synchronizing Student Data...</p>
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="p-16 flex flex-col items-center justify-center gap-6 text-center">
            <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-3xl text-slate-300 dark:text-slate-700">
              <GraduationCap size={48} />
            </div>
            <div>
              <p className="font-black text-slate-900 dark:text-slate-100 text-lg italic">No students indexed</p>
              <p className="text-sm text-slate-500 max-w-xs mx-auto mt-2 font-medium">Begin by enrolling students into the academic registry.</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-50 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Student Identity</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Admission / Class</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Affiliation</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Status</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {filteredStudents.map((student) => (
                  <tr key={student.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-all group">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-brand-50 dark:bg-brand-500/10 flex items-center justify-center text-brand-600 font-black shadow-sm group-hover:scale-110 transition-transform duration-300">
                          {(student.firstName?.[0] || 'S').toUpperCase()}{(student.lastName?.[0] || '').toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-black text-slate-900 dark:text-slate-100 truncate italic tracking-tight">
                            {student.firstName || 'Unknown'} {student.lastName || ''}
                          </p>
                          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{student.email || 'Registry Pending'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-sm font-bold">
                       <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 italic">
                             <Fingerprint size={12} className="text-brand-500" />
                             <span>{student.studentProfile?.admissionNo || 'N/A'}</span>
                          </div>
                          <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-tighter">
                             <School size={12} />
                             <span>{student.studentProfile?.enrollments?.[0]?.class?.name || 'Classless'}</span>
                          </div>
                       </div>
                    </td>
                    <td className="px-8 py-5">
                       {student.createdByRole ? (
                         <div className="space-y-1">
                            <p className="text-[9px] font-black text-brand-600 dark:text-brand-400 uppercase tracking-widest italic">Added by {student.createdByRole.toLowerCase()}</p>
                            <div className="flex items-center gap-1 text-[9px] font-bold text-slate-400 italic">
                               <Calendar size={10} />
                               {student.createdAt ? new Date(student.createdAt).toLocaleDateString() : 'Historical'}
                            </div>
                         </div>
                       ) : (
                         <span className="text-[10px] font-bold text-slate-300 italic uppercase">System Entry</span>
                       )}
                    </td>
                    <td className="px-8 py-5">
                      <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-[0.15em] border ${
                        student.status === 'ACTIVE' 
                          ? 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20 shadow-sm shadow-emerald-100' 
                          : 'bg-red-50 text-red-600 border-red-100 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20 shadow-sm shadow-red-100'
                      }`}>
                        {student.status}
                      </span>
                    </td>
                    <td className="px-8 py-5 text-right">
                       <div className="flex items-center justify-end gap-2 text-sm font-bold">
                          <button 
                            onClick={() => handleOpenEditModal(student)}
                            className="p-2.5 text-slate-400 hover:text-brand-600 transition-all bg-slate-50 dark:bg-slate-800 rounded-xl hover:shadow-md"
                            title="Edit Student"
                          >
                             <Edit2 size={16} />
                          </button>
                          <button 
                            onClick={() => handleDelete(student.id)}
                            className="p-2.5 text-slate-400 hover:text-red-600 transition-all bg-slate-50 dark:bg-slate-800 rounded-xl hover:shadow-md"
                            title="Permanently Delete"
                          >
                             <Trash2 size={16} />
                          </button>
                       </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Overlay */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto scrollbar-hide">
          <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-md transition-opacity" onClick={() => setIsModalOpen(false)}></div>
          <div className="relative bg-white dark:bg-slate-900 w-full max-w-lg rounded-[3.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300 border border-slate-100 dark:border-slate-800">
            <div className="px-10 py-10 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
              <div className="flex items-center gap-5">
                <div className="p-4 bg-white dark:bg-slate-900 rounded-[2rem] text-brand-600 shadow-xl border border-slate-100 dark:border-slate-800">
                  {editingStudent ? <Edit2 size={26} /> : <UserPlus size={26} />}
                </div>
                <div>
                  <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight italic leading-tight">
                    {editingStudent ? 'Update Student' : 'Enroll Scholar'}
                  </h2>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1 italic">
                    {editingStudent ? 'Synchronize academic records' : 'Initial admission indexing'}
                  </p>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all transform hover:rotate-90">
                <XCircle size={32} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-10 space-y-7 max-h-[65vh] overflow-y-auto scrollbar-hide">
              {message && (
                <div className={`p-5 rounded-3xl flex items-center gap-4 text-sm font-black shadow-inner animate-in slide-in-from-top-2 ${
                  message.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                }`}>
                  {message.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
                  {message.text}
                </div>
              )}

              <div className="grid grid-cols-2 gap-7">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 italic">First Name</label>
                  <input 
                    required
                    type="text"
                    value={formData.firstName}
                    onChange={e => setFormData({...formData, firstName: e.target.value})}
                    className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl outline-none focus:ring-2 focus:ring-brand-500 font-black text-sm transition-all text-slate-900 dark:text-slate-100 shadow-inner"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 italic">Last Name</label>
                  <input 
                    required
                    type="text"
                    value={formData.lastName}
                    onChange={e => setFormData({...formData, lastName: e.target.value})}
                    className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl outline-none focus:ring-2 focus:ring-brand-500 font-black text-sm transition-all text-slate-900 dark:text-slate-100 shadow-inner"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 italic">Email Identity</label>
                <input 
                  required
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                  className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl outline-none focus:ring-2 focus:ring-brand-500 font-black text-sm transition-all text-slate-900 dark:text-slate-100 shadow-inner font-mono tracking-tighter"
                />
              </div>

              <div className="grid grid-cols-2 gap-7">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 italic leading-none">Admission No.</label>
                  <input 
                    required
                    type="text"
                    placeholder="e.g. STU/24/001"
                    value={formData.admissionNo}
                    onChange={e => setFormData({...formData, admissionNo: e.target.value})}
                    className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl outline-none focus:ring-2 focus:ring-brand-500 font-black text-sm transition-all text-slate-900 dark:text-slate-100 shadow-inner"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 italic leading-none">Gender</label>
                  <select 
                    value={formData.gender}
                    onChange={e => setFormData({...formData, gender: e.target.value})}
                    className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl outline-none focus:ring-2 focus:ring-brand-500 font-black text-sm transition-all text-slate-900 dark:text-slate-100 shadow-inner"
                  >
                    <option value="MALE">MALE</option>
                    <option value="FEMALE">FEMALE</option>
                    <option value="OTHER">OTHER</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 italic flex items-center gap-2">
                  <Calendar size={12} className="text-brand-500" /> Date of Birth
                </label>
                <input 
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={e => setFormData({...formData, dateOfBirth: e.target.value})}
                  className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl outline-none focus:ring-2 focus:ring-brand-500 font-black text-sm transition-all text-slate-900 dark:text-slate-100 shadow-inner uppercase"
                />
              </div>

              <div className="grid grid-cols-2 gap-7">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 italic leading-none">Assign Class</label>
                  <select
                    value={formData.classId}
                    onChange={e => setFormData({...formData, classId: e.target.value})}
                    className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl outline-none focus:ring-2 focus:ring-brand-500 font-black text-sm transition-all text-slate-900 dark:text-slate-100 shadow-inner"
                  >
                    <option value="">No class yet</option>
                    {classes.map((item) => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 italic leading-none">Academic Year</label>
                  <input
                    type="text"
                    value={formData.academicYear}
                    onChange={e => setFormData({...formData, academicYear: e.target.value})}
                    placeholder="2024/2025"
                    className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl outline-none focus:ring-2 focus:ring-brand-500 font-black text-sm transition-all text-slate-900 dark:text-slate-100 shadow-inner"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between px-1 mb-1">
                  {editingStudent && (
                    <span className="text-[9px] font-black text-brand-600 uppercase tracking-tighter italic">Keep empty to preserve</span>
                  )}
                </div>
                <PasswordField 
                  required={!editingStudent}
                  label="Access Key (Password)"
                  value={formData.password}
                  onChange={e => setFormData({...formData, password: e.target.value})}
                  placeholder={editingStudent ? "••••••••" : "Min. 8 characters"}
                  className="w-full"
                />
              </div>

              <div className="pt-8">
                <button 
                  disabled={submitting}
                  className="w-full bg-brand-600 hover:bg-brand-700 disabled:bg-brand-300 text-white font-black py-5 rounded-3xl shadow-2xl shadow-brand-200 dark:shadow-none transition-all flex items-center justify-center gap-3 uppercase tracking-[0.2em] text-xs hover:scale-[1.02] active:scale-95 shadow-md"
                >
                  {submitting ? <Loader2 className="animate-spin" size={24} /> : (editingStudent ? 'Sync Records' : 'Release Scholarship')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default StudentsPage
