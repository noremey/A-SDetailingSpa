import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ReceiptText, Ban, DollarSign, Users, RefreshCw, Search, X, Banknote, Smartphone,
  ArrowLeftRight, Pencil, RotateCcw, ArrowRight, ChevronLeft, ChevronRight,
  ChevronsLeft, ChevronsRight, ChevronDown, ChevronUp, ChevronsUpDown, Download, Calendar, Printer,
} from 'lucide-react';
import { adminService } from '../../services/api';
import { useSettings } from '../../context/SettingsContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/ui/Toast';
import ConfirmModal from '../../components/ui/ConfirmModal';
import ReceiptModal, { type ReceiptData } from '../../components/ui/ReceiptModal';

// ── Types ────────────────────────────────────────────────────
interface Transaction {
  id: number;
  type: 'loyalty' | 'walkin';
  amount: string;
  token_count: number;
  status: 'active' | 'voided';
  void_reason: string | null;
  notes: string | null;
  payment_method: 'cash' | 'online' | 'split' | null;
  cash_amount: string | null;
  online_amount: string | null;
  created_at: string;
  voided_at: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  staff_name: string | null;
  voided_by_name: string | null;
}

interface Summary {
  active_total: number;
  active_count: number;
  voided_total: number;
  voided_count: number;
  cash_total: number;
  online_total: number;
  loyalty_count: number;
  loyalty_total: number;
  walkin_count: number;
  walkin_total: number;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

// ── Helpers ──────────────────────────────────────────────────
const localDateStr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const todayStr = () => localDateStr(new Date());
const yesterdayStr = () => {
  const d = new Date(); d.setDate(d.getDate() - 1);
  return localDateStr(d);
};
const weekStartStr = () => {
  const d = new Date(); const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return localDateStr(d);
};
const monthStartStr = () => {
  const d = new Date(); d.setDate(1);
  return localDateStr(d);
};
const formatDateDisplay = (ds: string) => {
  const d = new Date(ds + 'T00:00:00');
  return d.toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' });
};

// ── Main Component ───────────────────────────────────────────
export default function TransactionHistoryPage() {
  const { settings } = useSettings();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isSuperAdmin = user?.role === 'super_admin';
  const currency = settings.currency_symbol || 'RM';

  // ── State from URL ──
  const [dateFrom, setDateFrom] = useState(searchParams.get('date_from') || todayStr());
  const [dateTo, setDateTo] = useState(searchParams.get('date_to') || todayStr());
  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1', 10));
  const [limit, setLimit] = useState(parseInt(searchParams.get('limit') || '25', 10));
  const [sortBy, setSortBy] = useState(searchParams.get('sort_by') || 'created_at');
  const [sortDir, setSortDir] = useState<'ASC' | 'DESC'>((searchParams.get('sort_dir') as 'ASC' | 'DESC') || 'DESC');
  const [filterType, setFilterType] = useState(searchParams.get('type') || '');
  const [filterStatus, setFilterStatus] = useState(searchParams.get('status') || '');
  const [filterPay, setFilterPay] = useState(searchParams.get('payment_method') || '');
  const [searchInput, setSearchInput] = useState(searchParams.get('search') || '');
  const [searchValue, setSearchValue] = useState(searchParams.get('search') || '');
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Data ──
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 25, total: 0, total_pages: 0 });
  const [loading, setLoading] = useState(true);

  // ── Expanded row ──
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // ── Modal states ──
  const [voidTarget, setVoidTarget] = useState<Transaction | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [voiding, setVoiding] = useState(false);
  const [voidedLoyalty, setVoidedLoyalty] = useState<{ name: string; phone: string } | null>(null);
  const [editTarget, setEditTarget] = useState<Transaction | null>(null);
  const [editAmountTarget, setEditAmountTarget] = useState<Transaction | null>(null);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);

  // ── Date preset ──
  const datePreset = (() => {
    const t = todayStr(); const y = yesterdayStr(); const w = weekStartStr(); const m = monthStartStr();
    if (dateFrom === t && dateTo === t) return 'today';
    if (dateFrom === y && dateTo === y) return 'yesterday';
    if (dateFrom === w && dateTo === t) return 'week';
    if (dateFrom === m && dateTo === t) return 'month';
    return 'custom';
  })();

  // ── Sync URL ──
  const updateURL = useCallback((overrides?: Record<string, string | number>) => {
    const state: Record<string, string> = {};
    const df = String(overrides?.date_from ?? dateFrom);
    const dt = String(overrides?.date_to ?? dateTo);
    const p = Number(overrides?.page ?? page);
    const l = Number(overrides?.limit ?? limit);
    const sb = String(overrides?.sort_by ?? sortBy);
    const sd = String(overrides?.sort_dir ?? sortDir);
    const ft = String(overrides?.type ?? filterType);
    const fs = String(overrides?.status ?? filterStatus);
    const fp = String(overrides?.payment_method ?? filterPay);
    const sv = String(overrides?.search ?? searchValue);

    if (df !== todayStr()) state.date_from = df;
    if (dt !== todayStr()) state.date_to = dt;
    if (p > 1) state.page = String(p);
    if (l !== 25) state.limit = String(l);
    if (sb !== 'created_at') state.sort_by = sb;
    if (sd !== 'DESC') state.sort_dir = sd;
    if (ft) state.type = ft;
    if (fs) state.status = fs;
    if (fp) state.payment_method = fp;
    if (sv) state.search = sv;
    setSearchParams(state, { replace: true });
  }, [dateFrom, dateTo, page, limit, sortBy, sortDir, filterType, filterStatus, filterPay, searchValue, setSearchParams]);

  // ── Data Fetching ──
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = {
        page, limit, date_from: dateFrom, date_to: dateTo, sort_by: sortBy, sort_dir: sortDir,
      };
      if (filterType) params.type = filterType;
      if (filterStatus) params.status = filterStatus;
      if (filterPay) params.payment_method = filterPay;
      if (searchValue) params.search = searchValue;

      const { data } = await adminService.getRecentTransactions(params);
      if (data.success) {
        setTransactions(data.transactions || []);
        setSummary(data.summary || null);
        setPagination(data.pagination || { page: 1, limit: 25, total: 0, total_pages: 0 });
      }
    } catch {
      toast.error('Failed to load transactions');
    } finally {
      setLoading(false);
    }
  }, [page, limit, dateFrom, dateTo, sortBy, sortDir, filterType, filterStatus, filterPay, searchValue]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { updateURL(); }, [page, limit, dateFrom, dateTo, sortBy, sortDir, filterType, filterStatus, filterPay, searchValue]);

  // ── Debounced search ──
  const handleSearchChange = (v: string) => {
    setSearchInput(v);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => { setSearchValue(v); setPage(1); }, 300);
  };

  // ── Sort handler ──
  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortDir(prev => prev === 'DESC' ? 'ASC' : 'DESC');
    } else {
      setSortBy(field);
      setSortDir('DESC');
    }
    setPage(1);
  };

  // ── Filter handlers ──
  const setFilterAndReset = (setter: (v: any) => void, value: string) => { setter(value); setPage(1); };

  // ── Date preset handler ──
  const applyDatePreset = (preset: string) => {
    const t = todayStr();
    switch (preset) {
      case 'today': setDateFrom(t); setDateTo(t); break;
      case 'yesterday': setDateFrom(yesterdayStr()); setDateTo(yesterdayStr()); break;
      case 'week': setDateFrom(weekStartStr()); setDateTo(t); break;
      case 'month': setDateFrom(monthStartStr()); setDateTo(t); break;
    }
    setPage(1);
  };

  // ── Void handler ──
  const handleVoid = async () => {
    if (!voidTarget) return;
    setVoiding(true);
    try {
      const { data } = await adminService.voidTransaction(voidTarget.id, voidTarget.type, voidReason || 'Voided by admin');
      if (data.success) {
        toast.success(data.message || 'Transaction voided');
        if (voidTarget.type === 'loyalty' && voidTarget.customer_name && voidTarget.customer_phone) {
          setVoidedLoyalty({ name: voidTarget.customer_name, phone: voidTarget.customer_phone });
        }
        setVoidTarget(null);
        setVoidReason('');
        await loadData();
      } else {
        toast.error(data.message || 'Failed to void');
      }
    } catch {
      toast.error('Failed to void transaction');
    } finally {
      setVoiding(false);
    }
  };

  // ── CSV export ──
  const exportCSV = () => {
    if (transactions.length === 0) return;
    const headers = ['ID', 'Type', 'Customer', 'Phone', 'Amount', 'Payment', 'Cash', 'Online', 'Tokens', 'Staff', 'Status', 'Notes', 'Date', 'Time'];
    const rows = transactions.map(txn => [
      txn.id, txn.type, txn.customer_name || 'Walk-in', txn.customer_phone || '',
      parseFloat(txn.amount).toFixed(2), txn.payment_method || 'cash',
      txn.cash_amount ? parseFloat(txn.cash_amount).toFixed(2) : '',
      txn.online_amount ? parseFloat(txn.online_amount).toFixed(2) : '',
      txn.type === 'loyalty' ? txn.token_count : '', txn.staff_name || '',
      txn.status, txn.notes || '',
      new Date(txn.created_at).toLocaleDateString('en-MY'),
      new Date(txn.created_at).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit', hour12: true }),
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `transactions_${dateFrom}_${dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success('CSV downloaded');
  };

  // ── Format helpers ──
  const formatTime = (ds: string) => new Date(ds).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit', hour12: true });
  const formatDate = (ds: string) => new Date(ds).toLocaleDateString('en-MY', { day: '2-digit', month: 'short' });

  // ── Open receipt ──
  const openReceipt = (txn: Transaction) => {
    setReceiptData({
      id: txn.id,
      type: txn.type,
      created_at: txn.created_at,
      amount: parseFloat(txn.amount),
      payment_method: txn.payment_method,
      cash_amount: txn.cash_amount ? parseFloat(txn.cash_amount) : null,
      online_amount: txn.online_amount ? parseFloat(txn.online_amount) : null,
      customer_name: txn.customer_name,
      customer_phone: txn.customer_phone,
      staff_name: txn.staff_name,
      token_count: txn.type === 'loyalty' ? txn.token_count : undefined,
      notes: txn.notes,
    });
  };

  const colCount = isSuperAdmin ? 9 : 8;
  const start = pagination.total > 0 ? (pagination.page - 1) * pagination.limit + 1 : 0;
  const end = Math.min(pagination.page * pagination.limit, pagination.total);

  return (
    <div className="space-y-4">
      {/* ── Page Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white" style={{ backgroundColor: settings.primary_color }}>
            <ReceiptText className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Transaction History</h1>
            <p className="text-xs text-gray-400">
              {dateFrom === dateTo ? formatDateDisplay(dateFrom) : `${formatDateDisplay(dateFrom)} — ${formatDateDisplay(dateTo)}`}
              {summary ? ` · ${pagination.total} records` : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCSV} disabled={loading || transactions.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-40">
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
          <button onClick={loadData} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {/* ── Summary Cards ── */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Active Revenue', value: summary.active_total, sub: `${summary.active_count} txn`, icon: DollarSign, bg: 'bg-green-50', clr: 'text-green-600' },
            { label: 'Cash', value: summary.cash_total, sub: '', icon: Banknote, bg: 'bg-emerald-50', clr: 'text-emerald-600' },
            { label: 'Online', value: summary.online_total, sub: '', icon: Smartphone, bg: 'bg-blue-50', clr: 'text-blue-600' },
            { label: 'Loyalty', value: summary.loyalty_total, sub: `${summary.loyalty_count} txn`, icon: Users, bg: 'bg-indigo-50', clr: 'text-indigo-600' },
            { label: 'Walk-in', value: summary.walkin_total, sub: `${summary.walkin_count} txn`, icon: DollarSign, bg: 'bg-amber-50', clr: 'text-amber-600' },
          ].map((card, i) => (
            <motion.div key={card.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              className="bg-white rounded-2xl p-3.5 shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 mb-1.5">
                <div className={`w-7 h-7 rounded-lg ${card.bg} flex items-center justify-center`}>
                  <card.icon className={`w-3.5 h-3.5 ${card.clr}`} />
                </div>
                <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">{card.label}</span>
              </div>
              <p className="text-lg font-bold text-gray-900">{currency} {card.value.toFixed(2)}</p>
              {card.sub && <p className="text-[10px] text-gray-400">{card.sub}</p>}
              {summary.voided_count > 0 && card.label === 'Active Revenue' && (
                <p className="text-[10px] text-red-400 mt-0.5">{summary.voided_count} voided ({currency} {summary.voided_total.toFixed(2)})</p>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* ── Filters Bar ── */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">
        {/* Row 1: Date presets + Search */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Date presets */}
          <div className="flex items-center gap-1">
            <Calendar className="w-4 h-4 text-gray-400 mr-1" />
            {(['today', 'yesterday', 'week', 'month'] as const).map((p) => (
              <button key={p} onClick={() => applyDatePreset(p)}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
                  datePreset === p ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
                {p === 'today' ? 'Today' : p === 'yesterday' ? 'Yesterday' : p === 'week' ? 'This Week' : 'This Month'}
              </button>
            ))}
            <button onClick={() => {}} className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
              datePreset === 'custom' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
              Custom
            </button>
          </div>

          {/* Custom date inputs */}
          {datePreset === 'custom' && (
            <div className="flex items-center gap-1.5">
              <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                className="px-2 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
              <span className="text-xs text-gray-400">to</span>
              <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                className="px-2 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
            </div>
          )}

          {/* Search */}
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input type="text" placeholder="Search customer, staff, or ID..." value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
            {searchInput && (
              <button onClick={() => { setSearchInput(''); setSearchValue(''); setPage(1); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Type / Status / Payment filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Type filter */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            {[{ v: '', l: 'All' }, { v: 'loyalty', l: 'Loyalty' }, { v: 'walkin', l: 'Walk-in' }].map(f => (
              <button key={f.v} onClick={() => setFilterAndReset(setFilterType, filterType === f.v ? '' : f.v)}
                className={`px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${
                  filterType === f.v ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
                {f.l}
              </button>
            ))}
          </div>

          {/* Status filter */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            {[{ v: '', l: 'All Status' }, { v: 'active', l: 'Active' }, { v: 'voided', l: 'Voided' }].map(f => (
              <button key={f.v} onClick={() => setFilterAndReset(setFilterStatus, filterStatus === f.v ? '' : f.v)}
                className={`px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${
                  filterStatus === f.v ? (f.v === 'voided' ? 'bg-red-600 text-white' : 'bg-gray-900 text-white') : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
                {f.l}
              </button>
            ))}
          </div>

          {/* Payment filter */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            {[{ v: '', l: 'All Pay' }, { v: 'cash', l: 'Cash' }, { v: 'online', l: 'Online' }, { v: 'split', l: 'Split' }].map(f => (
              <button key={f.v} onClick={() => setFilterAndReset(setFilterPay, filterPay === f.v ? '' : f.v)}
                className={`px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${
                  filterPay === f.v ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
                {f.l}
              </button>
            ))}
          </div>

          <span className="text-[11px] text-gray-400 ml-auto">
            {pagination.total} result{pagination.total !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          /* Loading skeleton */
          <div className="p-4 space-y-3">
            {Array.from({ length: Math.min(limit, 10) }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 animate-pulse">
                <div className="h-3.5 w-8 bg-gray-100 rounded" />
                <div className="h-3.5 w-16 bg-gray-100 rounded" />
                <div className="h-3.5 w-14 bg-gray-100 rounded" />
                <div className="h-3.5 flex-1 bg-gray-100 rounded" />
                <div className="h-3.5 w-20 bg-gray-100 rounded" />
                <div className="h-3.5 w-16 bg-gray-100 rounded" />
                <div className="h-3.5 w-10 bg-gray-100 rounded" />
                <div className="h-3.5 w-16 bg-gray-100 rounded" />
              </div>
            ))}
          </div>
        ) : transactions.length === 0 ? (
          /* Empty state */
          <div className="py-16 text-center">
            <ReceiptText className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-400">No transactions found</p>
            <p className="text-xs text-gray-300 mt-1">
              {filterType || filterStatus || filterPay || searchValue ? 'Try different filters or date range' : 'No transactions recorded for this period'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10 bg-gray-50/95 backdrop-blur-sm">
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2.5 px-3 font-semibold text-gray-500 text-xs w-8">#</th>
                  <SortHeader label="Time" field="created_at" current={sortBy} dir={sortDir} onSort={handleSort} />
                  <th className="text-left py-2.5 px-3 font-semibold text-gray-500 text-xs">Customer</th>
                  <SortHeader label="Amount" field="amount" current={sortBy} dir={sortDir} onSort={handleSort} align="right" />
                  <th className="text-left py-2.5 px-3 font-semibold text-gray-500 text-xs">Payment</th>
                  <th className="text-left py-2.5 px-3 font-semibold text-gray-500 text-xs">Tokens</th>
                  <th className="text-left py-2.5 px-3 font-semibold text-gray-500 text-xs">Staff</th>
                  <SortHeader label="Status" field="status" current={sortBy} dir={sortDir} onSort={handleSort} />
                  {isSuperAdmin && <th className="text-center py-2.5 px-3 font-semibold text-gray-500 text-xs w-20">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                <AnimatePresence>
                  {transactions.map((txn, i) => {
                    const isVoided = txn.status === 'voided';
                    const rowKey = `${txn.type}-${txn.id}`;
                    const isExpanded = expandedRow === rowKey;
                    return (
                      <ExpandableRow key={rowKey} txn={txn} i={i} isVoided={isVoided} isExpanded={isExpanded}
                        onToggle={() => setExpandedRow(isExpanded ? null : rowKey)}
                        isSuperAdmin={isSuperAdmin} currency={currency}
                        onVoid={() => { setVoidTarget(txn); setVoidReason(''); }}
                        onEditPayment={() => setEditTarget(txn)}
                        onEditAmount={() => setEditAmountTarget(txn)}
                        onReceipt={() => openReceipt(txn)}
                        formatTime={formatTime} formatDate={formatDate}
                        colCount={colCount}
                      />
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}

        {/* ── Pagination Footer ── */}
        {pagination.total > 0 && (
          <div className="border-t border-gray-100 px-4 py-3 flex items-center justify-between bg-gray-50/50">
            <div className="flex items-center gap-3">
              <p className="text-[11px] text-gray-500">
                Showing <span className="font-semibold">{start}</span>–<span className="font-semibold">{end}</span> of <span className="font-semibold">{pagination.total}</span>
              </p>
              <select value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
                className="text-[11px] border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-600 focus:outline-none">
                <option value={10}>10 / page</option>
                <option value={25}>25 / page</option>
                <option value={50}>50 / page</option>
              </select>
            </div>
            <div className="flex items-center gap-1">
              <PaginationBtn icon={ChevronsLeft} onClick={() => setPage(1)} disabled={page <= 1} />
              <PaginationBtn icon={ChevronLeft} onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} />
              {getPageNumbers(page, pagination.total_pages).map((p, idx) =>
                p === '...' ? (
                  <span key={`dot-${idx}`} className="px-1 text-gray-400 text-xs">...</span>
                ) : (
                  <button key={p} onClick={() => setPage(Number(p))}
                    className={`min-w-[28px] h-7 rounded-lg text-[11px] font-semibold transition-colors ${
                      page === p ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
                    {p}
                  </button>
                )
              )}
              <PaginationBtn icon={ChevronRight} onClick={() => setPage(p => Math.min(pagination.total_pages, p + 1))} disabled={page >= pagination.total_pages} />
              <PaginationBtn icon={ChevronsRight} onClick={() => setPage(pagination.total_pages)} disabled={page >= pagination.total_pages} />
            </div>
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {voidTarget && (
        <VoidModal transaction={voidTarget} currency={currency} reason={voidReason}
          onReasonChange={setVoidReason} loading={voiding} onConfirm={handleVoid}
          onCancel={() => { setVoidTarget(null); setVoidReason(''); }} />
      )}
      {editTarget && (
        <EditPaymentModal transaction={editTarget} currency={currency}
          onSuccess={() => { setEditTarget(null); loadData(); }} onCancel={() => setEditTarget(null)} />
      )}
      {editAmountTarget && (
        <EditAmountModal transaction={editAmountTarget} currency={currency}
          onSuccess={() => { setEditAmountTarget(null); loadData(); }} onCancel={() => setEditAmountTarget(null)} />
      )}
      {voidedLoyalty && (
        <ReCreateModal customerName={voidedLoyalty.name}
          onYes={() => { navigate('/admin/add-token', { state: { preSelectPhone: voidedLoyalty.phone } }); setVoidedLoyalty(null); }}
          onNo={() => setVoidedLoyalty(null)} />
      )}

      {/* Receipt Modal */}
      <ReceiptModal
        isOpen={!!receiptData}
        onClose={() => setReceiptData(null)}
        data={receiptData}
      />
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────

function SortHeader({ label, field, current, dir, onSort, align }: {
  label: string; field: string; current: string; dir: 'ASC' | 'DESC'; onSort: (f: string) => void; align?: string;
}) {
  const active = current === field;
  return (
    <th onClick={() => onSort(field)}
      className={`${align === 'right' ? 'text-right' : 'text-left'} py-2.5 px-3 font-semibold text-gray-500 text-xs cursor-pointer select-none hover:bg-gray-100/50 transition-colors`}>
      <div className={`inline-flex items-center gap-1 ${align === 'right' ? 'flex-row-reverse' : ''}`}>
        {label}
        {active ? (dir === 'ASC' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) :
          <ChevronsUpDown className="w-3 h-3 text-gray-300" />}
      </div>
    </th>
  );
}

function PaginationBtn({ icon: Icon, onClick, disabled }: { icon: any; onClick: () => void; disabled: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
      <Icon className="w-3.5 h-3.5" />
    </button>
  );
}

function getPageNumbers(current: number, total: number): (number | string)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | string)[] = [];
  if (current <= 4) {
    for (let i = 1; i <= 5; i++) pages.push(i);
    pages.push('...', total);
  } else if (current >= total - 3) {
    pages.push(1, '...');
    for (let i = total - 4; i <= total; i++) pages.push(i);
  } else {
    pages.push(1, '...', current - 1, current, current + 1, '...', total);
  }
  return pages;
}

function ExpandableRow({ txn, i, isVoided, isExpanded, onToggle, isSuperAdmin, currency, onVoid, onEditPayment, onEditAmount, onReceipt, formatTime, formatDate, colCount }: {
  txn: Transaction; i: number; isVoided: boolean; isExpanded: boolean; onToggle: () => void;
  isSuperAdmin: boolean; currency: string;
  onVoid: () => void; onEditPayment: () => void; onEditAmount: () => void; onReceipt: () => void;
  formatTime: (s: string) => string; formatDate: (s: string) => string; colCount: number;
}) {
  const pm = txn.payment_method || 'cash';
  const pmCfg = pm === 'cash'
    ? { bg: 'bg-green-50', text: 'text-green-700', Icon: Banknote, label: 'Cash' }
    : pm === 'online'
    ? { bg: 'bg-blue-50', text: 'text-blue-700', Icon: Smartphone, label: 'Online' }
    : { bg: 'bg-purple-50', text: 'text-purple-700', Icon: ArrowLeftRight, label: 'Split' };
  const canEditPay = isSuperAdmin && !isVoided;
  const canEditAmt = isSuperAdmin && !isVoided && txn.type === 'walkin';
  const hasDetails = txn.notes || (txn.status === 'voided' && txn.void_reason) || (pm === 'split' && txn.cash_amount) || txn.customer_phone;

  return (
    <>
      <motion.tr
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: Math.min(i * 0.015, 0.2) }}
        className={`group ${isVoided ? 'bg-red-50/30' : 'hover:bg-blue-50/30'} transition-colors ${hasDetails ? 'cursor-pointer' : ''}`}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('button')) return;
          if (hasDetails) onToggle();
        }}
      >
        <td className="py-2.5 px-3">
          <span className={`text-xs font-mono ${isVoided ? 'text-gray-400' : 'text-gray-500'}`}>{txn.id}</span>
        </td>
        <td className="py-2.5 px-3">
          <div className={`text-xs ${isVoided ? 'text-gray-400' : 'text-gray-600'}`}>{formatTime(txn.created_at)}</div>
          <div className="text-xs text-gray-400">{formatDate(txn.created_at)}</div>
        </td>
        <td className="py-2.5 px-3">
          <span className={`font-medium text-xs ${isVoided ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
            {txn.customer_name || 'Walk-in'}
          </span>
          <span className={`ml-1 text-xs font-semibold ${txn.type === 'loyalty' ? 'text-blue-500' : 'text-emerald-500'}`}>
            ({txn.type === 'loyalty' ? 'Loyalty' : 'Walk-in'})
          </span>
          {txn.customer_phone && <span className="block text-xs text-gray-400">{txn.customer_phone}</span>}
          {txn.notes && <span className="block text-xs text-gray-400 truncate max-w-[200px]" title={txn.notes}>{txn.notes}</span>}
        </td>
        <td className="py-2.5 px-3 text-right">
          {canEditAmt ? (
            <button onClick={(e) => { e.stopPropagation(); onEditAmount(); }}
              className="inline-flex items-center gap-1 font-bold text-xs text-gray-900 hover:text-blue-600 hover:underline group" title="Edit amount">
              {currency} {parseFloat(txn.amount).toFixed(2)}
              <Pencil className="w-2.5 h-2.5 opacity-0 group-hover:opacity-50" />
            </button>
          ) : (
            <span className={`font-bold text-xs ${isVoided ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
              {currency} {parseFloat(txn.amount).toFixed(2)}
            </span>
          )}
        </td>
        <td className="py-2.5 px-3">
          <button onClick={(e) => { e.stopPropagation(); if (canEditPay) onEditPayment(); }} disabled={!canEditPay}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${pmCfg.bg} ${pmCfg.text} ${canEditPay ? 'hover:ring-2 hover:ring-gray-300 cursor-pointer' : 'cursor-default'}`}
            title={canEditPay ? 'Edit payment method' : ''}>
            <pmCfg.Icon className="w-3 h-3" /> {pmCfg.label}
            {canEditPay && <Pencil className="w-2 h-2 ml-0.5 opacity-40" />}
          </button>
        </td>
        <td className="py-2.5 px-3">
          {txn.type === 'loyalty' && txn.token_count > 0 ? (
            <span className={`text-xs font-semibold ${isVoided ? 'text-gray-400' : 'text-blue-600'}`}>+{txn.token_count}</span>
          ) : <span className="text-xs text-gray-300">-</span>}
        </td>
        <td className="py-2.5 px-3"><span className="text-xs text-gray-500">{txn.staff_name || '-'}</span></td>
        <td className="py-2.5 px-3">
          {isVoided ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-600">
              <Ban className="w-3 h-3" /> VOIDED
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-green-50 text-green-600">Active</span>
          )}
        </td>
        {isSuperAdmin && (
          <td className="py-2.5 px-3 text-center">
            <div className="flex items-center justify-center gap-1">
              <button onClick={(e) => { e.stopPropagation(); onReceipt(); }}
                className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                title="Print Receipt">
                <Printer className="w-3.5 h-3.5" />
              </button>
              {!isVoided && (
                <button onClick={(e) => { e.stopPropagation(); onVoid(); }}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 transition-colors">
                  VOID
                </button>
              )}
            </div>
          </td>
        )}
      </motion.tr>

      {/* Expanded detail row */}
      <AnimatePresence>
        {isExpanded && (
          <motion.tr initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <td colSpan={colCount} className="px-4 py-3 bg-gray-50/80 border-b border-gray-100">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                {txn.notes && (
                  <div><span className="font-semibold text-gray-500">Notes:</span> <span className="text-gray-700">{txn.notes}</span></div>
                )}
                {txn.customer_phone && (
                  <div><span className="font-semibold text-gray-500">Phone:</span> <span className="text-gray-700">{txn.customer_phone}</span></div>
                )}
                {pm === 'split' && txn.cash_amount && txn.online_amount && (
                  <div><span className="font-semibold text-gray-500">Split:</span> <span className="text-gray-700">Cash {currency}{parseFloat(txn.cash_amount).toFixed(2)} + Online {currency}{parseFloat(txn.online_amount).toFixed(2)}</span></div>
                )}
                {txn.status === 'voided' && (
                  <>
                    {txn.void_reason && <div><span className="font-semibold text-gray-500">Reason:</span> <span className="text-red-600">{txn.void_reason}</span></div>}
                    {txn.voided_by_name && <div><span className="font-semibold text-gray-500">Voided by:</span> <span className="text-gray-700">{txn.voided_by_name}</span></div>}
                    {txn.voided_at && <div><span className="font-semibold text-gray-500">Voided at:</span> <span className="text-gray-700">{new Date(txn.voided_at).toLocaleString('en-MY')}</span></div>}
                  </>
                )}
              </div>
            </td>
          </motion.tr>
        )}
      </AnimatePresence>
    </>
  );
}

// ══════════════════════════════════════════════════════════════
// ── MODALS (preserved from original) ─────────────────────────
// ══════════════════════════════════════════════════════════════

function EditPaymentModal({
  transaction, currency, onSuccess, onCancel,
}: { transaction: Transaction; currency: string; onSuccess: () => void; onCancel: () => void; }) {
  const toast = useToast();
  const amount = parseFloat(transaction.amount);
  const [method, setMethod] = useState<'cash' | 'online' | 'split'>(transaction.payment_method || 'cash');
  const [cashAmt, setCashAmt] = useState(transaction.cash_amount ? parseFloat(transaction.cash_amount).toString() : '');
  const [saving, setSaving] = useState(false);
  const cashVal = parseFloat(cashAmt) || 0;
  const onlineVal = method === 'split' ? Math.max(0, amount - cashVal) : 0;
  const splitValid = method === 'split' ? cashVal > 0 && cashVal < amount : true;
  const hasChanged = method !== (transaction.payment_method || 'cash') ||
    (method === 'split' && cashAmt !== (transaction.cash_amount ? parseFloat(transaction.cash_amount).toString() : ''));

  const handleSave = async () => {
    if (!splitValid) return;
    setSaving(true);
    try {
      const payload: any = { transaction_id: transaction.id, type: transaction.type, payment_method: method };
      if (method === 'split') { payload.cash_amount = cashVal; payload.online_amount = parseFloat(onlineVal.toFixed(2)); }
      const { data } = await adminService.editPaymentMethod(payload);
      if (data.success) { toast.success(data.message || 'Payment method updated'); onSuccess(); }
      else toast.error(data.message || 'Failed to update');
    } catch { toast.error('Failed to update payment method'); } finally { setSaving(false); }
  };

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape' && !saving) onCancel(); };
    document.body.style.overflow = 'hidden'; window.addEventListener('keydown', h);
    return () => { document.body.style.overflow = ''; window.removeEventListener('keydown', h); };
  }, [saving, onCancel]);

  return (
    <motion.div className="fixed inset-0 z-[100] flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <motion.div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !saving && onCancel()} />
      <motion.div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
        initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}>
        <button onClick={() => !saving && onCancel()} className="absolute top-3 right-3 p-1.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100"><X className="w-4 h-4" /></button>
        <div className="p-6 pt-8">
          <div className="text-center mb-5">
            <motion.div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3"
              initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 15, stiffness: 300, delay: 0.1 }}>
              <Pencil className="w-6 h-6 text-blue-600" />
            </motion.div>
            <h3 className="text-lg font-bold text-gray-900">Edit Payment Method</h3>
            <p className="text-sm text-gray-500">#{transaction.id} &middot; {transaction.customer_name || 'Walk-in'} &middot; {currency} {amount.toFixed(2)}</p>
          </div>
          <div className="flex rounded-xl border border-gray-200 overflow-hidden mb-4">
            {([{ key: 'cash' as const, label: 'Cash', Icon: Banknote, clr: '#16a34a' }, { key: 'online' as const, label: 'Online', Icon: Smartphone, clr: '#2563eb' }, { key: 'split' as const, label: 'Split', Icon: ArrowLeftRight, clr: '#9333ea' }]).map(({ key, label, Icon, clr }) => (
              <button key={key} onClick={() => { setMethod(key); if (key !== 'split') setCashAmt(''); }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors ${method === key ? 'text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                style={method === key ? { backgroundColor: clr } : {}}><Icon className="w-3.5 h-3.5" />{label}</button>
            ))}
          </div>
          {method === 'split' && (
            <div className="p-3 rounded-xl border border-purple-200 bg-purple-50/50 space-y-2 mb-4">
              <div className="flex items-center gap-3"><label className="text-xs font-semibold text-gray-600 w-14">Cash</label>
                <div className="relative flex-1"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs font-semibold">{currency}</span>
                  <input type="text" inputMode="decimal" value={cashAmt} onChange={(e) => setCashAmt(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="0.00"
                    className="w-full pl-10 pr-3 py-2 rounded-lg border border-gray-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400" autoFocus /></div></div>
              <div className="flex items-center gap-3"><label className="text-xs font-semibold text-gray-600 w-14">Online</label>
                <p className="flex-1 text-sm font-bold text-gray-700 pl-3">{currency} {onlineVal.toFixed(2)}</p></div>
              {cashVal >= amount && cashAmt !== '' && <p className="text-xs text-red-500 text-center">Cash must be less than total</p>}
              {cashVal <= 0 && cashAmt.length > 0 && <p className="text-xs text-red-500 text-center">Enter a valid amount</p>}
            </div>
          )}
        </div>
        <div className="flex gap-3 p-4 pt-0 pb-6 px-6">
          <button onClick={onCancel} disabled={saving} className="flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors disabled:opacity-50">Cancel</button>
          <button onClick={handleSave} disabled={saving || !splitValid || !hasChanged}
            className="flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50">
            {saving ? <span className="flex items-center justify-center gap-2"><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Saving...</span> : 'Save'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function EditAmountModal({
  transaction, currency, onSuccess, onCancel,
}: { transaction: Transaction; currency: string; onSuccess: () => void; onCancel: () => void; }) {
  const toast = useToast();
  const oldAmount = parseFloat(transaction.amount);
  const [newAmount, setNewAmount] = useState(oldAmount.toString());
  const [method, setMethod] = useState<'cash' | 'online' | 'split'>(transaction.payment_method || 'cash');
  const [cashAmt, setCashAmt] = useState(transaction.cash_amount ? parseFloat(transaction.cash_amount).toString() : '');
  const [saving, setSaving] = useState(false);
  const parsedAmount = parseFloat(newAmount) || 0;
  const cashVal = parseFloat(cashAmt) || 0;
  const onlineVal = method === 'split' ? Math.max(0, parsedAmount - cashVal) : 0;
  const splitValid = method === 'split' ? cashVal > 0 && cashVal < parsedAmount : true;
  const hasChanged = parsedAmount !== oldAmount || method !== (transaction.payment_method || 'cash') ||
    (method === 'split' && cashAmt !== (transaction.cash_amount ? parseFloat(transaction.cash_amount).toString() : ''));

  const handleSave = async () => {
    if (parsedAmount <= 0 || !splitValid) return;
    setSaving(true);
    try {
      const payload: any = { transaction_id: transaction.id, amount: parsedAmount, payment_method: method };
      if (method === 'split') { payload.cash_amount = cashVal; payload.online_amount = parseFloat(onlineVal.toFixed(2)); }
      const { data } = await adminService.editWalkinAmount(payload);
      if (data.success) { toast.success(data.message || 'Amount updated'); onSuccess(); }
      else toast.error(data.message || 'Failed to update');
    } catch { toast.error('Failed to update amount'); } finally { setSaving(false); }
  };

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape' && !saving) onCancel(); };
    document.body.style.overflow = 'hidden'; window.addEventListener('keydown', h);
    return () => { document.body.style.overflow = ''; window.removeEventListener('keydown', h); };
  }, [saving, onCancel]);

  return (
    <motion.div className="fixed inset-0 z-[100] flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <motion.div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !saving && onCancel()} />
      <motion.div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
        initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}>
        <button onClick={() => !saving && onCancel()} className="absolute top-3 right-3 p-1.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100"><X className="w-4 h-4" /></button>
        <div className="p-6 pt-8">
          <div className="text-center mb-5">
            <motion.div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3"
              initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 15, stiffness: 300, delay: 0.1 }}>
              <DollarSign className="w-6 h-6 text-emerald-600" />
            </motion.div>
            <h3 className="text-lg font-bold text-gray-900">Edit Amount</h3>
            <p className="text-sm text-gray-500">Walk-in #{transaction.id} &middot; {transaction.customer_name || 'Walk-in'}</p>
          </div>
          <div className="mb-4">
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Amount ({currency})</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-bold">{currency}</span>
              <input type="text" inputMode="decimal" value={newAmount} onChange={(e) => setNewAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 text-lg font-bold text-center focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400" autoFocus />
            </div>
            {parsedAmount !== oldAmount && parsedAmount > 0 && (
              <p className="text-xs text-gray-400 mt-1 text-center">Was {currency} {oldAmount.toFixed(2)} → Now {currency} {parsedAmount.toFixed(2)}</p>
            )}
          </div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">Payment Method</label>
          <div className="flex rounded-xl border border-gray-200 overflow-hidden mb-4">
            {([{ key: 'cash' as const, label: 'Cash', Icon: Banknote, clr: '#16a34a' }, { key: 'online' as const, label: 'Online', Icon: Smartphone, clr: '#2563eb' }, { key: 'split' as const, label: 'Split', Icon: ArrowLeftRight, clr: '#9333ea' }]).map(({ key, label, Icon, clr }) => (
              <button key={key} onClick={() => { setMethod(key); if (key !== 'split') setCashAmt(''); }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors ${method === key ? 'text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                style={method === key ? { backgroundColor: clr } : {}}><Icon className="w-3.5 h-3.5" />{label}</button>
            ))}
          </div>
          {method === 'split' && (
            <div className="p-3 rounded-xl border border-purple-200 bg-purple-50/50 space-y-2 mb-4">
              <div className="flex items-center gap-3"><label className="text-xs font-semibold text-gray-600 w-14">Cash</label>
                <div className="relative flex-1"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs font-semibold">{currency}</span>
                  <input type="text" inputMode="decimal" value={cashAmt} onChange={(e) => setCashAmt(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="0.00"
                    className="w-full pl-10 pr-3 py-2 rounded-lg border border-gray-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400" /></div></div>
              <div className="flex items-center gap-3"><label className="text-xs font-semibold text-gray-600 w-14">Online</label>
                <p className="flex-1 text-sm font-bold text-gray-700 pl-3">{currency} {onlineVal.toFixed(2)}</p></div>
              {cashVal >= parsedAmount && cashAmt !== '' && <p className="text-xs text-red-500 text-center">Cash must be less than total</p>}
            </div>
          )}
        </div>
        <div className="flex gap-3 p-4 pt-0 pb-6 px-6">
          <button onClick={onCancel} disabled={saving} className="flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors disabled:opacity-50">Cancel</button>
          <button onClick={handleSave} disabled={saving || parsedAmount <= 0 || !splitValid || !hasChanged}
            className="flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors disabled:opacity-50">
            {saving ? <span className="flex items-center justify-center gap-2"><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Saving...</span> : 'Save'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function ReCreateModal({ customerName, onYes, onNo }: { customerName: string; onYes: () => void; onNo: () => void; }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onNo(); };
    document.body.style.overflow = 'hidden'; window.addEventListener('keydown', h);
    return () => { document.body.style.overflow = ''; window.removeEventListener('keydown', h); };
  }, [onNo]);

  return (
    <motion.div className="fixed inset-0 z-[100] flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <motion.div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onNo} />
      <motion.div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
        initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ type: 'spring', damping: 25, stiffness: 300 }}>
        <div className="p-6 pt-8 text-center">
          <motion.div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4"
            initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 15, stiffness: 300, delay: 0.1 }}>
            <RotateCcw className="w-7 h-7 text-green-600" />
          </motion.div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">Void Berjaya!</h3>
          <p className="text-sm text-gray-500 mb-1">Nak buat transaksi baru untuk</p>
          <p className="text-base font-bold text-gray-800 mb-4">{customerName}?</p>
          <p className="text-xs text-gray-400">Customer akan auto-select di halaman Add Token</p>
        </div>
        <div className="flex gap-3 p-4 pt-2 pb-6 px-6">
          <button onClick={onNo} className="flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors">Tidak</button>
          <button onClick={onYes} className="flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold text-white bg-green-600 hover:bg-green-700 transition-colors flex items-center justify-center gap-2">
            Ya, Buat Baru <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

const VOID_REASONS = [
  'Wrong amount',
  'Duplicate entry',
  'Customer request',
  'Entered by mistake',
  'Wrong customer',
  'Wrong service',
];

function VoidModal({ transaction, currency, reason, onReasonChange, loading, onConfirm, onCancel }: {
  transaction: Transaction; currency: string; reason: string; onReasonChange: (v: string) => void;
  loading: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [customMode, setCustomMode] = useState(false);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape' && !loading) onCancel(); };
    document.body.style.overflow = 'hidden'; window.addEventListener('keydown', h);
    return () => { document.body.style.overflow = ''; window.removeEventListener('keydown', h); };
  }, [loading, onCancel]);

  const selectPreset = (r: string) => {
    setSelectedPreset(r);
    setCustomMode(false);
    onReasonChange(r);
  };

  const enableCustom = () => {
    setSelectedPreset(null);
    setCustomMode(true);
    onReasonChange('');
  };

  const hasReason = reason.trim().length > 0;

  return (
    <motion.div className="fixed inset-0 z-[100] flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !loading && onCancel()} />
      <motion.div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}>
        <button onClick={() => !loading && onCancel()} className="absolute top-3 right-3 p-1.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100"><X className="w-4 h-4" /></button>
        <div className="p-6 pt-8 text-center">
          <motion.div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4"
            initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 15, stiffness: 300, delay: 0.1 }}>
            <Ban className="w-7 h-7 text-red-600" />
          </motion.div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">Void Transaction #{transaction.id}</h3>
          <p className="text-sm text-gray-500 mb-1">{transaction.customer_name || 'Walk-in'} &middot; {currency} {parseFloat(transaction.amount).toFixed(2)}</p>
          <p className="text-xs text-gray-400 mb-4">
            {transaction.type === 'loyalty' ? `Loyalty — ${transaction.token_count} token(s) will be reversed` : 'Walk-in sale'}
          </p>

          <p className="text-xs font-semibold text-gray-500 mb-2 text-left">Select reason *</p>
          <div className="flex flex-wrap gap-2 mb-3">
            {VOID_REASONS.map(r => (
              <button key={r} type="button" onClick={() => selectPreset(r)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  selectedPreset === r
                    ? 'bg-red-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>
                {r}
              </button>
            ))}
            <button type="button" onClick={enableCustom}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                customMode
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>
              Other...
            </button>
          </div>

          {customMode && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
              <input type="text" placeholder="Enter custom reason..." value={reason} onChange={(e) => onReasonChange(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400" autoFocus />
            </motion.div>
          )}
        </div>
        <div className="flex gap-3 p-4 pt-2 pb-6 px-6">
          <button onClick={onCancel} disabled={loading} className="flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors disabled:opacity-50">Cancel</button>
          <button onClick={onConfirm} disabled={loading || !hasReason}
            className="flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? <span className="flex items-center justify-center gap-2"><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Voiding...</span> : 'Confirm Void'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
