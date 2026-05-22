import { AlertTriangle, CreditCard, Lock } from 'lucide-react'

interface ExpiredSchoolPanelProps {
  role?: string
  onRenew?: () => void
}

const ExpiredSchoolPanel = ({ role, onRenew }: ExpiredSchoolPanelProps) => {
  const isDirector = role === 'DIRECTOR'

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-4xl items-center justify-center">
      <div className="w-full rounded-[2.5rem] border border-slate-200 bg-white p-8 shadow-sm sm:p-10">
        <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
          <div className="mb-6 rounded-[2rem] bg-red-50 p-4 text-red-600">
            {isDirector ? <CreditCard size={34} /> : <Lock size={34} />}
          </div>
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-red-500">Subscription Expired</p>
          <h1 className="mt-3 text-3xl font-black italic text-slate-900">
            {isDirector ? 'Renew your school term plan to continue' : 'School access is currently restricted'}
          </h1>
          <p className="mt-4 max-w-xl text-base font-medium leading-relaxed text-slate-600">
            {isDirector
              ? 'This school subscription has expired. Renew the active term plan now to restore full platform access for your staff and students.'
              : 'Your school subscription has expired. Normal dashboard access is blocked until the Director renews the plan.'}
          </p>

          <div className="mt-8 w-full rounded-[2rem] border border-slate-200 bg-slate-50 p-5 text-left">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 text-amber-500" size={18} />
              <div>
                <p className="text-sm font-black text-slate-900">What happens now?</p>
                <p className="mt-1 text-sm font-medium text-slate-600">
                  Only subscription renewal actions remain available until the school term is renewed and activated again.
                </p>
              </div>
            </div>
          </div>

          {isDirector && onRenew && (
            <button
              type="button"
              onClick={onRenew}
              className="mt-8 inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-6 py-4 text-sm font-black uppercase tracking-[0.2em] text-white transition hover:bg-slate-800"
            >
              <CreditCard size={16} />
              Renew Subscription
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default ExpiredSchoolPanel

