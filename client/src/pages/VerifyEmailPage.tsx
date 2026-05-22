import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import Navbar from '../components/landing/Navbar';
import Footer from '../components/landing/Footer';
import { supabase } from '../lib/supabase';

const VerifyEmailPage = () => {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Verifying your email...');

  useEffect(() => {
    supabase.auth.getUser().then(({ data, error }) => {
      if (error || !data.user) {
        setStatus('error');
        setMessage('Unable to verify your session. Please request another verification email.');
        return;
      }

      if (data.user.email_confirmed_at) {
        setStatus('success');
        setMessage('Email verified successfully.');
      } else {
        setStatus('error');
        setMessage('Email is not verified yet. Please check your inbox for the verification link.');
      }
    });
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      <main className="flex-grow flex items-center justify-center p-4">
        <div className="max-w-lg w-full glass rounded-3xl p-8 sm:p-10 shadow-2xl bg-white/90 border border-white text-center">
          <div className="flex justify-center mb-6">
            <div className={`rounded-full p-5 ${status === 'success' ? 'bg-emerald-50 text-emerald-600' : status === 'error' ? 'bg-red-50 text-red-600' : 'bg-brand-50 text-brand-600'}`}>
              {status === 'loading' ? <Loader2 size={40} className="animate-spin" /> : status === 'success' ? <CheckCircle2 size={40} /> : <AlertCircle size={40} />}
            </div>
          </div>

          <h1 className="text-2xl font-black text-slate-900 mb-3">Email Verification</h1>
          <p className="text-slate-600 font-medium">{message}</p>

          <div className="mt-8 space-y-3">
            <Link to="/login" className="block w-full bg-slate-900 text-white py-4 rounded-2xl font-bold">
              Continue to Login
            </Link>
            <Link to="/verify-email-required" className="block w-full border border-slate-200 text-slate-700 py-4 rounded-2xl font-bold">
              Need Another Verification Email?
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default VerifyEmailPage;
