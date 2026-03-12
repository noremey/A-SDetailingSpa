import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Gift, Check, Clock, User, Search, ChevronLeft, ChevronRight,
  TrendingUp, Award, CalendarDays, ChevronDown, Car, Coins, Trophy, Timer
} from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';
import { adminService } from '../../services/api';
import ConfirmModal from '../../components/ui/ConfirmModal';
import { useToast } from '../../components/ui/Toast';

interface PendingItem {
  card_id: number;
  card_number: number;
  tokens_earned: number;
  tokens_required: number;
  completed_at: string;
  customer_id: number;
  user_code: string;
  customer_name: string;
  phone: string;
  plate_number?: string;
  card_total_spend: number;
  completed_cards: number;
}

interface HistoryItem {
  id: number;
  card_id: number;
  user_id: number;
  reward_description: string;
  notes: string | null;
  redeemed_at: string;
  customer_name: string;
  user_code: string;
  phone: string;
  processed_by_name: string;
  card_number: number;
  tokens_required: number;
  plate_number?: string;
  card_total_spend: number;
}

interface Stats {
  total_all_time: number;
  this_month: number;
  today: number;
  pending: number;
  top_redeemers: { name: string; user_code: string; redeem_count: number }[];
  monthly_trend: { label: string; count: number }[];
  avg_days_to_complete: number;
}

type TabType = 'pending' | 'history';

const years = Array.from({ length: 12 }, (_, i) => 2025 + i);
const monthOptions = [
  { value: 0, label: 'All Months' },
  { value: 1, label: 'Jan' }, { value: 2, label: 'Feb' }, { value: 3, label: 'Mar' },
  { value: 4, label: 'Apr' }, { value: 5, label: 'May' }, { value: 6, label: 'Jun' },
  { value: 7, label: 'Jul' }, { value: 8, label: 'Aug' }, { value: 9, label: 'Sep' },
  { value: 10, label: 'Oct' }, { value: 11, label: 'Nov' }, { value: 12, label: 'Dec' },
];

export default function RedemptionsPage() {
  const { settings } = useSettings();
  const toast = useToast();

  const requireVehicle = settings.require_vehicle === '1';
  const [tab, setTab] = useState<TabType>('pending');
  const [pending, setPending] = useState<PendingItem[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [redeemingId, setRedeemingId] = useState<number | null>(null);

  // History filters
  const [searchQ, setSearchQ] = useState('');
  const [filterYear, setFilterYear] = useState(0);
  const [filterMonth, setFilterMonth] = useState(0);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPages, setHistoryPages] = useState(1);

  // Confirm modal
  const [confirmItem, setConfirmItem] = useState<PendingItem | null>(null);

  // Dropdown states
  const [showYearPicker, setShowYearPicker] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);

  // Fetch stats on mount
  useEffect(() => {
    adminService.getRedemptionStats().then(({ data }) => {
      if (data.success) setStats(data.stats);
    }).catch(console.error);
  }, []);

  // Fetch tab data
  const fetchData = async () => {
    setLoading(true);
    try {
      if (tab === 'pending') {
        const { data } = await adminService.getPendingRedemptions();
        if (data.success) setPending(data.pending || []);
      } else {
        const { data } = await adminService.listRedemptions(
          historyPage,
          searchQ || undefined,
          filterYear || undefined,
          filterMonth || undefined
        );
        if (data.success) {
          setHistory(data.redemptions || []);
          setHistoryTotal(data.total || 0);
          setHistoryPages(data.pages || 1);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [tab, historyPage]);

  const handleSearchHistory = () => {
    setHistoryPage(1);
    fetchData();
  };

  // Apply filters
  useEffect(() => {
    if (tab === 'history') {
      setHistoryPage(1);
      fetchData();
    }
  }, [filterYear, filterMonth]);

  const handleRedeem = async () => {
    if (!confirmItem) return;
    setRedeemingId(confirmItem.card_id);
    try {
      const { data } = await adminService.redeemCard(confirmItem.card_id);
      if (data.success) {
        setPending(prev => prev.filter(p => p.card_id !== confirmItem.card_id));
        toast.success(data.message || `Reward redeemed for ${confirmItem.customer_name}!`);
        // Refresh stats
        adminService.getRedemptionStats().then(({ data: sd }) => {
          if (sd.success) setStats(sd.stats);
        });
      } else {
        toast.error(data.message || 'Failed to redeem');
      }
    } catch (err) {
      toast.error('Failed to process redemption');
    } finally {
      setRedeemingId(null);
      setConfirmItem(null);
    }
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' });

  const formatDateTime = (d: string) =>
    new Date(d).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const formatCurrency = (n: number) =>
    settings.currency_symbol + n.toLocaleString('en-MY', { minimumFractionDigits: 2 });

  const timeSince = (d: string) => {
    const ms = Date.now() - new Date(d).getTime();
    const hours = Math.floor(ms / 3600000);
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return '1 day ago';
    return `${days} days ago`;
  };

  // Max trend for bar sizing
  const maxTrend = stats?.monthly_trend ? Math.max(...stats.monthly_trend.map(t => t.count), 1) : 1;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Redemptions</h1>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <motion.div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100"
            initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-yellow-500 rounded-lg flex items-center justify-center">
                <Clock className="w-4 h-4 text-white" />
              </div>
              <span className="text-xs text-gray-500">Pending</span>
            </div>
            <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
          </motion.div>

          <motion.div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100"
            initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.05 }}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
                <Gift className="w-4 h-4 text-white" />
              </div>
              <span className="text-xs text-gray-500">This Month</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.this_month}</p>
          </motion.div>

          <motion.div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100"
            initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: settings.primary_color }}>
                <Award className="w-4 h-4 text-white" />
              </div>
              <span className="text-xs text-gray-500">All Time</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.total_all_time}</p>
          </motion.div>

          <motion.div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100"
            initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 }}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                <Timer className="w-4 h-4 text-white" />
              </div>
              <span className="text-xs text-gray-500">Avg. Days</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.avg_days_to_complete}<span className="text-sm font-normal text-gray-400 ml-1">days</span></p>
          </motion.div>
        </div>
      )}

      {/* Trend + Top Redeemers */}
      {stats && (
        <div className="grid md:grid-cols-2 gap-4">
          {/* Mini trend chart */}
          {stats.monthly_trend.length > 0 && (
            <motion.div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100"
              initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4" style={{ color: settings.primary_color }} />
                Monthly Trend
              </h3>
              <div className="flex items-end gap-2 h-20">
                {stats.monthly_trend.map((t, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[10px] font-bold text-gray-600">{t.count}</span>
                    <div
                      className="w-full rounded-t-md transition-all"
                      style={{
                        height: `${Math.max((t.count / maxTrend) * 100, 8)}%`,
                        backgroundColor: settings.primary_color,
                        opacity: 0.7 + (i / stats.monthly_trend.length) * 0.3,
                      }}
                    />
                    <span className="text-[9px] text-gray-400">{t.label.split(' ')[0]}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Top Redeemers */}
          {stats.top_redeemers.length > 0 && (
            <motion.div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100"
              initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.25 }}>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
                <Trophy className="w-4 h-4 text-yellow-500" />
                Top Redeemers
              </h3>
              <div className="space-y-2.5">
                {stats.top_redeemers.map((r, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                      i === 0 ? 'bg-yellow-500' : i === 1 ? 'bg-gray-400' : 'bg-amber-700'
                    }`}>
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{r.name}</p>
                      <p className="text-[10px] text-gray-400">{r.user_code}</p>
                    </div>
                    <span className="text-sm font-bold" style={{ color: settings.primary_color }}>
                      {r.redeem_count}x
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 bg-gray-100 p-1 rounded-xl">
        <button
          onClick={() => setTab('pending')}
          className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${
            tab === 'pending' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
          }`}
        >
          <Clock className="w-4 h-4" />
          Pending
          {pending.length > 0 && (
            <span className="bg-yellow-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {pending.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('history')}
          className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${
            tab === 'history' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
          }`}
        >
          <Check className="w-4 h-4" />
          History
          <span className="text-[10px] text-gray-400">({historyTotal})</span>
        </button>
      </div>

      {/* History filters */}
      {tab === 'history' && (
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearchHistory()}
              placeholder="Search customer..."
              className="input-field pl-9 py-2.5 text-sm"
            />
          </div>

          {/* Year filter */}
          <div className="relative">
            <button
              onClick={() => { setShowYearPicker(!showYearPicker); setShowMonthPicker(false); }}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <CalendarDays className="w-3.5 h-3.5 text-gray-400" />
              {filterYear || 'All Years'}
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showYearPicker ? 'rotate-180' : ''}`} />
            </button>
            {showYearPicker && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowYearPicker(false)} />
                <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-20 w-28 max-h-52 overflow-y-auto">
                  <button
                    onClick={() => { setFilterYear(0); setShowYearPicker(false); }}
                    className={`w-full px-3 py-1.5 text-sm text-left hover:bg-gray-50 ${!filterYear ? 'font-bold' : 'text-gray-600'}`}
                    style={!filterYear ? { color: settings.primary_color } : {}}
                  >All Years</button>
                  {years.map(y => (
                    <button
                      key={y}
                      onClick={() => { setFilterYear(y); setShowYearPicker(false); }}
                      className={`w-full px-3 py-1.5 text-sm text-left hover:bg-gray-50 ${y === filterYear ? 'font-bold' : 'text-gray-600'}`}
                      style={y === filterYear ? { color: settings.primary_color } : {}}
                    >{y}</button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Month filter */}
          <div className="relative">
            <button
              onClick={() => { setShowMonthPicker(!showMonthPicker); setShowYearPicker(false); }}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {monthOptions.find(m => m.value === filterMonth)?.label || 'All Months'}
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showMonthPicker ? 'rotate-180' : ''}`} />
            </button>
            {showMonthPicker && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowMonthPicker(false)} />
                <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-20 w-32 max-h-52 overflow-y-auto">
                  {monthOptions.map(m => (
                    <button
                      key={m.value}
                      onClick={() => { setFilterMonth(m.value); setShowMonthPicker(false); }}
                      className={`w-full px-3 py-1.5 text-sm text-left hover:bg-gray-50 ${m.value === filterMonth ? 'font-bold' : 'text-gray-600'}`}
                      style={m.value === filterMonth ? { color: settings.primary_color } : {}}
                    >{m.label}</button>
                  ))}
                </div>
              </>
            )}
          </div>

          <button onClick={handleSearchHistory} className="px-4 py-2.5 rounded-xl text-white text-sm font-medium"
            style={{ backgroundColor: settings.primary_color }}>
            Filter
          </button>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white rounded-xl p-5 animate-pulse h-24" />
          ))}
        </div>
      ) : tab === 'pending' ? (
        /* ========== PENDING TAB ========== */
        pending.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
            <Gift className="w-14 h-14 mx-auto text-gray-200 mb-3" />
            <p className="text-gray-400 font-medium">No pending redemptions</p>
            <p className="text-xs text-gray-300 mt-1">Completed cards will appear here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pending.map((item, i) => (
              <motion.div
                key={item.card_id}
                className="bg-white rounded-2xl p-4 shadow-sm border-l-4 border-yellow-400 border border-gray-100"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-11 h-11 rounded-full bg-yellow-100 flex items-center justify-center shrink-0 mt-0.5">
                      <Gift className="w-5 h-5 text-yellow-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 truncate">{item.customer_name}</p>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                        <span className="text-xs text-gray-500">{item.user_code}</span>
                        <span className="text-xs text-gray-300">|</span>
                        <span className="text-xs text-gray-500">Card #{item.card_number}</span>
                        {requireVehicle && item.plate_number && (
                          <>
                            <span className="text-xs text-gray-300">|</span>
                            <span className="text-xs text-gray-500 flex items-center gap-0.5">
                              <Car className="w-3 h-3" />{item.plate_number}
                            </span>
                          </>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700 flex items-center gap-0.5">
                          <Coins className="w-3 h-3" />
                          {formatCurrency(item.card_total_spend)}
                        </span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                          {item.tokens_earned}/{item.tokens_required} tokens
                        </span>
                        {item.completed_cards > 0 && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                            {item.completed_cards} cards done
                          </span>
                        )}
                        <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                          <Clock className="w-3 h-3" />
                          {timeSince(item.completed_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setConfirmItem(item)}
                    disabled={redeemingId === item.card_id}
                    className="px-4 py-2.5 bg-green-600 text-white rounded-xl text-sm font-bold
                               hover:bg-green-700 disabled:opacity-50 flex items-center gap-1.5 shrink-0 shadow-sm"
                  >
                    <Check className="w-4 h-4" />
                    Redeem
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )
      ) : (
        /* ========== HISTORY TAB ========== */
        history.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
            <Clock className="w-14 h-14 mx-auto text-gray-200 mb-3" />
            <p className="text-gray-400 font-medium">No redemption history</p>
            <p className="text-xs text-gray-300 mt-1">
              {searchQ || filterYear || filterMonth ? 'Try different filters' : 'Redeemed rewards will appear here'}
            </p>
          </div>
        ) : (
          <>
            {/* DataTable */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              {/* Table header info bar */}
              <div className="px-4 py-3 bg-gray-50/80 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Gift className="w-4 h-4" style={{ color: settings.primary_color }} />
                  <span className="text-sm font-semibold text-gray-700">Redemption History</span>
                </div>
                <span className="text-xs text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full font-medium">
                  {historyTotal} record{historyTotal !== 1 ? 's' : ''}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50/30">
                      <th className="text-center px-3 py-3 font-semibold text-gray-500 text-[10px] uppercase tracking-wider w-10">#</th>
                      <th className="text-left px-3 py-3 font-semibold text-gray-500 text-[10px] uppercase tracking-wider">Customer</th>
                      {requireVehicle && <th className="text-left px-3 py-3 font-semibold text-gray-500 text-[10px] uppercase tracking-wider hidden sm:table-cell">Vehicle</th>}
                      <th className="text-center px-3 py-3 font-semibold text-gray-500 text-[10px] uppercase tracking-wider">Card</th>
                      <th className="text-right px-3 py-3 font-semibold text-gray-500 text-[10px] uppercase tracking-wider">Spend</th>
                      <th className="text-left px-3 py-3 font-semibold text-gray-500 text-[10px] uppercase tracking-wider hidden md:table-cell">Reward</th>
                      <th className="text-left px-3 py-3 font-semibold text-gray-500 text-[10px] uppercase tracking-wider hidden lg:table-cell">Admin</th>
                      <th className="text-right px-3 py-3 font-semibold text-gray-500 text-[10px] uppercase tracking-wider">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {history.map((item, i) => {
                      const rowNum = (historyPage - 1) * 10 + i + 1;
                      return (
                      <motion.tr
                        key={item.id}
                        className="hover:bg-blue-50/30 transition-colors group"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.02 }}
                      >
                        <td className="px-3 py-3 text-center">
                          <span className="text-[10px] font-medium text-gray-400">{rowNum}</span>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                                 style={{ backgroundColor: settings.primary_color + '15' }}>
                              <span className="text-xs font-bold" style={{ color: settings.primary_color }}>
                                {item.customer_name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-gray-900 truncate text-[13px]">{item.customer_name}</p>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-gray-400 font-mono">{item.user_code}</span>
                                {item.phone && (
                                  <>
                                    <span className="text-gray-200">·</span>
                                    <span className="text-[10px] text-gray-400">{item.phone}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        {requireVehicle && (
                        <td className="px-3 py-3 hidden sm:table-cell">
                          {item.plate_number ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-700 bg-gray-100 px-2 py-0.5 rounded-md">
                              <Car className="w-3 h-3 text-gray-400" />{item.plate_number}
                            </span>
                          ) : <span className="text-gray-300 text-xs">-</span>}
                        </td>
                        )}
                        <td className="px-3 py-3 text-center">
                          <span className="inline-flex items-center justify-center text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
                            #{item.card_number}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right">
                          {item.card_total_spend > 0 ? (
                            <span className="text-green-600 font-bold text-xs">{formatCurrency(item.card_total_spend)}</span>
                          ) : <span className="text-gray-300 text-xs">-</span>}
                        </td>
                        <td className="px-3 py-3 hidden md:table-cell">
                          <span className="text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-medium">
                            {item.reward_description}
                          </span>
                        </td>
                        <td className="px-3 py-3 hidden lg:table-cell">
                          <span className="text-xs text-gray-500">{item.processed_by_name}</span>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <p className="text-xs font-medium text-gray-700 whitespace-nowrap">{formatDate(item.redeemed_at)}</p>
                          <p className="text-[10px] text-gray-400">{new Date(item.redeemed_at).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' })}</p>
                        </td>
                      </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination footer */}
              <div className="border-t border-gray-100 px-4 py-3 flex items-center justify-between bg-gray-50/50">
                <p className="text-xs text-gray-500">
                  Showing <span className="font-semibold text-gray-700">{(historyPage - 1) * 10 + 1}</span>
                  {' '}-{' '}
                  <span className="font-semibold text-gray-700">{Math.min(historyPage * 10, historyTotal)}</span>
                  {' '}of{' '}
                  <span className="font-semibold text-gray-700">{historyTotal}</span> records
                </p>
                {historyPages > 1 && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setHistoryPage(1)}
                      disabled={historyPage <= 1}
                      className="w-8 h-8 rounded-lg text-xs font-medium border border-gray-200 bg-white
                                 hover:bg-gray-50 disabled:opacity-30 flex items-center justify-center"
                    >
                      «
                    </button>
                    <button
                      onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                      disabled={historyPage <= 1}
                      className="w-8 h-8 rounded-lg text-xs font-medium border border-gray-200 bg-white
                                 hover:bg-gray-50 disabled:opacity-30 flex items-center justify-center"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>

                    {/* Page numbers */}
                    {(() => {
                      const pages: number[] = [];
                      const start = Math.max(1, historyPage - 2);
                      const end = Math.min(historyPages, historyPage + 2);
                      for (let p = start; p <= end; p++) pages.push(p);
                      return pages.map(p => (
                        <button
                          key={p}
                          onClick={() => setHistoryPage(p)}
                          className={`w-8 h-8 rounded-lg text-xs font-bold border transition-all flex items-center justify-center ${
                            p === historyPage
                              ? 'text-white shadow-sm'
                              : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                          }`}
                          style={p === historyPage ? { backgroundColor: settings.primary_color, borderColor: settings.primary_color } : {}}
                        >
                          {p}
                        </button>
                      ));
                    })()}

                    <button
                      onClick={() => setHistoryPage(p => Math.min(historyPages, p + 1))}
                      disabled={historyPage >= historyPages}
                      className="w-8 h-8 rounded-lg text-xs font-medium border border-gray-200 bg-white
                                 hover:bg-gray-50 disabled:opacity-30 flex items-center justify-center"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setHistoryPage(historyPages)}
                      disabled={historyPage >= historyPages}
                      className="w-8 h-8 rounded-lg text-xs font-medium border border-gray-200 bg-white
                                 hover:bg-gray-50 disabled:opacity-30 flex items-center justify-center"
                    >
                      »
                    </button>
                  </div>
                )}
              </div>
            </div>
          </>
        )
      )}

      {/* Redeem Confirm Modal */}
      <ConfirmModal
        isOpen={!!confirmItem}
        onConfirm={handleRedeem}
        onCancel={() => setConfirmItem(null)}
        title="Redeem Reward"
        message={confirmItem ? `Confirm redeem FREE reward for ${confirmItem.customer_name}?\n\nCard #${confirmItem.card_number} · ${confirmItem.tokens_earned}/${confirmItem.tokens_required} tokens · Total spend: ${formatCurrency(confirmItem.card_total_spend)}` : ''}
        confirmText="Redeem Now"
        cancelText="Cancel"
        variant="success"
        loading={redeemingId !== null}
      />
    </div>
  );
}
