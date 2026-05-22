import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Mail, Loader2, AlertCircle, ShieldCheck, CheckCircle2 } from 'lucide-react'
import { useNavigate, Link } from 'react-router-dom'
import AuthLayout from '../components/auth/AuthLayout'
import AuthCard from '../components/auth/AuthCard'
import AuthInput from '../components/auth/AuthInput'
import PasswordField from '../components/ui/PasswordField'
import AuthIllustration from '../components/auth/AuthIllustration'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

type LoginForm = z.infer<typeof loginSchema>

const LoginPage = () => {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rememberMe, setRememberMe] = useState(true)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    mode: 'onTouched',
  })

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true)
    setError(null)

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: data.email.trim().toLowerCase(),
        password: data.password,
      })

      if (authError || !authData.session || !authData.user) {
        throw new Error(authError?.message || 'Invalid email or password')
      }

      const fullName = (authData.user.user_metadata?.full_name as string | undefined)?.trim() || ''
      const [firstName = 'User', ...lastParts] = fullName.split(/\s+/).filter(Boolean)
      const user = {
        id: authData.user.id,
        email: authData.user.email || '',
        firstName: (authData.user.user_metadata?.first_name as string | undefined) || firstName,
        lastName: (authData.user.user_metadata?.last_name as string | undefined) || lastParts.join(' '),
        role: (authData.user.user_metadata?.role as string | undefined) || 'DIRECTOR',
        school: (authData.user.user_metadata?.school as string | undefined) || '',
        schoolId: (authData.user.user_metadata?.schoolId as string | undefined) || '',
        status: (authData.user.user_metadata?.status as string | undefined) || 'ACTIVE',
        emailVerifiedAt: authData.user.email_confirmed_at,
      }
      const token = authData.session.access_token
      login(token, user, rememberMe)

      switch (user.role) {
        case 'SUPERADMIN':
          navigate('/admin')
          break
        case 'DIRECTOR':
          navigate('/dashboard/director')
          break
        case 'PRINCIPAL':
          navigate('/dashboard/principal')
          break
        case 'TEACHER':
          navigate('/dashboard/teacher')
          break
        case 'STUDENT':
          navigate('/dashboard/student')
          break
        default:
          navigate('/dashboard')
          break
      }
    } catch (err: any) {
      setError(err?.message || 'Invalid email or password')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AuthLayout
      title="Welcome back to your education hub"
      subtitle="Access student records, attendance, payments and classroom workflows in a secure, modern dashboard."
      accentText="Secure login"
      panel={(
        <div className="relative z-10 flex h-full flex-col justify-between gap-8">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-3 rounded-3xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-slate-100 shadow-2xl shadow-slate-950/20 backdrop-blur">
              <ShieldCheck size={18} />
              <span>Secure cloud access</span>
            </div>
            <div className="space-y-4">
              <p className="text-xs uppercase tracking-[0.32em] text-slate-300/80">School management</p>
              <h2 className="text-4xl font-black tracking-tight text-white">Fast access to all your campus insights.</h2>
              <p className="max-w-md text-sm leading-6 text-slate-300/85">Sign in and continue managing teachers, students, results and finance from one premium platform.</p>
            </div>
          </div>

          <AuthIllustration />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-[1.75rem] border border-white/10 bg-white/10 p-5 text-sm text-slate-200 shadow-xl shadow-slate-950/20">
              <p className="uppercase tracking-[0.32em] text-slate-400">Logins</p>
              <p className="mt-3 text-2xl font-black">2.4k</p>
            </div>
            <div className="rounded-[1.75rem] border border-white/10 bg-white/10 p-5 text-sm text-slate-200 shadow-xl shadow-slate-950/20">
              <p className="uppercase tracking-[0.32em] text-slate-400">Secure</p>
              <p className="mt-3 text-2xl font-black">24/7</p>
            </div>
          </div>
        </div>
      )}
    >
      <div className="space-y-6">
        <AuthCard title="Sign in to SchoolFlow" description="Access teachers, students, attendance, billing and secure workflows from a polished portal.">
          {error && (
            <div className="rounded-[1.5rem] border border-rose-200/80 bg-rose-50/80 p-4 text-sm font-semibold text-rose-700 shadow-sm">
              <div className="flex items-center gap-2">
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <AuthInput
            label="Email"
            type="email"
            placeholder="admin@school.com"
            icon={<Mail size={18} />}
            error={errors.email?.message}
            {...register('email')}
          />

          <PasswordField
            label="Password"
            placeholder="Enter your password"
            error={errors.password?.message}
            autocomplete="current-password"
            {...register('password')}
          />

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <label className="inline-flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={() => setRememberMe(!rememberMe)}
                className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
              />
              Remember me
            </label>
            <Link to="/forgot-password" className="text-sm font-semibold text-slate-900 hover:text-slate-700">
              Forgot password?
            </Link>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className={
              'flex w-full items-center justify-center gap-3 rounded-[1.75rem] bg-slate-950 px-6 py-4 text-sm font-semibold text-white shadow-xl shadow-slate-900/20 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70'
            }
          >
            {isLoading ? <Loader2 className="animate-spin" size={18} /> : <><CheckCircle2 size={18} /> Continue to dashboard</>}
          </button>

          <div className="text-center text-sm text-slate-500">
            New to SchoolFlow? <Link to="/register" className="font-semibold text-slate-950 hover:text-slate-700">Create an account</Link>
          </div>
        </form>
      </AuthCard>
      </div>
    </AuthLayout>
  )
}

export default LoginPage
