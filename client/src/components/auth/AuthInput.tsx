import { forwardRef } from 'react'
import type { ReactNode, InputHTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

interface AuthInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
  icon?: ReactNode
  helperText?: string
}

const AuthInput = forwardRef<HTMLInputElement, AuthInputProps>(
  ({ label, icon, error, helperText, className, type = 'text', ...props }, ref) => {
    return (
      <div className={cn('relative w-full', className)}>
        <div className="relative">
          {icon && (
            <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            type={type}
            placeholder=" "
            {...props}
            className={cn(
              'peer w-full rounded-[1.25rem] border px-4 py-4 text-sm font-semibold outline-none transition-all duration-200',
              icon ? 'pl-12 pr-4' : 'px-4',
              error
                ? 'border-rose-300 bg-rose-50 text-rose-900 focus:border-rose-400 focus:ring-rose-100'
                : 'border-slate-200 bg-slate-50 text-slate-950 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20',
              'placeholder:text-transparent'
            )}
          />
          <label
            className={cn(
              'pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 cursor-text text-sm font-semibold text-slate-500 transition-all duration-200',
              icon ? 'pl-8' : '',
              'peer-placeholder-shown:top-1/2 peer-placeholder-shown:text-sm peer-focus:-top-2 peer-focus:text-xs peer-focus:text-brand-600'
            )}
          >
            {label}
          </label>
        </div>

        {helperText && !error && <p className="mt-2 text-xs text-slate-500">{helperText}</p>}
        {error && <p className="mt-2 text-xs font-semibold text-rose-600">{error}</p>}
      </div>
    )
  }
)

AuthInput.displayName = 'AuthInput'

export default AuthInput
