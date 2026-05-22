import { type ReactNode } from 'react'

interface StatCardProps {
  icon: ReactNode
  label: string
  value: string | number
  change?: string
  changeType?: 'positive' | 'negative' | 'neutral'
  bgColor?: string
  iconColor?: string
}

const StatCard = ({
  icon,
  label,
  value,
  change,
  changeType = 'neutral',
  bgColor = 'bg-brand-50/60',
  iconColor = 'text-brand-600',
}: StatCardProps) => {
  const changeColors = {
    positive: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400',
    negative: 'text-red-600 bg-red-50 dark:bg-red-500/10 dark:text-red-400',
    neutral: 'text-slate-500 bg-slate-100 dark:bg-slate-800 dark:text-slate-400',
  }

  // Handle dark mode variations for bgColor if using default brand ones
  const finalBgColor = bgColor.includes('brand') 
    ? `${bgColor} dark:bg-brand-500/10` 
    : bgColor.includes('emerald')
    ? `${bgColor} dark:bg-emerald-500/10`
    : bgColor.includes('violet')
    ? `${bgColor} dark:bg-violet-500/10`
    : bgColor.includes('amber')
    ? `${bgColor} dark:bg-amber-500/10`
    : bgColor.includes('sky')
    ? `${bgColor} dark:bg-sky-500/10`
    : bgColor

  const finalIconColor = iconColor.includes('brand')
    ? `${iconColor} dark:text-brand-400`
    : iconColor.includes('emerald')
    ? `${iconColor} dark:text-emerald-400`
    : iconColor.includes('violet')
    ? `${iconColor} dark:text-violet-400`
    : iconColor.includes('amber')
    ? `${iconColor} dark:text-amber-400`
    : iconColor.includes('sky')
    ? `${iconColor} dark:text-sky-400`
    : iconColor

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 hover:shadow-md dark:hover:border-slate-700 transition-all duration-300 group">
      <div className="flex items-start justify-between">
        <div className={`${finalBgColor} ${finalIconColor} p-3 rounded-xl transition-transform group-hover:scale-110`}>
          {icon}
        </div>
        {change && (
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${changeColors[changeType]}`}>
            {change}
          </span>
        )}
      </div>
      <div className="mt-4 space-y-1">
        <p className="text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">{value}</p>
        <p className="text-sm font-semibold text-slate-400 dark:text-slate-500">{label}</p>
      </div>
    </div>
  )
}

export default StatCard
