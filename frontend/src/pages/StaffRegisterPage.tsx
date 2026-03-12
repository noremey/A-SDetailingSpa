import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, User, Phone, Mail, Lock, Eye, EyeOff, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { staffRegisterService } from '../services/api';
import { useToast } from '../components/ui/Toast';

type PageState = 'loading' | 'valid' | 'invalid' | 'expired' | 'used' | 'success';

export default function StaffRegisterPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { settings } = useSettings();
  const { isAuthenticated, isAdmin } = useAuth();
  const toast = useToast();

  const inviteCode = searchParams.get('code') || '';

  // Page state
  const [pageState, setPageState] = useState<PageState>('loading');
  const [invitedBy, setInvitedBy] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Manual form
  const [form, setForm] = useState({ name: '', phone: '', email: '', password: '', confirmPassword: '' });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Success info
  const [successName, setSuccessName] = useState('');

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      if (isAdmin) {
        navigate('/admin', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    }
  }, [isAuthenticated, isAdmin, navigate]);

  // Validate invite code on mount
  useEffect(() => {
    if (!inviteCode) {
      setPageState('invalid');
      setErrorMessage('No invite code provided. Please use the invite link shared with you.');
      return;
    }

    const validate = async () => {
      try {
        const res = await staffRegisterService.validateInvite(inviteCode);
        if (res.data.success && res.data.invite?.valid) {
          setPageState('valid');
          setInvitedBy(res.data.invite.invited_by || '');
          setExpiresAt(res.data.invite.expires_at || '');
        } else {
          const msg = res.data.message || '';
          if (msg.toLowerCase().includes('used')) {
            setPageState('used');
          } else if (msg.toLowerCase().includes('expired')) {
            setPageState('expired');
          } else {
            setPageState('invalid');
          }
          setErrorMessage(msg);
        }
      } catch (err: any) {
        const msg = err.response?.data?.message || 'Failed to validate invite code';
        if (msg.toLowerCase().includes('used')) {
          setPageState('used');
        } else if (msg.toLowerCase().includes('expired')) {
          setPageState('expired');
        } else {
          setPageState('invalid');
        }
        setErrorMessage(msg);
      }
    };

    validate();
  }, [inviteCode]);

  // Manual form submit
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    // Validation
    if (!form.name.trim()) { setFormError('Name is required'); return; }
    if (!form.phone.trim()) { setFormError('Phone number is required'); return; }
    if (form.phone.replace(/\D/g, '').length < 10) { setFormError('Please enter a valid phone number (min 10 digits)'); return; }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) { setFormError('Please enter a valid email address'); return; }
    if (form.password.length < 6) { setFormError('Password must be at least 6 characters'); return; }
    if (form.password !== form.confirmPassword) { setFormError('Passwords do not match'); return; }

    setSubmitting(true);
    try {
      const res = await staffRegisterService.registerManual({
        invite_code: inviteCode,
        name: form.name.trim(),
        phone: form.phone.trim(),
        password: form.password,
        email: form.email.trim() || undefined,
      });
      if (res.data.success) {
        setSuccessName(res.data.user?.name || form.name);
        setPageState('success');
      } else {
        setFormError(res.data.message || 'Registration failed');
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Registration failed';
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // ================================
  // RENDER: Loading
  // ================================
  if (pageState === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100">
        <motion.div
          className="text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className="w-12 h-12 border-3 border-gray-200 border-t-gray-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 text-sm">Validating invite link...</p>
        </motion.div>
      </div>
    );
  }

  // ================================
  // RENDER: Error states (invalid / expired / used)
  // ================================
  if (pageState === 'invalid' || pageState === 'expired' || pageState === 'used') {
    const iconConfig = {
      invalid: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-50', title: 'Invalid Invite Link' },
      expired: { icon: Clock, color: 'text-amber-500', bg: 'bg-amber-50', title: 'Invite Link Expired' },
      used:    { icon: CheckCircle2, color: 'text-blue-500', bg: 'bg-blue-50', title: 'Invite Already Used' },
    }[pageState];

    const Icon = iconConfig.icon;

    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-b from-slate-50 to-slate-100">
        <motion.div
          className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-8 border border-gray-100 text-center"
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <div className={`w-16 h-16 rounded-2xl ${iconConfig.bg} flex items-center justify-center mx-auto mb-4`}>
            <Icon className={`w-8 h-8 ${iconConfig.color}`} />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">{iconConfig.title}</h1>
          <p className="text-sm text-gray-500 mb-6">
            {errorMessage || 'This invite link is no longer valid. Please contact your administrator for a new invite.'}
          </p>
          <Link
            to="/login"
            className="inline-flex items-center justify-center px-6 py-3 rounded-xl text-sm font-semibold text-white transition-all hover:shadow-md"
            style={{ backgroundColor: settings.primary_color }}
          >
            Go to Login
          </Link>
        </motion.div>
      </div>
    );
  }

  // ================================
  // RENDER: Success
  // ================================
  if (pageState === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-b from-slate-50 to-slate-100">
        <motion.div
          className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-8 border border-gray-100 text-center"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
        >
          <motion.div
            className="w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-5"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', damping: 15 }}
          >
            <CheckCircle2 className="w-10 h-10 text-emerald-500" />
          </motion.div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome aboard!</h1>
          <p className="text-sm text-gray-500 mb-1">
            <strong>{successName}</strong>, your staff account has been created successfully.
          </p>
          <p className="text-xs text-gray-400 mb-6">You can now login with your credentials.</p>

          <Link
            to="/login"
            className="inline-flex items-center justify-center w-full px-6 py-3 rounded-xl text-sm font-semibold text-white transition-all hover:shadow-md"
            style={{ backgroundColor: settings.primary_color }}
          >
            Go to Login
          </Link>
        </motion.div>
      </div>
    );
  }

  // ================================
  // RENDER: Valid - Registration form
  // ================================
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8 bg-gradient-to-b from-slate-50 to-slate-100">
      <motion.div
        className="w-full max-w-sm md:max-w-md bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden"
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        {/* Header */}
        <div className="px-6 pt-8 pb-4 text-center">
          {settings.business_logo ? (
            <img
              src={settings.business_logo}
              alt={settings.business_name}
              className="w-14 h-14 rounded-xl mx-auto mb-3 object-cover shadow-md"
            />
          ) : (
            <div
              className="w-14 h-14 rounded-xl mx-auto mb-3 flex items-center justify-center shadow-md"
              style={{ backgroundColor: settings.primary_color }}
            >
              <ShieldCheck className="w-7 h-7 text-white" />
            </div>
          )}
          <h1 className="text-xl font-bold text-gray-900">{settings.business_name}</h1>
          <p className="text-sm text-gray-500 mt-1">Staff Registration</p>
          {invitedBy && (
            <p className="text-xs text-gray-400 mt-1">
              Invited by <span className="font-medium text-gray-600">{invitedBy}</span>
            </p>
          )}
        </div>

        {/* Content */}
        <div className="px-6 pb-8">
          {/* Error */}
          <AnimatePresence>
            {formError && (
              <motion.div
                className="p-3 mb-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm text-center"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                {formError}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Registration Form */}
            <form onSubmit={handleManualSubmit} className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                    className="input-field pl-11"
                    placeholder="Enter your name"
                    autoFocus
                  />
                </div>
              </div>

              {/* Phone & Email */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))}
                      className="input-field pl-11"
                      placeholder="01xxxxxxxxx"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                      className="input-field pl-11"
                      placeholder="email@example.com"
                    />
                  </div>
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))}
                    className="input-field pl-11 pr-11"
                    placeholder="Min 6 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={form.confirmPassword}
                    onChange={(e) => setForm(f => ({ ...f, confirmPassword: e.target.value }))}
                    className="input-field pl-11 pr-11"
                    placeholder="Re-enter password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {form.confirmPassword && form.password !== form.confirmPassword && (
                  <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
                )}
                {form.confirmPassword && form.password === form.confirmPassword && form.password.length >= 6 && (
                  <p className="text-xs text-emerald-500 mt-1">Passwords match</p>
                )}
              </div>

              {/* Expiry info */}
              {expiresAt && (
                <div className="flex items-center justify-center gap-1.5 text-xs text-gray-400">
                  <Clock className="w-3 h-3" />
                  Link expires {new Date(expiresAt).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </div>
              )}

              {/* Submit */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full px-4 py-3 rounded-xl text-sm font-semibold text-white shadow-sm hover:shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ backgroundColor: settings.primary_color }}
                >
                  {submitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      Register
                    </>
                  )}
                </button>
              </div>
            </form>

          {/* Login link */}
          <p className="text-center text-sm text-gray-500 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold" style={{ color: settings.primary_color }}>
              Login here
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
