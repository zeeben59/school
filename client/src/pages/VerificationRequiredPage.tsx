import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { AlertCircle, CheckCircle2, Loader2, Mail, ShieldCheck, RefreshCcw } from 'lucide-react'
import AuthLayout from '../components/auth/AuthLayout'
import AuthCard from '../components/auth/AuthCard'
import AuthIllustration from '../components/auth/AuthIllustration'
import { supabase } from '../lib/supabase'

const OTP_CONTEXT_KEY = 'registrationOtpContext'

const VerificationRequiredPage = () => {
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [resendCooldownUntil, setResendCooldownUntil] = useState<number | null>(null);

  const remainingSeconds = useMemo(() => {
    if (!expiresAt) return null;
    return Math.max(0, Math.floor((expiresAt - currentTime) / 1000));
  }, [expiresAt, currentTime]);

  const resendCooldownSeconds = useMemo(() => {
    if (!resendCooldownUntil) return 0;
    return Math.max(0, Math.floor((resendCooldownUntil - currentTime) / 1000));
  }, [resendCooldownUntil, currentTime]);

  useEffect(() => {
    const stateEmail = typeof location.state?.email === 'string' ? location.state.email.trim().toLowerCase() : '';
    const stateExpiry = location.state?.expiresAt ? new Date(location.state.expiresAt).getTime() : null;

    if (stateEmail) {
      setEmail(stateEmail);
      setExpiresAt(stateExpiry);
      sessionStorage.setItem(OTP_CONTEXT_KEY, JSON.stringify({
        email: stateEmail,
        expiresAt: stateExpiry,
      }));
      return;
    }

    const stored = sessionStorage.getItem(OTP_CONTEXT_KEY);
    if (!stored) {
      return;
    }

    try {
      const parsed = JSON.parse(stored);
      setEmail(typeof parsed.email === 'string' ? parsed.email : '');
      setExpiresAt(typeof parsed.expiresAt === 'number' ? parsed.expiresAt : null);
    } catch {
      sessionStorage.removeItem(OTP_CONTEXT_KEY);
    }
  }, [location.state]);

  useEffect(() => {
    if (!expiresAt) return;
    const timer = window.setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, [expiresAt]);

  const handleVerify = async () => {
    setMessage('Use the verification link sent to your email inbox, then return and sign in.');
  };

  const handleResend = async () => {
    if (!email) {
      setError('Missing account email. Please register or sign in again.');
      return;
    }

    if (resendCooldownSeconds > 0) {
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const { error: authError } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim().toLowerCase(),
      })
      if (authError) {
        throw new Error(authError.message)
      }
      setMessage('A new verification email has been sent.');
      setOtpCode('');
      const nextExpiry = Date.now() + 15 * 60_000;
      setExpiresAt(nextExpiry);
      setResendCooldownUntil(Date.now() + 30_000);
      sessionStorage.setItem(OTP_CONTEXT_KEY, JSON.stringify({
        email,
        expiresAt: nextExpiry,
      }));
    } catch (err: any) {
      setError(err.message || 'Unable to resend verification email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Verify your email"
      subtitle="Verify your email address to complete sign-up and unlock secure access."
      accentText="Secure onboarding"
      panel={(
        <div className="relative z-10 flex h-full flex-col justify-between gap-8">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-3 rounded-3xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-slate-100 shadow-xl shadow-slate-950/20 backdrop-blur">
              <Mail size={18} />
              Secure OTP confirmation
            </div>
            <div className="space-y-4">
              <p className="text-xs uppercase tracking-[0.32em] text-slate-300/80">Confirmed identity</p>
              <h2 className="text-4xl font-black tracking-tight text-white">Complete your secure registration</h2>
              <p className="max-w-md text-sm leading-6 text-slate-300/85">OTP verification is the final step before your Paystack payment and school dashboard setup.</p>
            </div>
          </div>

          <AuthIllustration />

          <div className="rounded-[1.75rem] border border-white/10 bg-slate-900/30 p-5 text-sm leading-6 text-slate-300 shadow-2xl shadow-slate-950/40 backdrop-blur">
            <p className="font-semibold uppercase tracking-[0.28em] text-slate-400">Trusted verification</p>
            <p className="mt-3">Your temporary OTP is secured and expires quickly to keep your school data safe.</p>
          </div>
        </div>
      )}
    >
      <AuthCard title="Email verification required" description="Use the email verification link from your inbox to continue.">
        <div className="space-y-5">
          <div className="space-y-3">
            <p className="text-sm font-semibold text-slate-600">Verification email</p>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              {email || 'No email attached. Please restart registration.'}
            </div>
          </div>

          {message && (
            <div className="rounded-3xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 flex items-center gap-3">
              <CheckCircle2 size={18} />
              {message}
            </div>
          )}

          {error && (
            <div className="rounded-3xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 flex items-center gap-3">
              <AlertCircle size={18} />
              {error}
            </div>
          )}

          <div className="rounded-3xl border border-slate-200 bg-white p-4">
            <label className="mb-2 block text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Verification code (legacy)</label>
            <input
              value={otpCode}
              onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              maxLength={6}
              inputMode="numeric"
              placeholder="Verification now uses email link"
              className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4 text-center text-2xl font-black tracking-[0.35em] text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15"
            />
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-xs font-medium text-slate-500">
              <span>
                {remainingSeconds !== null ? `Expires in ${Math.floor(remainingSeconds / 60)}:${String(remainingSeconds % 60).padStart(2, '0')}` : 'OTP will expire soon'}
              </span>
              <span className="inline-flex items-center gap-2 text-slate-600">
                <ShieldCheck size={14} />
                Secure verification
              </span>
            </div>
          </div>

          <div className="grid gap-3">
            <button
              onClick={handleVerify}
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-3xl bg-slate-950 px-5 py-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : 'I have verified my email'}
            </button>

            <button
              onClick={handleResend}
              disabled={loading || resendCooldownSeconds > 0}
              className="flex w-full items-center justify-center gap-2 rounded-3xl border border-slate-200 bg-white px-5 py-4 text-sm font-semibold text-slate-800 transition disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : resendCooldownSeconds > 0 ? `Resend in ${resendCooldownSeconds}s` : <><RefreshCcw size={18} /> Resend OTP</>}
            </button>

            <Link
              to="/login"
              className="inline-flex w-full items-center justify-center rounded-3xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Back to login
            </Link>
          </div>

          <p className="text-center text-sm text-slate-500">
            After verifying your email from the inbox link, return to login and sign in.
          </p>
        </div>
      </AuthCard>
    </AuthLayout>
  )
}

export default VerificationRequiredPage;
