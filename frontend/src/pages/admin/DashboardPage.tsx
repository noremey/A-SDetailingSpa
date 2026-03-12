import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Coins, CreditCard, Gift, TrendingUp, BarChart3, UserPlus, ChevronDown, Search, ShoppingBag, ShoppingCart, Clock, ReceiptText } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useSettings } from '../../context/SettingsContext';
import { useAuth } from '../../context/AuthContext';
import { adminService } from '../../services/api';
import type { DashboardStats, CustomerWithCard } from '../../types';

interface RevenueData {
  month: number;
  name: string;
  revenue: number;
  token_count: number;
}

interface RecentTransaction {
  id: number;
  type: 'loyalty' | 'walkin';
  amount: string;
  token_count: number;
  status: 'active' | 'voided';
  notes: string | null;
  payment_method: 'cash' | 'online' | 'split' | null;
  customer_name: string | null;
  staff_name: string | null;
  created_at: string;
}

// ═══════════════════════════════════════════
// Entry point — route by role
// ═══════════════════════════════════════════
export default function DashboardPage() {
  const { user } = useAuth();

  if (user?.role === 'staff') {
    return <StaffDashboard />;
  }

  return <AdminDashboard />;
}

// ═══════════════════════════════════════════
// Staff Dashboard — Quick actions & today's data
// ═══════════════════════════════════════════
function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Selamat Pagi';
  if (h < 15) return 'Selamat Tengah Hari';
  if (h < 19) return 'Selamat Petang';
  return 'Selamat Malam';
}

function StaffDashboard() {
  const { settings } = useSettings();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Quick search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CustomerWithCard[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();
  const searchRef = useRef<HTMLDivElement>(null);

  // Recent transactions
  const [recentTxns, setRecentTxns] = useState<RecentTransaction[]>([]);

  // Menu visibility check
  const visibleMenus: string[] = (() => {
    try { return JSON.parse(settings.staff_visible_menus || '[]'); }
    catch { return []; }
  })();
  const canPOS = visibleMenus.length === 0 || visibleMenus.includes('pos') || visibleMenus.includes('add-token') || visibleMenus.includes('walkin-sales');

  // Fetch data on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const [dashRes, txnRes] = await Promise.all([
          adminService.getDashboard(),
          adminService.getRecentTransactions({ limit: 10 }),
        ]);
        if (dashRes.data.success) setStats(dashRes.data.stats);
        if (txnRes.data.success) setRecentTxns(txnRes.data.data?.transactions || txnRes.data.transactions || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // Click outside to close search
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search
  const handleSearchInput = (value: string) => {
    setSearchQuery(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (value.trim().length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const { data } = await adminService.searchCustomers(value.trim());
        if (data.success) {
          setSearchResults(data.customers || []);
          setShowResults(true);
        }
      } catch { /* silently fail */ }
      finally { setSearching(false); }
    }, 300);
  };

  const handleSelectCustomer = (customer: CustomerWithCard) => {
    setShowResults(false);
    setSearchQuery('');
    navigate('/admin/pos', { state: { preSelectPhone: customer.phone || customer.user_code } });
  };

  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-28 bg-gradient-to-r from-gray-100 to-gray-50 rounded-2xl animate-pulse" />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-24 bg-white rounded-2xl animate-pulse" />
          <div className="h-24 bg-white rounded-2xl animate-pulse" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map(i => <div key={i} className="h-20 bg-white rounded-2xl animate-pulse" />)}
        </div>
        <div className="h-48 bg-white rounded-2xl animate-pulse" />
      </div>
    );
  }

  const totalRevenue = (stats?.revenue_today || 0) + (stats?.walkin_today || 0) + (stats?.below_threshold_today || 0);
  const firstName = user?.name?.split(' ')[0] || '';

  return (
    <div className="space-y-4">
      {/* Hero Section — Greeting + Search combined */}
      <motion.div
        className="relative overflow-hidden rounded-2xl p-5 pb-4"
        style={{ background: `linear-gradient(135deg, ${settings.primary_color}, ${settings.primary_color}dd)` }}
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
      >
        {/* Decorative circles */}
        <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full opacity-10 bg-white" />
        <div className="absolute -bottom-4 -left-4 w-20 h-20 rounded-full opacity-10 bg-white" />

        <div className="relative z-10">
          <p className="text-white/70 text-xs font-medium tracking-wide uppercase">{getGreeting()}</p>
          <h1 className="text-2xl font-bold text-white mt-0.5">
            {firstName}
          </h1>
          <p className="text-white/60 text-xs mt-1">
            {new Date().toLocaleDateString('ms-MY', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>

          {/* Integrated Search */}
          <div ref={searchRef} className="relative mt-4">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchInput(e.target.value)}
                placeholder="Search customer — phone, name or plate..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/95 backdrop-blur-sm text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/50 transition-shadow shadow-sm"
                onFocus={() => { if (searchResults.length > 0) setShowResults(true); }}
              />
              {searching && (
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                  <svg className="animate-spin w-4 h-4 text-gray-400" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>
              )}
            </div>

            {/* Search Results Dropdown */}
            <AnimatePresence>
              {showResults && searchResults.length > 0 && (
                <motion.div
                  className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-xl shadow-2xl border border-gray-100 z-30 max-h-72 overflow-y-auto"
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{ duration: 0.15 }}
                >
                  {searchResults.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => handleSelectCustomer(c)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 active:bg-gray-100 transition-colors border-b border-gray-50 last:border-0 text-left"
                    >
                      {c.avatar ? (
                        <img src={c.avatar} alt={c.name} className="w-10 h-10 rounded-full object-cover shrink-0" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-white font-bold text-sm"
                          style={{ backgroundColor: settings.primary_color }}>
                          {c.name?.charAt(0)?.toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{c.name}</p>
                        <p className="text-xs text-gray-500 truncate">
                          {c.phone && <span>{c.phone}</span>}
                          {c.phone && c.user_code && <span className="mx-1 text-gray-300">|</span>}
                          <span className="font-mono text-gray-400">{c.user_code}</span>
                        </p>
                      </div>
                      <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full bg-green-50 text-green-600 shrink-0">
                        <Coins className="w-3 h-3" />
                        {c.tokens_earned ?? 0}/{c.tokens_required ?? settings.tokens_per_card ?? 10}
                      </span>
                    </button>
                  ))}
                </motion.div>
              )}
              {showResults && searchQuery.length >= 2 && searchResults.length === 0 && !searching && (
                <motion.div
                  className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-xl shadow-2xl border border-gray-100 z-30 px-4 py-5 text-center"
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                >
                  <Users className="w-8 h-8 mx-auto text-gray-200 mb-1.5" />
                  <p className="text-sm text-gray-400">No customers found</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>

      {/* Quick Action Button — POS Terminal */}
      {canPOS && (
        <motion.button
          onClick={() => navigate('/admin/pos')}
          className="relative overflow-hidden rounded-2xl p-5 flex items-center gap-3 text-left shadow-sm hover:shadow-md transition-all w-full"
          style={{ background: `linear-gradient(135deg, ${settings.primary_color}, ${settings.primary_color}cc)` }}
          initial={{ y: 15, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          whileTap={{ scale: 0.97 }}
        >
          <div className="absolute -top-3 -right-3 w-16 h-16 rounded-full bg-white/10" />
          <div className="w-11 h-11 bg-white/20 rounded-xl flex items-center justify-center shrink-0 backdrop-blur-sm">
            <ShoppingCart className="w-6 h-6 text-white" />
          </div>
          <div className="relative z-10 min-w-0">
            <span className="text-base font-bold text-white block">POS Terminal</span>
            <span className="text-[11px] text-white/60">Sales & loyalty tokens</span>
          </div>
        </motion.button>
      )}

      {/* Today's Stats — Responsive grid: 3 col desktop, 1+2 or stacked mobile */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Tokens Today', value: stats?.tokens_today ?? 0, icon: Coins, gradient: 'from-emerald-500 to-green-600' },
          { label: 'Revenue Today', value: `${settings.currency_symbol}${totalRevenue.toLocaleString('en-MY', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`, icon: TrendingUp, gradient: 'from-blue-500 to-indigo-600' },
          { label: 'Walk-in Sales', value: stats?.walkin_count_today ?? 0, icon: ShoppingBag, gradient: 'from-violet-500 to-purple-600' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            className="bg-white rounded-2xl p-3 sm:p-4 shadow-sm border border-gray-100 text-center"
            initial={{ y: 15, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 + i * 0.05 }}
          >
            <div className={`w-8 h-8 sm:w-9 sm:h-9 bg-gradient-to-br ${stat.gradient} rounded-lg sm:rounded-xl flex items-center justify-center mx-auto mb-1.5 sm:mb-2`}>
              <stat.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
            </div>
            <p className="text-lg sm:text-xl font-bold text-gray-900 leading-tight">{stat.value}</p>
            <p className="text-[10px] sm:text-[11px] text-gray-400 mt-0.5 leading-tight">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Recent Transactions */}
      <motion.div
        className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
        initial={{ y: 15, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.35 }}
      >
        <div className="px-4 sm:px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-50">
              <Clock className="w-3.5 h-3.5 text-gray-500" />
            </div>
            <span className="text-sm font-semibold text-gray-800">Recent Transactions</span>
          </div>
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{recentTxns.length} today</span>
        </div>

        {recentTxns.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-3">
              <ReceiptText className="w-8 h-8 text-gray-300" />
            </div>
            <p className="text-gray-500 font-medium text-sm">No transactions yet today</p>
            <p className="text-xs text-gray-400 mt-1">Transactions will appear here as you serve customers</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {recentTxns.map((txn) => (
              <div key={`${txn.type}-${txn.id}`} className="flex items-center gap-3 px-4 sm:px-5 py-3">
                {/* Type icon */}
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  txn.type === 'loyalty' ? 'bg-green-50' : 'bg-blue-50'
                }`}>
                  {txn.type === 'loyalty'
                    ? <Coins className="w-3.5 h-3.5 text-green-600" />
                    : <ShoppingBag className="w-3.5 h-3.5 text-blue-600" />
                  }
                </div>
                {/* Amount + customer */}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900 text-sm">
                    {settings.currency_symbol}{parseFloat(txn.amount).toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-[11px] text-gray-400 truncate">
                    {txn.customer_name || (txn.type === 'walkin' ? 'Walk-in customer' : 'Customer')}
                  </p>
                </div>
                {/* Payment method + time */}
                <div className="text-right shrink-0">
                  {txn.payment_method && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium block mb-0.5 ${
                      txn.payment_method === 'online' ? 'bg-blue-50 text-blue-500' :
                      txn.payment_method === 'split' ? 'bg-purple-50 text-purple-500' :
                      'bg-green-50 text-green-500'
                    }`}>
                      {txn.payment_method === 'online' ? 'Online' :
                       txn.payment_method === 'split' ? 'Split' : 'Cash'}
                    </span>
                  )}
                  <span className="text-[10px] text-gray-400">
                    {new Date(txn.created_at).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit', hour12: true })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}

// ═══════════════════════════════════════════
// Admin Dashboard — Full stats & revenue chart (unchanged)
// ═══════════════════════════════════════════
function AdminDashboard() {
  const { settings } = useSettings();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Chart state
  const [chartData, setChartData] = useState<RevenueData[]>([]);
  const [chartYear, setChartYear] = useState(new Date().getFullYear());
  const [chartLoading, setChartLoading] = useState(true);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalTokens, setTotalTokens] = useState(0);
  const [showYearPicker, setShowYearPicker] = useState(false);

  // Year range: current year + 11 years
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 12 }, (_, i) => currentYear + i);

  useEffect(() => {
    const fetch = async () => {
      try {
        const { data } = await adminService.getDashboard();
        if (data.success) {
          setStats(data.stats);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  // Fetch chart data when year changes
  useEffect(() => {
    const fetchChart = async () => {
      setChartLoading(true);
      try {
        const { data } = await adminService.getRevenueChart(chartYear);
        if (data.success) {
          setChartData(data.data || []);
          setTotalRevenue(data.total_revenue || 0);
          setTotalTokens(data.total_tokens || 0);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setChartLoading(false);
      }
    };
    fetchChart();
  }, [chartYear]);

  const statCards = stats ? [
    { label: 'Total Customers', value: stats.total_customers, icon: Users, color: 'bg-blue-500' },
    { label: 'Tokens Today', value: stats.tokens_today, icon: Coins, color: 'bg-green-500' },
    { label: 'Active Cards', value: stats.active_cards, icon: CreditCard, color: 'bg-purple-500' },
    { label: 'Awaiting Redemption', value: stats.completed_cards, icon: Gift, color: 'bg-yellow-500' },
    { label: 'Redeemed Today', value: stats.redeemed_today, icon: TrendingUp, color: 'bg-emerald-500' },
    { label: 'New This Week', value: stats.new_customers_week, icon: UserPlus, color: 'bg-indigo-500' },
  ] : [];

  // Custom tooltip for chart
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-3 min-w-[140px]">
          <p className="text-xs text-gray-500 font-medium mb-1">{label} {chartYear}</p>
          <p className="text-sm font-bold text-gray-900">
            {settings.currency_symbol}{payload[0].value.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {payload[0].payload.token_count} tokens
          </p>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="bg-white rounded-2xl p-5 animate-pulse h-28" />
        ))}
      </div>
    );
  }

  const maxRevenue = Math.max(...chartData.map(d => d.revenue), 1);
  const currentMonth = new Date().getMonth(); // 0-indexed

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {statCards.map((stat, i) => (
          <motion.div
            key={stat.label}
            className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: i * 0.05 }}
          >
            <div className={`w-10 h-10 ${stat.color} rounded-xl flex items-center justify-center mb-3`}>
              <stat.icon className="w-5 h-5 text-white" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Quick stats bar */}
      {stats && (
        <motion.div
          className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <TrendingUp className="w-5 h-5" style={{ color: settings.primary_color }} />
            Overview
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-3xl font-bold" style={{ color: settings.primary_color }}>
                {stats.total_tokens}
              </p>
              <p className="text-xs text-gray-500">Total Tokens</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-gray-900">{stats.total_redeemed}</p>
              <p className="text-xs text-gray-500">Total Redeemed</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-gray-900">
                {settings.currency_symbol}{((stats.revenue_today || 0) + (stats.walkin_today || 0) + (stats.below_threshold_today || 0)).toLocaleString('en-MY', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </p>
              <p className="text-xs text-gray-500">Revenue Today</p>
              <div className="mt-1 space-y-0.5">
                {(stats.walkin_count_today ?? 0) > 0 && (
                  <p className="text-[10px] text-blue-600 font-medium">
                    🧾 {settings.currency_symbol}{(stats.walkin_today ?? 0).toFixed(0)} walk-in ({stats.walkin_count_today})
                  </p>
                )}
                {(stats.revenue_today ?? 0) > 0 && (
                  <p className="text-[10px] text-cyan-600 font-medium">
                    💳 {settings.currency_symbol}{(stats.revenue_today ?? 0).toFixed(0)} loyalty card
                  </p>
                )}
                {(stats.below_threshold_count ?? 0) > 0 && (
                  <p className="text-[10px] text-amber-600 font-medium">
                    ⚠️ {settings.currency_symbol}{(stats.below_threshold_today ?? 0).toFixed(0)} no-token ({stats.below_threshold_count})
                  </p>
                )}
              </div>
            </div>
            <div>
              <p className="text-3xl font-bold text-gray-900">
                {stats.total_customers > 0
                  ? (stats.total_tokens / stats.total_customers).toFixed(1)
                  : '0'}
              </p>
              <p className="text-xs text-gray-500">Avg Tokens/Customer</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Revenue Chart */}
      <motion.div
        className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        {/* Chart header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" style={{ color: settings.primary_color }} />
            <h2 className="font-semibold text-gray-900">Payment Revenue</h2>
          </div>

          {/* Year picker dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowYearPicker(!showYearPicker)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              {chartYear}
              <ChevronDown className={`w-4 h-4 transition-transform ${showYearPicker ? 'rotate-180' : ''}`} />
            </button>
            {showYearPicker && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowYearPicker(false)} />
                <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-20 w-24 max-h-52 overflow-y-auto">
                  {years.map((y) => (
                    <button
                      key={y}
                      onClick={() => { setChartYear(y); setShowYearPicker(false); }}
                      className={`w-full px-3 py-1.5 text-sm text-left hover:bg-gray-50 transition-colors ${
                        y === chartYear ? 'font-bold' : 'text-gray-600'
                      }`}
                      style={y === chartYear ? { color: settings.primary_color } : {}}
                    >
                      {y}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Chart summary */}
        <div className="grid grid-cols-2 gap-4 mb-5">
          <div className="bg-gray-50 rounded-xl px-4 py-3">
            <p className="text-xs text-gray-500">Total Revenue ({chartYear})</p>
            <p className="text-xl font-bold text-gray-900 mt-0.5">
              {settings.currency_symbol}{totalRevenue.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="bg-gray-50 rounded-xl px-4 py-3">
            <p className="text-xs text-gray-500">Total Tokens ({chartYear})</p>
            <p className="text-xl font-bold text-gray-900 mt-0.5">
              {totalTokens.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Chart */}
        {chartLoading ? (
          <div className="h-64 bg-gray-50 rounded-xl animate-pulse flex items-center justify-center">
            <p className="text-sm text-gray-400">Loading chart...</p>
          </div>
        ) : (
          <div className="h-64 md:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(val) => `${settings.currency_symbol}${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)', radius: 8 }} />
                <Bar dataKey="revenue" radius={[6, 6, 0, 0]} maxBarSize={40}>
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={
                        chartYear === new Date().getFullYear() && index === currentMonth
                          ? settings.primary_color
                          : entry.revenue > 0
                            ? settings.primary_color + 'aa'
                            : '#e2e8f0'
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </motion.div>
    </div>
  );
}
