import { useState, useEffect, useRef } from 'react'
import { API_BASE } from '../../lib/config'
import { 
  Settings, 
  Lock, 
  Shield, 
  School, 
  User, 
  Phone, 
  MapPin, 
  Camera, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  Save,
  RefreshCw,
  Upload,
  Trash2
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import PasswordField from '../../components/ui/PasswordField'

const SettingsPage = () => {
  const { user, token, updateUser } = useAuth()
  const [activeTab, setActiveTab] = useState<'SECURITY' | 'SCHOOL'>('SECURITY')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Security Form
  const [securityData, setSecurityData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })

  // School Profile Form
  const [schoolData, setSchoolData] = useState({
    name: '',
    address: '',
    phone: '',
    directorFullName: ''
  })
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string>('')

  const buildLogoUrl = (logoUrl: string) => {
    if (logoUrl.startsWith('http')) return logoUrl
    const normalized = logoUrl.startsWith('/uploads/')
      ? logoUrl.replace('/uploads/', '/api/uploads/')
      : logoUrl
    return `${API_BASE}${normalized}`
  }

  const verifyLogoIsReachable = async (logoUrl: string) => {
    const verificationRes = await fetch(buildLogoUrl(logoUrl), {
      method: 'GET',
      cache: 'no-store'
    })

    if (!verificationRes.ok) {
      throw new Error('Badge upload did not complete. Please try again.')
    }

    const contentType = verificationRes.headers.get('content-type') || ''
    if (!contentType.startsWith('image/')) {
      throw new Error('Badge upload returned an invalid file type.')
    }
  }

  // Load current data from context
  useEffect(() => {
    if (user) {
      setSchoolData({
        name: user.school || '',
        address: user.address || '',
        phone: user.phone || '',
        directorFullName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Institution Director'
      })
      if (user.logoUrl) {
        setLogoPreview(buildLogoUrl(user.logoUrl))
      }
    }
  }, [user])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validate file type
      const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
      if (!allowed.includes(file.type)) {
        setMessage({ type: 'error', text: 'Invalid file type. PNG, JPG, or WEBP only.' })
        return
      }
      // Validate size (5MB)
      if (file.size > 5 * 1024 * 1024) {
        setMessage({ type: 'error', text: 'File too large. Max 5MB.' })
        return
      }

      setLogoFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setLogoPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
      setMessage(null)
    }
  }

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (securityData.newPassword !== securityData.confirmPassword) {
      setMessage({ type: 'error', text: 'New passwords do not match' })
      return
    }

    setLoading(true)
    setMessage(null)
    try {
      const res = await fetch(`${API_BASE}/api/settings/password`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify(securityData)
      })

      const data = await res.json()
      if (res.ok) {
        setMessage({ type: 'success', text: 'Password updated successfully' })
        setSecurityData({ currentPassword: '', newPassword: '', confirmPassword: '' })
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to update password' })
      }
    } catch {
      setMessage({ type: 'error', text: 'Network connection failure' })
    } finally {
      setLoading(false)
    }
  }

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    const formData = new FormData()
    formData.append('name', schoolData.name)
    formData.append('address', schoolData.address)
    formData.append('phone', schoolData.phone)
    formData.append('directorFullName', schoolData.directorFullName)
    const attemptedBadgeUpload = Boolean(logoFile)
    if (logoFile) {
      formData.append('logo', logoFile)
    }

    try {
      const res = await fetch(`${API_BASE}/api/settings/school`, {
        method: 'PATCH',
        headers: { 
          Authorization: `Bearer ${token}` 
        },
        body: formData
      })

      const data = await res.json()
      if (res.ok) {
        if (attemptedBadgeUpload) {
          if (!data?.logoUploadCompleted || !data?.user?.logoUrl) {
            setMessage({ type: 'error', text: 'Badge upload failed. No saved badge was confirmed.' })
            return
          }

          await verifyLogoIsReachable(data.user.logoUrl)
        }
        
        // Update AuthContext instead of just localStorage manually
        updateUser({ 
          school: data.user.school,
          logoUrl: data.user.logoUrl,
          firstName: data.user.firstName,
          lastName: data.user.lastName,
          phone: data.user.phone,
          address: data.user.address
        })

        if (data?.user?.logoUrl) {
          setLogoPreview(buildLogoUrl(data.user.logoUrl))
        }
        setLogoFile(null)
        if (fileInputRef.current) fileInputRef.current.value = ''
        setMessage({ type: 'success', text: attemptedBadgeUpload ? 'Badge uploaded and synchronized successfully.' : 'Profile synchronization complete!' })

        // Give visual feedback then stay on page (no hard reload unless absolutely necessary)
        // Logo changes might need a refresh to bypass browser cache, but updateUser state should handle it.
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to push profile updates' })
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || 'Network telemetry error' })
    } finally {
      setLoading(false)
    }
  }

  const removeSelectedFile = () => {
    setLogoFile(null)
    if (user?.logoUrl) {
      setLogoPreview(buildLogoUrl(user.logoUrl))
    } else {
      setLogoPreview('')
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-black text-slate-900 dark:text-slate-100 italic flex items-center gap-3 tracking-tight">
          <div className="p-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl shadow-lg">
            <Settings size={22} className="animate-spin-slow" />
          </div>
          System Control
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 font-bold uppercase tracking-[0.2em] pl-1 transition-colors">
          Account security and infrastructure branding
        </p>
      </div>

      {/* Status Message */}
      {message && (
        <div className={`p-5 rounded-2xl flex items-center gap-3 text-sm font-bold shadow-xl animate-in fade-in slide-in-from-top-4 duration-500 overflow-hidden relative ${
          message.type === 'success' 
            ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50' 
            : 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border border-red-100 dark:border-red-900/50'
        }`}>
          <div className={`absolute top-0 left-0 h-full w-1 ${message.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`} />
          {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          {message.text}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 p-1.5 bg-slate-100 dark:bg-slate-900/50 rounded-2xl w-fit transition-colors border border-slate-200 dark:border-slate-800">
        <button 
          onClick={() => { setActiveTab('SECURITY'); setMessage(null); }}
          className={`flex items-center gap-2 px-7 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all ${
            activeTab === 'SECURITY' 
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xl' 
              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Lock size={14} /> Security Guard
        </button>
        {user?.role === 'DIRECTOR' && (
          <button 
            onClick={() => { setActiveTab('SCHOOL'); setMessage(null); }}
            className={`flex items-center gap-2 px-7 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all ${
              activeTab === 'SCHOOL' 
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xl' 
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <School size={14} /> Institution Profile
          </button>
        )}
      </div>

      {/* Tab Content */}
      <div className="bg-white dark:bg-slate-900 rounded-[3rem] p-10 sm:p-14 border border-slate-100 dark:border-slate-800 shadow-2xl shadow-slate-200/50 dark:shadow-none min-h-[500px] transition-all relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-slate-50 dark:bg-slate-800/20 rounded-full translate-x-1/2 -translate-y-1/2 -z-0"></div>
        
        <div className="relative z-10">
          {activeTab === 'SECURITY' ? (
            <div className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="flex items-center gap-5 border-b border-slate-50 dark:border-slate-800 pb-8">
                <div className="p-4 bg-brand-50 dark:bg-brand-500/10 rounded-2xl text-brand-600 border border-brand-100 dark:border-brand-500/20 transition-colors">
                  <Shield size={32} />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 italic uppercase">Access Authorization</h2>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">Synchronize your dashboard credentials</p>
                </div>
              </div>

              <form onSubmit={handlePasswordUpdate} className="space-y-7 max-w-md">
                <PasswordField
                  label="Current Authentication Code"
                  value={securityData.currentPassword}
                  onChange={e => setSecurityData({...securityData, currentPassword: e.target.value})}
                  required
                />

                <div className="flex items-center gap-4 py-2">
                  <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800" />
                  <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest whitespace-nowrap">Encryption Update</span>
                  <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800" />
                </div>

                <PasswordField
                  label="New Security Cipher"
                  value={securityData.newPassword}
                  onChange={e => setSecurityData({...securityData, newPassword: e.target.value})}
                  required
                  placeholder="Min 8 characters required"
                />

                <PasswordField
                  label="Verify New Cipher"
                  value={securityData.confirmPassword}
                  onChange={e => setSecurityData({...securityData, confirmPassword: e.target.value})}
                  required
                />

                <button 
                  disabled={loading}
                  className="w-full bg-slate-900 border-2 border-slate-900 dark:bg-white dark:border-white text-white dark:text-slate-900 font-black py-4.5 rounded-2xl shadow-2xl transition-all hover:translate-y-[-2px] active:translate-y-[0px] active:scale-95 disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-3 uppercase tracking-[0.3em] text-xs"
                >
                  {loading ? <Loader2 className="animate-spin" size={20} /> : <Save size={18} />}
                  Authorize Changes
                </button>
              </form>
            </div>
          ) : user?.role === 'DIRECTOR' ? (
            /* SCHOOL PROFILE TAB */
            <div className="space-y-12 animate-in fade-in slide-in-from-left-4 duration-500">
              <div className="flex items-center gap-5 border-b border-slate-50 dark:border-slate-800 pb-8">
                <div className="p-4 bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl text-emerald-600 border border-emerald-100 dark:border-emerald-500/20 transition-colors">
                  <School size={32} />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 italic uppercase">Institution Identity</h2>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">Map your official institutional brand assets</p>
                </div>
              </div>

              <form onSubmit={handleProfileUpdate} className="space-y-10">
                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-16 gap-y-12">
                   {/* Left Column: Details */}
                   <div className="space-y-7">
                      <div className="space-y-2.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 transition-colors">Institution Name</label>
                        <div className="relative group">
                          <School size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                          <input 
                            required
                            type="text"
                            value={schoolData.name}
                            onChange={e => setSchoolData({...schoolData, name: e.target.value})}
                            className="w-full pl-12 pr-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-2 border-transparent focus:border-emerald-500/30 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-500/5 focus:bg-white dark:focus:bg-slate-800 transition-all font-bold text-sm text-slate-700 dark:text-slate-200 italic"
                          />
                        </div>
                      </div>

                      <div className="space-y-2.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 transition-colors">Registry Address</label>
                        <div className="relative group">
                          <MapPin size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                          <input 
                            required
                            type="text"
                            value={schoolData.address}
                            onChange={e => setSchoolData({...schoolData, address: e.target.value})}
                            className="w-full pl-12 pr-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-2 border-transparent focus:border-emerald-500/30 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-500/5 focus:bg-white dark:focus:bg-slate-800 transition-all font-bold text-sm text-slate-700 dark:text-slate-200 italic"
                          />
                        </div>
                      </div>

                      <div className="space-y-2.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 transition-colors">Telemetry Phone</label>
                        <div className="relative group">
                          <Phone size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                          <input 
                            required
                            type="text"
                            value={schoolData.phone}
                            onChange={e => setSchoolData({...schoolData, phone: e.target.value})}
                            className="w-full pl-12 pr-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-2 border-transparent focus:border-emerald-500/30 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-500/5 focus:bg-white dark:focus:bg-slate-800 transition-all font-bold text-sm text-slate-700 dark:text-slate-200 italic"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-4 py-4">
                        <div className="h-px flex-1 bg-slate-50 dark:bg-slate-800" />
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Administrative Entry</span>
                        <div className="h-px flex-1 bg-slate-50 dark:bg-slate-800" />
                      </div>

                      <div className="space-y-2.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 transition-colors">Overseer Designation</label>
                        <div className="relative group">
                          <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                          <input 
                            required
                            type="text"
                            value={schoolData.directorFullName}
                            onChange={e => setSchoolData({...schoolData, directorFullName: e.target.value})}
                            className="w-full pl-12 pr-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-2 border-transparent focus:border-emerald-500/30 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-500/5 focus:bg-white dark:focus:bg-slate-800 transition-all font-bold text-sm text-slate-700 dark:text-slate-200 italic"
                          />
                        </div>
                      </div>
                   </div>

                   {/* Right Column: Photo Upload Section */}
                   <div className="space-y-7">
                      <div className="space-y-4">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 transition-colors">Registry Badge / Seal</label>
                         
                         {/* Preview Area */}
                         <div className="relative aspect-square w-full max-w-[280px] rounded-[3rem] bg-slate-50 dark:bg-slate-800/40 flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-200 dark:border-slate-800 overflow-hidden group transition-all shadow-inner">
                           {logoPreview ? (
                             <>
                               <img 
                                  src={logoPreview} 
                                  alt="Badge Preview" 
                                  className="w-full h-full object-contain drop-shadow-2xl group-hover:scale-110 transition-transform duration-700"
                               />
                               <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                                  <button 
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="p-3 bg-white rounded-2xl text-slate-900 hover:scale-110 active:scale-95 transition-all shadow-xl"
                                  >
                                    <Upload size={20} />
                                  </button>
                                  {logoFile && (
                                    <button 
                                      type="button"
                                      onClick={removeSelectedFile}
                                      className="p-3 bg-red-500 rounded-2xl text-white hover:scale-110 active:scale-95 transition-all shadow-xl"
                                    >
                                      <Trash2 size={20} />
                                    </button>
                                  )}
                               </div>
                             </>
                           ) : (
                             <button 
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="flex flex-col items-center gap-4 text-slate-400 hover:text-emerald-500 transition-all"
                             >
                               <div className="p-5 bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-700">
                                 <Camera size={48} className="transition-transform group-hover:rotate-12 duration-500" />
                               </div>
                               <div className="text-center">
                                 <p className="text-[10px] font-black uppercase tracking-[0.1em]">Synchronize Badge</p>
                                 <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest mt-1 opacity-60">Click to upload seal</p>
                               </div>
                             </button>
                           )}
                         </div>

                         {/* Hidden File Input */}
                         <input 
                            ref={fileInputRef}
                            type="file"
                            accept="image/png,image/jpeg,image/jpg,image/webp"
                            onChange={handleFileChange}
                            className="hidden"
                         />
                         
                         <div className="flex items-start gap-2 max-w-[280px] pl-1">
                           <AlertCircle size={12} className="text-slate-300 mt-0.5" />
                           <p className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.1em] leading-relaxed">
                             System constraints: PNG, JPG, or WEBP. Max payload 5MB per transmission.
                           </p>
                         </div>
                      </div>
                   </div>
                 </div>

                 <div className="pt-10 border-t border-slate-50 dark:border-slate-800">
                    <button 
                       disabled={loading}
                       className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-14 py-5 rounded-[2rem] shadow-2xl shadow-emerald-200/50 dark:shadow-none transition-all hover:translate-y-[-2px] active:translate-y-[0px] active:scale-95 flex items-center gap-4 disabled:opacity-50 disabled:scale-100 uppercase tracking-[0.3em] text-xs"
                    >
                      {loading ? <RefreshCw className="animate-spin" size={20} /> : <Save size={18} />}
                      Commit Profile Mapping
                    </button>
                 </div>
              </form>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default SettingsPage
