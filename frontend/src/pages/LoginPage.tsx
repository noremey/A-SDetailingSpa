import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CreditCard, Eye, EyeOff, Phone, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, isAuthenticated, isAdmin, needsProfileCompletion } = useAuth();
  const { settings } = useSettings();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => {
    return localStorage.getItem('remember_me') === 'true';
  });

  // Load saved credentials on mount
  useEffect(() => {
    if (localStorage.getItem('remember_me') === 'true') {
      const saved = localStorage.getItem('saved_identifier');
      if (saved) setIdentifier(saved);
    }
  }, []);

  // Redirect if already logged in
  useEffect(() => {
    if (isAuthenticated) {
      if (isAdmin) {
        navigate('/admin', { replace: true });
      } else if (needsProfileCompletion) {
        navigate('/complete-profile', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    }
  }, [isAuthenticated, isAdmin, needsProfileCompletion, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      // Save or clear remember me
      if (rememberMe) {
        localStorage.setItem('remember_me', 'true');
        localStorage.setItem('saved_identifier', identifier);
      } else {
        localStorage.removeItem('remember_me');
        localStorage.removeItem('saved_identifier');
      }
      await login(identifier, password);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8 bg-gradient-to-b from-slate-50 to-slate-100">
      <motion.div
        className="w-full max-w-sm md:max-w-md md:bg-white md:rounded-2xl md:shadow-xl md:p-8 md:border md:border-gray-100"
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        {/* Logo & Brand */}
        <div className="text-center mb-8">
          {settings.business_logo ? (
            <motion.img
              src={settings.business_logo}
              alt={settings.business_name}
              className="w-16 h-16 md:w-20 md:h-20 rounded-2xl mx-auto mb-4 object-cover shadow-lg"
              whileHover={{ scale: 1.05, rotate: 5 }}
            />
          ) : (
            <motion.div
              className="w-16 h-16 md:w-20 md:h-20 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg"
              style={{ backgroundColor: settings.primary_color }}
              whileHover={{ scale: 1.05, rotate: 5 }}
            >
              <CreditCard className="w-8 h-8 md:w-10 md:h-10 text-white" />
            </motion.div>
          )}
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{settings.business_name}</h1>
          <p className="text-gray-500 text-sm md:text-base mt-1">Sign in to your account</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <motion.div
              className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm text-center"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {error}
            </motion.div>
          )}

          <div className="relative">
            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="Phone, email or user code"
              className="input-field pl-11"
              required
              autoComplete="username"
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="input-field pl-11 pr-11"
              required
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {/* Remember Me */}
          <div className="flex items-center">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <span className="text-sm text-gray-600">Remember Me</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
            style={{ backgroundColor: settings.primary_color }}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Signing in...
              </span>
            ) : 'Sign In'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
