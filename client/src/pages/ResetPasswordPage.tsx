import { useState } from 'react';
import { API_BASE } from '../lib/config';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { AlertCircle, CheckCircle2, Loader2, Lock } from 'lucide-react';
import Navbar from '../components/landing/Navbar';
import Footer from '../components/landing/Footer';
import PasswordField from '../components/ui/PasswordField';

const ResetPasswordPage = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      const response = await axios.post(`${API_BASE}/api/auth/reset-password`, {
        token,
        password,
        confirmPassword,
      });
      setMessage(response.data.message || 'Password reset successfully.');
      setTimeout(() => navigate('/login'), 1200);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Unable to reset password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      <main className="flex-grow flex items-center justify-center p-4">
        <div className="max-w-md w-full glass rounded-3xl p-8 sm:p-10 shadow-2xl bg-white/90 border border-white">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-600 text-white mb-6 shadow-xl shadow-brand-500/30">
              <Lock size={32} />
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Reset Password</h1>
            <p className="text-slate-500 font-medium">Choose a new password for your account.</p>
          </div>

          {!token && (
            <div className="mb-4 p-4 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm font-medium flex items-center gap-3">
              <AlertCircle size={18} />
              Reset token is missing. Request a new password reset link.
            </div>
          )}

          {message && (
            <div className="mb-4 p-4 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700 text-sm font-medium flex items-center gap-3">
              <CheckCircle2 size={18} />
              {message}
            </div>
          )}

          {error && (
            <div className="mb-4 p-4 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm font-medium flex items-center gap-3">
              <AlertCircle size={18} />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <PasswordField
              label="New Password"
              placeholder="Enter a strong password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <PasswordField
              label="Confirm Password"
              placeholder="Confirm your password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />

            <button
              type="submit"
              disabled={loading || !token}
              className="w-full premium-gradient text-white py-4 px-8 rounded-2xl font-bold text-lg shadow-lg shadow-brand-500/25 flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : 'Update Password'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500 font-medium">
            Need a new link? <Link to="/forgot-password" className="text-brand-600 font-bold">Request reset email</Link>
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default ResetPasswordPage;
