import { useState, useEffect } from 'react'
import { API_BASE } from '../../lib/config'
import { 
  Megaphone, 
  Plus, 
  Loader2,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Send,
  RefreshCw
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

interface Notice {
  id: string
  title: string
  content: string
  target: 'ALL' | 'PRINCIPAL' | 'TEACHER' | 'STUDENT'
  createdAt: string
  author: {
    firstName: string
    lastName: string
    role: string
  }
}

const NoticesPage = () => {
  const { token, user } = useAuth()
  const [notices, setNotices] = useState<Notice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    target: 'ALL' as const
  })
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const canManageNotices = user?.role === 'DIRECTOR' || user?.role === 'PRINCIPAL'

  useEffect(() => {
    fetchNotices()
  }, [])

  const fetchNotices = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/notices`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      
      if (res.ok) {
        setNotices(Array.isArray(data) ? data : [])
      } else {
        setError(data.error || 'Failed to sync bulletin board')
      }
    } catch (err) {
      console.error('Fetch error:', err)
      setError('Network synchronization failure. Notices server unreachable.')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setMessage(null)

    try {
      const res = await fetch(`${API_BASE}/api/notices`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify(formData)
      })

      const data = await res.json()
      if (res.ok) {
        setMessage({ type: 'success', text: 'Announcement published' })
        setFormData({ title: '', content: '', target: 'ALL' })
        setTimeout(() => setIsModalOpen(false), 1500)
        fetchNotices()
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to publish' })
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Network error' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this announcement?')) return

    try {
      const res = await fetch(`${API_BASE}/api/notices/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })

      if (res.ok) fetchNotices()
    } catch (err) {
      console.error('Delete error:', err)
    }
  }

  const safeNotices = Array.isArray(notices) ? notices : []

  if (error) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center text-center p-6">
        <div className="w-16 h-16 bg-red-50 dark:bg-red-500/10 rounded-2xl flex items-center justify-center text-red-600 mb-4">
          <AlertCircle size={32} />
        </div>
        <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 mb-2">Notice Sync Failed</h2>
        <p className="text-slate-500 max-w-xs mb-6 font-medium">{error}</p>
        <button 
          onClick={fetchNotices}
          className="flex items-center gap-2 px-6 py-3 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-bold rounded-xl transition-transform hover:scale-105"
        >
          <RefreshCw size={18} />
          Retry Connection
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight italic">Notices & Announcements</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium tracking-tight">Broadcast important news to your school community</p>
        </div>
        {canManageNotices && (
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-brand-200 dark:shadow-none"
          >
            <Plus size={18} />
            New Announcement
          </button>
        )}
      </div>

      {/* Notices Feed */}
      <div className="space-y-4 max-w-4xl">
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800">
            <Loader2 className="animate-spin text-brand-500" size={32} />
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest italic">Polling broadcast frequency...</p>
          </div>
        ) : safeNotices.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center gap-4 text-center bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm">
            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-full text-slate-400">
              <Megaphone size={40} />
            </div>
            <div>
              <p className="font-bold text-slate-900 dark:text-slate-100 italic">Static Interference</p>
              <p className="text-sm text-slate-500 italic">But sharing news is better! Post your first announcement.</p>
            </div>
          </div>
        ) : (
          safeNotices.map((notice) => (
            <div key={notice.id} className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all relative group overflow-hidden">
              {/* Accent line based on target */}
              <div className={`absolute top-0 left-0 w-2 h-full ${
                notice.target === 'ALL' ? 'bg-brand-500' :
                notice.target === 'TEACHER' ? 'bg-emerald-500' :
                notice.target === 'PRINCIPAL' ? 'bg-amber-500' : 'bg-blue-500'
              }`} />

              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-brand-600 font-black border border-slate-100 dark:border-slate-700">
                     {notice.author?.firstName?.[0] || 'U'}
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-900 dark:text-slate-100 italic">
                      {notice.author?.firstName || 'Unknown'} {notice.author?.lastName || ''}
                    </p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] leading-none">
                      {notice.author?.role} • {new Date(notice.createdAt).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-[0.2em] ${
                    notice.target === 'ALL' ? 'bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400' :
                    notice.target === 'TEACHER' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' :
                    notice.target === 'PRINCIPAL' ? 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400' : 
                    'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400'
                  }`}>
                    {notice.target}
                  </span>
                  {canManageNotices && (
                    <button 
                      onClick={() => handleDelete(notice.id)}
                      className="p-1.5 text-slate-300 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>

              <h3 className="text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight mb-2 italic group-hover:text-brand-600 transition-colors uppercase">{notice.title}</h3>
              <div className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-medium whitespace-pre-wrap italic">
                {notice.content}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal Overlay */}
      {isModalOpen && canManageNotices && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
          <div className="relative bg-white dark:bg-slate-900 w-full max-w-xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-slate-100 dark:border-slate-800">
            <div className="px-8 py-8 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between bg-slate-50/30 dark:bg-slate-800/20">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-brand-50 dark:bg-brand-500/10 rounded-2xl text-brand-600 border border-brand-100 dark:border-brand-500/20">
                  <Megaphone size={28} />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight italic uppercase">Publish Announcement</h2>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">Publish notice to your school community</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleCreate} className="p-8 space-y-6">
              {message && (
                <div className={`p-4 rounded-2xl flex items-center gap-3 text-sm font-bold animate-in slide-in-from-top-2 duration-300 ${
                  message.type === 'success' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400'
                }`}>
                  {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                  {message.text}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Notice Title</label>
                <input 
                  required
                  type="text"
                  placeholder="e.g. Sports Meeting, PTA Announcement"
                  value={formData.title}
                  onChange={e => setFormData({...formData, title: e.target.value})}
                  className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border border-transparent focus:border-brand-500/30 rounded-2xl outline-none focus:ring-4 focus:ring-brand-500/5 font-bold text-lg text-slate-900 dark:text-slate-100 italic transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Target Audience</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {['ALL', 'PRINCIPAL', 'TEACHER', 'STUDENT'].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setFormData({...formData, target: t as any})}
                      className={`px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-[0.15em] border-2 transition-all ${
                        formData.target === t 
                          ? 'bg-brand-600 border-brand-600 text-white shadow-xl shadow-brand-500/20' 
                          : 'border-slate-100 dark:border-slate-800 text-slate-400 hover:border-brand-200 dark:hover:border-slate-700'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Notice Content</label>
                <textarea 
                  required
                  value={formData.content}
                  onChange={e => setFormData({...formData, content: e.target.value})}
                  placeholder="Describe the update in detail..."
                  className="w-full px-6 py-5 bg-slate-50 dark:bg-slate-800/50 border border-transparent focus:border-brand-500/30 rounded-2xl outline-none focus:ring-4 focus:ring-brand-500/5 font-medium text-sm h-48 resize-none text-slate-700 dark:text-slate-300 shadow-inner italic transition-all"
                />
              </div>

              <div className="pt-2">
                <button 
                  disabled={submitting}
                  className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black py-4.5 rounded-2xl shadow-2xl transition-all flex items-center justify-center gap-3 hover:translate-y-[-2px] active:translate-y-[0px] active:scale-95 disabled:opacity-50 uppercase tracking-[0.3em] text-xs"
                >
                  {submitting ? <Loader2 className="animate-spin" size={20} /> : (
                    <>
                      Publish Notice
                      <Send size={18} />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default NoticesPage
