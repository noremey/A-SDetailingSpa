import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CreditCard, Phone } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';

export default function CustomerLoginPage() {
  const navigate = useNavigate();
  const { login, isAuthenticated, isAdmin, needsProfileCompletion } = useAuth();
  const { settings } = useSettings();
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
      await login(phone);
      navigate('/', { replace: true });
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Login failed';
      // If user not found, redirect to register
      if (msg.includes('Invalid credentials')) {
        navigate('/register', { state: { phone } });
        return;
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-gradient-to-b from-slate-50 to-slate-100">
      <motion.div
        className="w-full max-w-sm md:max-w-md"
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
              className="w-20 h-20 rounded-2xl mx-auto mb-4 object-cover shadow-lg"
              whileHover={{ scale: 1.05 }}
            />
          ) : (
            <motion.div
              className="w-20 h-20 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg"
              style={{ backgroundColor: settings.primary_color }}
              whileHover={{ scale: 1.05 }}
            >
              <CreditCard className="w-10 h-10 text-white" />
            </motion.div>
          )}
          <h1 className="text-2xl font-bold text-gray-900">{settings.business_name}</h1>
          <p className="text-gray-500 text-sm mt-1">Masukkan nombor telefon untuk log masuk</p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Nombor Telefon</label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="cth: 0121234567"
                  className="input-field pl-11"
                  required
                  autoComplete="tel"
                  autoFocus
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
              style={{ backgroundColor: settings.primary_color }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Loading...
                </span>
              ) : 'Log Masuk'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Pengguna baru akan diminta untuk mendaftar
        </p>
      </motion.div>
    </div>
  );
}
