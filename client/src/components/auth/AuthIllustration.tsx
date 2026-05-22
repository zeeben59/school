import { motion } from 'framer-motion'

const AuthIllustration = () => {
  return (
    <div className="relative flex min-h-[420px] flex-col justify-between overflow-hidden rounded-[2rem] bg-[radial-gradient(circle_at_top_left,_rgba(96,165,250,0.35),_transparent_40%),radial-gradient(circle_at_bottom_right,_rgba(129,140,248,0.3),_transparent_35%)] px-6 py-8 text-white sm:px-10 lg:px-12">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.16),_transparent_35%)]" />
      <div className="relative z-10 space-y-6">
        <div className="rounded-3xl border border-white/10 bg-white/10 p-5 shadow-[0_25px_70px_-40px_rgba(255,255,255,0.5)]">
          <p className="text-xs uppercase tracking-[0.32em] text-sky-200/90">School analytics</p>
          <h2 className="mt-4 text-3xl font-black tracking-tight">Growth in attendance</h2>
          <p className="mt-2 max-w-xs text-sm text-slate-200/90">Interactive insights that keep principals informed and action-ready.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-[1.75rem] border border-white/10 bg-white/10 p-5"
          >
            <p className="text-xs uppercase tracking-[0.32em] text-sky-200/80">Attendance</p>
            <p className="mt-3 text-3xl font-black">+12%</p>
            <p className="mt-2 text-sm text-slate-200/80">Daily performance versus last week.</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18 }}
            className="rounded-[1.75rem] border border-white/10 bg-white/10 p-5"
          >
            <p className="text-xs uppercase tracking-[0.32em] text-sky-200/80">Teachers</p>
            <p className="mt-3 text-3xl font-black">128</p>
            <p className="mt-2 text-sm text-slate-200/80">Active faculty across all campuses.</p>
          </motion.div>
        </div>
      </div>

      <div className="relative z-10 space-y-4 rounded-[2rem] border border-white/10 bg-slate-950/20 p-6 shadow-2xl shadow-slate-950/40 backdrop-blur">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-3xl bg-white/10 p-4">
            <p className="text-xxs uppercase tracking-[0.32em] text-slate-200/70">Secure</p>
            <p className="mt-3 text-2xl font-black">AES</p>
          </div>
          <div className="rounded-3xl bg-white/10 p-4">
            <p className="text-xxs uppercase tracking-[0.32em] text-slate-200/70">Cloud</p>
            <p className="mt-3 text-2xl font-black">99.99%</p>
          </div>
          <div className="rounded-3xl bg-white/10 p-4">
            <p className="text-xxs uppercase tracking-[0.32em] text-slate-200/70">Insights</p>
            <p className="mt-3 text-2xl font-black">Live</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AuthIllustration
