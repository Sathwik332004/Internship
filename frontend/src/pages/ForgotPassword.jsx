import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { authAPI } from '../services/api';
import BrandLogo from '../components/BrandLogo';
import {
  isValidEmail,
  normalizeEmail,
  validateResetPasswordForm
} from '../utils/validation';

const ForgotPassword = () => {
  const [step, setStep] = useState(1); // 1: email, 2: otp, 3: new password
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSendOTP = async (e) => {
    e.preventDefault();
    const normalizedEmail = normalizeEmail(email);
    if (!isValidEmail(normalizedEmail)) {
      toast.error('Enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      await authAPI.forgotPassword({ email: normalizedEmail });
      toast.success('OTP sent to your email');
      setEmail(normalizedEmail);
      setStep(2);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    const validationError = validateResetPasswordForm({ email, otp, password, confirmPassword });
    if (validationError) {
      toast.error(validationError);
      return;
    }
    setLoading(true);
    try {
      await authAPI.resetPassword({ email, otp, password });
      toast.success('Password reset successfully');
      navigate('/login');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="medical-grid flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,_rgba(34,197,94,0.18),_transparent_24%),linear-gradient(135deg,_#fbfcf8,_#f2f7ee_55%,_#f3efe6)] p-4">
      <div className="w-full max-w-md rounded-[32px] border border-white/60 bg-white/80 p-8 shadow-[0_30px_90px_rgba(15,23,42,0.14)] backdrop-blur-xl">
        <div className="mb-8">
          <BrandLogo compact />
          <h1 className="mt-8 text-3xl font-semibold text-slate-950">Reset Password</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">Recover access to Bhagya Medicals with your email OTP.</p>
        </div>

        {step === 1 && (
          <form onSubmit={handleSendOTP} className="space-y-6">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm"
                placeholder="Enter your email"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-emerald-600 via-lime-500 to-emerald-500 py-3.5 font-medium text-white shadow-[0_18px_40px_rgba(34,197,94,0.28)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                'Send OTP'
              )}
            </button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleVerifyOTP} className="space-y-6">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                One Time Password
              </label>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-center text-2xl tracking-widest shadow-sm"
                placeholder="000000"
                maxLength={6}
                inputMode="numeric"
                required
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                New Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm"
                placeholder="Enter new password"
                required
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm"
                placeholder="Confirm new password"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading || otp.length !== 6}
              className="flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-emerald-600 via-lime-500 to-emerald-500 py-3.5 font-medium text-white shadow-[0_18px_40px_rgba(34,197,94,0.28)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Resetting...
                </>
              ) : (
                'Reset Password'
              )}
            </button>
          </form>
        )}

        <div className="mt-6 text-center">
          <button
            onClick={() => navigate('/login')}
            className="flex items-center justify-center text-sm font-medium text-emerald-700 hover:text-emerald-800"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Login
          </button>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
