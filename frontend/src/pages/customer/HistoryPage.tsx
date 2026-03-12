import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Award, CreditCard, Check, Gift, LogOut, ChevronDown, Receipt } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { useNavigate } from 'react-router-dom';
import { customerService } from '../../services/api';
import LoyaltyCard from '../../components/loyalty/LoyaltyCard';
import ConfirmModal from '../../components/ui/ConfirmModal';
import CustomerReceiptModal, { type CustomerReceiptData } from '../../components/ui/CustomerReceiptModal';
import type { LoyaltyCard as LoyaltyCardType, Token } from '../../types';

export default function HistoryPage() {
  const { logout } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const [cards, setCards] = useState<LoyaltyCardType[]>([]);
  const [redemptions, setRedemptions] = useState<Record<number, { reward_description: string; processed_by_name: string; redeemed_at: string }>>({});
  const [stats, setStats] = useState({ total_tokens: 0, total_redemptions: 0, total_cards: 0 });
  const [loading, setLoading] = useState(true);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [expandedCard, setExpandedCard] = useState<number | null>(null);
  const [receiptData, setReceiptData] = useState<CustomerReceiptData | null>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const { data } = await customerService.getAllCards();
        if (data.success) {
          setCards(data.cards || []);
          setRedemptions(data.redemptions || {});
          setStats(data.stats || stats);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, []);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="flex items-center justify-between">
          <h1 className="font-bold text-lg md:text-xl text-gray-900">History</h1>
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-red-500 hover:bg-red-50 transition-colors text-sm font-medium"
            title="Logout"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>

      <div className="px-4 md:px-6 lg:px-8 pt-5 md:pt-6 pb-6">
        {/* Stats overview */}
        <motion.div
          className="grid grid-cols-3 gap-3 md:gap-4 mb-6"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
        >
          <div className="bg-white rounded-xl p-3 md:p-4 text-center shadow-sm border border-gray-100">
            <Award className="w-5 h-5 md:w-6 md:h-6 mx-auto mb-1" style={{ color: settings.primary_color }} />
            <p className="text-xl md:text-2xl font-bold text-gray-900">{stats.total_tokens}</p>
            <p className="text-[11px] md:text-xs text-gray-400">Total Tokens</p>
          </div>
          <div className="bg-white rounded-xl p-3 md:p-4 text-center shadow-sm border border-gray-100">
            <Gift className="w-5 h-5 md:w-6 md:h-6 mx-auto mb-1 text-yellow-500" />
            <p className="text-xl md:text-2xl font-bold text-gray-900">{stats.total_redemptions}</p>
            <p className="text-[11px] md:text-xs text-gray-400">Rewards</p>
          </div>
          <div className="bg-white rounded-xl p-3 md:p-4 text-center shadow-sm border border-gray-100">
            <CreditCard className="w-5 h-5 md:w-6 md:h-6 mx-auto mb-1 text-gray-400" />
            <p className="text-xl md:text-2xl font-bold text-gray-900">{stats.total_cards}</p>
            <p className="text-[11px] md:text-xs text-gray-400">Cards</p>
          </div>
        </motion.div>

        {/* Card history */}
        <h2 className="font-semibold text-gray-900 mb-3 md:text-lg">Card History</h2>

        {loading ? (
          <div className="space-y-4 md:grid md:grid-cols-2 md:gap-4 md:space-y-0">
            {[1, 2].map(i => (
              <div key={i} className="rounded-2xl bg-gray-100 animate-pulse h-40" />
            ))}
          </div>
        ) : cards.length === 0 ? (
          <div className="text-center py-12 md:py-16">
            <Clock className="w-12 h-12 md:w-16 md:h-16 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 md:text-lg">No history yet</p>
          </div>
        ) : (
          <div className="space-y-4 md:grid md:grid-cols-2 md:gap-4 md:space-y-0">
            {cards.map((card, index) => (
              <motion.div
                key={card.id}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: index * 0.1 }}
              >
                {card.status === 'active' ? (
                  <div>
                    <LoyaltyCard card={card} />
                    {/* Expandable token list for active card */}
                    {card.tokens && card.tokens.length > 0 && (
                      <div className="mt-2">
                        <button
                          onClick={() => setExpandedCard(expandedCard === card.id ? null : card.id)}
                          className="w-full flex items-center justify-between px-4 py-2.5 bg-white rounded-xl border border-gray-100 shadow-sm text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                        >
                          <span className="font-medium">View Transactions ({card.tokens.length})</span>
                          <motion.div
                            animate={{ rotate: expandedCard === card.id ? 180 : 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <ChevronDown className="w-4 h-4" />
                          </motion.div>
                        </button>
                        <AnimatePresence>
                          {expandedCard === card.id && (
                            <TokenList
                              tokens={card.tokens}
                              card={card}
                              settings={settings}
                              onReceipt={setReceiptData}
                            />
                          )}
                        </AnimatePresence>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 h-full overflow-hidden">
                    <div className="p-4 md:p-5">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 md:w-9 md:h-9 rounded-full flex items-center justify-center ${
                            card.status === 'redeemed' ? 'bg-green-100' : 'bg-yellow-100'
                          }`}>
                            {card.status === 'redeemed' ? (
                              <Check className="w-4 h-4 text-green-600" />
                            ) : (
                              <Gift className="w-4 h-4 text-yellow-600" />
                            )}
                          </div>
                          <div>
                            <p className="font-semibold text-sm md:text-base text-gray-900">Card #{card.card_number}</p>
                            <p className="text-xs md:text-sm text-gray-400">
                              {card.status === 'redeemed' ? 'Reward claimed' : 'Ready to redeem'}
                            </p>
                          </div>
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                          card.status === 'redeemed'
                            ? 'bg-green-50 text-green-700'
                            : 'bg-yellow-50 text-yellow-700'
                        }`}>
                          {card.status === 'redeemed' ? 'Redeemed' : 'Completed'}
                        </span>
                      </div>

                      {/* Reward details for redeemed cards */}
                      {card.status === 'redeemed' && redemptions[card.id] && (
                        <div className="mb-3 px-3 py-2.5 rounded-xl bg-green-50/60 border border-green-100">
                          <p className="text-xs font-semibold text-green-700">
                            🎁 {redemptions[card.id].reward_description}
                          </p>
                          {redemptions[card.id].processed_by_name && (
                            <p className="text-[10px] text-green-600 mt-0.5">
                              Processed by {redemptions[card.id].processed_by_name}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Mini token circles */}
                      <div className="flex gap-1.5 md:gap-2 mb-3 flex-wrap">
                        {Array.from({ length: card.tokens_required }, (_, i) => (
                          <div
                            key={i}
                            className="w-5 h-5 md:w-6 md:h-6 rounded-full flex items-center justify-center bg-primary-100"
                            style={{ backgroundColor: settings.primary_color + '20' }}
                          >
                            <Check className="w-3 h-3" style={{ color: settings.primary_color }} />
                          </div>
                        ))}
                      </div>
                      <p className="text-xs md:text-sm text-gray-400">
                        {card.completed_at && `Completed: ${formatDate(card.completed_at)}`}
                        {card.redeemed_at && ` | Redeemed: ${formatDate(card.redeemed_at)}`}
                      </p>
                    </div>

                    {/* Expandable token list */}
                    {card.tokens && card.tokens.length > 0 && (
                      <>
                        <button
                          onClick={() => setExpandedCard(expandedCard === card.id ? null : card.id)}
                          className="w-full flex items-center justify-between px-4 py-2.5 border-t border-gray-100 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
                        >
                          <span className="font-medium">View Transactions ({card.tokens.length})</span>
                          <motion.div
                            animate={{ rotate: expandedCard === card.id ? 180 : 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <ChevronDown className="w-4 h-4" />
                          </motion.div>
                        </button>
                        <AnimatePresence>
                          {expandedCard === card.id && (
                            <TokenList
                              tokens={card.tokens}
                              card={card}
                              settings={settings}
                              onReceipt={setReceiptData}
                            />
                          )}
                        </AnimatePresence>
                      </>
                    )}
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Customer Receipt Modal */}
      <CustomerReceiptModal
        isOpen={!!receiptData}
        onClose={() => setReceiptData(null)}
        data={receiptData}
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

/* ─── Token List Component ─── */

function TokenList({
  tokens,
  card,
  settings,
  onReceipt,
}: {
  tokens: Token[];
  card: LoyaltyCardType;
  settings: any;
  onReceipt: (data: CustomerReceiptData) => void;
}) {
  const currency = settings.currency_symbol || 'RM';

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.25, ease: 'easeInOut' }}
      className="overflow-hidden"
    >
      <div className="divide-y divide-gray-50 bg-gray-50/30">
        {[...tokens].reverse().map((token) => {
          const tDate = new Date(token.created_at);
          const tDateStr = tDate.toLocaleDateString('en-MY', { day: 'numeric', month: 'short' });
          const tTimeStr = tDate.toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit', hour12: true });

          return (
            <button
              key={token.id}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-white/60 active:bg-white transition-colors"
              onClick={() => onReceipt({
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
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: settings.primary_color + '15' }}
              >
                <Receipt className="w-3.5 h-3.5" style={{ color: settings.primary_color }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-800 truncate">
                  {token.notes || `Token #${token.token_position}`}
                </p>
                <p className="text-[10px] text-gray-400">
                  {tDateStr} &middot; {tTimeStr}
                </p>
              </div>
              {token.amount != null && token.amount > 0 && (
                <span className="text-xs font-semibold text-gray-700 shrink-0">
                  {currency}{token.amount.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}
