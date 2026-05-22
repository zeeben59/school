import { useState, useEffect } from 'react'
import { API_BASE } from '../../lib/config'
import { 
  ShieldCheck, 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  UserPlus,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import PasswordField from '../../components/ui/PasswordField'

interface Principal {
  id: string
  firstName: string
  lastName: string
  email: string
  status: 'ACTIVE' | 'INACTIVE' | 'DEACTIVATED'
  createdByRole: string | null
  createdAt: string
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

const PrincipalsPage = () => {
  const { token } = useAuth()
  const [principals, setPrincipals] = useState<Principal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingPrincipal, setEditingPrincipal] = useState<Principal | null>(null)
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: ''
  })
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  useEffect(() => {
    fetchPrincipals()
  }, [])

  const fetchPrincipals = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/principals`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      
      const data = await res.json()
      
      if (res.ok) {
        if (Array.isArray(data)) {
          setPrincipals(data)
        } else {
          console.error('Expected array but got:', data)
          setPrincipals([])
        }
      } else {
        setError(data.error || 'Failed to fetch principals')
      }
    } catch (err) {
      console.error('Failed to fetch:', err)
      setError('Network error. Please check your connection.')
    } finally {
      setLoading(false)
    }
  }

  const handleOpenCreateModal = () => {
    setEditingPrincipal(null)
    setFormData({ firstName: '', lastName: '', email: '', password: '' })
    setMessage(null)
    setIsModalOpen(true)
  }

  const handleOpenEditModal = (principal: Principal) => {
    setEditingPrincipal(principal)
    setFormData({
      firstName: principal.firstName,
      lastName: principal.lastName,
      email: principal.email,
      password: '' // Keep empty unless updating
    })
    setMessage(null)
    setIsModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setMessage(null)

    const url = editingPrincipal 
      ? `${API_BASE}/api/principals/${editingPrincipal.id}`
      : `${API_BASE}/api/principals`
    
    const method = editingPrincipal ? 'PUT' : 'POST'

    // Only include password if it's provided during edit, or always for create
    const payload: any = { ...formData }
    if (editingPrincipal && !formData.password) {
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
          text: editingPrincipal ? 'Principal updated successfully' : 'Principal created successfully' 
        })
        setTimeout(() => {
          setIsModalOpen(false)
          fetchPrincipals()
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
    if (!confirm('WARNING: Are you sure you want to PERMANENTLY delete this principal account? This action cannot be undone.')) return

    try {
      const res = await fetch(`${API_BASE}/api/principals/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })

      if (res.ok) {
        // Instant UI update
        setPrincipals(prev => prev.filter(p => p.id !== id))
        setMessage({ type: 'success', text: 'Principal deleted successfully' })
        setTimeout(() => setMessage(null), 3000)
      } else {
        // Safe JSON parsing for specific backend errors
        let errorMsg = 'Failed to delete principal'
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

  const safePrincipals = Array.isArray(principals) ? principals : []
  const filteredPrincipals = safePrincipals.filter(p => {
    const firstName = p.firstName || ''
    const lastName = p.lastName || ''
    const email = p.email || ''
    return `${firstName} ${lastName} ${email}`.toLowerCase().includes(search.toLowerCase())
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
          onClick={fetchPrincipals}
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
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight italic">Principals</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Manage your school's principal accounts</p>
        </div>
        <button 
          onClick={handleOpenCreateModal}
          className="flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-brand-200 dark:shadow-none"
        >
          <Plus size={18} />
          Add Principal
        </button>
      </div>

      {/* Stats & Search */}
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
        <div className="relative w-full lg:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-brand-500 transition-all text-sm font-medium"
          />
        </div>
        {!loading && (
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
            <span>Total: {filteredPrincipals.length}</span>
            <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
            <span className="text-brand-600">Active: {filteredPrincipals.filter(p => p.status === 'ACTIVE').length}</span>
          </div>
        )}
      </div>

      {/* List View */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3">
            <Loader2 className="animate-spin text-brand-500" size={32} />
            <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Loading principals...</p>
          </div>
        ) : filteredPrincipals.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center gap-4 text-center">
            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-full text-slate-400">
              <ShieldCheck size={40} />
            </div>
            <div>
              <p className="font-bold text-slate-900 dark:text-slate-100">No principals found</p>
              <p className="text-sm text-slate-500">Add your first principal to help manage the school.</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-50 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Principal</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {filteredPrincipals.map((principal) => (
                  <tr key={principal.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-brand-50 dark:bg-brand-500/10 flex items-center justify-center text-brand-600 font-bold">
                          {principal.firstName?.[0]}{principal.lastName?.[0]}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 dark:text-slate-100 truncate">
                            {principal.firstName || 'Unknown'} {principal.lastName || ''}
                          </p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight italic">School Principal</p>
                          {principal.createdByRole && (
                            <p className="text-[10px] text-brand-500 dark:text-brand-400 font-bold mt-0.5 uppercase tracking-tighter">Added by {principal.createdByRole.toLowerCase()}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-600 dark:text-slate-400">{principal.email}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        principal.status === 'ACTIVE' 
                          ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' 
                          : 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400'
                      }`}>
                        {principal.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => handleOpenEditModal(principal)}
                          className="p-2 text-slate-400 hover:text-brand-600 transition-colors bg-slate-50 dark:bg-slate-800 rounded-lg hover:shadow-sm" 
                          title="Edit"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => handleDelete(principal.id)}
                          className="p-2 text-slate-400 hover:text-red-600 transition-colors bg-slate-50 dark:bg-slate-800 rounded-lg hover:shadow-sm" 
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
          <div className="relative bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-slate-100 dark:border-slate-800">
            <div className="px-8 py-8 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white dark:bg-slate-900 rounded-2xl text-brand-600 shadow-sm border border-slate-100 dark:border-slate-800">
                  {editingPrincipal ? <Edit2 size={22} /> : <UserPlus size={22} />}
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight italic">
                    {editingPrincipal ? 'Update Profile' : 'Initiate Principal'}
                  </h2>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none mt-1">
                    {editingPrincipal ? 'Modify access credentials' : 'Create new administrative access'}
                  </p>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
                <XCircle size={28} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-5">
              {message && (
                <div className={`p-4 rounded-2xl flex items-center gap-3 text-sm font-bold ${
                  message.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                }`}>
                  {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                  {message.text}
                </div>
              )}

              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 italic">First Name</label>
                  <input 
                    required
                    type="text"
                    value={formData.firstName}
                    onChange={e => setFormData({...formData, firstName: e.target.value})}
                    className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl outline-none focus:ring-2 focus:ring-brand-500 font-bold text-sm transition-all text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 italic">Last Name</label>
                  <input 
                    required
                    type="text"
                    value={formData.lastName}
                    onChange={e => setFormData({...formData, lastName: e.target.value})}
                    className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl outline-none focus:ring-2 focus:ring-brand-500 font-bold text-sm transition-all text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 italic">Email Address</label>
                <input 
                  required
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                  className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl outline-none focus:ring-2 focus:ring-brand-500 font-bold text-sm transition-all text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between px-1 mb-1">
                  {editingPrincipal && (
                    <span className="text-[9px] font-bold text-brand-500 uppercase tracking-tighter italic">Leave blank to keep current</span>
                  )}
                </div>
                <PasswordField 
                  required={!editingPrincipal}
                  label="Password"
                  value={formData.password}
                  onChange={e => setFormData({...formData, password: e.target.value})}
                  placeholder={editingPrincipal ? "••••••••" : "Min. 8 characters"}
                  className="w-full"
                />
              </div>

              <div className="pt-6">
                <button 
                  disabled={submitting}
                  className="w-full bg-brand-600 hover:bg-brand-700 disabled:bg-brand-300 text-white font-black py-4 rounded-2xl shadow-xl shadow-brand-200 dark:shadow-none transition-all flex items-center justify-center gap-3 uppercase tracking-[0.2em] text-xs hover:scale-[1.02] active:scale-95"
                >
                  {submitting ? <Loader2 className="animate-spin" size={20} /> : (editingPrincipal ? 'Sync Updates' : 'Deploy Principal')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default PrincipalsPage
