import { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { cn } from '../../lib/utils'

interface AuthLayoutProps {
  title: string
  subtitle: string
  accentText?: string
  panel: ReactNode
  children: ReactNode
  footer?: ReactNode
  theme?: 'light' | 'dark'
}

const AuthLayout = ({
  title,
  subtitle,
  accentText,
  panel,
  children,
  footer,
  theme = 'light',
}: AuthLayoutProps) => {
  const isDark = theme === 'dark'

  return (
    <div
      className={cn(
        'min-h-screen overflow-hidden',
        isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-950'
      )}
    >
      <div className="mx-auto flex min-h-screen w-full max-w-[1640px] flex-col lg:flex-row">
        <aside
          className={cn(
            'relative flex min-h-[420px] flex-1 flex-col justify-between overflow-hidden px-6 py-10 sm:px-10 lg:px-14',
            isDark ? 'bg-slate-950 text-slate-100' : 'bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white'
          )}
        >
          {panel}
        </aside>

        <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6 lg:px-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className={cn(
              'w-full max-w-[520px] rounded-[2rem] border p-8 shadow-[0_42px_120px_-40px_rgba(15,23,42,0.4)]',
              isDark
                ? 'border-slate-800 bg-slate-900/95'
                : 'border-slate-200 bg-white/95'
            )}
          >
            <div className="space-y-3 pb-6 text-center xl:pb-8">
              <p className="text-sm font-semibold uppercase tracking-[0.34em] text-brand-600">{accentText || 'Welcome to SchoolFlow'}</p>
              <h1 className={cn('text-3xl font-black tracking-tight sm:text-4xl', isDark ? 'text-white' : 'text-slate-950')}>
                {title}
              </h1>
              <p className={cn('mx-auto max-w-[34rem] text-sm sm:text-base', isDark ? 'text-slate-300' : 'text-slate-500')}>
                {subtitle}
              </p>
            </div>

            {children}

            {footer && <div className="mt-6">{footer}</div>}
          </motion.div>
        </main>
      </div>
    </div>
  )
}

export default AuthLayout
