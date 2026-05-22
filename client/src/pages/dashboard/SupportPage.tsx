import { useEffect, useMemo, useState } from 'react'
import { API_BASE } from '../../lib/config'
import { useAuth } from '../../context/AuthContext'
import { LifeBuoy, Loader2, MessageSquare, Send, Sparkles, ThumbsUp } from 'lucide-react'

type FeedbackItem = {
  id: string
  category: string
  message: string
  rating: number | null
  status: 'NEW' | 'REVIEWED' | 'CLOSED'
  createdAt: string
  user?: { firstName?: string; lastName?: string; role?: string; email?: string }
}

type SupportThread = {
  id: string
  subject: string
  status: string
  role: string
  createdAt: string
  lastMessageAt: string
  messages: Array<{ content: string; createdAt: string }>
}

type SupportMessage = {
  id: string
  content: string
  senderType: 'USER' | 'ASSISTANT' | 'SUPPORT'
  senderRole?: string | null
  createdAt: string
}

const FEEDBACK_CATEGORIES = [
  'General',
  'Bug Report',
  'Feature Request',
  'UI/UX',
  'Performance',
]

const SupportPage = () => {
  const { token, user } = useAuth()
  const [activeTab, setActiveTab] = useState<'SUPPORT' | 'FEEDBACK'>('SUPPORT')

  const [threads, setThreads] = useState<SupportThread[]>([])
  const [threadsLoading, setThreadsLoading] = useState(false)
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null)
  const [messages, setMessages] = useState<SupportMessage[]>([])
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [newThreadSubject, setNewThreadSubject] = useState('')
  const [newThreadMessage, setNewThreadMessage] = useState('')
  const [newMessage, setNewMessage] = useState('')
  const [aiQuestion, setAiQuestion] = useState('')
  const [aiAnswer, setAiAnswer] = useState<string | null>(null)
  const [aiSupportMessage, setAiSupportMessage] = useState<string | null>(null)
  const [aiQuickActions, setAiQuickActions] = useState<string[]>([])
  const [aiLoading, setAiLoading] = useState(false)

  const [feedbackItems, setFeedbackItems] = useState<FeedbackItem[]>([])
  const [feedbackLoading, setFeedbackLoading] = useState(false)
  const [feedbackCategory, setFeedbackCategory] = useState(FEEDBACK_CATEGORIES[0])
  const [feedbackMessage, setFeedbackMessage] = useState('')
  const [feedbackRating, setFeedbackRating] = useState<string>('')
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  const selectedThread = useMemo(
    () => threads.find((thread) => thread.id === selectedThreadId) || null,
    [threads, selectedThreadId]
  )

  const authHeaders = useMemo(
    () => ({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }),
    [token]
  )

  const loadThreads = async () => {
    setThreadsLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/support/threads`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to load support threads')
      }
      setThreads(Array.isArray(data) ? data : [])
      if (!selectedThreadId && Array.isArray(data) && data.length > 0) {
        setSelectedThreadId(data[0].id)
      }
    } catch (error: any) {
      setStatusError(error?.message || 'Failed to load support threads')
    } finally {
      setThreadsLoading(false)
    }
  }

  const loadMessages = async (threadId: string) => {
    setMessagesLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/support/threads/${threadId}/messages`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to load support messages')
      }
      setMessages(Array.isArray(data?.messages) ? data.messages : [])
    } catch (error: any) {
      setStatusError(error?.message || 'Failed to load support messages')
    } finally {
      setMessagesLoading(false)
    }
  }

  const loadFeedback = async () => {
    setFeedbackLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/support/feedback`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to load feedback')
      }
      setFeedbackItems(Array.isArray(data) ? data : [])
    } catch (error: any) {
      setStatusError(error?.message || 'Failed to load feedback')
    } finally {
      setFeedbackLoading(false)
    }
  }

  useEffect(() => {
    if (!token) return
    loadThreads()
    loadFeedback()
  }, [token])

  useEffect(() => {
    if (!token || !selectedThreadId) return
    loadMessages(selectedThreadId)
  }, [token, selectedThreadId])

  const createThread = async () => {
    if (!newThreadSubject.trim() || !newThreadMessage.trim()) return
    setSending(true)
    setStatusError(null)
    setStatusMessage(null)
    try {
      const res = await fetch(`${API_BASE}/api/support/threads`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          subject: newThreadSubject.trim(),
          message: newThreadMessage.trim(),
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to create support thread')
      setNewThreadSubject('')
      setNewThreadMessage('')
      setStatusMessage('Support thread created successfully.')
      await loadThreads()
      if (data?.thread?.id) {
        setSelectedThreadId(data.thread.id)
      }
    } catch (error: any) {
      setStatusError(error?.message || 'Failed to create support thread')
    } finally {
      setSending(false)
    }
  }

  const sendMessage = async () => {
    if (!selectedThreadId || !newMessage.trim()) return
    setSending(true)
    setStatusError(null)
    try {
      const res = await fetch(`${API_BASE}/api/support/threads/${selectedThreadId}/messages`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ content: newMessage.trim() })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to send message')
      setNewMessage('')
      await loadMessages(selectedThreadId)
      await loadThreads()
    } catch (error: any) {
      setStatusError(error?.message || 'Failed to send message')
    } finally {
      setSending(false)
    }
  }

  const askAssistant = async () => {
    if (!selectedThreadId) return
    setSending(true)
    setStatusError(null)
    try {
      const res = await fetch(`${API_BASE}/api/support/threads/${selectedThreadId}/assistant-reply`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to generate assistant response')
      await loadMessages(selectedThreadId)
      await loadThreads()
    } catch (error: any) {
      setStatusError(error?.message || 'Failed to generate assistant response')
    } finally {
      setSending(false)
    }
  }

  const submitFeedback = async () => {
    if (!feedbackMessage.trim()) return
    setSending(true)
    setStatusError(null)
    setStatusMessage(null)
    try {
      const res = await fetch(`${API_BASE}/api/support/feedback`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          category: feedbackCategory,
          message: feedbackMessage.trim(),
          rating: feedbackRating ? Number(feedbackRating) : undefined,
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to submit feedback')
      setFeedbackMessage('')
      setFeedbackRating('')
      setStatusMessage('Feedback submitted successfully.')
      await loadFeedback()
    } catch (error: any) {
      setStatusError(error?.message || 'Failed to submit feedback')
    } finally {
      setSending(false)
    }
  }

  const askPlatformAiHelp = async () => {
    if (!aiQuestion.trim()) return
    setAiLoading(true)
    setStatusError(null)
    setAiAnswer(null)
    setAiSupportMessage(null)
    setAiQuickActions([])
    try {
      const res = await fetch(`${API_BASE}/api/support/ai-help`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ question: aiQuestion.trim(), currentPage: '/dashboard/support' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to get AI help')
      setAiAnswer(data?.answer || 'No response available. Please submit a support request.')
      setAiSupportMessage(data?.supportMessage || null)
      setAiQuickActions(Array.isArray(data?.quickActions) ? data.quickActions : [])
    } catch (error: any) {
      setStatusError(error?.message || 'Failed to get AI help')
    } finally {
      setAiLoading(false)
    }
  }

  const updateFeedbackStatus = async (feedbackId: string, status: FeedbackItem['status']) => {
    setStatusError(null)
    try {
      const res = await fetch(`${API_BASE}/api/support/feedback/${feedbackId}/status`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ status }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to update feedback status')
      setFeedbackItems((prev) => prev.map((item) => (item.id === feedbackId ? { ...item, status } : item)))
    } catch (error: any) {
      setStatusError(error?.message || 'Failed to update feedback status')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <LifeBuoy size={22} /> Support & Feedback
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
          Ask for help, submit structured feedback, and track your support conversations.
        </p>
      </div>

      <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('SUPPORT')}
          className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest ${activeTab === 'SUPPORT' ? 'bg-white dark:bg-slate-700 text-brand-600' : 'text-slate-500'}`}
        >
          Support Chat
        </button>
        <button
          onClick={() => setActiveTab('FEEDBACK')}
          className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest ${activeTab === 'FEEDBACK' ? 'bg-white dark:bg-slate-700 text-brand-600' : 'text-slate-500'}`}
        >
          Feedback
        </button>
      </div>

      {statusError && <div className="rounded-xl bg-red-50 text-red-700 px-4 py-3 text-sm font-semibold">{statusError}</div>}
      {statusMessage && <div className="rounded-xl bg-emerald-50 text-emerald-700 px-4 py-3 text-sm font-semibold">{statusMessage}</div>}

      {activeTab === 'SUPPORT' ? (
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-3">
              <h2 className="font-black text-slate-900 dark:text-slate-100 text-sm uppercase tracking-widest">
                AI Platform Help
              </h2>
              <textarea
                value={aiQuestion}
                onChange={(event) => setAiQuestion(event.target.value)}
                placeholder="Ask how to use this platform (example: How do I add a teacher?)"
                className="w-full min-h-[90px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm"
              />
              <button
                onClick={askPlatformAiHelp}
                disabled={aiLoading || !aiQuestion.trim()}
                className="w-full rounded-xl bg-brand-600 text-white py-2.5 text-sm font-bold disabled:opacity-60"
              >
                {aiLoading ? 'Thinking...' : 'Ask AI Help'}
              </button>
              <div className="grid grid-cols-1 gap-2">
                {['Add Teacher', 'Upload Result', 'Mark Attendance'].map((action) => (
                  <button
                    key={action}
                    onClick={() => {
                      setAiQuestion(`How do I ${action.toLowerCase()} on this platform?`)
                    }}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200"
                  >
                    {action}
                  </button>
                ))}
              </div>
              {aiAnswer && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3">
                  <p className="text-xs uppercase tracking-wider font-bold text-slate-500 mb-2">AI Guidance</p>
                  <p className="text-sm text-slate-800 dark:text-slate-100 whitespace-pre-wrap">{aiAnswer}</p>
                  {aiSupportMessage && (
                    <p className="mt-3 text-xs font-semibold text-slate-600 dark:text-slate-300">{aiSupportMessage}</p>
                  )}
                  {aiQuickActions.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {aiQuickActions.map((action) => (
                        <button
                          key={action}
                          onClick={() => setAiQuestion(`How do I ${action.toLowerCase()} on this platform?`)}
                          className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700 dark:border-brand-500/40 dark:bg-brand-500/10 dark:text-brand-300"
                        >
                          {action}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-3">
              <h2 className="font-black text-slate-900 dark:text-slate-100 text-sm uppercase tracking-widest">Start New Thread</h2>
              <input
                value={newThreadSubject}
                onChange={(event) => setNewThreadSubject(event.target.value)}
                placeholder="Thread subject"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm"
              />
              <textarea
                value={newThreadMessage}
                onChange={(event) => setNewThreadMessage(event.target.value)}
                placeholder="Describe your issue or question"
                className="w-full min-h-[90px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm"
              />
              <button
                onClick={createThread}
                disabled={sending}
                className="w-full rounded-xl bg-slate-900 text-white py-2.5 text-sm font-bold disabled:opacity-60"
              >
                {sending ? 'Creating...' : 'Create Thread'}
              </button>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
              <h2 className="font-black text-slate-900 dark:text-slate-100 text-sm uppercase tracking-widest mb-3">Threads</h2>
              {threadsLoading ? (
                <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" /> Loading threads...</div>
              ) : threads.length === 0 ? (
                <p className="text-sm text-slate-500">No support threads yet.</p>
              ) : (
                <div className="space-y-2">
                  {threads.map((thread) => (
                    <button
                      key={thread.id}
                      onClick={() => setSelectedThreadId(thread.id)}
                      className={`w-full text-left rounded-xl border px-3 py-2 ${selectedThreadId === thread.id ? 'border-brand-300 bg-brand-50 dark:bg-brand-500/10' : 'border-slate-200 dark:border-slate-700'}`}
                    >
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{thread.subject}</p>
                      <p className="text-xs text-slate-500 uppercase font-semibold tracking-wider">
                        {thread.status} | {new Date(thread.lastMessageAt).toLocaleDateString()}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 flex flex-col min-h-[500px]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="font-black text-slate-900 dark:text-slate-100">
                  {selectedThread ? selectedThread.subject : 'Select a thread'}
                </h2>
                {selectedThread && (
                  <p className="text-xs text-slate-500 uppercase font-semibold tracking-wider">
                    {selectedThread.status} | Opened by {selectedThread.role}
                  </p>
                )}
              </div>
              <button
                onClick={askAssistant}
                disabled={!selectedThreadId || sending}
                className="inline-flex items-center gap-1 rounded-lg bg-brand-600 text-white px-3 py-2 text-xs font-bold disabled:opacity-60"
              >
                <Sparkles size={14} /> Ask AI
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-3">
              {messagesLoading ? (
                <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" /> Loading messages...</div>
              ) : !selectedThreadId ? (
                <p className="text-sm text-slate-500">Create or select a support thread to start chatting.</p>
              ) : messages.length === 0 ? (
                <p className="text-sm text-slate-500">No messages yet.</p>
              ) : (
                messages.map((message) => {
                  const isCurrentUser = message.senderType === 'USER' && message.senderRole === user?.role
                  return (
                    <div key={message.id} className={`rounded-xl px-3 py-2 ${isCurrentUser ? 'bg-brand-50 dark:bg-brand-500/10 ml-8' : 'bg-slate-50 dark:bg-slate-800 mr-8'}`}>
                      <p className="text-xs uppercase font-bold tracking-wider text-slate-500 mb-1">
                        {message.senderType === 'ASSISTANT' ? 'AI Assistant' : message.senderType === 'SUPPORT' ? 'Support Team' : (message.senderRole || 'User')}
                      </p>
                      <p className="text-sm text-slate-800 dark:text-slate-100 whitespace-pre-wrap">{message.content}</p>
                      <p className="text-[10px] text-slate-400 mt-1">{new Date(message.createdAt).toLocaleString()}</p>
                    </div>
                  )
                })
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex gap-2">
              <input
                value={newMessage}
                onChange={(event) => setNewMessage(event.target.value)}
                placeholder="Type your support message"
                className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm"
              />
              <button
                onClick={sendMessage}
                disabled={!selectedThreadId || sending || !newMessage.trim()}
                className="inline-flex items-center gap-1 rounded-xl bg-slate-900 text-white px-4 py-2 text-sm font-bold disabled:opacity-60"
              >
                <Send size={14} /> Send
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-3">
            <h2 className="font-black text-slate-900 dark:text-slate-100 text-sm uppercase tracking-widest flex items-center gap-2">
              <ThumbsUp size={16} /> Submit Feedback
            </h2>
            <select
              value={feedbackCategory}
              onChange={(event) => setFeedbackCategory(event.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm"
            >
              {FEEDBACK_CATEGORIES.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
            <textarea
              value={feedbackMessage}
              onChange={(event) => setFeedbackMessage(event.target.value)}
              placeholder="Describe your feedback"
              className="w-full min-h-[120px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm"
            />
            <select
              value={feedbackRating}
              onChange={(event) => setFeedbackRating(event.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm"
            >
              <option value="">Optional rating</option>
              <option value="1">1 - Very poor</option>
              <option value="2">2 - Poor</option>
              <option value="3">3 - Okay</option>
              <option value="4">4 - Good</option>
              <option value="5">5 - Excellent</option>
            </select>
            <button
              onClick={submitFeedback}
              disabled={sending || !feedbackMessage.trim()}
              className="w-full rounded-xl bg-slate-900 text-white py-2.5 text-sm font-bold disabled:opacity-60"
            >
              {sending ? 'Submitting...' : 'Submit Feedback'}
            </button>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
            <h2 className="font-black text-slate-900 dark:text-slate-100 text-sm uppercase tracking-widest mb-3 flex items-center gap-2">
              <MessageSquare size={16} /> Feedback History
            </h2>
            {feedbackLoading ? (
              <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" /> Loading feedback...</div>
            ) : feedbackItems.length === 0 ? (
              <p className="text-sm text-slate-500">No feedback submitted yet.</p>
            ) : (
              <div className="space-y-3">
                {feedbackItems.map((item) => (
                  <div key={item.id} className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{item.category}</p>
                      <span className="text-[10px] uppercase tracking-widest font-black text-slate-500">{item.status}</span>
                    </div>
                    <p className="text-sm text-slate-700 dark:text-slate-200 mt-1 whitespace-pre-wrap">{item.message}</p>
                    <p className="text-xs text-slate-500 mt-2">
                      {item.rating ? `Rating: ${item.rating}/5 | ` : ''}
                      {canViewSchoolWide(user?.role) && item.user
                        ? `${item.user.firstName || ''} ${item.user.lastName || ''} (${item.user.role || ''}) | `
                        : ''}
                      {new Date(item.createdAt).toLocaleString()}
                    </p>
                    {canViewSchoolWide(user?.role) && (
                      <div className="mt-3">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</label>
                        <select
                          value={item.status}
                          onChange={(event) => updateFeedbackStatus(item.id, event.target.value as FeedbackItem['status'])}
                          className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm"
                        >
                          <option value="NEW">New</option>
                          <option value="REVIEWED">Reviewed</option>
                          <option value="CLOSED">Closed</option>
                        </select>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function canViewSchoolWide(role?: string) {
  return role === 'DIRECTOR' || role === 'PRINCIPAL'
}

export default SupportPage


