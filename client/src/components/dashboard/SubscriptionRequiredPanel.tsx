import { CreditCard, Lock } from 'lucide-react'

interface SubscriptionRequiredPanelProps {
  role?: string
  onSubscribe?: () => void
}

const SubscriptionRequiredPanel = ({ role, onSubscribe }: SubscriptionRequiredPanelProps) => {
  const isDirector = role === 'DIRECTOR'

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-4xl items-center justify-center">
      <div className="w-full rounded-[2.5rem] border border-slate-200 bg-white p-8 shadow-sm sm:p-10">
        <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
          <div className="mb-6 rounded-[2rem] bg-brand-50 p-4 text-brand-600">
            {isDirector ? <CreditCard size={34} /> : <Lock size={34} />}
          </div>
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-brand-500">Subscription Required</p>
          <h1 className="mt-3 text-3xl font-black italic text-slate-900">
            {isDirector ? 'Activate a term subscription to unlock modules' : 'School access is locked until subscription'}
          </h1>
          <p className="mt-4 max-w-xl text-base font-medium leading-relaxed text-slate-600">
            {isDirector
              ? 'Your school trial has ended. Teachers, principals, students, classes, attendance, and results remain locked until a term subscription is paid.'
              : 'Your school trial has ended. Advanced modules are unavailable until the Director subscribes.'}
          </p>

          {isDirector && onSubscribe && (
            <button
              type="button"
              onClick={onSubscribe}
              className="mt-8 inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-6 py-4 text-sm font-black uppercase tracking-[0.2em] text-white transition hover:bg-slate-800"
            >
              <CreditCard size={16} />
              Open Subscription Plan
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default SubscriptionRequiredPanel
