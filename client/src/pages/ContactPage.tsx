import { useState } from 'react'
import type { FormEvent } from 'react'
import MarketingFooter from '../components/marketing/MarketingFooter'
import MarketingNavbar from '../components/marketing/MarketingNavbar'
import { API_BASE } from '../lib/config'

type ContactFormData = {
  name: string
  email: string
  message: string
}

const initialFormData: ContactFormData = {
  name: '',
  email: '',
  message: '',
}

const ContactPage = () => {
  const [formData, setFormData] = useState<ContactFormData>(initialFormData)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setSuccess(null)
    setError(null)

    try {
      const response = await fetch(`${API_BASE}/api/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
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
            : 'Failed to send message')
        )
      }

      setSuccess('Message sent successfully. We will contact you shortly.')
      setFormData(initialFormData)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to send message')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <MarketingNavbar />
      <main className="px-6 py-16">
        <section className="mx-auto w-full max-w-6xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="grid gap-10 lg:grid-cols-2">
            <div>
              <h1 className="text-4xl font-black leading-tight sm:text-5xl">Contact SchoolFlow</h1>
              <p className="mt-4 max-w-xl text-slate-600">
                Let us know your school size and goals. We can help you set up a smooth onboarding experience.
              </p>
              <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-600">
                  Response time: usually within 24 hours.
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-brand-500"
                  placeholder="Your name"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(event) => setFormData((prev) => ({ ...prev, email: event.target.value }))}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-brand-500"
                  placeholder="you@school.com"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Message</label>
                <textarea
                  required
                  rows={6}
                  value={formData.message}
                  onChange={(event) => setFormData((prev) => ({ ...prev, message: event.target.value }))}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-brand-500"
                  placeholder="Tell us what you need help with"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-brand-700 to-brand-500 px-6 py-3 font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? 'Sending...' : 'Send Message'}
              </button>
              {success && <p className="text-sm text-emerald-700">{success}</p>}
              {error && <p className="text-sm text-rose-600">{error}</p>}
            </form>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </div>
  )
}

export default ContactPage
