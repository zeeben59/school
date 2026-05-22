import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useAuth } from '../context/AuthContext'
import { ShieldCheck, Lock, Loader2, AlertCircle } from 'lucide-react'
import AuthLayout from '../components/auth/AuthLayout'
import AuthInput from '../components/auth/AuthInput'
import PasswordField from '../components/ui/PasswordField'
import { cn } from '../lib/utils'
import { supabase } from '../lib/supabase'

const adminLoginSchema = z.object({
  email: z.string().email('Enter a valid admin email'),
  password: z.string().min(1, 'Password is required'),
})

type AdminLoginForm = z.infer<typeof adminLoginSchema>

const SuperAdminLoginPage = () => {
  const navigate = useNavigate()
  const { user, login } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (user?.role === 'SUPERADMIN') {
      navigate('/admin', { replace: true })
    }
  }, [user, navigate])

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AdminLoginForm>({
    resolver: zodResolver(adminLoginSchema),
  })

  const onSubmit = async (data: AdminLoginForm) => {
    setIsLoading(true)
    setError(null)

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: data.email.trim().toLowerCase(),
        password: data.password,
      })

      if (authError || !authData.session || !authData.user) {
        throw new Error(authError?.message || 'Unable to authenticate. Please check your credentials and try again.')
      }

      const userData = {
        id: authData.user.id,
        email: authData.user.email || '',
        firstName: (authData.user.user_metadata?.first_name as string | undefined) || 'Admin',
        lastName: (authData.user.user_metadata?.last_name as string | undefined) || '',
        role: (authData.user.user_metadata?.role as string | undefined) || 'DIRECTOR',
        school: (authData.user.user_metadata?.school as string | undefined) || '',
        schoolId: (authData.user.user_metadata?.schoolId as string | undefined) || '',
        status: (authData.user.user_metadata?.status as string | undefined) || 'ACTIVE',
        emailVerifiedAt: authData.user.email_confirmed_at,
      }
      if (userData.role !== 'SUPERADMIN') {
        setError('This portal is for superadmin access only. Please login through the standard portal.')
        return
      }

      login(authData.session.access_token, userData)
      navigate('/admin', { replace: true })
    } catch (err: any) {
      setError(err?.message || 'Unable to authenticate. Please check your credentials and try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AuthLayout
      theme="dark"
      title="Superadmin access"
      subtitle="Enterprise-grade access for platform administrators with secure, monitored authentication."
      accentText="Elite Control"
      panel={(
        <div className="relative z-10 space-y-8">
          <div className="space-y-4">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-3xl bg-white/10 text-slate-100 ring-1 ring-white/10">
              <ShieldCheck size={24} />
            </div>
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.32em] text-slate-400">Admin Gateway</p>
              <h2 className="text-4xl font-black tracking-tight text-white">Secure control for your entire platform</h2>
              <p className="max-w-sm text-sm leading-6 text-slate-300/90">Review system events, manage enterprise subscriptions, and operate with full confidence from a gated admin console.</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-[1.75rem] border border-white/10 bg-white/10 p-4 text-sm text-slate-200">
              <p className="uppercase tracking-[0.28em] text-slate-400">Audit</p>
              <p className="mt-3 text-2xl font-black">Active logs</p>
            </div>
            <div className="rounded-[1.75rem] border border-white/10 bg-white/10 p-4 text-sm text-slate-200">
              <p className="uppercase tracking-[0.28em] text-slate-400">Security</p>
              <p className="mt-3 text-2xl font-black">Zero trust</p>
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-white/10 bg-slate-900/50 p-5 text-sm leading-6 text-slate-300 shadow-2xl shadow-slate-950/40 backdrop-blur">
            <p className="font-semibold uppercase tracking-[0.28em] text-slate-400">Operational safety</p>
            <p className="mt-3">Session monitoring, secure token handling and privileged access control for sensitive platform workflows.</p>
          </div>
        </div>
      )}
    >
      <div className="space-y-6">
        <div className="rounded-[1.75rem] border border-slate-800/70 bg-slate-950/95 p-6 text-slate-100 shadow-xl shadow-slate-950/20">
          <div className="flex items-center gap-3 text-sm uppercase tracking-[0.3em] text-sky-300/80">
            <Lock size={16} /> Secure session
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-400">Authorized administrators only. All access is monitored and audited for platform safety.</p>
        </div>

        {error && (
          <div className="rounded-3xl border border-rose-500/20 bg-rose-500/10 px-5 py-4 text-sm font-semibold text-rose-700">
            <div className="flex items-start gap-3">
              <AlertCircle size={18} />
              <div>{error}</div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <AuthInput
            label="Admin email"
            type="email"
            error={errors.email?.message}
            helperText="Use the email assigned to your superadmin account."
            icon={<ShieldCheck size={18} />}
            {...register('email')}
          />

          <PasswordField
            label="Password"
            placeholder="Enter password"
            error={errors.password?.message}
            autocomplete="current-password"
            {...register('password')}
          />

          <button
            type="submit"
            disabled={isLoading}
            className={cn(
              'flex w-full items-center justify-center gap-2 rounded-3xl px-5 py-3 text-sm font-semibold transition',
              isLoading
                ? 'cursor-wait bg-slate-700 text-slate-200 opacity-80'
                : 'bg-gradient-to-r from-sky-500 to-cyan-500 text-slate-950 hover:scale-[1.01]'
            )}
          >
            {isLoading ? <Loader2 className="animate-spin" size={18} /> : 'Sign in securely'}
          </button>

          <div className="text-center text-sm text-slate-500">
            Need help? Contact your platform owner or use the standard login portal.
          </div>
        </form>
      </div>
    </AuthLayout>
  )
}

export default SuperAdminLoginPage
