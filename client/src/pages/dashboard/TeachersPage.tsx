import { useState, useEffect } from 'react'
import { API_BASE } from '../../lib/config'
import { 
  Users, 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  UserPlus,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  BookOpen,
  RefreshCw
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import PasswordField from '../../components/ui/PasswordField'

interface StaffProfile {
  designation: string | null
  specialization: string | null
}

interface Teacher {
  id: string
  firstName: string
  lastName: string
  email: string
  status: 'ACTIVE' | 'INACTIVE' | 'DEACTIVATED'
  createdByRole: string | null
  createdAt: string
  staffProfile: StaffProfile | null
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

const TeachersPage = () => {
  const { token } = useAuth()
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null)
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    designation: '',
    specialization: ''
  })
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  useEffect(() => {
    fetchTeachers()
  }, [])

  const fetchTeachers = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/teachers`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      
      if (res.ok) {
        if (Array.isArray(data)) {
          setTeachers(data)
        } else {
          console.error('Expected array but got:', data)
          setTeachers([])
        }
      } else {
        setError(data.error || 'Failed to fetch teachers')
      }
    } catch (err) {
      console.error('Failed to fetch:', err)
      setError('Network error. Please check your connection.')
    } finally {
      setLoading(false)
    }
  }

  const handleOpenCreateModal = () => {
    setEditingTeacher(null)
    setFormData({ 
      firstName: '', 
      lastName: '', 
      email: '', 
      password: '', 
      designation: '', 
      specialization: '' 
    })
    setMessage(null)
    setIsModalOpen(true)
  }

  const handleOpenEditModal = (teacher: Teacher) => {
    setEditingTeacher(teacher)
    setFormData({
      firstName: teacher.firstName,
      lastName: teacher.lastName,
      email: teacher.email,
      password: '',
      designation: teacher.staffProfile?.designation || '',
      specialization: teacher.staffProfile?.specialization || ''
    })
    setMessage(null)
    setIsModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setMessage(null)

    const url = editingTeacher 
      ? `${API_BASE}/api/teachers/${editingTeacher.id}`
      : `${API_BASE}/api/teachers`
    
    const method = editingTeacher ? 'PUT' : 'POST'

    const payload: any = { ...formData }
    if (editingTeacher && !formData.password) {
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
          text: editingTeacher ? 'Teacher profile updated' : 'Teacher registered successfully' 
        })
        setTimeout(() => {
          setIsModalOpen(false)
          fetchTeachers()
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
    if (!confirm('WARNING: Are you sure you want to PERMANENTLY delete this teacher account? This action cannot be undone.')) return

    try {
      const res = await fetch(`${API_BASE}/api/teachers/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })

      if (res.ok) {
        // Instant UI update
        setTeachers(prev => prev.filter(t => t.id !== id))
        setMessage({ type: 'success', text: 'Teacher deleted successfully' })
        setTimeout(() => setMessage(null), 3000)
      } else {
        // Safe JSON parsing for specific backend errors
        let errorMsg = 'Failed to delete teacher'
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

  const safeTeachers = Array.isArray(teachers) ? teachers : []
  const filteredTeachers = safeTeachers.filter(t => {
    const firstName = t.firstName || ''
    const lastName = t.lastName || ''
    const email = t.email || ''
    const specialization = t.staffProfile?.specialization || ''
    return `${firstName} ${lastName} ${email} ${specialization}`.toLowerCase().includes(search.toLowerCase())
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
          onClick={fetchTeachers}
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
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight italic">Teachers</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium tracking-tight uppercase">Faculty & Staff Management</p>
        </div>
        <button 
          onClick={handleOpenCreateModal}
          className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-emerald-200 dark:shadow-none"
        >
          <Plus size={18} />
          Add Faculty Member
        </button>
      </div>

      {/* Stats & Search */}
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
        <div className="relative w-full lg:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text"
            placeholder="Search by name, email, or subject..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm font-medium shadow-sm"
          />
        </div>
        {!loading && (
          <div className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest">
            <span>Total: {filteredTeachers.length}</span>
            <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
            <span className="text-emerald-600">Active: {filteredTeachers.filter(p => p.status === 'ACTIVE').length}</span>
          </div>
        )}
      </div>

      {/* List View */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3">
            <Loader2 className="animate-spin text-emerald-500" size={32} />
            <p className="text-sm font-bold text-slate-500 uppercase tracking-widest italic">Syncing staff records...</p>
          </div>
        ) : filteredTeachers.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center gap-4 text-center">
            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl text-slate-400">
              <Users size={40} />
            </div>
            <div>
              <p className="font-bold text-slate-900 dark:text-slate-100 italic">No faculty members found</p>
              <p className="text-sm text-slate-500 max-w-xs">Start building your academic team by adding your first teacher.</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-50 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Staff Member</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Email</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Specialization</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Status</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {filteredTeachers.map((teacher) => (
                  <tr key={teacher.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-600 font-black shadow-sm group-hover:scale-110 transition-transform">
                          {(teacher.firstName?.[0] || 'T').toUpperCase()}{(teacher.lastName?.[0] || '').toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 dark:text-slate-100 truncate italic tracking-tighter">
                            {teacher.firstName || 'Unknown'} {teacher.lastName || ''}
                          </p>
                          <p className="text-[10px] text-slate-400 font-black uppercase tracking-tight">{teacher.staffProfile?.designation || 'Staff Member'}</p>
                          {teacher.createdByRole && (
                            <p className="text-[9px] text-emerald-600 dark:text-emerald-400 font-black mt-0.5 uppercase tracking-tighter italic">Added by {teacher.createdByRole.toLowerCase()}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-slate-600 dark:text-slate-400 italic">{teacher.email}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <BookOpen size={14} className="text-slate-300" />
                        <span className="text-[10px] text-slate-600 dark:text-slate-400 font-black uppercase tracking-tight">
                          {teacher.staffProfile?.specialization || 'General'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-[0.15em] ${
                        teacher.status === 'ACTIVE' 
                          ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/20 shadow-sm' 
                          : 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400 border border-red-100 dark:border-red-500/20 shadow-sm'
                      }`}>
                        {teacher.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => handleOpenEditModal(teacher)}
                          className="p-2 text-slate-400 hover:text-emerald-600 transition-all bg-slate-50 dark:bg-slate-800 rounded-xl hover:shadow-md" 
                          title="Edit"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => handleDelete(teacher.id)}
                          className="p-2 text-slate-400 hover:text-red-600 transition-all bg-slate-50 dark:bg-slate-800 rounded-xl hover:shadow-md" 
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
          <div className="relative bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-slate-100 dark:border-slate-800">
            <div className="px-8 py-8 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white dark:bg-slate-900 rounded-2xl text-emerald-600 shadow-sm border border-slate-100 dark:border-slate-800">
                  {editingTeacher ? <Edit2 size={24} /> : <UserPlus size={24} />}
                </div>
                <div>
                  <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight italic">
                    {editingTeacher ? 'Update Profile' : 'Initiate Teacher'}
                  </h2>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1 leading-none">
                    {editingTeacher ? 'Modify credentials & role' : 'New academic faculty registration'}
                  </p>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
                <XCircle size={28} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              {message && (
                <div className={`p-4 rounded-2xl flex items-center gap-3 text-sm font-bold shadow-sm ${
                  message.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                }`}>
                  {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                  {message.text}
                </div>
              )}

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 italic leading-none">First Name</label>
                  <input 
                    required
                    type="text"
                    value={formData.firstName}
                    onChange={e => setFormData({...formData, firstName: e.target.value})}
                    className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-sm transition-all text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 italic leading-none">Last Name</label>
                  <input 
                    required
                    type="text"
                    value={formData.lastName}
                    onChange={e => setFormData({...formData, lastName: e.target.value})}
                    className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-sm transition-all text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 italic leading-none">Email Address</label>
                <input 
                  required
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                  className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-sm transition-all text-slate-900 dark:text-slate-100 shadow-sm font-mono text-[13px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 italic leading-none">Designation</label>
                  <input 
                    type="text"
                    placeholder="e.g. Senior Teacher"
                    value={formData.designation}
                    onChange={e => setFormData({...formData, designation: e.target.value})}
                    className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-sm transition-all text-slate-900 dark:text-slate-100 shadow-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 italic leading-none">Specialization</label>
                  <input 
                    type="text"
                    placeholder="e.g. Mathematics"
                    value={formData.specialization}
                    onChange={e => setFormData({...formData, specialization: e.target.value})}
                    className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-sm transition-all text-slate-900 dark:text-slate-100 shadow-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between px-1 mb-1">
                  {editingTeacher && (
                    <span className="text-[9px] font-black text-emerald-600 uppercase tracking-tighter italic">Keep empty to preserve</span>
                  )}
                </div>
                <PasswordField 
                  required={!editingTeacher}
                  label="Access Password"
                  value={formData.password}
                  onChange={e => setFormData({...formData, password: e.target.value})}
                  placeholder={editingTeacher ? "••••••••" : "Min. 8 characters"}
                  className="w-full"
                />
              </div>

              <div className="pt-6">
                <button 
                  disabled={submitting}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white font-black py-4 rounded-2xl shadow-xl shadow-emerald-200 dark:shadow-none transition-all flex items-center justify-center gap-3 uppercase tracking-[0.2em] text-xs hover:scale-[1.02] active:scale-95 shadow-md"
                >
                  {submitting ? <Loader2 className="animate-spin" size={20} /> : (editingTeacher ? 'Sync Faculty Data' : 'Deploy Teacher')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default TeachersPage
