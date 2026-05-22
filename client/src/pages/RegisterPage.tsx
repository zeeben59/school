import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { ArrowRight, Loader2, AlertCircle, Sparkles, Mail, Phone, MapPin, User, School } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import AuthLayout from '../components/auth/AuthLayout'
import AuthCard from '../components/auth/AuthCard'
import AuthInput from '../components/auth/AuthInput'
import PasswordField from '../components/ui/PasswordField'
import PasswordStrength from '../components/auth/PasswordStrength'
import AuthIllustration from '../components/auth/AuthIllustration'
import { supabase } from '../lib/supabase'

const registerSchema = z.object({
  schoolName: z.string().min(3, 'School name must be at least 3 characters'),
  directorFullName: z.string().min(5, 'Please enter your full name'),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(10, 'Invalid phone number'),
  address: z.string().min(10, 'Please enter a complete school address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
})

type RegisterForm = z.infer<typeof registerSchema>

const RegisterPage = () => {
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [passwordValue, setPasswordValue] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    mode: 'onTouched',
  })

  const onSubmit = async (data: RegisterForm) => {
    setIsLoading(true)
    setError(null)

    try {
      const { error: authError } = await supabase.auth.signUp({
        email: data.email.trim().toLowerCase(),
        password: data.password,
        options: {
          data: {
            full_name: data.directorFullName,
            first_name: data.directorFullName.split(' ')[0] || 'User',
            last_name: data.directorFullName.split(' ').slice(1).join(' '),
            school: data.schoolName,
            address: data.address,
            phone: data.phone,
            role: 'DIRECTOR',
            status: 'ACTIVE',
          },
        },
      })

      if (authError) {
        throw new Error(authError.message)
      }

      navigate('/login', {
        state: {
          registered: true,
          email: data.email,
        },
        replace: true,
      })
    } catch (err: any) {
      console.error('Registration request failed:', err)
      const fallback = 'Something went wrong. Please try again.'
      const message = err.message || fallback
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AuthLayout
      title="Build a smarter school experience"
      subtitle="Register your school with secure OTP onboarding, premium analytics and Paystack billing integration."
      accentText="Premium onboarding"
      panel={(
        <div className="relative z-10 flex h-full flex-col justify-between gap-8">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-3 rounded-3xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-sky-100 shadow-2xl shadow-slate-950/20 backdrop-blur">
              <Sparkles size={18} />
              <span>Trusted by fast-growing schools</span>
            </div>
            <div className="space-y-4">
              <p className="text-xs uppercase tracking-[0.32em] text-sky-200/80">School analytics</p>
              <h2 className="text-4xl font-black tracking-tight text-white">A modern control center for attendance, payments, and admissions.</h2>
              <p className="max-w-md text-sm leading-6 text-slate-200/80">Everything your school leadership needs to stay ahead: data, security, and real-time workflows in one polished platform.</p>
            </div>
          </div>

          <AuthIllustration />

          <div className="rounded-[1.75rem] border border-white/10 bg-white/10 p-5 text-sm text-slate-200 shadow-xl backdrop-blur">
            <p className="uppercase tracking-[0.32em] text-sky-200/70">Secure registration</p>
            <p className="mt-3">Your registration includes OTP verification, role-based tenant setup, and secure Paystack payment initiation.</p>
          </div>
        </div>
      )}
    >
      <div className="space-y-6">
        <AuthCard title="Secure school registration" description="Create your director account and complete OTP verification before Paystack billing.">
          {error && (
            <div className="rounded-[1.5rem] border border-rose-200/80 bg-rose-50/80 p-4 text-sm font-semibold text-rose-700 shadow-sm">
              <div className="flex items-center gap-2">
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
            </div>
          )}

          <p className="mt-2 text-sm leading-6 text-slate-600">Complete the form below to set up your director account and prepare for OTP verification.</p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <AuthInput
              label="School Name"
              placeholder="Sunrise International Academy"
              icon={<School size={18} />}
              error={errors.schoolName?.message}
              {...register('schoolName')}
            />
            <AuthInput
              label="Director Full Name"
              placeholder="Jane Doe"
              icon={<User size={18} />}
              error={errors.directorFullName?.message}
              {...register('directorFullName')}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <AuthInput
              label="School Email"
              type="email"
              placeholder="admin@school.com"
              icon={<Mail size={18} />}
              error={errors.email?.message}
              {...register('email')}
            />
            <AuthInput
              label="Phone Number"
              placeholder="0801 234 5678"
              icon={<Phone size={18} />}
              error={errors.phone?.message}
              {...register('phone')}
            />
          </div>

          <AuthInput
            label="School Address"
            placeholder="120 Academic Road, Lagos"
            icon={<MapPin size={18} />}
            error={errors.address?.message}
            {...register('address')}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <PasswordField
              label="Password"
              placeholder="Create a strong password"
              error={errors.password?.message}
              autocomplete="new-password"
              {...register('password', {
                onChange: (event) => setPasswordValue(event.target.value),
              })}
            />
            <PasswordField
              label="Confirm Password"
              placeholder="Re-enter password"
              error={errors.confirmPassword?.message}
              autocomplete="new-password"
              {...register('confirmPassword')}
            />
          </div>

          <PasswordStrength password={passwordValue} />

          <button
            type="submit"
            disabled={isLoading}
            className="flex w-full items-center justify-center gap-3 rounded-[1.75rem] bg-gradient-to-r from-slate-900 to-slate-700 px-6 py-4 text-sm font-semibold text-white shadow-lg shadow-slate-900/10 transition hover:-translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isLoading ? <Loader2 className="animate-spin" size={18} /> : <><ArrowRight size={18} /> Create my school account</>}
          </button>

          <div className="text-center text-sm text-slate-500">
            Already have an account? <Link to="/login" className="font-semibold text-slate-900 hover:text-slate-700">Login here</Link>
          </div>
        </form>
      </AuthCard>
      </div>
    </AuthLayout>
  )
}

export default RegisterPage
