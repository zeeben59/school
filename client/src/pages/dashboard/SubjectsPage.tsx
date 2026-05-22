import { useState, useEffect } from 'react'
import { API_BASE } from '../../lib/config'
import { 
  BookOpen, 
  Plus, 
  Search, 
  User,
  Loader2,
  CheckCircle2,
  AlertCircle,
  School,
  Edit2,
  Trash2,
  Hash,
  RefreshCw,
  XCircle,
  Layers
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

interface Teacher {
  id: string
  user: {
    firstName: string
    lastName: string
  }
}

interface ClassOption {
  id: string
  name: string
}

interface Subject {
  id: string
  name: string
  code: string | null
  level: string | null
  teacherId?: string
  classId?: string
  createdByRole?: string | null
  teacher: {
    user: {
      firstName: string
      lastName: string
    }
  } | null
  class: {
    name: string
  } | null
}

const SUBJECT_LEVELS = [
  'Nursery 1', 'Nursery 2',
  'Primary 1', 'Primary 2', 'Primary 3', 'Primary 4', 'Primary 5', 'Primary 6',
  'JS1', 'JS2', 'JS3',
  'SS1', 'SS2', 'SS3'
]

const SubjectsPage = () => {
  const { token } = useAuth()
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [classes, setClasses] = useState<ClassOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    level: '',
    teacherId: '',
    classId: ''
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
      const [subjectRes, teacherRes, classRes] = await Promise.all([
        fetch(`${API_BASE}/api/subjects`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE}/api/teachers`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE}/api/classes`, { headers: { Authorization: `Bearer ${token}` } })
      ])
      
      const subjectData = await subjectRes.json()
      const teacherData = await teacherRes.json()
      const classData = await classRes.json()
      
      if (subjectRes.ok) {
        setSubjects(Array.isArray(subjectData) ? subjectData : [])
      } else {
        setError(subjectData.error || 'Failed to load subjects')
      }

      if (teacherRes.ok && Array.isArray(teacherData)) {
        setTeachers(teacherData.map((t: any) => ({
          id: t.staffProfile?.id,
          user: { firstName: t.firstName, lastName: t.lastName }
        })).filter((t: any) => t.id))
      }

      if (classRes.ok && Array.isArray(classData)) {
        setClasses(classData)
      }
      
    } catch (err) {
      console.error('Failed to fetch:', err)
      setError('Network error. Check your connection.')
    } finally {
      setLoading(false)
    }
  }

  const handleOpenCreateModal = () => {
    setEditingSubject(null)
    setFormData({ name: '', code: '', level: '', teacherId: '', classId: '' })
    setMessage(null)
    setIsModalOpen(true)
  }

  const handleOpenEditModal = (subject: Subject) => {
    setEditingSubject(subject)
    setFormData({
      name: subject.name,
      code: subject.code || '',
      level: (subject as any).level || '',
      teacherId: subject.teacherId || '',
      classId: subject.classId || ''
    })
    setMessage(null)
    setIsModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setMessage(null)

    const url = editingSubject 
      ? `${API_BASE}/api/subjects/${editingSubject.id}`
      : `${API_BASE}/api/subjects`
    
    const method = editingSubject ? 'PUT' : 'POST'

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
          text: editingSubject ? 'Subject updated successfully' : 'Subject created successfully' 
        })
        setTimeout(() => {
          setIsModalOpen(false)
          fetchInitialData()
        }, 1500)
      } else {
        // Display exact backend validation error
        let errorText = data.error || data.message || 'Action failed'
        if (data.errors && Array.isArray(data.errors)) {
          errorText = data.errors.join('. ')
        }
        setMessage({ type: 'error', text: errorText })
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: `Network connection failed: ${err.message || 'Unable to reach server'}` })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to remove this subject?')) return

    try {
      const res = await fetch(`${API_BASE}/api/subjects/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })

      if (res.ok) {
        setSubjects(prev => prev.filter(s => s.id !== id))
        setMessage({ type: 'success', text: 'Subject deleted successfully' })
        setTimeout(() => setMessage(null), 3000)
      } else {
        let errorMsg = 'Failed to delete subject'
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
      setMessage({ type: 'error', text: `Network connection failed: ${err.message || 'Unable to reach server'}` })
      setTimeout(() => setMessage(null), 5000)
    }
  }

  // Preview summary for modal
  const previewSummary = formData.name ? {
    title: formData.name,
    code: formData.code || '—',
    level: formData.level || 'All Levels',
    teacher: formData.teacherId 
      ? (() => {
          const t = teachers.find(t => t.id === formData.teacherId)
          return t ? `${t.user.firstName} ${t.user.lastName}` : 'Unknown'
        })()
      : 'Unassigned'
  } : null

  const safeSubjects = Array.isArray(subjects) ? subjects : []
  const filteredSubjects = safeSubjects.filter(s => {
    const name = s.name || ''
    const code = s.code || ''
    const level = (s as any).level || ''
    return `${name} ${code} ${level}`.toLowerCase().includes(search.toLowerCase())
  })

  if (error) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center text-center p-6">
        <div className="w-16 h-16 bg-red-50 dark:bg-red-500/10 rounded-2xl flex items-center justify-center text-red-600 mb-4">
          <AlertCircle size={32} />
        </div>
        <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 mb-2">Failed to Load Subjects</h2>
        <p className="text-slate-500 max-w-xs mb-6 font-medium">{error}</p>
        <button 
          onClick={fetchInitialData}
          className="flex items-center gap-2 px-6 py-3 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-bold rounded-xl transition-transform hover:scale-105"
        >
          <RefreshCw size={18} />
          Retry
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
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight italic leading-tight">Subjects</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium tracking-tight uppercase">Academic Subjects & Teacher Assignments</p>
        </div>
        <button 
          onClick={handleOpenCreateModal}
          className="flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-brand-200 dark:shadow-none"
        >
          <Plus size={18} />
          Add Subject
        </button>
      </div>

      {/* Search */}
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
        <div className="relative w-full lg:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text"
            placeholder="Search by name, code, or level..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-brand-500 transition-all text-sm font-medium shadow-sm"
          />
        </div>
        {!loading && (
          <div className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest italic leading-none">
            <span>Total Subjects: {filteredSubjects.length}</span>
          </div>
        )}
      </div>

      {/* List View */}
      <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm transition-colors duration-500">
        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center gap-4 text-center">
            <Loader2 className="animate-spin text-brand-500" size={36} />
            <p className="text-sm font-bold text-slate-500 uppercase tracking-[0.2em] italic leading-none">Loading subjects...</p>
          </div>
        ) : filteredSubjects.length === 0 ? (
          <div className="p-16 flex flex-col items-center justify-center gap-6 text-center">
            <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-3xl text-slate-300 dark:text-slate-700 shadow-inner">
              <BookOpen size={48} />
            </div>
            <div>
              <p className="font-black text-slate-900 dark:text-slate-100 italic">No subjects found</p>
              <p className="text-sm text-slate-500 max-w-xs mx-auto mt-2 font-medium">Add subjects and assign them to teachers and class levels.</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-50 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Subject Title</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Code</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Level</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Class</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Assigned Teacher</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {filteredSubjects.map((subject) => (
                  <tr key={subject.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-all group">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-2xl bg-brand-50 dark:bg-brand-500/10 flex items-center justify-center text-brand-600 transition-all group-hover:scale-110 shadow-sm border border-brand-100 dark:border-brand-500/20">
                          <BookOpen size={18} />
                        </div>
                        <span className="font-black text-slate-900 dark:text-slate-100 italic tracking-tight group-hover:text-brand-600 transition-colors text-sm">
                           {subject.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-2">
                        <Hash size={12} className="text-slate-300" />
                        <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.15em] italic">
                           {subject.code || '—'}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-2">
                        <Layers size={12} className="text-slate-300" />
                        <span className="text-xs font-black text-slate-600 dark:text-slate-400 italic">
                           {(subject as any).level || '—'}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-2">
                        <School size={14} className="text-slate-300" />
                        <span className="text-xs font-black text-slate-600 dark:text-slate-400 italic">
                           {subject.class?.name || '—'}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-2">
                        <User size={14} className="text-slate-300" />
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-400 truncate tracking-tight">
                          {subject.teacher?.user 
                            ? `${subject.teacher.user.firstName || ''} ${subject.teacher.user.lastName || ''}`.trim() || 'Staff'
                            : <span className="text-red-400/80 font-black tracking-widest text-[9px]">UNASSIGNED</span>}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                        <button 
                          onClick={() => handleOpenEditModal(subject)}
                          className="p-2.5 text-slate-400 hover:text-brand-600 transition-all bg-slate-50 dark:bg-slate-800 rounded-xl hover:shadow-md"
                          title="Edit Subject"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => handleDelete(subject.id)} 
                          className="p-2.5 text-slate-400 hover:text-red-600 transition-all bg-slate-50 dark:bg-slate-800 rounded-xl hover:shadow-md"
                          title="Delete Subject"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md transition-opacity" onClick={() => setIsModalOpen(false)}></div>
          <div className="relative bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300 border border-slate-100 dark:border-slate-800 transition-colors max-h-[90vh] overflow-y-auto">
            <div className="px-10 py-8 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50 sticky top-0 z-10">
              <div className="flex items-center gap-5">
                <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl text-brand-600 shadow-xl border border-slate-100 dark:border-slate-800">
                  {editingSubject ? <Edit2 size={26} /> : <BookOpen size={26} />}
                </div>
                <div>
                   <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight italic leading-tight">
                    {editingSubject ? 'Edit Subject' : 'Add Subject'}
                   </h2>
                   <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1 leading-none italic">
                    {editingSubject ? 'Update subject details' : 'Create a new academic subject'}
                   </p>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all">
                 <XCircle size={32} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-10 space-y-6">
              {message && (
                <div className={`p-5 rounded-2xl flex items-center gap-4 text-sm font-black shadow-inner ${
                  message.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400'
                }`}>
                  {message.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
                  {message.text}
                </div>
              )}

              {/* Subject Title */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 italic">Subject Title</label>
                <input 
                  required
                  type="text"
                  placeholder="e.g. English Language, Mathematics, Biology"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl outline-none focus:ring-2 focus:ring-brand-500 font-bold text-sm transition-all text-slate-900 dark:text-slate-100 shadow-inner"
                />
              </div>

              {/* Subject Code */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 italic leading-none">Subject Code</label>
                <input 
                  type="text"
                  placeholder="e.g. ENG, MTH, BIO, CIV"
                  value={formData.code}
                  onChange={e => setFormData({...formData, code: e.target.value.toUpperCase()})}
                  className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl outline-none focus:ring-2 focus:ring-brand-500 font-black text-sm transition-all text-slate-900 dark:text-slate-100 shadow-inner uppercase font-mono tracking-wider"
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                {/* Subject Level */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 italic leading-none">Subject Level</label>
                  <select 
                    value={formData.level}
                    onChange={e => setFormData({...formData, level: e.target.value})}
                    className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl outline-none focus:ring-2 focus:ring-brand-500 font-bold text-sm transition-all text-slate-900 dark:text-slate-100 shadow-inner"
                  >
                    <option value="">All Levels</option>
                    {SUBJECT_LEVELS.map(lvl => (
                      <option key={lvl} value={lvl}>{lvl}</option>
                    ))}
                  </select>
                </div>

                {/* Assigned Class */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 italic leading-none">Assign to Class</label>
                  <select 
                    value={formData.classId}
                    onChange={e => setFormData({...formData, classId: e.target.value})}
                    className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl outline-none focus:ring-2 focus:ring-brand-500 font-bold text-sm transition-all text-slate-900 dark:text-slate-100 shadow-inner"
                  >
                    <option value="">No Specific Class</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Assigned Teacher */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 italic leading-none">Assigned Teacher</label>
                <select 
                  value={formData.teacherId}
                  onChange={e => setFormData({...formData, teacherId: e.target.value})}
                  className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl outline-none focus:ring-2 focus:ring-brand-500 font-bold text-sm transition-all text-slate-900 dark:text-slate-100 shadow-inner"
                >
                  <option value="">Unassigned</option>
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>{t.user.firstName} {t.user.lastName}</option>
                  ))}
                </select>
              </div>

              {/* Preview Summary */}
              {previewSummary && (
                <div className="p-5 bg-brand-50/30 dark:bg-brand-500/5 rounded-3xl border border-brand-100/50 dark:border-brand-500/10 shadow-inner space-y-2">
                  <p className="text-[9px] font-black text-brand-600 uppercase tracking-[0.2em] italic mb-3">Subject Preview</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-[9px] font-bold text-slate-400 uppercase">Title</p>
                      <p className="text-sm font-black text-slate-900 dark:text-slate-100 italic">{previewSummary.title}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-slate-400 uppercase">Code</p>
                      <p className="text-sm font-black text-slate-900 dark:text-slate-100 font-mono">{previewSummary.code}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-slate-400 uppercase">Level</p>
                      <p className="text-sm font-black text-slate-900 dark:text-slate-100 italic">{previewSummary.level}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-slate-400 uppercase">Teacher</p>
                      <p className="text-sm font-black text-slate-900 dark:text-slate-100 italic">{previewSummary.teacher}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-4">
                <button 
                  disabled={submitting}
                  className="w-full bg-brand-600 hover:bg-brand-700 disabled:bg-brand-300 text-white font-black py-5 rounded-3xl shadow-2xl shadow-brand-200 dark:shadow-none transition-all flex items-center justify-center gap-3 uppercase tracking-[0.2em] text-xs hover:scale-[1.02] active:scale-95"
                >
                  {submitting ? <Loader2 className="animate-spin" size={24} /> : (editingSubject ? 'Update Subject' : 'Create Subject')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default SubjectsPage
