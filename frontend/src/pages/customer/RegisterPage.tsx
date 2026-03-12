import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CreditCard, User, Phone, Mail, Car } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { useToast } from '../../components/ui/Toast';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register, isAuthenticated, isAdmin, needsProfileCompletion } = useAuth();
  const { settings } = useSettings();
  const toast = useToast();
  const [form, setForm] = useState({
    name: '', phone: '', email: '', plate_number: ''
  });
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: name === 'plate_number' ? value.toUpperCase() : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.plate_number.trim() || form.plate_number.trim().length < 2) {
      setError('Vehicle plate number is required');
      toast.warning('Vehicle plate number is required');
      return;
    }

    setLoading(true);
    try {
      await register({
        name: form.name,
        phone: form.phone,
        email: form.email || undefined,
        plate_number: form.plate_number.trim(),
      });
      navigate('/', { replace: true });
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Registration failed';
      setError(msg);
      toast.error(msg);
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
        {/* Header */}
        <div className="text-center mb-8">
          <motion.div
            className="w-16 h-16 md:w-20 md:h-20 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg"
            style={{ backgroundColor: settings.primary_color }}
            whileHover={{ scale: 1.05 }}
          >
            <CreditCard className="w-8 h-8 md:w-10 md:h-10 text-white" />
          </motion.div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Create Account</h1>
          <p className="text-gray-500 text-sm md:text-base mt-1">
            Join {settings.business_name} loyalty program!
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <motion.div
              className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              {error}
            </motion.div>
          )}

          <div className="relative">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="Full name"
              className="input-field pl-11"
              required
            />
          </div>

          <div className="relative">
            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="tel"
              name="phone"
              value={form.phone}
              onChange={handleChange}
              placeholder="Phone number (e.g., 0121234567)"
              className="input-field pl-11"
              required
            />
          </div>

          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="Email (optional)"
              className="input-field pl-11"
            />
          </div>

          {/* Vehicle Plate Number - REQUIRED */}
          <div className="relative">
            <Car className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              name="plate_number"
              value={form.plate_number}
              onChange={handleChange}
              placeholder="Vehicle plate number (e.g., WQT 1234)"
              className="input-field pl-11 uppercase font-mono tracking-wider"
              required
            />
          </div>
          <p className="text-xs text-gray-400 -mt-2 ml-1">
            * Required for car wash service
          </p>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
            style={{ backgroundColor: settings.primary_color }}
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold" style={{ color: settings.primary_color }}>
            Sign In
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
