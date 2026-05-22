import { useEffect, useState } from 'react';
import { API_BASE } from '../lib/config';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  ArrowRight,
  ShieldCheck,
  RefreshCcw
} from 'lucide-react';
import axios from 'axios';
import Navbar from '../components/landing/Navbar';
import Footer from '../components/landing/Footer';
import { useAuth } from '../context/AuthContext';

function getAxiosErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError<{ error?: string }>(error)) {
    return error.response?.data?.error || fallback
  }
  return fallback
}

const VerifyPayment = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const reference = searchParams.get('reference');
  
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [message, setMessage] = useState('Checking transaction status with Paystack...');
  const [paymentType, setPaymentType] = useState<'REGISTRATION' | 'SUBSCRIPTION' | null>(null);

  useEffect(() => {
    const verify = async () => {
      if (!reference) {
        setStatus('error');
        setMessage('Missing transaction reference.');
        return;
      }

      try {
        const response = await axios.get(`${API_BASE}/api/payments/verify/${reference}`);
        
        if (response.status === 200) {
          // Auto-login: store token and user data from verification response
          if (response.data.token) {
            login(response.data.token, response.data.user);
          }
          if (response.data.paymentType === 'REGISTRATION' || response.data.paymentType === 'SUBSCRIPTION') {
            setPaymentType(response.data.paymentType);
          }
          setStatus('success');
          setMessage(response.data.message || 'Payment verified successfully.');
        } else {
          setStatus('error');
          setMessage(response.data.error || 'Verification failed. Please contact support.');
        }
      } catch (err: unknown) {
        setStatus('error');
        setMessage(getAxiosErrorMessage(err, 'Verification encountered an error.'));
      }
    };

    const timer = setTimeout(verify, 1500); // Small delay for UX feel
    return () => clearTimeout(timer);
  }, [reference, login]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />
      
      <main className="flex-grow flex items-center justify-center p-4 bg-[radial-gradient(circle_at_center,_var(--color-brand-100),_transparent_70%)]">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full glass rounded-3xl p-8 sm:p-10 shadow-2xl bg-white/90 border border-white text-center"
        >
          {status === 'verifying' && (
            <div className="space-y-6">
              <div className="relative flex justify-center">
                <div className="absolute inset-0 animate-ping rounded-full bg-brand-500/20" />
                <div className="relative bg-brand-50 rounded-full p-6">
                  <Loader2 className="animate-spin text-brand-600" size={48} />
                </div>
              </div>
              <h2 className="text-2xl font-black text-slate-900">Verifying Payment</h2>
              <p className="text-slate-500 font-medium leading-relaxed">
                {message}
              </p>
              <div className="flex items-center justify-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest pt-4">
                <ShieldCheck size={14} />
                Secure Verification
              </div>
            </div>
          )}

          {status === 'success' && (
            <div className="space-y-6">
              <div className="bg-green-50 rounded-full p-6 w-fit mx-auto">
                <CheckCircle2 className="text-green-600" size={48} />
              </div>
              <h2 className="text-2xl font-black text-slate-900">
                {paymentType === 'REGISTRATION' ? 'Registration Complete!' : 'Subscription Active!'}
              </h2>
              <p className="text-slate-500 font-medium leading-relaxed">
                {paymentType === 'REGISTRATION'
                  ? 'Your registration payment is complete. Your school now has a 7-day trial before a term subscription is required.'
                  : 'Your school term plan has been activated successfully. You can now access the management dashboard.'}
              </p>
              <button
                onClick={() => navigate('/dashboard')}
                className="w-full premium-gradient text-white py-4 px-8 rounded-2xl font-bold text-lg shadow-lg shadow-brand-500/25 flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                Go to Dashboard
                <ArrowRight size={20} />
              </button>
            </div>
          )}

          {status === 'error' && (
            <div className="space-y-6">
              <div className="bg-red-50 rounded-full p-6 w-fit mx-auto">
                <XCircle className="text-red-600" size={48} />
              </div>
              <h2 className="text-2xl font-black text-slate-900">Verification Failed</h2>
              <p className="text-slate-500 font-medium leading-relaxed">
                {message}
              </p>
              <div className="flex flex-col gap-3 pt-4">
                <button
                  onClick={() => navigate('/register')}
                  className="w-full bg-slate-900 text-white py-4 px-8 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all hover:bg-slate-800"
                >
                  <RefreshCcw size={18} />
                  Retry Registration
                </button>
                <button
                  onClick={() => navigate('/')}
                  className="text-slate-500 font-bold hover:text-slate-700 transition-colors"
                >
                  Return Home
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </main>

      <Footer />
    </div>
  );
};

export default VerifyPayment;
