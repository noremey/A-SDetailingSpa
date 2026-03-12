import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Phone, Car, CheckCircle, ChevronRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { customerService } from '../../services/api';
import { useToast } from '../../components/ui/Toast';

export default function CompleteProfilePage() {
  const navigate = useNavigate();
  const { user, isAdmin, needsProfileCompletion, refreshUser, clearProfileCompletion } = useAuth();
  const { settings } = useSettings();
  const toast = useToast();

  const [phone, setPhone] = useState('');
  const [plateNumber, setPlateNumber] = useState('');
  const [step, setStep] = useState<'phone' | 'vehicle' | 'done'>('phone');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Determine what's needed
  const needsPhone = !user?.phone;
  const needsVehicle = user?.needs_vehicle !== false; // default to true if unknown

  // If profile is already complete, redirect
  useEffect(() => {
    if (!needsProfileCompletion) {
      if (isAdmin) {
        navigate('/admin', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    }
  }, [needsProfileCompletion, isAdmin, navigate]);

  // Set initial step based on what's needed
  useEffect(() => {
    if (!needsPhone) {
      setStep('vehicle');
    } else {
      setStep('phone');
    }
  }, [needsPhone]);

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const cleanPhone = phone.trim();
    if (!cleanPhone || cleanPhone.length < 10) {
      setError('Please enter a valid phone number (min 10 digits)');
      return;
    }

    setLoading(true);
    try {
      const res = await customerService.updateProfile({
        name: user?.name || '',
        phone: cleanPhone,
        email: user?.email || '',
      });
      if (res.data.success) {
        toast.success('Phone number saved!');
        // Refresh user to get updated data
        await refreshUser();
        // Check if vehicle is also needed
        if (needsVehicle) {
          setStep('vehicle');
        } else {
          // Profile complete
          handleComplete();
        }
      } else {
        setError(res.data.message || 'Failed to save phone number');
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to save phone number';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleVehicleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const plate = plateNumber.toUpperCase().trim();
    if (!plate || plate.length < 2) {
      setError('Please enter a valid plate number');
      return;
    }

    setLoading(true);
    try {
      const res = await customerService.addVehicle({ plate_number: plate });
      if (res.data.success) {
        toast.success('Vehicle registered!');
        handleComplete();
      } else {
        setError(res.data.message || 'Failed to add vehicle');
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to add vehicle';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async () => {
    setStep('done');
    // Clear the profile completion flag
    clearProfileCompletion();
    await refreshUser();
    // Brief delay to show success animation
    setTimeout(() => {
      navigate('/', { replace: true });
    }, 1500);
  };

  // Progress indicator
  const totalSteps = (needsPhone ? 1 : 0) + (needsVehicle ? 1 : 0);
  const currentStep = step === 'phone' ? 1 : step === 'vehicle' ? (needsPhone ? 2 : 1) : totalSteps;

  if (step === 'done') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-gradient-to-b from-slate-50 to-slate-100">
        <motion.div
          className="text-center"
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', duration: 0.6 }}
        >
          <motion.div
            className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center bg-green-500 shadow-lg"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring' }}
          >
            <CheckCircle className="w-10 h-10 text-white" />
          </motion.div>
          <h1 className="text-2xl font-bold text-gray-900">All Set!</h1>
          <p className="text-gray-500 text-sm mt-2">Redirecting to your dashboard...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-gradient-to-b from-slate-50 to-slate-100">
      <motion.div
        className="w-full max-w-sm md:max-w-md md:bg-white md:rounded-2xl md:shadow-xl md:p-8 md:border md:border-gray-100"
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        key={step}
      >
        {/* Progress dots */}
        {totalSteps > 1 && (
          <div className="flex items-center justify-center gap-2 mb-6">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={`h-2 rounded-full transition-all duration-300 ${
                  i < currentStep
                    ? 'w-8 bg-green-500'
                    : i === currentStep
                    ? 'w-8'
                    : 'w-2 bg-gray-200'
                }`}
                style={i === currentStep - 1 ? { backgroundColor: settings.primary_color, width: '2rem' } : undefined}
              />
            ))}
          </div>
        )}

        {/* Header */}
        <div className="text-center mb-8">
          <motion.div
            className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg"
            style={{ backgroundColor: step === 'phone' ? '#3b82f6' : '#22c55e' }}
            whileHover={{ scale: 1.05 }}
            key={step}
            initial={{ rotate: -10, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            {step === 'phone' ? (
              <Phone className="w-8 h-8 text-white" />
            ) : (
              <Car className="w-8 h-8 text-white" />
            )}
          </motion.div>
          <h1 className="text-2xl font-bold text-gray-900">
            {step === 'phone' ? 'Add Phone Number' : 'Register Vehicle'}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {step === 'phone'
              ? 'We need your phone number for account security'
              : 'Register your vehicle plate number for our car wash service'}
          </p>
          {user?.name && (
            <p className="text-gray-400 text-xs mt-3">
              Welcome, <span className="font-medium text-gray-600">{user.name}</span>
            </p>
          )}
        </div>

        {/* Form */}
        {step === 'phone' ? (
          <form onSubmit={handlePhoneSubmit} className="space-y-4">
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
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g., 0121234567"
                className="input-field pl-11"
                required
                autoFocus
                minLength={10}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary flex items-center justify-center gap-2"
              style={{ backgroundColor: settings.primary_color }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Saving...
                </span>
              ) : (
                <>
                  {needsVehicle ? 'Next' : 'Complete'}
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVehicleSubmit} className="space-y-4">
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
              <Car className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={plateNumber}
                onChange={(e) => setPlateNumber(e.target.value.toUpperCase())}
                placeholder="e.g., WQT 1234"
                className="input-field pl-11 uppercase font-mono tracking-wider"
                required
                autoFocus
              />
            </div>
            <p className="text-xs text-gray-400 -mt-2 ml-1">
              * Required for car wash service
            </p>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary flex items-center justify-center gap-2"
              style={{ backgroundColor: settings.primary_color }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Saving...
                </span>
              ) : (
                <>
                  Complete
                  <CheckCircle className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
}
