import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import BrandLogo from '../components/BrandLogo';
import {
  normalizeEmail,
  validateLoginForm
} from '../utils/validation';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const { login } = useAuth();
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
      await login(normalizeEmail(email), password);
      toast.success('Login successful');
      navigate('/dashboard', { replace: true });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4"
      style={{ background: 'linear-gradient(135deg, #0f1f3d 0%, #1e3a5f 50%, #0f2642 100%)' }}>

      {/* Background blobs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #2563eb, transparent 70%)' }} />
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full opacity-15"
          style={{ background: 'radial-gradient(circle, #1d4ed8, transparent 70%)' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full opacity-5"
          style={{ background: 'radial-gradient(circle, #3b82f6, transparent 70%)' }} />
      </div>

      <div className="relative w-full max-w-md">
        {/* Card */}
        <div className="rounded-2xl overflow-hidden"
          style={{ background: '#ffffff', boxShadow: '0 25px 60px rgba(0,0,0,0.35)' }}>

          {/* Blue header strip */}
          <div className="px-8 pt-8 pb-6"
            style={{ background: 'linear-gradient(135deg, #1e3a5f, #0f2642)', borderBottom: '1px solid rgba(37,99,235,0.3)' }}>
            <BrandLogo dark />
          </div>

          <section className="p-8">
            <div className="mb-6">
              <h1 className="text-2xl font-bold" style={{ color: '#0f172a' }}>Welcome back</h1>
              <p className="mt-1 text-sm" style={{ color: '#64748b' }}>Sign in to your pharmacy management system</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="mb-1.5 block text-sm font-medium" style={{ color: '#374151' }}>
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border px-4 py-3 text-sm"
                  style={{ borderColor: '#d1d5db', borderRadius: 8, color: '#111827', background: '#f9fafb' }}
                  placeholder="admin@bhagyamedicals.com"
                  required
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium" style={{ color: '#374151' }}>
                  Password
                </label>
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
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    style={{ color: '#9ca3af' }}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center py-3 text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                style={{
                  background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                  borderRadius: 8,
                  boxShadow: '0 4px 14px rgba(37,99,235,0.40)'
                }}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Signing in…
                  </>
                ) : (
                  'Sign In to Dashboard'
                )}
              </button>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => navigate('/forgot-password')}
                  className="text-sm font-medium transition-colors"
                  style={{ color: '#2563eb' }}
                >
                  Forgot Password?
                </button>
              </div>
            </form>
          </section>
        </div>

        {/* Footer note */}
        <p className="mt-4 text-center text-xs" style={{ color: 'rgba(148,163,184,0.7)' }}>
          Bhagya Medicals © {new Date().getFullYear()} · Pharmacy Management System
        </p>
      </div>

    </div>
  );
};

export default Login;
