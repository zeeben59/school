import { Check } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import MarketingFooter from '../components/marketing/MarketingFooter'
import MarketingNavbar from '../components/marketing/MarketingNavbar'
import { API_BASE } from '../lib/config'
import { MARKETING_PRICING_FALLBACK } from '../lib/marketingPricing'
import type { MarketingPricingPayload } from '../lib/marketingPricing'

const baseFeatures = [
  'Role-based access control',
  'Attendance and results tools',
  'School-level subscription billing',
]

const PricingPage = () => {
  const [pricing, setPricing] = useState<MarketingPricingPayload>(MARKETING_PRICING_FALLBACK)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()

    const loadPricing = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/pricing`, {
          signal: controller.signal,
        })
        if (!response.ok) {
          throw new Error('Failed to load pricing')
        }

        const payload = (await response.json()) as MarketingPricingPayload
        if (!payload?.terms?.length) {
          throw new Error('Invalid pricing payload')
        }

        setPricing(payload)
      } catch {
        setPricing(MARKETING_PRICING_FALLBACK)
      } finally {
        setLoading(false)
      }
    }

    loadPricing()
    return () => controller.abort()
  }, [])

  const plans = useMemo(() => {
    const termPlans = pricing.terms.map((term, index) => ({
      name: term.termName,
      price: `${new Intl.NumberFormat('en-NG', { style: 'currency', currency: pricing.currency || 'NGN', maximumFractionDigits: 0 }).format(term.amount)}/term`,
      features: [...baseFeatures, index === 1 ? 'Most popular for growing schools' : 'Standard onboarding support'],
      cta: `Choose ${term.termName}`,
      highlight: index === 1,
    }))

    return [
      {
        name: 'Trial',
        price: `${pricing.trialDays}-Day Free Trial`,
        features: ['Full platform access', 'No card required to get started', 'Setup and onboarding support'],
        cta: 'Start Trial',
        highlight: false,
      },
      ...termPlans,
    ]
  }, [pricing])

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <MarketingNavbar />
      <main className="px-6 py-16">
        <div className="mx-auto w-full max-w-6xl">
          <div className="text-center">
            <h1 className="text-4xl font-black sm:text-5xl">Simple Pricing for Every School Stage</h1>
            <p className="mx-auto mt-4 max-w-2xl text-slate-600">
              Start free, then choose the plan that fits your school size and operational needs.
            </p>
          </div>

          {loading && (
            <div className="mt-8 rounded-xl border border-slate-200 bg-white p-4 text-center text-sm text-slate-600">
              Loading current pricing...
            </div>
          )}

          <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {plans.map((plan) => (
              <article
                key={plan.name}
                className={`rounded-2xl border p-7 shadow-sm transition hover:-translate-y-1 hover:shadow-lg ${
                  plan.highlight ? 'border-brand-400 bg-brand-50/40' : 'border-slate-200 bg-white'
                }`}
              >
                <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">{plan.name}</p>
                <h2 className="mt-4 text-3xl font-black">{plan.price}</h2>
                <ul className="mt-6 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-slate-700">
                      <Check className="mt-0.5 h-4 w-4 text-brand-700" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  to="/register"
                  className={`mt-8 inline-flex w-full items-center justify-center rounded-xl px-5 py-3 font-semibold transition ${
                    plan.highlight
                      ? 'bg-gradient-to-r from-brand-700 to-brand-500 text-white hover:brightness-110'
                      : 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-100'
                  }`}
                >
                  {plan.cta}
                </Link>
              </article>
            ))}
          </div>
        </div>
      </main>
      <MarketingFooter />
    </div>
  )
}

export default PricingPage
