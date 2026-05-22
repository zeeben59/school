import type { ReactNode } from 'react'
import { Activity, Inbox } from 'lucide-react'

type PageHeaderProps = {
  title: string
  description: string
  liveLabel?: string
  lastUpdatedAt?: string | null
  actions?: ReactNode
}

export function AdminPageHeader({ title, description, liveLabel, lastUpdatedAt, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div>
        <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100">{title}</h2>
        <p className="mt-1.5 max-w-3xl text-sm font-medium text-slate-500 dark:text-slate-400">{description}</p>
        {(liveLabel || lastUpdatedAt) && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold">
            {liveLabel && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-900/30 dark:text-emerald-300">
                <Activity size={12} />
                {liveLabel}
              </span>
            )}
            {lastUpdatedAt && (
              <span className="text-slate-500 dark:text-slate-400">
                Last updated {new Date(lastUpdatedAt).toLocaleTimeString()}
              </span>
            )}
          </div>
        )}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}

type MetricCardProps = {
  label: string
  value: string | number
  hint?: string
  icon?: ReactNode
  tone?: 'default' | 'success' | 'warning' | 'danger'
}

export function MetricCard({ label, value, hint, icon, tone = 'default' }: MetricCardProps) {
  const toneClass =
    tone === 'success'
      ? 'from-emerald-50 to-white dark:from-emerald-900/20 dark:to-slate-900'
      : tone === 'warning'
      ? 'from-amber-50 to-white dark:from-amber-900/20 dark:to-slate-900'
      : tone === 'danger'
      ? 'from-rose-50 to-white dark:from-rose-900/20 dark:to-slate-900'
      : 'from-slate-50 to-white dark:from-slate-900 dark:to-slate-900'

  return (
    <div className={`group rounded-2xl border border-slate-200/90 bg-gradient-to-br p-5 shadow-sm shadow-slate-200/40 transition hover:-translate-y-0.5 hover:shadow-md hover:shadow-slate-200/50 dark:border-slate-800 dark:shadow-black/20 ${toneClass}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</p>
        {icon ? (
          <span className="rounded-xl border border-slate-200 bg-white/80 p-2 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {icon}
          </span>
        ) : null}
      </div>
      <p className="mt-3 text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100">{value}</p>
      {hint ? <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">{hint}</p> : null}
    </div>
  )
}

type SectionCardProps = {
  title: string
  subtitle?: string
  children: ReactNode
  className?: string
}

export function SectionCard({ title, subtitle, children, className = '' }: SectionCardProps) {
  return (
    <section className={`rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm shadow-slate-200/40 transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/20 ${className}`}>
      <div className="mb-4">
        <h3 className="text-base font-black tracking-tight text-slate-900 dark:text-slate-100">{title}</h3>
        {subtitle ? <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  )
}

export function AdminEmptyState({ message, action }: { message: string; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center dark:border-slate-700 dark:bg-slate-900/40">
      <div className="mx-auto mb-3 inline-flex rounded-2xl border border-slate-200 bg-white p-3 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
        <Inbox size={18} />
      </div>
      <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{message}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}

export function AdminStatusBadge({ value }: { value: string }) {
  const normalized = String(value || '').toUpperCase()

  const classes =
    normalized === 'ACTIVE' || normalized === 'APPROVED' || normalized === 'SUCCESS' || normalized === 'RESOLVED'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-900/30 dark:text-emerald-300'
      : normalized === 'TRIAL' || normalized === 'IN_PROGRESS' || normalized === 'REVIEWED' || normalized === 'OPEN'
      ? 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800/60 dark:bg-sky-900/30 dark:text-sky-300'
      : normalized === 'PENDING' || normalized === 'PENDING_PAYMENT' || normalized === 'NEW' || normalized === 'OPEN'
      ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/60 dark:bg-amber-900/30 dark:text-amber-300'
      : normalized === 'EXPIRED' || normalized === 'FAILED' || normalized === 'CANCELLED' || normalized === 'CLOSED' || normalized === 'REJECTED' || normalized === 'SUSPENDED' || normalized === 'DISABLED'
      ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800/60 dark:bg-rose-900/30 dark:text-rose-300'
      : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'

  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.12em] ${classes}`}>
      {value}
    </span>
  )
}

export function AdminTableContainer({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200/90 bg-white shadow-sm shadow-slate-200/40 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/20">
      {children}
    </div>
  )
}

export function AdminLoadingState() {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map(item => (
          <div key={item} className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-100 via-slate-50 to-slate-100 dark:border-slate-800 dark:from-slate-800 dark:via-slate-900 dark:to-slate-800" />
        ))}
      </div>
      <div className="h-80 animate-pulse rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-100 via-slate-50 to-slate-100 dark:border-slate-800 dark:from-slate-800 dark:via-slate-900 dark:to-slate-800" />
    </div>
  )
}
