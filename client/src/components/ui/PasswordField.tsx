import { useState, forwardRef } from 'react'
import { Eye, EyeOff, Lock } from 'lucide-react'

interface PasswordFieldProps {
  label: string
  value?: string
  placeholder?: string
  required?: boolean
  className?: string
  autocomplete?: string
  error?: string
  // Support react-hook-form props
  name?: string
  onChange?: (e: any) => void
  onBlur?: (e: any) => void
}

const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(({
  label,
  value,
  placeholder,
  required = false,
  className = "",
  autocomplete,
  error,
  name,
  onChange,
  onBlur,
}, ref) => {
  const [show, setShow] = useState(false)

  return (
    <div className={`space-y-2 ${className}`}>
      <label className="text-sm font-bold text-slate-700 ml-1 transition-colors">
        {label}
      </label>
      <div className="relative group">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-500 transition-colors">
          <Lock size={18} />
        </div>
        <input 
          ref={ref}
          name={name}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          required={required}
          type={show ? 'text' : 'password'}
          placeholder={placeholder}
          autoComplete={autocomplete}
          className={`w-full pl-12 pr-12 py-3.5 bg-white border-2 rounded-2xl outline-none focus:ring-2 focus:ring-brand-500 transition-all font-bold text-sm text-slate-900 placeholder:text-slate-500 ${
            error ? 'border-red-300 focus:ring-red-500' : 'border-transparent'
          }`}
        />
        <button 
          type="button"
          onClick={() => setShow(!show)}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-lg hover:bg-slate-100"
          title={show ? 'Hide password' : 'Show password'}
        >
          {show ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      {error && (
        <p className="text-xs font-bold text-red-500 ml-1 mt-1 animate-in fade-in slide-in-from-top-1 duration-200">
          {error}
        </p>
      )}
    </div>
  )
})

PasswordField.displayName = 'PasswordField'

export default PasswordField
