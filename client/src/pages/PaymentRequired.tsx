import { useState } from 'react';
import { API_BASE } from '../lib/config';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  CreditCard, 
  ArrowRight, 
  Loader2, 
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import axios from 'axios';
import Navbar from '../components/landing/Navbar';
import Footer from '../components/landing/Footer';
import { REGISTRATION_FEE_FALLBACK_NAIRA } from '../lib/subscriptionPricing';

function getAxiosErrorMessage(
  error: unknown,
  fallback: string
) {
  if (axios.isAxiosError<{ error?: string }>(error)) {
    return error.response?.data?.error || fallback
  }
  return fallback
}

const PaymentRequired = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const email = location.state?.email || '';
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const registrationFee = REGISTRATION_FEE_FALLBACK_NAIRA;

  const handlePay = async () => {
    if (!email) {
      setError('Missing account information. Please try logging in again.');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const response = await axios.post(`${API_BASE}/api/payments/reinitialize`, { email });
      if (response.data.authorization_url) {
        window.location.href = response.data.authorization_url;
      }
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status === 403) {
        navigate('/verify-email-required', { state: { email } });
        return;
      }
      setError(getAxiosErrorMessage(err, 'Failed to initialize payment. Please try again.'));
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />
      
      <main className="flex-grow flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full glass rounded-3xl p-8 sm:p-10 shadow-2xl bg-white/90 border border-white"
        >
          <div className="flex justify-center mb-8">
            <div className="bg-brand-50 rounded-full p-6 text-brand-600">
              <CreditCard size={48} />
            </div>
          </div>

          <div className="text-center mb-8">
            <h2 className="text-2xl font-black text-slate-900 mb-3">Registration Payment Required</h2>
            <p className="text-slate-500 font-medium">
              Your account is registered but inactive. Complete your one-time registration fee of <span className="text-slate-900 font-bold">NGN {registrationFee.toLocaleString()}</span> to activate your dashboard.
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm font-medium flex items-center gap-3">
              <AlertCircle size={18} />
              {error}
            </div>
          )}

          <div className="space-y-4">
            <button
              onClick={handlePay}
              disabled={isLoading}
              className="w-full premium-gradient text-white py-4 px-8 rounded-2xl font-bold text-lg shadow-lg shadow-brand-500/25 flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70"
            >
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  Connecting...
                </>
              ) : (
                <>
                  Complete Payment
                  <ArrowRight size={20} />
                </>
              )}
            </button>
            <button
              onClick={() => navigate('/login')}
              className="w-full bg-white border border-slate-200 text-slate-600 py-4 px-8 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all hover:bg-slate-50"
            >
              Back to Login
            </button>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col gap-3">
            <div className="flex items-center gap-3 text-slate-500 text-sm">
              <CheckCircle2 size={16} className="text-brand-500" />
              <span>Full dashboard access</span>
            </div>
            <div className="flex items-center gap-3 text-slate-500 text-sm">
              <CheckCircle2 size={16} className="text-brand-500" />
              <span>Term-based school activation</span>
            </div>
            <div className="flex items-center gap-3 text-slate-500 text-sm">
              <CheckCircle2 size={16} className="text-brand-500" />
              <span>Renewable access for all school users</span>
            </div>
          </div>
        </motion.div>
      </main>

      <Footer />
    </div>
  );
};

export default PaymentRequired;
