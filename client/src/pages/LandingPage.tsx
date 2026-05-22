import {
  BookOpen,
  CalendarCheck,
  CreditCard,
  GraduationCap,
  LayoutDashboard,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import MarketingFooter from '../components/marketing/MarketingFooter'
import MarketingNavbar from '../components/marketing/MarketingNavbar'
import { API_BASE } from '../lib/config'
import { SCHOOL_TRIAL_DAYS_FALLBACK } from '../lib/subscriptionPricing'

const stripFeatures = [
  { label: 'Dashboard', icon: LayoutDashboard },
  { label: 'Student Management', icon: Users },
  { label: 'Results', icon: BookOpen },
  { label: 'Attendance', icon: CalendarCheck },
  { label: 'Payments', icon: CreditCard },
]

const featureCards = [
  {
    title: 'Student Management',
    description: 'Centralize student records, classes, guardians, and enrollment history.',
    icon: Users,
  },
  {
    title: 'Attendance Monitoring',
    description: 'Track daily attendance and identify trends across all classes.',
    icon: CalendarCheck,
  },
  {
    title: 'Results and Reports',
    description: 'Upload scores, publish results, and generate report slips in minutes.',
    icon: BookOpen,
  },
  {
    title: 'Staff Management',
    description: 'Manage staff roles, responsibilities, and department visibility securely.',
    icon: GraduationCap,
  },
  {
    title: 'Payments',
    description: 'Monitor subscriptions and payment status with clean billing records.',
    icon: CreditCard,
  },
  {
    title: 'Security',
    description: 'Role-based access and protected workflows for directors and staff.',
    icon: ShieldCheck,
  },
]

const LandingPage = () => {
  const [contactForm, setContactForm] = useState({ name: '', email: '', message: '' })
  const [submitting, setSubmitting] = useState(false)
  const [contactFeedback, setContactFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const handleContactSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setContactFeedback(null)
    setSubmitting(true)

    try {
      const response = await fetch(`${API_BASE}/api/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contactForm),
      })
      const raw = await response.text()
      let payload: { error?: string } | null = null
      if (raw) {
        try {
          payload = JSON.parse(raw) as { error?: string }
        } catch {
          payload = null
        }
      }
      if (!response.ok) {
        throw new Error(
          payload?.error || (response.status >= 500
            ? 'Server is unavailable. Please ensure the backend is running.'
            : 'Unable to send message')
        )
      }

      setContactFeedback({ type: 'success', message: 'Message sent successfully. Our team will reach out soon.' })
      setContactForm({ name: '', email: '', message: '' })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to send message'
      setContactFeedback({ type: 'error', message })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <MarketingNavbar />
      <main>
        <section className="px-6 pb-16 pt-20">
          <div className="mx-auto grid w-full max-w-6xl items-center gap-10 lg:grid-cols-2">
            <div>
              <p className="inline-flex rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-700">
                Built for School Leaders
              </p>
              <h1 className="mt-6 text-4xl font-black leading-tight sm:text-5xl">
                Manage Your School Smarter, Faster, and Better
              </h1>
              <p className="mt-5 max-w-xl text-base leading-7 text-slate-600">
                SchoolFlow helps schools run operations in one platform, from student records and attendance to
                results and payments.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/register"
                  className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-brand-700 to-brand-500 px-6 py-3 font-semibold text-white shadow-md transition hover:brightness-110"
                >
                  Get Started
                </Link>
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-6 py-3 font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  Login
                </Link>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_18px_40px_-24px_rgba(15,23,42,0.35)]">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-700">Dashboard Preview</p>
                <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">
                  Live
                </span>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs text-slate-500">Students</p>
                  <p className="mt-1 text-2xl font-bold">15,248</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs text-slate-500">Attendance Today</p>
                  <p className="mt-1 text-2xl font-bold">93.4%</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 sm:col-span-2">
                  <p className="text-xs text-slate-500">Performance Summary</p>
                  <div className="mt-3 flex items-end gap-2">
                    {[35, 55, 48, 72, 66, 84, 78].map((h, index) => (
                      <span
                        key={index}
                        style={{ height: `${h}px` }}
                        className="w-7 rounded-md bg-gradient-to-t from-brand-700 to-brand-400"
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="px-6 py-16">
          <div className="mx-auto w-full max-w-6xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
              {stripFeatures.map((item) => (
                <div key={item.label} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <item.icon className="h-5 w-5 text-brand-700" />
                  <p className="mt-2 text-sm font-semibold text-slate-700">{item.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="features" className="px-6 py-16">
          <div className="mx-auto w-full max-w-6xl">
            <div className="mb-10 text-center">
              <h2 className="text-3xl font-bold sm:text-4xl">Everything You Need to Run Daily Operations</h2>
              <p className="mt-3 text-slate-600">Powerful tools designed for schools of any size.</p>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {featureCards.map((card) => (
                <article
                  key={card.title}
                  className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg"
                >
                  <card.icon className="h-6 w-6 text-brand-700" />
                  <h3 className="mt-4 text-lg font-semibold">{card.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{card.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="px-6 py-16">
          <div className="mx-auto w-full max-w-6xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <h2 className="text-center text-3xl font-bold sm:text-4xl">How It Works</h2>
            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {['Register your school', 'Verify and subscribe', 'Start managing'].map((step, index) => (
                <div key={step} className="rounded-xl border border-slate-200 bg-slate-50 p-6">
                  <p className="text-sm font-semibold text-brand-700">Step {index + 1}</p>
                  <p className="mt-2 text-lg font-semibold text-slate-900">{step}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-6 py-16">
          <div className="mx-auto w-full max-w-6xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="mx-auto max-w-md text-center">
              <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">Pricing Preview</p>
              <h2 className="mt-3 text-3xl font-bold">Start with a {SCHOOL_TRIAL_DAYS_FALLBACK}-day free trial</h2>
              <p className="mt-3 text-slate-600">Try SchoolFlow risk-free and set up your school in minutes.</p>
              <Link
                to="/pricing"
                className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-brand-700 to-brand-500 px-6 py-3 font-semibold text-white transition hover:brightness-110"
              >
                View Pricing
              </Link>
            </div>
          </div>
        </section>

        <section className="px-6 py-16">
          <div className="mx-auto w-full max-w-6xl rounded-2xl bg-slate-900 px-6 py-14 text-center text-white shadow-lg">
            <h2 className="text-3xl font-bold sm:text-4xl">Start Managing Your School Today</h2>
            <p className="mx-auto mt-3 max-w-2xl text-slate-300">
              Join forward-thinking schools using SchoolFlow to simplify operations and improve outcomes.
            </p>
            <Link
              to="/register"
              className="mt-8 inline-flex rounded-xl bg-white px-6 py-3 font-semibold text-slate-900 transition hover:bg-slate-100"
            >
              Get Started
            </Link>
          </div>
        </section>

        <section id="contact" className="px-6 py-16">
          <div className="mx-auto w-full max-w-6xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="grid gap-8 lg:grid-cols-2">
              <div>
                <h2 className="text-3xl font-bold">Contact Us</h2>
                <p className="mt-3 text-slate-600">
                  Tell us about your school and what you need. We&apos;ll get back to you quickly.
                </p>
              </div>
              <form onSubmit={handleContactSubmit} className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Name</label>
                  <input
                    type="text"
                    required
                    value={contactForm.name}
                    onChange={(event) => setContactForm((prev) => ({ ...prev, name: event.target.value }))}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-brand-500"
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
                  <input
                    type="email"
                    required
                    value={contactForm.email}
                    onChange={(event) => setContactForm((prev) => ({ ...prev, email: event.target.value }))}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-brand-500"
                    placeholder="you@school.com"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Message</label>
                  <textarea
                    required
                    rows={5}
                    value={contactForm.message}
                    onChange={(event) => setContactForm((prev) => ({ ...prev, message: event.target.value }))}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-brand-500"
                    placeholder="How can we help your school?"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-brand-700 to-brand-500 px-6 py-3 font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {submitting ? 'Sending...' : 'Send Message'}
                </button>
                {contactFeedback && (
                  <p
                    className={`text-sm ${
                      contactFeedback.type === 'success' ? 'text-emerald-700' : 'text-rose-600'
                    }`}
                  >
                    {contactFeedback.message}
                  </p>
                )}
              </form>
            </div>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </div>
  )
}

export default LandingPage
