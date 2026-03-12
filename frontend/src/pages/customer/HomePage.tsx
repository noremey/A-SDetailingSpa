import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, Sparkles, User, LogOut, Receipt, ChevronRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { useNavigate } from 'react-router-dom';
import { customerService } from '../../services/api';
import LoyaltyCard from '../../components/loyalty/LoyaltyCard';
import CelebrationModal from '../../components/loyalty/CelebrationModal';
import CustomerReceiptModal, { type CustomerReceiptData } from '../../components/ui/CustomerReceiptModal';
import type { LoyaltyCard as LoyaltyCardType, Token } from '../../types';
import ConfirmModal from '../../components/ui/ConfirmModal';
import { usePushNotifications } from '../../hooks/usePushNotifications';

export default function HomePage() {
  const { user, logout } = useAuth();
  const { settings } = useSettings();

  // Subscribe to push notifications after login
  const vapidKey = settings.push_notifications_enabled === '1' ? settings.vapid_public_key : undefined;
  usePushNotifications(vapidKey, !!user);
  const navigate = useNavigate();
  const [card, setCard] = useState<LoyaltyCardType | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCelebration, setShowCelebration] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [receiptData, setReceiptData] = useState<CustomerReceiptData | null>(null);

  const fetchCard = async () => {
    setLoading(true);
    try {
      const { data } = await customerService.getActiveCard();
      if (data.success) {
        const newCard = data.card;
        // Check if card just got completed
        const prevTokens = card?.tokens_earned || 0;
        if (newCard && newCard.status === 'completed' && prevTokens < newCard.tokens_required) {
          setShowCelebration(true);
        }
        setCard(newCard);
      }
    } catch (err) {
      console.error('Error fetching card:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCard();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchCard, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 md:gap-4">
            {/* Avatar */}
            {user?.avatar ? (
              <motion.img
                src={user.avatar.startsWith('http') ? user.avatar : `${import.meta.env.BASE_URL}uploads/${user.avatar}`}
                alt={user.name}
                className="w-11 h-11 md:w-12 md:h-12 rounded-full object-cover ring-2 ring-white shadow-md"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', damping: 15, stiffness: 200 }}
                referrerPolicy="no-referrer"
              />
            ) : (
              <motion.div
                className="w-11 h-11 md:w-12 md:h-12 rounded-full flex items-center justify-center ring-2 ring-white shadow-md text-white font-bold text-sm md:text-base"
                style={{ backgroundColor: settings.primary_color }}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', damping: 15, stiffness: 200 }}
              >
                {user?.name?.charAt(0)?.toUpperCase() || <User className="w-5 h-5" />}
              </motion.div>
            )}
            <div>
              <h1 className="font-bold text-lg md:text-xl text-gray-900">
                Hi, {user?.name?.split(' ')[0]}! 👋
              </h1>
              <p className="text-xs md:text-sm text-gray-400">{user?.user_code}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={fetchCard}
              className="p-2 md:p-2.5 rounded-full hover:bg-gray-100 transition-colors"
              disabled={loading}
            >
              <RefreshCw className={`w-5 h-5 md:w-6 md:h-6 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="p-2 md:p-2.5 rounded-full hover:bg-red-50 transition-colors"
              title="Logout"
            >
              <LogOut className="w-5 h-5 md:w-6 md:h-6 text-gray-400 hover:text-red-500" />
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 md:px-6 lg:px-8 pt-5 md:pt-6 pb-6">
        {/* Two-column layout for tablet/desktop */}
        <div className="lg:grid lg:grid-cols-2 lg:gap-6">
          {/* Left column: Card */}
          <div>
            {loading && !card ? (
              <div className="rounded-2xl bg-gray-100 animate-pulse h-72" />
            ) : card ? (
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1 }}
              >
                <LoyaltyCard card={card} />
              </motion.div>
            ) : (
              <div className="text-center py-12 md:py-16">
                <Sparkles className="w-12 h-12 md:w-16 md:h-16 mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500 md:text-lg">No active card found</p>
                <p className="text-sm md:text-base text-gray-400 mt-1">Visit us to start collecting tokens!</p>
              </div>
            )}
          </div>

          {/* Right column: Reward info + Stats */}
          <div>
            {/* Reward info */}
            {card && (
              <motion.div
                className="mt-5 lg:mt-0 bg-white rounded-2xl p-4 md:p-5 shadow-sm border border-gray-100"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: settings.primary_color + '15' }}
                  >
                    <Sparkles className="w-5 h-5 md:w-6 md:h-6" style={{ color: settings.primary_color }} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 text-sm md:text-base">Your Reward</h3>
                    <p className="text-gray-500 text-sm md:text-base mt-0.5">
                      Collect {card.tokens_required} tokens to earn{' '}
                      <span className="font-semibold" style={{ color: settings.primary_color }}>
                        {settings.reward_description}
                      </span>
                    </p>
                    {card.status === 'completed' && (
                      <p className="text-yellow-600 font-semibold text-sm md:text-base mt-2">
                        🎉 Show this to staff to claim your reward!
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Quick stats */}
            {card && (
              <motion.div
                className="mt-4 grid grid-cols-2 gap-3 md:gap-4"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                <div className="bg-white rounded-xl p-3 md:p-4 text-center shadow-sm border border-gray-100">
                  <p className="text-2xl md:text-3xl font-bold" style={{ color: settings.primary_color }}>
                    {card.tokens_earned}/{card.tokens_required}
                  </p>
                  <p className="text-[11px] md:text-xs text-gray-400 mt-0.5">Tokens</p>
                </div>
                <div className="bg-white rounded-xl p-3 md:p-4 text-center shadow-sm border border-gray-100">
                  <p className="text-2xl md:text-3xl font-bold text-gray-900">
                    {card.tokens_required - card.tokens_earned}
                  </p>
                  <p className="text-[11px] md:text-xs text-gray-400 mt-0.5">To Go</p>
                </div>
                <div className="bg-white rounded-xl p-3 md:p-4 text-center shadow-sm border border-gray-100">
                  <p className="text-2xl md:text-3xl font-bold text-gray-900">
                    {settings.currency_symbol}{(card.total_amount || 0).toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-[11px] md:text-xs text-gray-400 mt-0.5">Total Spent</p>
                </div>
                <div className="bg-white rounded-xl p-3 md:p-4 text-center shadow-sm border border-gray-100">
                  <p className="text-2xl md:text-3xl font-bold text-gray-900">#{card.card_number}</p>
                  <p className="text-[11px] md:text-xs text-gray-400 mt-0.5">Card</p>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      {card && card.tokens && card.tokens.length > 0 && (
        <div className="px-4 md:px-6 lg:px-8 pb-6">
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <h3 className="font-semibold text-gray-900 mb-3 text-sm md:text-base">Recent Activity</h3>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-50">
              {[...card.tokens].reverse().slice(0, 5).map((token: Token, idx: number) => {
                const tDate = new Date(token.created_at);
                const tDateStr = tDate.toLocaleDateString('en-MY', { day: 'numeric', month: 'short' });
                const tTimeStr = tDate.toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit', hour12: true });
                return (
                  <motion.button
                    key={token.id}
                    className="w-full flex items-center gap-3 p-3 md:p-3.5 text-left hover:bg-gray-50/50 active:bg-gray-100/50 transition-colors"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + idx * 0.05 }}
                    onClick={() => setReceiptData({
                      id: token.id,
                      type: 'token',
                      created_at: token.created_at,
                      amount: token.amount,
                      staff_name: token.added_by_name,
                      plate_number: token.plate_number,
                      notes: token.notes,
                      token_position: token.token_position,
                      card_number: card.card_number,
                      tokens_earned: card.tokens_earned,
                      tokens_required: card.tokens_required,
                    })}
                  >
                    <div
                      className="w-9 h-9 md:w-10 md:h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: settings.primary_color + '12' }}
                    >
                      <Receipt className="w-4 h-4 md:w-[18px] md:h-[18px]" style={{ color: settings.primary_color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {token.notes || `Token #${token.token_position}`}
                      </p>
                      <p className="text-[11px] text-gray-400">
                        {tDateStr} &middot; {tTimeStr}
                        {token.added_by_name && <> &middot; {token.added_by_name}</>}
                      </p>
                    </div>
                    {token.amount != null && token.amount > 0 && (
                      <span className="text-sm font-semibold text-gray-900 shrink-0">
                        {settings.currency_symbol}{token.amount.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                      </span>
                    )}
                    <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        </div>
      )}

      {/* Customer Receipt Modal */}
      <CustomerReceiptModal
        isOpen={!!receiptData}
        onClose={() => setReceiptData(null)}
        data={receiptData}
      />

      {/* Celebration modal */}
      <CelebrationModal
        isOpen={showCelebration}
        onClose={() => setShowCelebration(false)}
      />

      {/* Logout confirm */}
      <ConfirmModal
        isOpen={showLogoutConfirm}
        onConfirm={() => { setShowLogoutConfirm(false); logout(); navigate('/login'); }}
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
