import { useEffect, useMemo, useState } from 'react'
import { API_BASE } from '../../lib/config'
import { getTermPriceNaira } from '../../lib/subscriptionPricing'
import { AlertCircle, CalendarDays, CheckCircle2, CreditCard, Loader2, RefreshCw, X } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

interface SubscriptionPlanModalProps {
  open: boolean
  onClose: () => void
}

interface SubscriptionStatusPayload {
  schoolStatus: string
  currentStatus: string
  hasActiveTrial?: boolean
  activeTerm: string | null
  price: number
  termPrices?: Record<string, number>
  expiryDate: string | null
  startDate: string | null
  paymentReference: string | null
  availableTerms: string[]
  trial?: {
    days: number
    startsAt: string
    endsAt: string
    isActive: boolean
  } | null
}

const SubscriptionPlanModal = ({ open, onClose }: SubscriptionPlanModalProps) => {
  const { token, user } = useAuth()
  const [selectedTerm, setSelectedTerm] = useState('First Term')
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [subscription, setSubscription] = useState<SubscriptionStatusPayload | null>(null)

  const isRenewal = useMemo(
    () => subscription?.schoolStatus === 'EXPIRED' || subscription?.currentStatus === 'EXPIRED',
    [subscription]
  )
  const selectedPrice = getTermPriceNaira(selectedTerm, subscription?.termPrices)

  const fetchSubscriptionStatus = async () => {
    if (!token || !open) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`${API_BASE}/api/payments/subscription/status`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to load subscription details.')
      }

      setSubscription(data)
      if (data.activeTerm) {
        setSelectedTerm(data.activeTerm)
      } else if (Array.isArray(data.availableTerms) && data.availableTerms.length > 0) {
        setSelectedTerm(data.availableTerms[0])
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load subscription details.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSubscriptionStatus()
  }, [open, token])

  if (!open) return null

  const handleInitializePayment = async () => {
    if (!token) return

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch(`${API_BASE}/api/payments/subscription/initialize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ termName: selectedTerm }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to initialize subscription payment.')
      }

      window.location.href = data.authorization_url
    } catch (err: any) {
      setError(err.message || 'Failed to initialize subscription payment.')
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/65 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-3xl overflow-hidden rounded-[2.5rem] border border-slate-200 bg-white shadow-2xl">
        <div className="bg-gradient-to-r from-brand-700 via-brand-600 to-brand-500 px-6 py-6 text-white sm:px-8">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="rounded-2xl bg-white/15 p-3">
                <CreditCard size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-black italic">Subscription Plan</h2>
                <p className="text-sm font-medium text-white/80">
                  Manage your school term access for {user?.school || 'your school'}.
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-2xl bg-white/10 p-2 text-white/80 transition hover:bg-white/20 hover:text-white"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="space-y-6 p-6 sm:p-8">
          {error && (
            <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm font-medium text-red-700">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center gap-4 py-16">
              <Loader2 className="animate-spin text-brand-600" size={28} />
              <p className="text-sm font-bold uppercase tracking-widest text-slate-500">Loading subscription details</p>
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-[2rem] border border-slate-200 bg-slate-50 p-5">
                  <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Current Status</p>
                  <p className="mt-3 text-2xl font-black text-slate-900">
                    {subscription?.hasActiveTrial ? 'TRIAL' : (subscription?.schoolStatus || 'INACTIVE')}
                  </p>
                </div>
                <div className="rounded-[2rem] border border-slate-200 bg-slate-50 p-5">
                  <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Active Term</p>
                  <p className="mt-3 text-2xl font-black text-slate-900">
                    {subscription?.activeTerm || 'None'}
                  </p>
                </div>
                <div className="rounded-[2rem] border border-slate-200 bg-slate-50 p-5">
                  <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Expiry Date</p>
                  <p className="mt-3 text-lg font-black text-slate-900">
                    {subscription?.expiryDate ? new Date(subscription.expiryDate).toLocaleDateString() : 'Not active'}
                  </p>
                </div>
              </div>

              <div className="rounded-[2.25rem] border border-slate-200 bg-slate-50 p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-brand-700">Available Term Plan</p>
                    <h3 className="mt-2 text-3xl font-black text-slate-900">
                      NGN {selectedPrice.toLocaleString()}
                    </h3>
                    <p className="mt-2 text-sm font-medium text-slate-500">
                      Subscribe for a school term. Once the term expires, the school is blocked until renewed.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600">
                    <CalendarDays size={16} className="text-brand-600" />
                    {isRenewal ? 'Renewal required' : 'Ready to subscribe'}
                  </div>
                </div>

                {subscription?.trial?.isActive && (
                  <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
                    3-day school trial is active until {new Date(subscription.trial.endsAt).toLocaleDateString()}.
                  </div>
                )}

                <div className="mt-6 grid gap-3 md:grid-cols-3">
                  {(subscription?.availableTerms || ['First Term', 'Second Term', 'Third Term']).map((term) => {
                    const active = selectedTerm === term
                    return (
                      <button
                        key={term}
                        type="button"
                        onClick={() => setSelectedTerm(term)}
                        className={`rounded-2xl border px-4 py-4 text-left transition ${
                          active
                            ? 'border-brand-500 bg-brand-50 text-brand-700 shadow-sm'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-brand-300'
                        }`}
                      >
                        <p className="text-sm font-black">{term}</p>
                        <p className="mt-1 text-xs font-medium text-current/80">
                          NGN {getTermPriceNaira(term, subscription?.termPrices).toLocaleString()}
                        </p>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="flex flex-col gap-3 rounded-[2rem] border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3 text-sm font-medium text-slate-600">
                  <CheckCircle2 size={18} className="text-emerald-500" />
                  <span>
                    {subscription?.activeTerm
                      ? `Current school term: ${subscription.activeTerm}`
                      : 'No active term subscription yet.'}
                  </span>
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={fetchSubscriptionStatus}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                  >
                    <RefreshCw size={16} />
                    Refresh
                  </button>
                  <button
                    type="button"
                    onClick={handleInitializePayment}
                    disabled={submitting}
                    className="inline-flex min-w-[190px] items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-black uppercase tracking-[0.18em] text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting ? <Loader2 size={18} className="animate-spin" /> : <CreditCard size={16} />}
                    {isRenewal ? 'Renew Plan' : 'Subscribe Now'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default SubscriptionPlanModal
