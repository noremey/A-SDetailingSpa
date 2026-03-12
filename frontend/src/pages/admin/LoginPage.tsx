import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Shield, Eye, EyeOff, User, Lock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const { login, isAuthenticated, isAdmin } = useAuth();
  const { settings } = useSettings();
  const [identifier, setIdentifier] = useState(() => localStorage.getItem('admin_remember_id') || '');
  const [password, setPassword] = useState(() => localStorage.getItem('admin_remember_pw') || '');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => !!localStorage.getItem('admin_remember_id'));
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (isAuthenticated && isAdmin) {
    navigate('/admin', { replace: true });
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(identifier, password);
      if (rememberMe) {
        localStorage.setItem('admin_remember_id', identifier);
        localStorage.setItem('admin_remember_pw', password);
      } else {
        localStorage.removeItem('admin_remember_id');
        localStorage.removeItem('admin_remember_pw');
      }
      navigate('/admin', { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-gradient-to-b from-gray-900 to-gray-800">
      <motion.div
        className="w-full max-w-sm"
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
      >
        <div className="text-center mb-8">
          <motion.div
            className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center bg-white/10 border border-white/20"
            whileHover={{ scale: 1.05 }}
          >
            <Shield className="w-8 h-8 text-white" />
          </motion.div>
          <h1 className="text-2xl font-bold text-white">{settings.business_name}</h1>
          <p className="text-gray-400 text-sm mt-1">Admin Panel</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <motion.div
              className="p-3 bg-red-500/20 border border-red-500/30 rounded-xl text-red-300 text-sm text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              {error}
            </motion.div>
          )}

          <div className="relative">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="Email, phone or admin code"
              className="w-full px-4 py-3.5 pl-11 bg-white/5 border border-white/10 rounded-xl
                         text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white/20"
              required
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full px-4 py-3.5 pl-11 pr-11 bg-white/5 border border-white/10 rounded-xl
                         text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white/20"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded border-white/20 bg-white/10 text-white accent-white"
            />
            <span className="text-sm text-gray-400">Remember me</span>
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl font-semibold text-gray-900 bg-white
                       hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign In to Admin'}
          </button>
        </form>

        <div className="text-center mt-6">
          <Link to="/login" className="text-sm text-gray-500 hover:text-gray-300">
            ← Customer Login
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
