import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import { Eye, EyeOff, Loader2, ShieldCheck, Truck, Sparkles } from 'lucide-react';
import { authAPI } from '../services/api';
import BrandLogo from '../components/BrandLogo';
import {
  normalizeEmail,
  validateLoginForm,
  validateOtp
} from '../utils/validation';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [otpRequired, setOtpRequired] = useState(false);
  const [otp, setOtp] = useState('');
  const [userId, setUserId] = useState(null);
  
  const { login, verifyOTP } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    const validationError = validateLoginForm({ email, password });
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setLoading(true);
    
    try {
      const result = await login(normalizeEmail(email), password);
      
      if (result.requiresOTP) {
        setOtpRequired(true);
        setUserId(result.userId);
        toast.info('Please enter the OTP sent to your email');
      } else {
        toast.success('Login successful');
        navigate('/dashboard');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    const validationError = validateOtp(otp);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setLoading(true);
    
    try {
      await verifyOTP(userId, otp);
      toast.success('Login successful');
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    try {
      await authAPI.resendOTP({ userId });
      toast.info('OTP resent to your email');
    } catch (error) {
      toast.error('Failed to resend OTP');
    }
  };

  return (
    <div className="medical-grid relative flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(34,197,94,0.18),_transparent_24%),linear-gradient(135deg,_#fbfcf8,_#f2f7ee_55%,_#f3efe6)] p-4">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(163,230,53,0.14),transparent_18%),radial-gradient(circle_at_20%_85%,rgba(34,197,94,0.12),transparent_20%)]" />
      <div className="relative grid w-full max-w-6xl overflow-hidden rounded-[36px] border border-white/50 bg-white/70 shadow-[0_30px_100px_rgba(15,23,42,0.16)] backdrop-blur-xl lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative hidden overflow-hidden bg-gradient-to-br from-slate-950 via-emerald-950 to-lime-900 p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.28),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(163,230,53,0.22),transparent_22%)]" />
          <div className="relative">
            <BrandLogo />
            <div className="mt-12 max-w-lg">
              <p className="text-sm uppercase tracking-[0.35em] text-emerald-200/80">Clinical Retail Experience</p>
              <h2 className="mt-4 text-4xl font-semibold leading-tight">A calmer, cleaner workspace for medicine billing, inventory, and care-led operations.</h2>
              <p className="mt-5 text-base leading-7 text-slate-200/85">
                Bhagya Medicals brings purchase tracking, billing accuracy, and inventory visibility into one polished medical command center.
              </p>
            </div>
          </div>
          <div className="relative grid gap-4">
            <div className="rounded-3xl border border-white/10 bg-white/10 p-5">
              <ShieldCheck className="mb-3 h-6 w-6 text-emerald-200" />
              <p className="text-lg font-semibold">Secure staff access</p>
              <p className="mt-1 text-sm text-slate-200/80">OTP-backed sign-in for accountable day-to-day pharmacy operations.</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/10 p-5">
              <Truck className="mb-3 h-6 w-6 text-lime-200" />
              <p className="text-lg font-semibold">Purchase to shelf clarity</p>
              <p className="mt-1 text-sm text-slate-200/80">Track procurement, expiry, and low-stock movement with inventory-first logic.</p>
            </div>
          </div>
        </section>

        <section className="p-6 sm:p-10">
          <div className="mx-auto w-full max-w-md">
            <div className="mb-8">
              <div className="flex items-center justify-between">
                <BrandLogo compact showTagline={false} />
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-emerald-700">
                  Staff Login
                </span>
              </div>
              <div className="mt-8">
                <h1 className="text-3xl font-semibold text-slate-950">Welcome back</h1>
                <p className="mt-2 text-sm leading-6 text-slate-500">Sign in to manage billing, purchases, and inventory for Bhagya Medicals.</p>
              </div>
            </div>

            {!otpRequired ? (
              <form onSubmit={handleLogin} className="space-y-6">
                <div className="rounded-3xl border border-emerald-100 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-800">
                  <div className="flex items-center gap-2 font-medium">
                    <Sparkles className="h-4 w-4" />
                    Premium medical workspace
                  </div>
                  <p className="mt-1 text-emerald-700/80">Use your authorized staff account to continue.</p>
                </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-slate-900 shadow-sm"
                placeholder="admin@bhagyamedicals.com"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 pr-12 text-slate-900 shadow-sm"
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-emerald-600 via-lime-500 to-emerald-500 py-3.5 font-medium text-white shadow-[0_18px_40px_rgba(34,197,94,0.28)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </button>

            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => navigate('/forgot-password')}
                className="text-sm font-medium text-emerald-700 hover:text-emerald-800"
              >
                Forgot Password?
              </button>
            </div>
          </form>

        ) : (
          <form onSubmit={handleVerifyOTP} className="space-y-6">
            <div className="text-center mb-4">
              <p className="text-slate-600">Enter the 6-digit OTP sent to your email</p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                One Time Password
              </label>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-center text-2xl tracking-widest text-slate-900 shadow-sm"
                placeholder="000000"
                maxLength={6}
                inputMode="numeric"
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
                  Verifying...
                </>
              ) : (
                'Verify OTP'
              )}
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  setOtpRequired(false);
                  setOtp('');
                }}
                className="text-sm font-medium text-emerald-700 hover:text-emerald-800"
              >
                Back to Login
              </button>
              <button
                type="button"
                onClick={handleResendOTP}
                className="ml-4 text-sm font-medium text-lime-700 hover:text-lime-800"
              >
                Resend OTP
              </button>
            </div>
          </form>
        )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default Login;
