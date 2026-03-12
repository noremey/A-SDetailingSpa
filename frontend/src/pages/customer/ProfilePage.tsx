import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Phone, Mail, Lock, Save, LogOut, CreditCard, Car, Plus, Trash2, Star, Shield, ChevronDown, Bike } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { customerService } from '../../services/api';
import { Vehicle } from '../../types';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../components/ui/Toast';
import ConfirmModal from '../../components/ui/ConfirmModal';

type VehicleType = 'car' | 'motorcycle';

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const toast = useToast();

  const isGoogleUser = !!user?.google_id;

  const [form, setForm] = useState({ name: '', phone: '', email: '' });
  const [loading, setLoading] = useState(false);

  // Vehicle state
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(false);
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [newPlate, setNewPlate] = useState('');
  const [newVehicleType, setNewVehicleType] = useState<VehicleType>('car');
  const [addingVehicle, setAddingVehicle] = useState(false);

  // Confirm modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    vehicleId: number | null;
    plateName: string;
  }>({ isOpen: false, vehicleId: null, plateName: '' });

  // Logout confirm
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Active section for mobile accordion
  const [activeSection, setActiveSection] = useState<'vehicles' | 'profile' | null>('vehicles');

  useEffect(() => {
    if (user) {
      setForm({
        name: user.name || '',
        phone: user.phone || '',
        email: user.email || '',
      });
    }
  }, [user]);

  useEffect(() => {
    fetchVehicles();
  }, []);

  const fetchVehicles = async () => {
    setVehiclesLoading(true);
    try {
      const { data } = await customerService.getVehicles();
      if (data.success) {
        setVehicles(data.vehicles || []);
      }
    } catch {
      toast.error('Failed to load vehicles');
    } finally {
      setVehiclesLoading(false);
    }
  };

  const handleAddVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlate.trim()) return;
    setAddingVehicle(true);

    try {
      const { data } = await customerService.addVehicle({
        plate_number: newPlate.trim().toUpperCase(),
        vehicle_type: newVehicleType,
      });
      if (data.success) {
        toast.success('Vehicle added successfully!');
        setNewPlate('');
        setNewVehicleType('car');
        setShowAddVehicle(false);
        fetchVehicles();
      } else {
        toast.error(data.message || 'Failed to add vehicle');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to add vehicle');
    } finally {
      setAddingVehicle(false);
    }
  };

  const handleRemoveVehicle = (vehicleId: number, plateName: string) => {
    if (vehicles.length <= 1) {
      toast.warning('You must have at least one vehicle.');
      return;
    }
    setConfirmModal({ isOpen: true, vehicleId, plateName });
  };

  const confirmRemoveVehicle = async () => {
    if (!confirmModal.vehicleId) return;
    try {
      const { data } = await customerService.removeVehicle(confirmModal.vehicleId);
      if (data.success) {
        toast.success('Vehicle removed successfully.');
        fetchVehicles();
      } else {
        toast.error(data.message || 'Failed to remove vehicle');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to remove vehicle');
    } finally {
      setConfirmModal({ isOpen: false, vehicleId: null, plateName: '' });
    }
  };

  const handleSetPrimary = async (vehicleId: number) => {
    try {
      const { data } = await customerService.setPrimaryVehicle(vehicleId);
      if (data.success) {
        toast.success('Primary vehicle updated.');
        fetchVehicles();
      } else {
        toast.error(data.message || 'Failed to set primary vehicle');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to set primary vehicle');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const updateData: any = {};

      // Google users cannot change name and email
      if (isGoogleUser) {
        updateData.name = user?.name || '';
        updateData.email = user?.email || '';
        updateData.phone = form.phone;
      } else {
        updateData.name = form.name;
        updateData.email = form.email;
        updateData.phone = form.phone;
      }

      const { data } = await customerService.updateProfile(updateData);
      if (data.success) {
        toast.success('Profile updated successfully!');
      } else {
        toast.error(data.message || 'Update failed');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Update failed');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  const confirmLogout = () => {
    setShowLogoutConfirm(false);
    logout();
    navigate('/login');
  };

  const getVehicleIcon = (type: string) => {
    if (type === 'motorcycle') return <Bike className="w-4 h-4" />;
    return <Car className="w-4 h-4" />;
  };

  const getVehicleLabel = (type: string) => {
    if (type === 'motorcycle') return 'Motorcycle';
    return 'Car';
  };

  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-MY', { month: 'long', year: 'numeric' })
    : '';

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="flex items-center justify-between">
          <h1 className="font-bold text-lg md:text-xl text-gray-900">My Profile</h1>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-red-500 hover:bg-red-50 transition-colors text-sm font-medium"
            title="Logout"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>

      <div className="px-4 md:px-6 lg:px-8 pt-5 md:pt-6 pb-6 space-y-5">

        {/* ========== Profile Hero Card ========== */}
        <motion.div
          className="relative rounded-2xl overflow-hidden shadow-lg"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
        >
          {/* Background gradient */}
          <div
            className="absolute inset-0"
            style={{ background: `linear-gradient(135deg, ${settings.primary_color}, ${settings.secondary_color})` }}
          />
          {/* Pattern overlay */}
          <div className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: `radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)`,
              backgroundSize: '40px 40px, 60px 60px',
            }}
          />

          <div className="relative p-5 md:p-6">
            <div className="flex items-center gap-4">
              {/* Avatar */}
              <div className="relative">
                {user?.avatar ? (
                  <img
                    src={user.avatar.startsWith('http') ? user.avatar : `${import.meta.env.BASE_URL}uploads/${user.avatar}`}
                    alt={user.name}
                    className="w-16 h-16 md:w-20 md:h-20 rounded-2xl object-cover ring-3 ring-white/30 shadow-xl"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-white font-bold text-2xl md:text-3xl shadow-xl ring-3 ring-white/30">
                    {user?.name?.charAt(0)?.toUpperCase() || <User className="w-8 h-8 text-white" />}
                  </div>
                )}
                {isGoogleUser && (
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-white rounded-lg shadow-md flex items-center justify-center">
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <h2 className="font-bold text-lg md:text-xl text-white truncate">{user?.name}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <CreditCard className="w-3.5 h-3.5 text-white/60 flex-shrink-0" />
                  <span className="text-sm text-white/80 font-medium">{user?.user_code}</span>
                </div>
              </div>
            </div>

            {/* User details section */}
            <div className="mt-4 pt-4 border-t border-white/15 space-y-2.5">
              {user?.email && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                    <Mail className="w-3.5 h-3.5 text-white/70" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-white/40 font-medium">Email</p>
                    <p className="text-sm text-white/90 truncate">{user.email}</p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                  <Phone className="w-3.5 h-3.5 text-white/70" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wider text-white/40 font-medium">Phone</p>
                  <p className="text-sm text-white/90">{user?.phone || <span className="text-white/40 italic">Not set</span>}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Car className="w-3.5 h-3.5 text-white/70" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] uppercase tracking-wider text-white/40 font-medium">Vehicles</p>
                  {vehicles.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {vehicles.map((v) => (
                        <span
                          key={v.id}
                          className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-md ${
                            v.is_primary
                              ? 'bg-white/25 text-white'
                              : 'bg-white/10 text-white/75'
                          }`}
                        >
                          {v.vehicle_type === 'motorcycle' ? (
                            <Bike className="w-3 h-3" />
                          ) : (
                            <Car className="w-3 h-3" />
                          )}
                          {v.plate_number}
                          {v.is_primary && <Star className="w-2.5 h-2.5 text-yellow-300" fill="currentColor" />}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-white/40 italic">No vehicles</p>
                  )}
                </div>
              </div>

              {memberSince && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                    <Shield className="w-3.5 h-3.5 text-white/70" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-white/40 font-medium">Member Since</p>
                    <p className="text-sm text-white/90">{memberSince}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Stats bar */}
            <div className="flex items-center gap-3 mt-4 pt-4 border-t border-white/15">
              <div className="flex-1 text-center">
                <p className="text-2xl font-bold text-white">{vehicles.length}</p>
                <p className="text-xs text-white/60 mt-0.5">Vehicles</p>
              </div>
              <div className="w-px h-8 bg-white/15" />
              <div className="flex-1 text-center">
                <p className="text-2xl font-bold text-white">{user?.active_card?.tokens_earned || 0}</p>
                <p className="text-xs text-white/60 mt-0.5">Tokens</p>
              </div>
              <div className="w-px h-8 bg-white/15" />
              <div className="flex-1 text-center">
                <p className="text-2xl font-bold text-white">{user?.total_completed_cards || 0}</p>
                <p className="text-xs text-white/60 mt-0.5">Completed</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Google account info banner */}
        {isGoogleUser && (
          <motion.div
            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-50 border border-blue-100"
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.05 }}
          >
            <Shield className="w-4 h-4 text-blue-500 flex-shrink-0" />
            <p className="text-xs text-blue-700">
              Your name and email are managed by Google and cannot be changed here.
            </p>
          </motion.div>
        )}

        {/* ========== Two-column layout ========== */}
        <div className="lg:grid lg:grid-cols-2 lg:gap-5 space-y-4 lg:space-y-0">

          {/* ========== My Vehicles Section ========== */}
          <motion.div
            className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.05 }}
          >
            {/* Section header - clickable on mobile */}
            <button
              type="button"
              className="w-full flex items-center justify-between p-5 md:p-6 lg:cursor-default"
              onClick={() => setActiveSection(activeSection === 'vehicles' ? null : 'vehicles')}
            >
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${settings.primary_color}12` }}
                >
                  <Car className="w-4 h-4" style={{ color: settings.primary_color }} />
                </div>
                My Vehicles
                <span className="text-xs font-normal text-gray-400 bg-gray-100 rounded-full px-2 py-0.5 ml-1">
                  {vehicles.length}
                </span>
              </h2>
              <ChevronDown className={`w-5 h-5 text-gray-400 lg:hidden transition-transform ${activeSection === 'vehicles' ? 'rotate-180' : ''}`} />
            </button>

            {/* Section content */}
            <div className={`${activeSection === 'vehicles' ? 'block' : 'hidden'} lg:block`}>
              <div className="px-5 md:px-6 pb-5 md:pb-6 space-y-3">

                {/* Add Vehicle button */}
                <button
                  type="button"
                  onClick={() => setShowAddVehicle(!showAddVehicle)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed transition-colors text-sm font-medium"
                  style={{
                    borderColor: showAddVehicle ? settings.primary_color : '#e5e7eb',
                    color: showAddVehicle ? settings.primary_color : '#9ca3af',
                    backgroundColor: showAddVehicle ? `${settings.primary_color}08` : 'transparent',
                  }}
                >
                  <Plus className="w-4 h-4" />
                  Add New Vehicle
                </button>

                {/* Add Vehicle form */}
                <AnimatePresence>
                  {showAddVehicle && (
                    <motion.form
                      onSubmit={handleAddVehicle}
                      className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-3"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      {/* Vehicle type selector */}
                      <div>
                        <label className="text-xs font-medium text-gray-500 mb-2 block">Vehicle Type</label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setNewVehicleType('car')}
                            className={`flex items-center justify-center gap-2 py-3 rounded-xl border-2 text-sm font-medium transition-all ${
                              newVehicleType === 'car'
                                ? 'border-current shadow-sm'
                                : 'border-gray-200 text-gray-400 hover:border-gray-300'
                            }`}
                            style={newVehicleType === 'car' ? { color: settings.primary_color, borderColor: settings.primary_color, backgroundColor: `${settings.primary_color}08` } : {}}
                          >
                            <Car className="w-5 h-5" />
                            Car
                          </button>
                          <button
                            type="button"
                            onClick={() => setNewVehicleType('motorcycle')}
                            className={`flex items-center justify-center gap-2 py-3 rounded-xl border-2 text-sm font-medium transition-all ${
                              newVehicleType === 'motorcycle'
                                ? 'border-current shadow-sm'
                                : 'border-gray-200 text-gray-400 hover:border-gray-300'
                            }`}
                            style={newVehicleType === 'motorcycle' ? { color: settings.primary_color, borderColor: settings.primary_color, backgroundColor: `${settings.primary_color}08` } : {}}
                          >
                            <Bike className="w-5 h-5" />
                            Motorcycle
                          </button>
                        </div>
                      </div>

                      {/* Plate number input */}
                      <div>
                        <label className="text-xs font-medium text-gray-500 mb-1.5 block">Plate Number</label>
                        <input
                          type="text"
                          value={newPlate}
                          onChange={e => setNewPlate(e.target.value)}
                          placeholder="e.g. ABC 1234"
                          className="input-field w-full uppercase tracking-wider font-semibold text-center"
                          required
                        />
                      </div>

                      {/* Submit */}
                      <button
                        type="submit"
                        disabled={addingVehicle || !newPlate.trim()}
                        className="w-full py-2.5 rounded-xl text-white text-sm font-semibold transition-opacity disabled:opacity-50"
                        style={{ backgroundColor: settings.primary_color }}
                      >
                        {addingVehicle ? (
                          <span className="flex items-center justify-center gap-2">
                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Adding...
                          </span>
                        ) : (
                          <span className="flex items-center justify-center gap-2">
                            <Plus className="w-4 h-4" />
                            Add Vehicle
                          </span>
                        )}
                      </button>
                    </motion.form>
                  )}
                </AnimatePresence>

                {/* Vehicles list */}
                {vehiclesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin" />
                  </div>
                ) : vehicles.length === 0 ? (
                  <div className="text-center py-8">
                    <Car className="w-10 h-10 text-gray-200 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">No vehicles added yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {vehicles.map((vehicle, idx) => (
                      <motion.div
                        key={vehicle.id}
                        className={`flex items-center justify-between p-3.5 rounded-xl transition-colors ${
                          vehicle.is_primary
                            ? 'bg-gradient-to-r from-gray-50 to-transparent border-l-3'
                            : 'bg-gray-50'
                        } border border-gray-100`}
                        style={vehicle.is_primary ? { borderLeftColor: settings.primary_color } : {}}
                        initial={{ x: -20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: idx * 0.05 }}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{
                              backgroundColor: vehicle.is_primary ? `${settings.primary_color}15` : '#f3f4f6',
                              color: vehicle.is_primary ? settings.primary_color : '#9ca3af',
                            }}
                          >
                            {getVehicleIcon(vehicle.vehicle_type)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-gray-900 tracking-wide truncate">
                                {vehicle.plate_number}
                              </span>
                              {vehicle.is_primary && (
                                <span
                                  className="inline-flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md text-white flex-shrink-0"
                                  style={{ backgroundColor: settings.primary_color }}
                                >
                                  <Star className="w-2.5 h-2.5" fill="currentColor" />
                                  Primary
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-gray-400">{getVehicleLabel(vehicle.vehicle_type)}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-0.5 flex-shrink-0">
                          {!vehicle.is_primary && (
                            <button
                              type="button"
                              onClick={() => handleSetPrimary(vehicle.id)}
                              className="p-2 rounded-lg text-gray-300 hover:text-yellow-500 hover:bg-yellow-50 transition-colors"
                              title="Set as primary"
                            >
                              <Star className="w-4 h-4" />
                            </button>
                          )}
                          {vehicles.length > 1 ? (
                            <button
                              type="button"
                              onClick={() => handleRemoveVehicle(vehicle.id, vehicle.plate_number)}
                              className="p-2 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                              title="Remove vehicle"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          ) : (
                            <span className="p-2 text-gray-200 cursor-not-allowed" title="Cannot remove last vehicle">
                              <Trash2 className="w-4 h-4" />
                            </span>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>

          {/* ========== Edit Profile Section ========== */}
          <motion.div
            className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            {/* Section header - clickable on mobile */}
            <button
              type="button"
              className="w-full flex items-center justify-between p-5 md:p-6 lg:cursor-default"
              onClick={() => setActiveSection(activeSection === 'profile' ? null : 'profile')}
            >
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${settings.primary_color}12` }}
                >
                  <User className="w-4 h-4" style={{ color: settings.primary_color }} />
                </div>
                Edit Profile
              </h2>
              <ChevronDown className={`w-5 h-5 text-gray-400 lg:hidden transition-transform ${activeSection === 'profile' ? 'rotate-180' : ''}`} />
            </button>

            {/* Section content */}
            <div className={`${activeSection === 'profile' ? 'block' : 'hidden'} lg:block`}>
              <form onSubmit={handleSubmit} className="px-5 md:px-6 pb-5 md:pb-6 space-y-4">

                {/* Name field */}
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1.5 block">Full Name</label>
                  <div className="relative">
                    <User className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 ${isGoogleUser ? 'text-gray-300' : 'text-gray-400'}`} />
                    <input
                      type="text"
                      value={form.name}
                      onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                      placeholder="Full name"
                      className={`input-field pl-11 w-full ${isGoogleUser ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''}`}
                      disabled={isGoogleUser}
                      required
                    />
                    {isGoogleUser && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <Lock className="w-3.5 h-3.5 text-gray-300" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Email field */}
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1.5 block">Email</label>
                  <div className="relative">
                    <Mail className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 ${isGoogleUser ? 'text-gray-300' : 'text-gray-400'}`} />
                    <input
                      type="email"
                      value={form.email}
                      onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                      placeholder="Email"
                      className={`input-field pl-11 w-full ${isGoogleUser ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''}`}
                      disabled={isGoogleUser}
                    />
                    {isGoogleUser && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <Lock className="w-3.5 h-3.5 text-gray-300" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Phone field - always editable */}
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1.5 block">Phone Number</label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                      placeholder="Phone number"
                      className="input-field pl-11 w-full"
                      required
                    />
                  </div>
                </div>

                {/* Save button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2 transition-opacity disabled:opacity-60 shadow-sm"
                  style={{ backgroundColor: settings.primary_color }}
                >
                  {loading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save Changes
                    </>
                  )}
                </button>
              </form>
            </div>
          </motion.div>

        </div>{/* End two-column grid */}

      </div>

      {/* ========== Modals ========== */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onConfirm={confirmRemoveVehicle}
        onCancel={() => setConfirmModal({ isOpen: false, vehicleId: null, plateName: '' })}
        title="Remove Vehicle"
        message={`Are you sure you want to remove ${confirmModal.plateName}? This action cannot be undone.`}
        confirmText="Remove"
        cancelText="Keep It"
        variant="danger"
      />

      <ConfirmModal
        isOpen={showLogoutConfirm}
        onConfirm={confirmLogout}
        onCancel={() => setShowLogoutConfirm(false)}
        title="Logout"
        message="Are you sure you want to log out of your account?"
        confirmText="Logout"
        cancelText="Cancel"
        variant="warning"
      />
    </div>
  );
}
