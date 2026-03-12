import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, User, Phone, Mail, Calendar, Clock, CreditCard, Car,
  Star, Check, ChevronDown, Gift, TrendingUp, Award, Coins,
  Shield, ShieldOff, ShieldAlert
} from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';
import { adminService } from '../../services/api';
import type { CustomerWithCard, Vehicle, LoyaltyCard, Token } from '../../types';

interface CustomerDetailData {
  customer: {
    id: number;
    user_code: string;
    name: string;
    phone: string | null;
    email: string | null;
    status: string;
    avatar: string | null;
    last_login: string | null;
    created_at: string;
  };
  vehicles: Vehicle[];
  cards: LoyaltyCard[];
  stats: {
    total_tokens: number;
    total_redemptions: number;
    total_spend: number;
    total_cards: number;
  };
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  customer: CustomerWithCard | null;
  data: CustomerDetailData | null;
  loading: boolean;
  onStatusChange?: () => void;
}

export default function CustomerDetailModal({ isOpen, onClose, customer, data, loading, onStatusChange }: Props) {
  const { settings } = useSettings();
  const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set());
  const [changingStatus, setChangingStatus] = useState(false);
  const [statusConfirm, setStatusConfirm] = useState<'active' | 'inactive' | 'banned' | null>(null);
  const [currentStatus, setCurrentStatus] = useState<string>('');

  // Sync currentStatus with data
  useEffect(() => {
    if (data?.customer?.status) setCurrentStatus(data.customer.status);
  }, [data]);

  // Reset confirm state when modal closes
  useEffect(() => {
    if (!isOpen) { setStatusConfirm(null); setChangingStatus(false); }
  }, [isOpen]);

  const handleStatusChange = async (newStatus: 'active' | 'inactive' | 'banned') => {
    if (!data?.customer) return;
    setChangingStatus(true);
    try {
      const res = await adminService.changeCustomerStatus(data.customer.id, newStatus);
      if (res.data.success) {
        setCurrentStatus(newStatus);
        setStatusConfirm(null);
        onStatusChange?.();
      }
    } catch (err: any) {
      console.error('Failed to change status:', err);
    } finally {
      setChangingStatus(false);
    }
  };

  // Auto-expand active card when data loads
  useEffect(() => {
    if (data?.cards) {
      const activeCard = data.cards.find(c => c.status === 'active');
      if (activeCard) {
        setExpandedCards(new Set([activeCard.id]));
      } else if (data.cards.length > 0) {
        setExpandedCards(new Set([data.cards[0].id]));
      }
    }
  }, [data]);

  // Body scroll lock + Escape key
  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = 'hidden';
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen, onClose]);

  const toggleCard = (cardId: number) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(cardId)) next.delete(cardId);
      else next.add(cardId);
      return next;
    });
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' });

  const formatDateTime = (d: string) =>
    new Date(d).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const formatCurrency = (amount: number) =>
    `${settings.currency_symbol}${amount.toLocaleString('en-MY', { minimumFractionDigits: 2 })}`;

  const cardStatusBadge = (status: string) => {
    switch (status) {
      case 'active': return { bg: 'bg-blue-50', text: 'text-blue-600', label: 'Active' };
      case 'completed': return { bg: 'bg-emerald-50', text: 'text-emerald-600', label: 'Completed' };
      case 'redeemed': return { bg: 'bg-amber-50', text: 'text-amber-600', label: 'Redeemed' };
      default: return { bg: 'bg-gray-100', text: 'text-gray-500', label: status };
    }
  };

  const customerStatusBadge = (status: string) => {
    switch (status) {
      case 'active': return { bg: 'bg-emerald-50', text: 'text-emerald-600', label: 'Active' };
      case 'inactive': return { bg: 'bg-gray-100', text: 'text-gray-500', label: 'Inactive' };
      case 'banned': return { bg: 'bg-red-50', text: 'text-red-600', label: 'Banned' };
      default: return { bg: 'bg-gray-100', text: 'text-gray-500', label: status };
    }
  };

  const calcCardTotal = (card: LoyaltyCard) =>
    card.tokens.reduce((sum, t) => sum + (t.amount || 0), 0);

  const requireVehicle = settings.require_vehicle === '1';

  if (!isOpen || !customer) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[100] flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        {/* Backdrop */}
        <motion.div
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        />

        {/* Modal */}
        <motion.div
          className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col"
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-1.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors z-10"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Scrollable content */}
          <div className="overflow-y-auto flex-1">
            {loading ? (
              /* Loading Skeleton */
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-gray-100 animate-pulse shrink-0" />
                  <div className="space-y-2 flex-1">
                    <div className="h-5 w-36 bg-gray-100 rounded-lg animate-pulse" />
                    <div className="h-3 w-24 bg-gray-100 rounded animate-pulse" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="h-[72px] bg-gray-50 rounded-xl animate-pulse" />
                  ))}
                </div>
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-14 bg-gray-50 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : data ? (
              <>
                {/* ── Profile Header ── */}
                <div className="p-6 pb-4">
                  <div className="flex items-center gap-4">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', damping: 15, stiffness: 300, delay: 0.1 }}
                    >
                      {data.customer.avatar ? (
                        <img
                          src={data.customer.avatar}
                          alt={data.customer.name}
                          className="w-16 h-16 rounded-full object-cover ring-2 ring-white shadow-lg"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div
                          className="w-16 h-16 rounded-full flex items-center justify-center shadow-lg text-white text-xl font-bold"
                          style={{ background: `linear-gradient(135deg, ${settings.primary_color}, ${settings.secondary_color || settings.primary_color}dd)` }}
                        >
                          {data.customer.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </motion.div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-lg font-bold text-gray-900 truncate">{data.customer.name}</h2>
                        {(() => {
                          const badge = customerStatusBadge(currentStatus || data.customer.status);
                          return (
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${badge.bg} ${badge.text}`}>
                              {badge.label}
                            </span>
                          );
                        })()}
                      </div>
                      <p className="text-xs text-gray-400 font-mono mt-0.5">{data.customer.user_code}</p>
                      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                        <span className="flex items-center gap-1 text-[11px] text-gray-400">
                          <Calendar className="w-3 h-3" />
                          Joined {formatDate(data.customer.created_at)}
                        </span>
                        {data.customer.last_login && (
                          <span className="flex items-center gap-1 text-[11px] text-gray-400">
                            <Clock className="w-3 h-3" />
                            Last seen {formatDate(data.customer.last_login)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Stats Grid ── */}
                <div className="px-6 pb-4">
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Total Spend', value: formatCurrency(data.stats.total_spend), icon: TrendingUp, color: settings.primary_color },
                      { label: 'Total Tokens', value: data.stats.total_tokens, icon: Coins, color: '#059669' },
                      { label: 'Cards', value: data.stats.total_cards, icon: CreditCard, color: '#2563eb' },
                      { label: 'Redemptions', value: data.stats.total_redemptions, icon: Gift, color: '#d97706' },
                    ].map((stat, i) => (
                      <motion.div
                        key={stat.label}
                        className="bg-gray-50 rounded-xl p-3 border border-gray-100"
                        initial={{ y: 10, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.15 + i * 0.05 }}
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: stat.color + '12' }}>
                            <stat.icon className="w-3.5 h-3.5" style={{ color: stat.color }} />
                          </div>
                          <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">{stat.label}</span>
                        </div>
                        <p className="text-xl font-bold" style={{ color: stat.color }}>{stat.value}</p>
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* ── Contact Info ── */}
                <div className="px-6 pb-4">
                  <div className="bg-gray-50 rounded-xl p-3.5 border border-gray-100 space-y-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                        <Phone className="w-3.5 h-3.5 text-blue-500" />
                      </div>
                      <span className={`text-sm ${data.customer.phone ? 'text-gray-700 font-medium' : 'text-gray-300 italic'}`}>
                        {data.customer.phone || 'No phone number'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center shrink-0">
                        <Mail className="w-3.5 h-3.5 text-purple-500" />
                      </div>
                      <span className={`text-sm truncate ${data.customer.email ? 'text-gray-700 font-medium' : 'text-gray-300 italic'}`}>
                        {data.customer.email || 'No email address'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* ── Status Actions ── */}
                <div className="px-6 pb-4">
                  <h4 className="text-xs font-semibold text-gray-600 flex items-center gap-1 mb-2">
                    <Shield className="w-3.5 h-3.5" /> Account Status
                  </h4>
                  {statusConfirm ? (
                    <motion.div
                      className={`rounded-xl p-3.5 border ${
                        statusConfirm === 'banned' ? 'bg-red-50 border-red-200' :
                        statusConfirm === 'inactive' ? 'bg-gray-50 border-gray-200' :
                        'bg-emerald-50 border-emerald-200'
                      }`}
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <p className="text-xs font-medium text-gray-700 mb-2.5">
                        {statusConfirm === 'banned' && 'Ban this customer? They will not be able to login.'}
                        {statusConfirm === 'inactive' && 'Set this customer as inactive?'}
                        {statusConfirm === 'active' && 'Reactivate this customer account?'}
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleStatusChange(statusConfirm)}
                          disabled={changingStatus}
                          className={`flex-1 py-2 rounded-lg text-xs font-bold text-white transition-all disabled:opacity-60 ${
                            statusConfirm === 'banned' ? 'bg-red-500 hover:bg-red-600' :
                            statusConfirm === 'inactive' ? 'bg-gray-500 hover:bg-gray-600' :
                            'bg-emerald-500 hover:bg-emerald-600'
                          }`}
                        >
                          {changingStatus ? (
                            <span className="flex items-center justify-center gap-1.5">
                              <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                              Updating...
                            </span>
                          ) : (
                            `Yes, ${statusConfirm === 'active' ? 'Activate' : statusConfirm === 'banned' ? 'Ban' : 'Deactivate'}`
                          )}
                        </button>
                        <button
                          onClick={() => setStatusConfirm(null)}
                          disabled={changingStatus}
                          className="flex-1 py-2 rounded-lg text-xs font-bold text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 transition-all disabled:opacity-60"
                        >
                          Cancel
                        </button>
                      </div>
                    </motion.div>
                  ) : (
                    <div className="flex gap-2">
                      {currentStatus !== 'active' && (
                        <button
                          onClick={() => setStatusConfirm('active')}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition-all"
                        >
                          <Shield className="w-3.5 h-3.5" />
                          Activate
                        </button>
                      )}
                      {currentStatus !== 'inactive' && (
                        <button
                          onClick={() => setStatusConfirm('inactive')}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold text-gray-600 bg-gray-50 border border-gray-200 hover:bg-gray-100 transition-all"
                        >
                          <ShieldOff className="w-3.5 h-3.5" />
                          Deactivate
                        </button>
                      )}
                      {currentStatus !== 'banned' && (
                        <button
                          onClick={() => setStatusConfirm('banned')}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold text-red-600 bg-red-50 border border-red-200 hover:bg-red-100 transition-all"
                        >
                          <ShieldAlert className="w-3.5 h-3.5" />
                          Ban
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* ── Vehicles ── */}
                {requireVehicle && (
                  <div className="px-6 pb-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-semibold text-gray-600 flex items-center gap-1">
                        <Car className="w-3.5 h-3.5" /> Vehicles
                      </h4>
                      <span className="text-[10px] text-gray-400 font-medium">{data.vehicles.length} registered</span>
                    </div>
                    {data.vehicles.length > 0 ? (
                      <div className="space-y-1.5">
                        {data.vehicles.map(v => (
                          <div key={v.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-3.5 py-2.5 border border-gray-100">
                            <div className="flex items-center gap-2">
                              <Car className="w-4 h-4 text-gray-400" />
                              <span className="text-sm font-bold text-gray-800 tracking-wide uppercase">{v.plate_number}</span>
                              {v.is_primary && (
                                <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600">
                                  <Star className="w-2.5 h-2.5" fill="currentColor" /> Primary
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-gray-400 capitalize">{v.vehicle_type}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-3 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                        <Car className="w-5 h-5 mx-auto text-gray-300 mb-1" />
                        <p className="text-[10px] text-gray-400">No vehicles registered</p>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Loyalty Cards ── */}
                <div className="px-6 pb-6">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-semibold text-gray-600 flex items-center gap-1">
                      <CreditCard className="w-3.5 h-3.5" /> Loyalty Cards
                    </h4>
                    <span className="text-[10px] text-gray-400 font-medium">{data.cards.length} card{data.cards.length !== 1 ? 's' : ''}</span>
                  </div>

                  {data.cards.length > 0 ? (
                    <div className="space-y-3">
                      {data.cards.map((card, i) => {
                        const badge = cardStatusBadge(card.status);
                        const pct = Math.min(100, Math.round((card.tokens_earned / (card.tokens_required || 10)) * 100));
                        const isExpanded = expandedCards.has(card.id);
                        const cardTotal = calcCardTotal(card);

                        return (
                          <motion.div
                            key={card.id}
                            className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 + i * 0.05 }}
                          >
                            {/* Card Header */}
                            <div className="px-4 py-3 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                                  style={{
                                    backgroundColor: card.status === 'active' ? settings.primary_color + '12' :
                                      card.status === 'completed' ? '#05966912' : '#d9770612'
                                  }}
                                >
                                  <CreditCard
                                    className="w-4 h-4"
                                    style={{
                                      color: card.status === 'active' ? settings.primary_color :
                                        card.status === 'completed' ? '#059669' : '#d97706'
                                    }}
                                  />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-sm text-gray-900">Card #{card.card_number}</span>
                                    <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${badge.bg} ${badge.text}`}>
                                      {badge.label}
                                    </span>
                                  </div>
                                  <span className="text-[10px] text-gray-400">{formatDate(card.created_at)}</span>
                                </div>
                              </div>
                              {cardTotal > 0 && (
                                <span className="text-sm font-bold" style={{ color: settings.primary_color }}>
                                  {formatCurrency(cardTotal)}
                                </span>
                              )}
                            </div>

                            {/* Progress Bar */}
                            <div className="px-4 pb-2">
                              <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                                <span className="font-semibold">{card.tokens_earned}/{card.tokens_required} tokens</span>
                                <span className="font-medium">{pct}%</span>
                              </div>
                              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <motion.div
                                  className="h-full rounded-full"
                                  style={{
                                    backgroundColor: card.status !== 'active' ? '#059669' : settings.primary_color
                                  }}
                                  initial={{ width: 0 }}
                                  animate={{ width: `${pct}%` }}
                                  transition={{ duration: 0.8, delay: 0.3 + i * 0.05 }}
                                />
                              </div>
                            </div>

                            {/* Completed/Redeemed dates */}
                            {(card.completed_at || card.redeemed_at) && (
                              <div className="px-4 pb-2 flex flex-wrap gap-3">
                                {card.completed_at && (
                                  <span className="flex items-center gap-1 text-[10px] text-emerald-600">
                                    <Award className="w-3 h-3" /> Completed {formatDate(card.completed_at)}
                                  </span>
                                )}
                                {card.redeemed_at && (
                                  <span className="flex items-center gap-1 text-[10px] text-amber-600">
                                    <Gift className="w-3 h-3" /> Redeemed {formatDate(card.redeemed_at)}
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Toggle Tokens */}
                            {card.tokens.length > 0 && (
                              <>
                                <button
                                  onClick={() => toggleCard(card.id)}
                                  className="w-full px-4 py-2 flex items-center justify-between text-[11px] text-gray-400 hover:text-gray-600 hover:bg-gray-50/50 transition-colors border-t border-gray-100"
                                >
                                  <span className="font-medium">
                                    {isExpanded ? 'Hide' : 'Show'} token details
                                  </span>
                                  <motion.div
                                    animate={{ rotate: isExpanded ? 180 : 0 }}
                                    transition={{ duration: 0.2 }}
                                  >
                                    <ChevronDown className="w-3.5 h-3.5" />
                                  </motion.div>
                                </button>

                                <AnimatePresence>
                                  {isExpanded && (
                                    <motion.div
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: 'auto', opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      transition={{ duration: 0.25 }}
                                      className="overflow-hidden"
                                    >
                                      <div className="px-4 pb-3 space-y-1.5">
                                        {card.tokens.map((token) => (
                                          <div
                                            key={token.id}
                                            className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2"
                                          >
                                            <div className="flex items-center gap-2.5">
                                              <div
                                                className="w-6 h-6 rounded-full flex items-center justify-center text-white"
                                                style={{ backgroundColor: settings.primary_color }}
                                              >
                                                <Check className="w-3 h-3" strokeWidth={3} />
                                              </div>
                                              <div>
                                                <span className="text-xs font-semibold text-gray-700">
                                                  Token #{token.token_position}
                                                </span>
                                                {token.plate_number && (
                                                  <span className="text-[10px] text-gray-400 ml-1.5">
                                                    · {token.plate_number}
                                                  </span>
                                                )}
                                              </div>
                                            </div>
                                            <div className="text-right">
                                              {token.amount != null && token.amount > 0 && (
                                                <p className="text-xs font-bold" style={{ color: settings.primary_color }}>
                                                  {formatCurrency(token.amount)}
                                                </p>
                                              )}
                                              <p className="text-[10px] text-gray-400">{formatDate(token.created_at)}</p>
                                              {token.added_by_name && (
                                                <p className="text-[9px] text-gray-300">by {token.added_by_name}</p>
                                              )}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </>
                            )}
                          </motion.div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-6 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                      <CreditCard className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                      <p className="text-xs text-gray-400 font-medium">No loyalty cards yet</p>
                      <p className="text-[10px] text-gray-300 mt-0.5">Cards will appear after the first token</p>
                    </div>
                  )}
                </div>
              </>
            ) : null}
          </div>

          {/* Footer */}
          <div className="px-6 py-3 border-t border-gray-100 bg-gray-50/50 shrink-0">
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 active:bg-gray-100 transition-colors"
            >
              Close
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
