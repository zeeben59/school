import { useState, useEffect, useRef } from 'react'
import { API_BASE } from '../../lib/config'
import { Bell, CheckCircle2, AlertCircle, Clock, XCircle, Megaphone } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

interface Notification {
  id: string
  title: string
  message: string
  type: string
  isRead: boolean
  createdAt: string
  createdByRole: string | null
}

const NotificationBell = () => {
  const { token } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null)
  
  const dropdownRef = useRef<HTMLDivElement>(null)

  const unreadCount = notifications.filter(n => !n.isRead).length

  useEffect(() => {
    fetchNotifications()
    
    // Polling every 30 seconds
    const interval = setInterval(fetchNotifications, 30000)
    
    return () => clearInterval(interval)
  }, [token])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Don't close if a modal is open
      if (selectedNotification) return;
      
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [selectedNotification])

  const fetchNotifications = async () => {
    if (!token) return
    try {
      const res = await fetch(`${API_BASE}/api/notifications`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setNotifications(Array.isArray(data) ? data : [])
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err)
    }
  }

  const markAsRead = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    try {
      const res = await fetch(`${API_BASE}/api/notifications/${id}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n))
      }
    } catch (err) {
      console.error('Failed to mark as read:', err)
    }
  }

  const handleNotificationClick = (n: Notification) => {
    if (!n.isRead) {
      markAsRead(n.id)
    }
    setSelectedNotification(n)
  }

  const markAllAsRead = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/notifications/read-all`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
      }
    } catch (err) {
      console.error('Failed to mark all as read:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffInMins = Math.floor((now.getTime() - date.getTime()) / 60000)
    
    if (diffInMins < 1) return 'Just now'
    if (diffInMins < 60) return `${diffInMins}m ago`
    
    const diffInHours = Math.floor(diffInMins / 60)
    if (diffInHours < 24) return `${diffInHours}h ago`
    
    return date.toLocaleDateString()
  }

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        {/* Bell Button */}
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className={`relative p-2.5 rounded-xl transition-all duration-300 ${
            isOpen ? 'bg-brand-50 dark:bg-brand-500/10 text-brand-600' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400'
          }`}
        >
          <Bell size={19} />
          {unreadCount > 0 && (
            <span className="absolute top-2.5 right-2.5 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 border-2 border-white dark:border-slate-900 text-[8px] font-bold text-white items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            </span>
          )}
        </button>

        {/* Dropdown Panel */}
        {isOpen && (
          <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden z-50 animate-in zoom-in-95 duration-200 origin-top-right">
            {/* Header */}
            <div className="px-6 py-5 bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 italic">Notifications</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{unreadCount} New Alerts</p>
              </div>
              {unreadCount > 0 && (
                <button 
                  onClick={markAllAsRead}
                  disabled={loading}
                  className="text-[10px] font-black text-brand-600 hover:text-brand-700 dark:text-brand-400 uppercase tracking-tighter disabled:opacity-50"
                >
                  Mark all as read
                </button>
              )}
            </div>

            {/* List */}
            <div className="max-h-[400px] overflow-y-auto scrollbar-hide py-2">
              {notifications.length === 0 ? (
                <div className="py-12 px-6 text-center">
                  <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-slate-300 mx-auto mb-3">
                    <Bell size={24} />
                  </div>
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-100 italic">Quiet for now</p>
                  <p className="text-[10px] text-slate-400 font-medium uppercase tracking-tight mt-1">No new activity to report</p>
                </div>
              ) : (
                notifications.map((n) => (
                  <div 
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={`px-6 py-4 flex gap-4 transition-colors relative group cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
                      n.isRead ? 'opacity-60' : 'bg-brand-50/20 dark:bg-brand-500/5'
                    }`}
                  >
                    <div className={`shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center shadow-sm border border-transparent ${
                      n.type === 'CLASS_ASSIGNMENT' ? 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-500/10 dark:border-emerald-500/20' : 
                      'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-500/10 dark:border-blue-500/20'
                    }`}>
                      {n.type === 'CLASS_ASSIGNMENT' ? <CheckCircle2 size={18} /> : 
                       n.type === 'ANNOUNCEMENT' ? <Megaphone size={18} /> : <AlertCircle size={18} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                         <p className="text-xs font-black text-slate-900 dark:text-slate-100 leading-tight italic truncate pr-4">{n.title}</p>
                         {!n.isRead && (
                           <div className="w-2 h-2 rounded-full bg-brand-500 shadow-[0_0_8px_rgba(var(--brand-500-rgb),0.6)]" />
                         )}
                      </div>
                      <p className="text-[11px] font-medium text-slate-600 dark:text-slate-400 leading-snug line-clamp-3 mb-2">{n.message}</p>
                      <div className="flex items-center gap-2">
                         <Clock size={10} className="text-slate-300" />
                         <span className="text-[9px] font-bold text-slate-300 uppercase tracking-tighter">{formatTime(n.createdAt)}</span>
                      </div>
                    </div>
                    
                    {/* Mark as read button overlay on hover (only if not read) */}
                    {!n.isRead && (
                      <button 
                        onClick={(e) => markAsRead(n.id, e)}
                        className="absolute right-4 bottom-4 p-1.5 opacity-0 group-hover:opacity-100 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg text-slate-400 hover:text-brand-600 transition-all shadow-sm"
                        title="Mark as read"
                      >
                        <CheckCircle2 size={12} />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/20 text-center">
               <p className="text-[9px] font-black text-slate-300 uppercase italic">Notification Center Hub</p>
            </div>
          </div>
        )}
      </div>

      {/* Full Notice Modal */}
      {selectedNotification && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setSelectedNotification(null)}></div>
          <div className="relative bg-white dark:bg-slate-900 w-full max-w-xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-slate-100 dark:border-slate-800 scale-100">
            <div className="px-8 py-8 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between bg-slate-50/30 dark:bg-slate-800/20">
              <div className="flex items-center gap-4">
                <div className={`p-4 rounded-2xl border ${
                  selectedNotification.type === 'CLASS_ASSIGNMENT' ? 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-500/10 dark:border-emerald-500/20' : 
                  'bg-brand-50 text-brand-600 border-brand-100 dark:bg-brand-500/10 dark:border-brand-500/20'
                }`}>
                  {selectedNotification.type === 'CLASS_ASSIGNMENT' ? <CheckCircle2 size={24} /> : 
                   selectedNotification.type === 'ANNOUNCEMENT' ? <Megaphone size={24} /> : <AlertCircle size={24} />}
                </div>
                <div>
                  <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight italic uppercase">{selectedNotification.title}</h2>
                  <div className="flex items-center gap-3 mt-1">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">{selectedNotification.type.replace('_', ' ')}</p>
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700"></span>
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <Clock size={10} />
                      <p className="text-[10px] font-bold uppercase tracking-tighter">{formatTime(selectedNotification.createdAt)}</p>
                    </div>
                  </div>
                </div>
              </div>
              <button onClick={() => setSelectedNotification(null)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all transform hover:rotate-90">
                 <XCircle size={32} />
              </button>
            </div>
            <div className="p-10">
              <div className="text-sm md:text-base text-slate-600 dark:text-slate-300 font-medium leading-relaxed whitespace-pre-wrap italic rendering-auto">
                {selectedNotification.message}
              </div>
            </div>
            {selectedNotification.createdByRole && (
              <div className="px-10 py-5 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest italic">
                  Published by {selectedNotification.createdByRole}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

export default NotificationBell
