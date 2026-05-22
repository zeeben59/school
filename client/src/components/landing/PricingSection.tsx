import { Link } from 'react-router-dom'
import { CheckCircle2 } from 'lucide-react'

const plans = [
  { name: '3-Day Trial', amountLabel: 'Free', description: 'Full platform trial for your school setup and onboarding.' },
  { name: 'First Term', amountLabel: '₦75,000', description: 'School-level subscription for the first academic term.' },
  { name: 'Second Term', amountLabel: '₦100,000', description: 'School-level subscription for the second academic term.' },
  { name: 'Third Term', amountLabel: '₦110,000', description: 'School-level subscription for the third academic term.' },
]

const PricingSection = () => {
  return (
    <section id="pricing" className="scroll-mt-36 py-24 px-6 bg-slate-50/70">
      <div className="max-w-7xl mx-auto">
        <div className="text-center space-y-4 mb-14">
          <p className="text-brand-600 font-bold tracking-widest uppercase text-sm">Subscription Plans</p>
          <h2 className="text-4xl md:text-5xl font-black text-slate-900">Choose Your Plan</h2>
          <p className="text-slate-500 max-w-3xl mx-auto text-lg font-medium">
            Pricing is per school, not per user. Every school starts with a 3-day trial, then subscribes by term.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((plan) => (
            <article key={plan.name} className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
              <p className="text-xs font-black uppercase tracking-widest text-slate-500">{plan.name}</p>
              <p className="mt-4 text-3xl font-black text-slate-900">{plan.amountLabel}</p>
              <p className="mt-3 text-sm font-medium text-slate-500 leading-relaxed">{plan.description}</p>
            </article>
          ))}
        </div>

        <div className="mt-10 rounded-3xl border border-slate-200 bg-white p-6 md:p-8">
          <ul className="space-y-3 text-sm font-medium text-slate-600">
            <li className="flex items-start gap-2">
              <CheckCircle2 size={16} className="mt-0.5 text-emerald-600 shrink-0" />
              Subscription applies to the school tenant, not to individual users.
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 size={16} className="mt-0.5 text-emerald-600 shrink-0" />
              Each school receives a 3-day trial before selecting a term plan.
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 size={16} className="mt-0.5 text-emerald-600 shrink-0" />
              After trial, subscribe by First, Second, or Third Term.
            </li>
          </ul>

          <div className="mt-7 flex flex-col sm:flex-row gap-3">
            <Link to="/register" className="inline-flex items-center justify-center rounded-xl bg-slate-950 px-5 py-3 text-xs font-black uppercase tracking-wider text-white hover:bg-brand-700 transition-colors">
              Start 3-Day Trial
            </Link>
            <Link to="/register" className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-5 py-3 text-xs font-black uppercase tracking-wider text-slate-700 hover:bg-slate-50 transition-colors">
              Register School
            </Link>
            <Link to="/login" className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-5 py-3 text-xs font-black uppercase tracking-wider text-slate-700 hover:bg-slate-50 transition-colors">
              Subscribe Now
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

export default PricingSection
