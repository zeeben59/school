import { useState, useEffect } from 'react'
import { API_BASE } from '../../lib/config'
import { 
  School, 
  Plus, 
  Search, 
  Users,
  Loader2,
  CheckCircle2,
  AlertCircle,
  User,
  Layers,
  Edit2,
  Trash2,
  RefreshCw,
  XCircle,
  LayoutGrid
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

interface Teacher {
  id: string
  user: {
    firstName: string
    lastName: string
  }
}

interface Class {
  id: string
  name: string
  level: string
  arm: string
  classTeacherId?: string
  createdByRole: string | null
  classTeacher: {
    user: {
      firstName: string
      lastName: string
    }
  } | null
  _count: {
    enrollments: number
  }
}

const CLASS_LEVELS = [
  'JS1', 'JS2', 'JS3',
  'SS1', 'SS2', 'SS3'
]

const ClassesPage = () => {
  const { token } = useAuth()
  const [classes, setClasses] = useState<Class[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingClass, setEditingClass] = useState<Class | null>(null)
  const [formData, setFormData] = useState({
    level: '',
    arm: '',
    classTeacherId: ''
  })
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  useEffect(() => {
    fetchInitialData()
  }, [])

  const fetchInitialData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [classRes, teacherRes] = await Promise.all([
        fetch(`${API_BASE}/api/classes`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE}/api/teachers`, { headers: { Authorization: `Bearer ${token}` } })
      ])
      
      const classData = await classRes.json()
      const teacherData = await teacherRes.json()
      
      if (classRes.ok) {
        setClasses(Array.isArray(classData) ? classData : [])
      } else {
        setError(classData.error || 'Failed to load classes')
      }

      if (teacherRes.ok && Array.isArray(teacherData)) {
        setTeachers(teacherData.map((t: any) => ({
          id: t.staffProfile?.id,
          user: { firstName: t.firstName, lastName: t.lastName }
        })).filter((t: any) => t.id))
      }
      
    } catch (err) {
      console.error('Failed to fetch:', err)
      setError('Network error. Unable to load academic settings.')
    } finally {
      setLoading(false)
    }
  }

  const handleOpenCreateModal = () => {
    setEditingClass(null)
    setFormData({ level: '', arm: '', classTeacherId: '' })
    setMessage(null)
    setIsModalOpen(true)
  }

  const handleOpenEditModal = (cls: Class) => {
    setEditingClass(cls)
    setFormData({
      level: cls.level,
      arm: cls.arm,
      classTeacherId: cls.classTeacherId || ''
    })
    setMessage(null)
    setIsModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setMessage(null)

    const url = editingClass 
      ? `${API_BASE}/api/classes/${editingClass.id}`
      : `${API_BASE}/api/classes`
    
    const method = editingClass ? 'PUT' : 'POST'

    try {
      const res = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify(formData)
      })

      const data = await res.json()
      if (res.ok) {
        setMessage({ 
          type: 'success', 
          text: editingClass ? 'Class updated successfully' : 'Class created successfully' 
        })
        setTimeout(() => {
          setIsModalOpen(false)
          fetchInitialData()
        }, 1500)
      } else {
        let errorText = data.error || data.message || 'Action failed'
        if (data.errors && Array.isArray(data.errors)) {
          errorText = data.errors.map((e: any) => e.message).join('. ')
        }
        setMessage({ type: 'error', text: errorText })
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Network error' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to PERMANENTLY remove this class? All associated enrollments and subjects will be purged.')) return

    try {
      const res = await fetch(`${API_BASE}/api/classes/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })

      // Check if the response is actually a success
      if (res.ok) {
        // Instant UI update
        setClasses(prev => prev.filter(c => c.id !== id))
        setMessage({ type: 'success', text: 'Class deleted successfully' })
        setTimeout(() => setMessage(null), 3000)
      } else {
        // Safe JSON parsing for specific backend errors
        let errorMsg = 'Failed to delete class'
        try {
          const data = await res.json()
          errorMsg = data.message || data.error || errorMsg
          if (data.errorCode) {
            console.error(`Backend Error [${data.errorCode}]:`, errorMsg)
          }
        } catch (jsonErr) {
          // Response wasn't JSON (e.g., server crash or 404)
          errorMsg = `Server error (${res.status})`
        }
        
        setMessage({ type: 'error', text: errorMsg })
        setTimeout(() => setMessage(null), 5000)
      }
    } catch (err: any) {
      console.error('Delete network/parsing error:', err)
      // Only thrown when network fails entirely or CORS blocks it
      setMessage({ type: 'error', text: `Network connection failed: ${err.message || 'Unable to reach server'}` })
      setTimeout(() => setMessage(null), 5000)
    }
  }

  const previewFullName = formData.level && formData.arm 
    ? (formData.arm.length === 1 ? `${formData.level}${formData.arm}` : `${formData.level} ${formData.arm}`)
    : ''

  const safeClasses = Array.isArray(classes) ? classes : []
  const filteredClasses = safeClasses.filter(c => {
    const name = c.name || ''
    const level = c.level || ''
    const arm = c.arm || ''
    return `${name} ${level} ${arm}`.toLowerCase().includes(search.toLowerCase())
  })

  if (error) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center text-center p-6">
        <div className="w-16 h-16 bg-red-50 dark:bg-red-500/10 rounded-2xl flex items-center justify-center text-red-600 mb-4">
          <AlertCircle size={32} />
        </div>
        <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 mb-2">Academic Sync Failed</h2>
        <p className="text-slate-500 max-w-xs mb-6 font-medium">{error}</p>
        <button 
          onClick={fetchInitialData}
          className="flex items-center gap-2 px-6 py-3 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-bold rounded-xl transition-transform hover:scale-105"
        >
          <RefreshCw size={18} />
          Retry Sync
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

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight italic">Classes</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium tracking-tight uppercase">Academic Structure & Arms</p>
        </div>
        <button 
          onClick={handleOpenCreateModal}
          className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-emerald-200 dark:shadow-none"
        >
          <Plus size={18} />
          Initiate New Class
        </button>
      </div>

      {/* Search & Total */}
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
        <div className="relative w-full lg:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text"
            placeholder="Search by level, arm, or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm font-medium shadow-sm"
          />
        </div>
        {!loading && (
          <div className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-[0.2em] italic">
            <LayoutGrid size={14} />
            <span>Active Classes: {filteredClasses.length}</span>
          </div>
        )}
      </div>

      {/* List View */}
      {loading ? (
        <div className="p-12 flex flex-col items-center justify-center gap-3">
          <Loader2 className="animate-spin text-emerald-500" size={32} />
          <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Hydrating academic structure...</p>
        </div>
      ) : filteredClasses.length === 0 ? (
        <div className="p-12 flex flex-col items-center justify-center gap-4 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
          <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl text-slate-400">
            <Layers size={40} />
          </div>
          <div>
            <p className="font-bold text-slate-900 dark:text-slate-100 italic">No classes cataloged</p>
            <p className="text-sm text-slate-500 max-w-xs">Define your school's class levels and arms to begin student enrollment.</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredClasses.map((item) => (
            <div key={item.id} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-2xl hover:-translate-y-1.5 transition-all group overflow-hidden">
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl text-emerald-600 group-hover:scale-110 transition-transform shadow-sm">
                    <School size={28} />
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                    <button 
                      onClick={() => handleOpenEditModal(item)}
                      className="p-2 text-slate-400 hover:text-emerald-600 transition-all bg-slate-50 dark:bg-slate-800 rounded-xl hover:shadow-md"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button 
                      onClick={() => handleDelete(item.id)}
                      className="p-2 text-slate-400 hover:text-red-600 transition-all bg-slate-50 dark:bg-slate-800 rounded-xl hover:shadow-md"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                
                <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 group-hover:text-emerald-600 transition-all italic tracking-tight">{item.name}</h3>
                
                <div className="mt-4 space-y-2">
                   <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
                      <span className="text-slate-400">Level:</span>
                      <span className="text-slate-900 dark:text-slate-100">{item.level}</span>
                   </div>
                   <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
                      <span className="text-slate-400">Arm:</span>
                      <span className="text-slate-900 dark:text-slate-100">{item.arm}</span>
                   </div>
                </div>

                <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 border border-slate-100 dark:border-slate-700">
                       <User size={16} />
                    </div>
                    <div className="min-w-0">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Class Teacher</p>
                       <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate italic">
                          {item.classTeacher?.user 
                            ? `${item.classTeacher.user.firstName || ''} ${item.classTeacher.user.lastName || ''}`.trim() || 'Staff'
                            : 'Unassigned'}
                       </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                     <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-100 dark:border-emerald-500/10">
                        <Users size={12} className="text-emerald-600" />
                        <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-tight">{item._count?.enrollments || 0} Students</span>
                     </div>
                     {item.createdByRole && (
                        <p className="text-[9px] font-black text-slate-300 uppercase italic">Added by {item.createdByRole.toLowerCase()}</p>
                     )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Overlay */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
          <div className="relative bg-white dark:bg-slate-900 w-full max-w-lg rounded-[3rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-slate-100 dark:border-slate-800">
            <div className="px-8 py-8 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white dark:bg-slate-900 rounded-2xl text-emerald-600 shadow-sm border border-slate-100 dark:border-slate-800">
                  {editingClass ? <Edit2 size={24} /> : <School size={24} />}
                </div>
                <div>
                   <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight italic leading-tight">
                    {editingClass ? 'Modify Class' : 'Initiate Class'}
                   </h2>
                   <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] leading-none mt-1">
                    {editingClass ? 'Update academic unit credentials' : 'New academic cluster registration'}
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
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] ml-1 italic leading-none">Class Level</label>
                  <select 
                    required
                    value={formData.level}
                    onChange={e => setFormData({...formData, level: e.target.value})}
                    className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-sm transition-all text-slate-900 dark:text-slate-100 shadow-sm"
                  >
                    <option value="">Select Level</option>
                    {CLASS_LEVELS.map(lvl => (
                      <option key={lvl} value={lvl}>{lvl}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] ml-1 italic leading-none">Class Arm</label>
                  <input 
                    required
                    type="text"
                    placeholder="e.g. A, Gold..."
                    value={formData.arm}
                    onChange={e => setFormData({...formData, arm: e.target.value})}
                    className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-sm transition-all text-slate-900 dark:text-slate-100 shadow-sm"
                  />
                </div>
              </div>

              {previewFullName && (
                <div className="p-5 bg-emerald-50/30 dark:bg-emerald-500/5 rounded-3xl border border-emerald-100/50 dark:border-emerald-500/10 shadow-inner">
                   <p className="text-[9px] font-black text-emerald-600 uppercase tracking-[0.2em] mb-1 italic">Generated Identity</p>
                   <p className="text-2xl font-black text-slate-900 dark:text-slate-100 italic tracking-tight">{previewFullName}</p>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] ml-1 italic leading-none">Class Teacher (Assignee)</label>
                <select 
                  required
                  value={formData.classTeacherId}
                  onChange={e => setFormData({...formData, classTeacherId: e.target.value})}
                  className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-sm transition-all text-slate-900 dark:text-slate-100 shadow-sm"
                >
                  <option value="">Select Staff Member</option>
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>{t.user.firstName} {t.user.lastName}</option>
                  ))}
                </select>
              </div>

              <div className="pt-6">
                <button 
                  disabled={submitting}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white font-black py-4 rounded-2xl shadow-xl shadow-emerald-200 dark:shadow-none transition-all flex items-center justify-center gap-3 uppercase tracking-[0.2em] text-xs hover:scale-[1.02] active:scale-95 shadow-md"
                >
                  {submitting ? <Loader2 className="animate-spin" size={20} /> : (editingClass ? 'Sync Unit Data' : 'Deploy Academic Unit')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default ClassesPage
