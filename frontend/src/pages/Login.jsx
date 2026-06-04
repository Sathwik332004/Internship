import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import { Eye, EyeOff, Loader2, ShieldCheck, Mail, ArrowLeft, RefreshCw } from 'lucide-react';
import BrandLogo from '../components/BrandLogo';
import { normalizeEmail, validateLoginForm } from '../utils/validation';

// Mask email: sathwik@gmail.com → s*****k@gmail.com
const maskEmail = (email = '') => {
  const [local, domain] = email.split('@');
  if (!local || !domain) return email;
  if (local.length <= 2) return `${local[0]}*@${domain}`;
  return `${local[0]}${'*'.repeat(Math.min(local.length - 2, 5))}${local[local.length - 1]}@${domain}`;
};

// ─── Shared card wrapper ──────────────────────────────────────────
const LoginCard = ({ children }) => (
  <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4"
    style={{ background: 'linear-gradient(135deg, #0f1f3d 0%, #1e3a5f 50%, #0f2642 100%)' }}>

    {/* bg blobs */}
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full opacity-20"
        style={{ background: 'radial-gradient(circle, #2563eb, transparent 70%)' }} />
      <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full opacity-15"
        style={{ background: 'radial-gradient(circle, #1d4ed8, transparent 70%)' }} />
    </div>

    <div className="relative w-full max-w-md">
      <div className="rounded-2xl overflow-hidden"
        style={{ background: '#ffffff', boxShadow: '0 25px 60px rgba(0,0,0,0.35)' }}>

        {/* Blue header */}
        <div className="px-8 pt-8 pb-6"
          style={{ background: 'linear-gradient(135deg, #1e3a5f, #0f2642)', borderBottom: '1px solid rgba(37,99,235,0.3)' }}>
          <BrandLogo dark />
        </div>

        {children}
      </div>

      <p className="mt-4 text-center text-xs" style={{ color: 'rgba(148,163,184,0.7)' }}>
        Bhagya Medicals © {new Date().getFullYear()} · Pharmacy Management System
      </p>
    </div>
  </div>
);

// ─── Step 1: Credentials ──────────────────────────────────────────
const CredentialsStep = ({ onAdminOTP, onStaffLogin }) => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const normalizedEmail = normalizeEmail(email);
    const validationError = validateLoginForm({ email: normalizedEmail, password });
    if (validationError) { toast.error(validationError); return; }

    setLoading(true);
    try {
      const result = await login(normalizedEmail, password);

      if (result.requiresOTP) {
        toast.info('OTP sent to your email');
        onAdminOTP(result.email);
      } else {
        // Staff — direct login done inside AuthContext
        toast.success('Login successful');
        onStaffLogin();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: '#0f172a' }}>Welcome back</h1>
        <p className="mt-1 text-sm" style={{ color: '#64748b' }}>Sign in to your pharmacy management system</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="mb-1.5 block text-sm font-medium" style={{ color: '#374151' }}>Email Address</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border px-4 py-3 text-sm"
            style={{ borderColor: '#d1d5db', borderRadius: 8, color: '#111827', background: '#f9fafb' }}
            placeholder="admin@bhagyamedicals.com"
            required
            autoFocus
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium" style={{ color: '#374151' }}>Password</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border px-4 py-3 pr-12 text-sm"
              style={{ borderColor: '#d1d5db', borderRadius: 8, color: '#111827', background: '#f9fafb' }}
              placeholder="Enter your password"
              required
            />
            <button type="button" onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: '#9ca3af' }}>
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center py-3 text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', borderRadius: 8, boxShadow: '0 4px 14px rgba(37,99,235,0.40)' }}
        >
          {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Verifying…</> : 'Sign In'}
        </button>

        <div className="text-center pt-1">
          <button type="button" onClick={() => navigate('/forgot-password')}
            className="text-sm font-medium" style={{ color: '#2563eb' }}>
            Forgot Password?
          </button>
        </div>
      </form>
    </section>
  );
};

// ─── Step 2: OTP verification (admin only) ────────────────────────
const OTPStep = ({ email, onSuccess, onBack }) => {
  const { verifyLoginOTP } = useAuth();
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(30);
  const [resending, setResending] = useState(false);
  const inputRef = useRef(null);

  // Countdown timer for resend
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleVerify = async (e) => {
    e.preventDefault();
    if (otp.length !== 6) { toast.error('Enter the 6-digit OTP'); return; }

    setLoading(true);
    try {
      await verifyLoginOTP(email, otp);
      toast.success('Login successful');
      onSuccess();
    } catch (error) {
      const msg = error.response?.data?.message || 'Invalid or expired OTP';
      toast.error(msg);
      setOtp('');
      inputRef.current?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      // Re-trigger login with stored credentials isn't possible here,
      // so we call the resend endpoint via forgot-password approach.
      // Instead, we go back to credentials step so the user re-enters password.
      toast.info('Please re-enter your credentials to resend the OTP');
      onBack();
    } finally {
      setResending(false);
    }
  };

  return (
    <section className="p-8">
      {/* Icon */}
      <div className="mb-6 flex flex-col items-center text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
          style={{ background: '#eff6ff' }}>
          <ShieldCheck className="h-8 w-8" style={{ color: '#2563eb' }} />
        </div>
        <h1 className="text-2xl font-bold" style={{ color: '#0f172a' }}>Verify Your Identity</h1>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: '#64748b' }}>
          A 6-digit OTP has been sent to
        </p>
        <div className="mt-1.5 flex items-center gap-1.5 rounded-full px-3 py-1"
          style={{ background: '#eff6ff' }}>
          <Mail className="h-3.5 w-3.5 shrink-0" style={{ color: '#2563eb' }} />
          <span className="text-sm font-semibold" style={{ color: '#1d4ed8' }}>
            {maskEmail(email)}
          </span>
        </div>
      </div>

      <form onSubmit={handleVerify} className="space-y-5">
        {/* OTP input */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-center" style={{ color: '#374151' }}>
            Enter OTP
          </label>
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            maxLength={6}
            className="w-full border px-4 py-4 text-center text-3xl font-bold tracking-[0.5em]"
            style={{
              borderColor: otp.length === 6 ? '#2563eb' : '#d1d5db',
              borderRadius: 10,
              color: '#0f172a',
              background: '#f9fafb',
              letterSpacing: '0.4em',
              boxShadow: otp.length === 6 ? '0 0 0 3px rgba(37,99,235,0.12)' : 'none'
            }}
            placeholder="------"
            required
            autoComplete="one-time-code"
          />
          <p className="mt-2 text-center text-xs" style={{ color: '#94a3b8' }}>
            OTP expires in 10 minutes
          </p>
        </div>

        {/* Verify button */}
        <button
          type="submit"
          disabled={loading || otp.length !== 6}
          className="flex w-full items-center justify-center py-3 text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', borderRadius: 8, boxShadow: '0 4px 14px rgba(37,99,235,0.40)' }}
        >
          {loading
            ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Verifying…</>
            : <><ShieldCheck className="w-4 h-4 mr-2" />Verify &amp; Login</>
          }
        </button>

        {/* Resend + back */}
        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm font-medium transition-colors"
            style={{ color: '#64748b' }}
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          <button
            type="button"
            onClick={handleResend}
            disabled={resending}
            className="flex items-center gap-1.5 text-sm font-medium transition-colors disabled:opacity-50"
            style={{ color: resendCooldown > 0 ? '#94a3b8' : '#2563eb', cursor: resendCooldown > 0 ? 'not-allowed' : 'pointer' }}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${resending ? 'animate-spin' : ''}`} />
            {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend OTP'}
          </button>
        </div>
      </form>
    </section>
  );
};

// ─── Main Login page ──────────────────────────────────────────────
const Login = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState('credentials'); // 'credentials' | 'otp'
  const [adminEmail, setAdminEmail] = useState('');

  const handleAdminOTP = (email) => {
    setAdminEmail(email);
    setStep('otp');
  };

  const handleLoginSuccess = () => {
    navigate('/dashboard', { replace: true });
  };

  const handleBack = () => {
    setStep('credentials');
    setAdminEmail('');
  };

  return (
    <LoginCard>
      {step === 'credentials' ? (
        <CredentialsStep
          onAdminOTP={handleAdminOTP}
          onStaffLogin={handleLoginSuccess}
        />
      ) : (
        <OTPStep
          email={adminEmail}
          onSuccess={handleLoginSuccess}
          onBack={handleBack}
        />
      )}
    </LoginCard>
  );
};

export default Login;
