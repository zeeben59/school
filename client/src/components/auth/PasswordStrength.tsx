import { CheckCircle2, Circle } from 'lucide-react'

const requirements = [
  {
    key: 'length',
    label: '8+ characters',
    test: (value: string) => value.length >= 8,
  },
  {
    key: 'uppercase',
    label: 'Uppercase letter',
    test: (value: string) => /[A-Z]/.test(value),
  },
  {
    key: 'number',
    label: 'Number or symbol',
    test: (value: string) => /[0-9!@#$%^&*]/.test(value),
  },
  {
    key: 'lowercase',
    label: 'Lowercase letter',
    test: (value: string) => /[a-z]/.test(value),
  },
]

interface PasswordStrengthProps {
  password: string
}

const PasswordStrength = ({ password }: PasswordStrengthProps) => {
  const matches = requirements.filter((requirement) => requirement.test(password))
  const score = matches.length
  const intensity = score / requirements.length

  const strengthLabel = password.length === 0
    ? 'Waiting for password'
    : score <= 1
    ? 'Very weak'
    : score === 2
    ? 'Fair'
    : score === 3
    ? 'Strong'
    : 'Excellent'

  const strengthColor = score < 2 ? 'bg-rose-500' : score < 3 ? 'bg-amber-400' : 'bg-emerald-500'

  return (
    <div className="space-y-3 rounded-[1.5rem] border border-slate-200/80 bg-slate-50/80 p-4 text-sm text-slate-700">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.26em] text-slate-400">Password strength</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{strengthLabel}</p>
        </div>
        <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">{score}/4</div>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-slate-200">
        <div className={`h-2 rounded-full ${strengthColor}`} style={{ width: `${Math.round(intensity * 100)}%` }} />
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {requirements.map((requirement) => {
          const passed = requirement.test(password)
          return (
            <div key={requirement.key} className="flex items-center gap-2 text-xs text-slate-600">
              {passed ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Circle className="h-4 w-4 text-slate-300" />}
              <span>{requirement.label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default PasswordStrength
