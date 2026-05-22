import { ReactNode } from 'react'
import { cn } from '../../lib/utils'

interface AuthCardProps {
  title: string
  description?: string
  children: ReactNode
  className?: string
}

const AuthCard = ({ title, description, children, className }: AuthCardProps) => {
  return (
    <section className={cn('space-y-4 rounded-[1.75rem] border border-slate-200/70 bg-white/90 p-6 shadow-xl shadow-slate-900/5', className)}>
      <div className="space-y-2">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h2>
        {description && <p className="text-sm text-slate-500">{description}</p>}
      </div>
      {children}
    </section>
  )
}

export default AuthCard
