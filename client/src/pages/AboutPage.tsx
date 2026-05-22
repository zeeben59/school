import { ShieldCheck, Sparkles, Zap } from 'lucide-react'
import MarketingFooter from '../components/marketing/MarketingFooter'
import MarketingNavbar from '../components/marketing/MarketingNavbar'

const stats = [
  '120+ Schools',
  '15,000+ Students',
  '800+ Teachers',
  '99.9% uptime',
  '24/7 support',
]

const AboutPage = () => {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <MarketingNavbar />
      <main>
        <section className="px-6 py-16">
          <div className="mx-auto grid w-full max-w-6xl items-center gap-10 lg:grid-cols-2">
            <div>
              <h1 className="text-4xl font-black leading-tight sm:text-5xl">
                We&apos;re on a mission to transform school management
              </h1>
              <p className="mt-5 max-w-xl leading-7 text-slate-600">
                SchoolFlow exists to make school operations simpler, faster, and more transparent for every stakeholder
                from directors and principals to teachers and students.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-100 via-white to-brand-50 p-6 shadow-sm">
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-700">SchoolFlow Dashboard</p>
                  <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">
                    Live
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">Students</p>
                    <p className="mt-1 text-xl font-bold text-slate-900">15,024</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">Attendance</p>
                    <p className="mt-1 text-xl font-bold text-slate-900">94.2%</p>
                  </div>
                  <div className="col-span-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">Performance Trend</p>
                    <div className="mt-3 flex items-end gap-1.5">
                      {[20, 35, 30, 48, 44, 60, 56, 66].map((height, index) => (
                        <span
                          key={index}
                          style={{ height: `${height}px` }}
                          className="w-6 rounded-sm bg-gradient-to-t from-brand-700 to-brand-400"
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="px-6 py-16">
          <div className="mx-auto w-full max-w-6xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <h2 className="text-center text-3xl font-bold">Trusted by Growing Schools</h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {stats.map((stat) => (
                <div key={stat} className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-center">
                  <p className="text-lg font-bold text-slate-900">{stat}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-6 py-16">
          <div className="mx-auto w-full max-w-6xl">
            <h2 className="text-center text-3xl font-bold">Why Schools Trust SchoolFlow</h2>
            <div className="mt-10 grid gap-6 md:grid-cols-3">
              <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <ShieldCheck className="h-6 w-6 text-brand-700" />
                <h3 className="mt-4 text-lg font-semibold">Secure</h3>
                <p className="mt-2 text-sm text-slate-600">Role-based access and secure workflows protect your data.</p>
              </article>
              <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <Sparkles className="h-6 w-6 text-brand-700" />
                <h3 className="mt-4 text-lg font-semibold">Reliable</h3>
                <p className="mt-2 text-sm text-slate-600">Built for consistent performance through every school term.</p>
              </article>
              <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <Zap className="h-6 w-6 text-brand-700" />
                <h3 className="mt-4 text-lg font-semibold">Built for scale</h3>
                <p className="mt-2 text-sm text-slate-600">Supports growth from one campus to multi-school operations.</p>
              </article>
            </div>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </div>
  )
}

export default AboutPage
