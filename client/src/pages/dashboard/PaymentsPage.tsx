import { useState, useEffect } from 'react'
import { API_BASE } from '../../lib/config'
import { 
  Plus, 
  Search, 
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  DollarSign,
  Receipt,
  AlertTriangle,
  History,
  RefreshCw
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

interface FeeRecord {
  id: string
  amount: number
  balance: number
  type: string
  status: 'PAID' | 'UNPAID' | 'PARTIAL'
  dueDate: string
  paymentDate: string | null
  student: {
    user: {
      firstName: string
      lastName: string
      email: string
    }
  }
}

interface Student {
  id: string
  firstName: string
  lastName: string
}

const PaymentsPage = () => {
  const { token } = useAuth()
  const [fees, setFees] = useState<FeeRecord[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [formData, setFormData] = useState({
    studentId: '',
    amount: 0,
    type: 'Tuition Fee',
    dueDate: new Date().toISOString().split('T')[0]
  })
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  useEffect(() => {
    if (token) fetchInitialData()
  }, [token])

  const fetchInitialData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [feeRes, studentRes] = await Promise.all([
        fetch(`${API_BASE}/api/fees`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE}/api/students`, { headers: { Authorization: `Bearer ${token}` } })
      ])
      
      const feeData = await feeRes.json()
      const studentData = await studentRes.json()
      
      if (feeRes.ok && studentRes.ok) {
        setFees(Array.isArray(feeData) ? feeData : [])
        setStudents((Array.isArray(studentData) ? studentData : [])
          .filter((s: any) => s.studentProfile?.id)
          .map((s: any) => ({
            id: s.studentProfile.id,
            firstName: s.firstName,
            lastName: s.lastName
          }))
        )
      } else {
        setError('Failed to synchronize financial telemetry')
      }
      
    } catch (err) {
      console.error('Fetch error:', err)
      setError('Network synchronization failure. Accounting server unreachable.')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setMessage(null)

    try {
      const res = await fetch(`${API_BASE}/api/fees`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify(formData)
      })

      const data = await res.json()
      if (res.ok) {
        setMessage({ type: 'success', text: 'Fee bill generated' })
        setFormData({ studentId: '', amount: 0, type: 'Tuition Fee', dueDate: new Date().toISOString().split('T')[0] })
        setTimeout(() => setIsModalOpen(false), 1500)
        fetchInitialData()
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed' })
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Network error' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdateStatus = async (id: string, newStatus: string, fullPaid: boolean) => {
    try {
      const res = await fetch(`${API_BASE}/api/fees/${id}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ 
          status: newStatus,
          balance: fullPaid ? 0 : undefined
        })
      })

      if (res.ok) fetchInitialData()
    } catch (err) {
      console.error('Update error:', err)
    }
  }

  const safeFees = Array.isArray(fees) ? fees : []
  const filteredFees = safeFees.filter(f => 
    `${f.student?.user?.firstName || ''} ${f.student?.user?.lastName || ''} ${f.type || ''}`.toLowerCase().includes(search.toLowerCase())
  )

  const totalCollected = safeFees.filter(f => f.status === 'PAID').reduce((acc, f) => acc + (f.amount || 0), 0)
  const totalPending = safeFees.filter(f => f.status !== 'PAID').reduce((acc, f) => acc + (f.balance || 0), 0)

  if (error) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center text-center p-6">
        <div className="w-16 h-16 bg-red-50 dark:bg-red-500/10 rounded-2xl flex items-center justify-center text-red-600 mb-4">
          <AlertCircle size={32} />
        </div>
        <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 mb-2">Accounting Sync Failed</h2>
        <p className="text-slate-500 max-w-xs mb-6 font-medium">{error}</p>
        <button 
          onClick={fetchInitialData}
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
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight italic">Financial Records</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium tracking-tight">Manage student fees and payments</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-lg active:scale-95"
        >
          <Plus size={18} />
          Generate Fee Bill
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 p-8 rounded-[2.5rem] text-white shadow-2xl shadow-emerald-100 dark:shadow-none relative overflow-hidden group">
           <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full translate-x-1/2 -translate-y-1/2 group-hover:scale-110 transition-transform duration-500"></div>
           <div className="flex items-center justify-between mb-6 relative z-10">
             <div className="p-3 bg-white/20 backdrop-blur-md rounded-2xl">
               <DollarSign size={24} />
             </div>
             <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">Total Collected</span>
           </div>
           <p className="text-4xl font-black italic relative z-10">${totalCollected.toLocaleString()}</p>
        </div>
        <div className="bg-gradient-to-br from-amber-500 to-orange-600 p-8 rounded-[2.5rem] text-white shadow-2xl shadow-amber-100 dark:shadow-none relative overflow-hidden group">
           <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full translate-x-1/2 -translate-y-1/2 group-hover:scale-110 transition-transform duration-500"></div>
           <div className="flex items-center justify-between mb-6 relative z-10">
             <div className="p-3 bg-white/20 backdrop-blur-md rounded-2xl">
               <AlertTriangle size={24} />
             </div>
             <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">Pending Balance</span>
           </div>
           <p className="text-4xl font-black italic relative z-10">${totalPending.toLocaleString()}</p>
        </div>
      </div>

      {/* Search */}
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
        <div className="relative w-full lg:max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text"
            placeholder="Filter by student entity or fee mapping..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-3.5 bg-white dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500/30 transition-all text-sm font-bold italic"
          />
        </div>
      </div>

      {/* List Table */}
      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center gap-3">
            <Loader2 className="animate-spin text-emerald-500" size={32} />
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest italic">Polling ledger states...</p>
          </div>
        ) : filteredFees.length === 0 ? (
          <div className="p-16 text-center text-slate-400 flex flex-col items-center gap-4">
            <div className="p-5 bg-slate-50 dark:bg-slate-800 rounded-full">
              <History size={48} className="text-slate-200 dark:text-slate-700" />
            </div>
            <p className="text-sm font-bold italic">No financial records detected in current branch.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Student Entity</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Asset Type</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Principal</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Residual</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Status</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Maturity</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Commitments</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {filteredFees.map((f) => (
                  <tr key={f.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group">
                    <td className="px-8 py-5">
                      <p className="font-bold text-slate-900 dark:text-slate-100 text-sm italic group-hover:text-emerald-600 transition-colors">
                        {f.student?.user?.firstName || 'Unknown'} {f.student?.user?.lastName || ''}
                      </p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{f.student?.user?.email || 'No Email'}</p>
                    </td>
                    <td className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">{f.type}</td>
                    <td className="px-8 py-5 text-sm font-black text-slate-900 dark:text-slate-100">${f.amount?.toLocaleString()}</td>
                    <td className={`px-8 py-5 text-sm font-black ${f.balance > 0 ? 'text-orange-500' : 'text-slate-400'}`}>${f.balance?.toLocaleString()}</td>
                    <td className="px-8 py-5">
                      <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-[0.2em] flex items-center gap-1.5 w-fit ${
                        f.status === 'PAID' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' :
                        f.status === 'UNPAID' ? 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400' :
                        'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400'
                      }`}>
                        {f.status === 'PAID' ? <CheckCircle2 size={10} /> : <Clock size={10} />}
                        {f.status}
                      </span>
                    </td>
                    <td className="px-8 py-5 text-right text-[10px] font-black text-slate-400 uppercase italic">
                      {new Date(f.dueDate).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}
                    </td>
                    <td className="px-8 py-5 text-right">
                      {f.status !== 'PAID' ? (
                        <button 
                          onClick={() => handleUpdateStatus(f.id, 'PAID', true)}
                          className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-600 hover:text-emerald-700 bg-emerald-50 dark:bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-100 dark:border-emerald-500/20 transition-all active:scale-95"
                        >
                          Settle
                        </button>
                      ) : (
                         <button className="text-slate-300 hover:text-emerald-600 transition-colors bg-slate-50 dark:bg-slate-800 p-2 rounded-lg border border-slate-100 dark:border-slate-700">
                           <Receipt size={16} />
                         </button>
                      )}
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
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
          <div className="relative bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-slate-100 dark:border-slate-800">
            <div className="px-8 py-8 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between bg-emerald-50/30 dark:bg-emerald-500/5">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl text-emerald-600 border border-emerald-100 dark:border-emerald-500/20">
                  <Receipt size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 italic uppercase">Invoice Creation</h2>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">authorized revenue entry</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleCreate} className="p-8 space-y-5">
              {message && (
                <div className={`p-4 rounded-xl flex items-center gap-3 text-sm font-bold animate-in slide-in-from-top-2 duration-300 ${
                  message.type === 'success' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400'
                }`}>
                  {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                  {message.text}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Entity Selection</label>
                <select 
                  required
                  value={formData.studentId}
                  onChange={(e) => setFormData({...formData, studentId: e.target.value})}
                  className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800/50 border border-transparent focus:border-emerald-500/30 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-500/5 text-sm font-bold italic transition-all appearance-none"
                >
                  <option value="">Choose student account...</option>
                  {students.map(s => (
                    <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Asset Category</label>
                  <input 
                    required
                    type="text"
                    placeholder="e.g. Tuition"
                    value={formData.type}
                    onChange={e => setFormData({...formData, type: e.target.value})}
                    className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800/50 border border-transparent focus:border-emerald-500/30 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-500/5 font-bold text-sm italic transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Principal ($)</label>
                  <input 
                    required
                    type="number"
                    value={formData.amount}
                    onChange={e => setFormData({...formData, amount: Number(e.target.value)})}
                    className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800/50 border border-transparent focus:border-emerald-500/30 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-500/5 font-bold text-sm transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Maturity Date</label>
                <input 
                  required
                  type="date"
                  value={formData.dueDate}
                  onChange={e => setFormData({...formData, dueDate: e.target.value})}
                  className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800/50 border border-transparent focus:border-emerald-500/30 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-500/5 font-bold text-sm transition-all"
                />
              </div>

              <div className="pt-4">
                <button 
                  disabled={submitting}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-4.5 rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 uppercase tracking-[0.3em] text-xs"
                >
                  {submitting ? <Loader2 className="animate-spin" size={20} /> : 'Authorize Invoice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default PaymentsPage

