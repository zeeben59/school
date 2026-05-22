import { type ReactNode } from 'react'

interface QuickActionProps {
  icon: ReactNode
  label: string
  description?: string
  onClick?: () => void
  color?: string
}

const QuickAction = ({
  icon,
  label,
  description,
  onClick,
  color = 'brand',
}: QuickActionProps) => {
  const colorVariants: Record<string, { iconBg: string; iconText: string; hover: string }> = {
    brand: { iconBg: 'bg-brand-50 dark:bg-brand-500/10', iconText: 'text-brand-600 dark:text-brand-400', hover: 'hover:border-brand-200 dark:hover:border-brand-900' },
    emerald: { iconBg: 'bg-emerald-50 dark:bg-emerald-500/10', iconText: 'text-emerald-600 dark:text-emerald-400', hover: 'hover:border-emerald-200 dark:hover:border-emerald-900' },
    violet: { iconBg: 'bg-violet-50 dark:bg-violet-500/10', iconText: 'text-violet-600 dark:text-violet-400', hover: 'hover:border-violet-200 dark:hover:border-violet-900' },
    amber: { iconBg: 'bg-amber-50 dark:bg-amber-500/10', iconText: 'text-amber-600 dark:text-amber-400', hover: 'hover:border-amber-200 dark:hover:border-amber-900' },
    rose: { iconBg: 'bg-rose-50 dark:bg-rose-500/10', iconText: 'text-rose-600 dark:text-rose-400', hover: 'hover:border-rose-200 dark:hover:border-rose-900' },
    sky: { iconBg: 'bg-sky-50 dark:bg-sky-500/10', iconText: 'text-sky-600 dark:text-sky-400', hover: 'hover:border-sky-200 dark:hover:border-sky-900' },
  }

  const variant = colorVariants[color] || colorVariants.brand

  return (
    <button
      onClick={onClick}
      className={`bg-white dark:bg-slate-900 ${variant.hover} rounded-2xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-4 text-left hover:shadow-md transition-all duration-300 group w-full cursor-pointer`}
    >
      <div className={`${variant.iconBg} ${variant.iconText} p-3 rounded-xl transition-transform group-hover:scale-110 shrink-0`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{label}</p>
        {description && (
          <p className="text-xs text-slate-400 dark:text-slate-500 font-medium truncate">{description}</p>
        )}
      </div>
    </button>
  )
}

export default QuickAction
