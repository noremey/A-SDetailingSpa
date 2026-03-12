import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, Plus, Trash2, Clock, TrendingUp, Hash, Calendar, Receipt, Banknote, Smartphone, ArrowLeftRight, Printer } from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';
import { useAuth } from '../../context/AuthContext';
import { adminService } from '../../services/api';
import { useToast } from '../../components/ui/Toast';
import ConfirmModal from '../../components/ui/ConfirmModal';
import ReceiptModal, { type ReceiptData } from '../../components/ui/ReceiptModal';
import type { WalkInSale } from '../../types';

export default function WalkInSalesPage() {
  const { settings } = useSettings();
  const { user } = useAuth();
  const toast = useToast();
  const isSuperAdmin = user?.role === 'super_admin';
  const amountInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [amount, setAmount] = useState('');
  const [displayAmount, setDisplayAmount] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'online' | 'split'>('cash');
  const [cashAmount, setCashAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Data state
  const [sales, setSales] = useState<WalkInSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [todayTotal, setTodayTotal] = useState(0);
  const [todayCount, setTodayCount] = useState(0);
  const [weekTotal, setWeekTotal] = useState(0);
  const [monthTotal, setMonthTotal] = useState(0);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<WalkInSale | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Receipt
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);

  const accent = settings.primary_color || '#6366f1';

  // Currency formatting
  const formatCurrency = (value: number | string) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '0.00';
    return num.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/,/g, '');
    if (raw === '' || /^\d*\.?\d{0,2}$/.test(raw)) {
      setAmount(raw);
      setDisplayAmount(raw);
    }
  };

  const handleAmountBlur = () => {
    if (amount && parseFloat(amount) > 0) {
      setDisplayAmount(formatCurrency(amount));
    }
  };

  const handleAmountFocus = () => {
    setDisplayAmount(amount);
  };

  // Load today's data
  const loadData = useCallback(async () => {
    try {
      const { data } = await adminService.getWalkInSalesToday();
      if (data.success) {
        setSales(data.sales || []);
        setTodayTotal(data.today_total || 0);
        setTodayCount(data.today_count || 0);
        setWeekTotal(data.week_total || 0);
        setMonthTotal(data.month_total || 0);
      }
    } catch {
      toast.error('Failed to load sales data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-focus amount input on load
  useEffect(() => {
    if (!loading) {
      setTimeout(() => amountInputRef.current?.focus(), 100);
    }
  }, [loading]);

  // Handle add sale
  const handleAdd = async () => {
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      toast.error('Enter a valid amount');
      amountInputRef.current?.focus();
      return;
    }
    // Validate split
    const parsedCash = parseFloat(cashAmount) || 0;
    const onlineAmt = paymentMethod === 'split' ? Math.max(0, parsedAmount - parsedCash) : 0;
    if (paymentMethod === 'split' && (parsedCash <= 0 || parsedCash >= parsedAmount)) {
      toast.error('Split: cash amount must be between 0 and total');
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        amount: parsedAmount,
        customer_name: customerName.trim() || undefined,
        notes: notes.trim() || undefined,
        payment_method: paymentMethod,
      };
      if (paymentMethod === 'split') {
        payload.cash_amount = parsedCash;
        payload.online_amount = parseFloat(onlineAmt.toFixed(2));
      }
      const { data } = await adminService.addWalkInSale(payload);
      if (data.success) {
        // Capture receipt data before form reset
        setReceiptData({
          id: data.sale?.id || data.id || Date.now(),
          type: 'walkin',
          created_at: data.sale?.created_at || new Date().toISOString(),
          amount: parsedAmount,
          payment_method: paymentMethod,
          cash_amount: paymentMethod === 'split' ? parsedCash : paymentMethod === 'cash' ? parsedAmount : null,
          online_amount: paymentMethod === 'split' ? onlineAmt : paymentMethod === 'online' ? parsedAmount : null,
          customer_name: customerName.trim() || null,
          staff_name: user?.name || null,
          notes: notes.trim() || null,
        });
        toast.success(`${settings.currency_symbol}${formatCurrency(parsedAmount)} recorded`);
        await loadData();
        setAmount('');
        setDisplayAmount('');
        setCustomerName('');
        setNotes('');
        setPaymentMethod('cash');
        setCashAmount('');
        setTimeout(() => amountInputRef.current?.focus(), 50);
      } else {
        toast.error(data.message || 'Failed to record sale');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to record sale');
    } finally {
      setSubmitting(false);
    }
  };

  // Enter key to submit
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !submitting) {
      e.preventDefault();
      handleAdd();
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { data } = await adminService.deleteWalkInSale(deleteTarget.id);
      if (data.success) {
        toast.success('Sale deleted');
        // Refresh all cards (today, week, month)
        await loadData();
      } else {
        toast.error(data.message || 'Failed to delete');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete');
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('en-MY', {
      hour: '2-digit', minute: '2-digit', hour12: true,
    });
  };

  // Open receipt for existing sale
  const openReceipt = (sale: WalkInSale) => {
    setReceiptData({
      id: sale.id,
      type: 'walkin',
      created_at: sale.created_at,
      amount: typeof sale.amount === 'string' ? parseFloat(sale.amount) : sale.amount,
      payment_method: sale.payment_method,
      cash_amount: sale.cash_amount != null ? (typeof sale.cash_amount === 'string' ? parseFloat(sale.cash_amount) : sale.cash_amount) : null,
      online_amount: sale.online_amount != null ? (typeof sale.online_amount === 'string' ? parseFloat(sale.online_amount) : sale.online_amount) : null,
      customer_name: sale.customer_name || null,
      staff_name: sale.added_by_name || null,
      notes: sale.notes || null,
    });
  };

  const parsedAmount = parseFloat(amount) || 0;

  // Loading skeleton
  if (loading) {
    return (
      <div className="pb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-5 flex items-center gap-2.5">
          <ShoppingBag className="w-7 h-7" style={{ color: accent }} />
          Walk-in Sales
        </h1>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 animate-pulse h-28" />
          ))}
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 animate-pulse h-24 mb-5" />
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 animate-pulse h-64" />
      </div>
    );
  }

  return (
    <div className="pb-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-5 flex items-center gap-2.5">
        <ShoppingBag className="w-7 h-7" style={{ color: accent }} />
        Walk-in Sales
      </h1>

      {/* ===== Summary Cards ===== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        {/* Today's Revenue */}
        <motion.div
          className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100"
          initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0 }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 bg-green-500 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {settings.currency_symbol}{formatCurrency(todayTotal)}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">Today's Revenue</p>
        </motion.div>

        {/* Sales Count */}
        <motion.div
          className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100"
          initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.05 }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center">
              <Hash className="w-5 h-5 text-white" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{todayCount}</p>
          <p className="text-xs text-gray-500 mt-0.5">Sales Today</p>
        </motion.div>

        {/* This Week */}
        <motion.div
          className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100"
          initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 bg-purple-500 rounded-xl flex items-center justify-center">
              <Calendar className="w-5 h-5 text-white" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {settings.currency_symbol}{formatCurrency(weekTotal)}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">This Week</p>
        </motion.div>

        {/* This Month */}
        <motion.div
          className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100"
          initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center">
              <Receipt className="w-5 h-5 text-white" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {settings.currency_symbol}{formatCurrency(monthTotal)}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">This Month</p>
        </motion.div>
      </div>

      {/* ===== Quick Entry Form ===== */}
      <motion.div
        className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-5"
        initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}
      >
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2 text-sm">
          <Plus className="w-4 h-4" style={{ color: accent }} />
          Quick Sale Entry
        </h2>

        {/* Row 1: Amount + Name + Notes + Add */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 sm:max-w-[220px]">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-base pointer-events-none">
              {settings.currency_symbol}
            </span>
            <input
              ref={amountInputRef}
              type="text"
              inputMode="decimal"
              value={displayAmount}
              onChange={handleAmountChange}
              onBlur={handleAmountBlur}
              onFocus={handleAmountFocus}
              onKeyDown={handleKeyDown}
              placeholder="0.00"
              autoComplete="off"
              className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-gray-200 text-lg font-bold
                         focus:outline-none focus:ring-2 focus:border-transparent transition-all
                         placeholder:text-gray-300 placeholder:font-normal"
              style={{ '--tw-ring-color': accent } as any}
            />
          </div>

          <div className="flex-1 sm:max-w-[200px]">
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Name (optional)"
              autoComplete="off"
              className="w-full px-4 py-3.5 rounded-xl border border-gray-200 text-sm
                         focus:outline-none focus:ring-2 focus:border-transparent transition-all
                         placeholder:text-gray-400"
              style={{ '--tw-ring-color': accent } as any}
            />
          </div>

          <div className="flex-1">
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Notes (optional) e.g., Set A, Combo meal..."
              autoComplete="off"
              className="w-full px-4 py-3.5 rounded-xl border border-gray-200 text-sm
                         focus:outline-none focus:ring-2 focus:border-transparent transition-all
                         placeholder:text-gray-400"
              style={{ '--tw-ring-color': accent } as any}
            />
          </div>

          <motion.button
            onClick={handleAdd}
            disabled={submitting || parsedAmount <= 0}
            whileTap={{ scale: 0.97 }}
            className="px-7 py-3.5 rounded-xl font-semibold text-white shrink-0 transition-all
                       disabled:opacity-40 flex items-center justify-center gap-2
                       shadow-lg hover:shadow-xl"
            style={{ backgroundColor: accent }}
          >
            {submitting ? (
              <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <Plus className="w-5 h-5" />
            )}
            <span className="hidden sm:inline">{submitting ? 'Adding...' : 'Add Sale'}</span>
          </motion.button>
        </div>

        {/* Row 2: Payment Method */}
        <div className="flex items-center gap-3 mt-3">
          <span className="text-xs font-medium text-gray-500">Payment:</span>
          <div className="flex gap-1.5 bg-gray-100 rounded-xl p-1">
            {([
              { key: 'cash' as const, label: 'Cash', Icon: Banknote },
              { key: 'online' as const, label: 'Online', Icon: Smartphone },
              { key: 'split' as const, label: 'Split', Icon: ArrowLeftRight },
            ]).map(({ key, label, Icon }) => (
              <button
                key={key}
                onClick={() => { setPaymentMethod(key); if (key !== 'split') setCashAmount(''); }}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                  paymentMethod === key
                    ? 'bg-white shadow-sm text-gray-900'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>

          {/* Split inputs */}
          {paymentMethod === 'split' && parsedAmount > 0 && (
            <div className="flex items-center gap-2 ml-2">
              <div className="flex items-center gap-1.5">
                <Banknote className="w-3.5 h-3.5 text-green-600" />
                <input
                  type="text"
                  inputMode="decimal"
                  value={cashAmount}
                  onChange={(e) => setCashAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                  placeholder="Cash"
                  className="w-24 px-3 py-2 rounded-lg border border-gray-200 text-sm font-semibold
                             focus:outline-none focus:ring-2 focus:border-transparent"
                  style={{ '--tw-ring-color': accent } as any}
                />
              </div>
              <span className="text-gray-300">+</span>
              <div className="flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-blue-600" />
                <span className="text-sm font-semibold text-gray-600 w-24">
                  {settings.currency_symbol}{(Math.max(0, parsedAmount - (parseFloat(cashAmount) || 0))).toFixed(2)}
                </span>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* ===== Today's Sales List ===== */}
      <motion.div
        className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
        initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.25 }}
      >
        <div className="px-5 py-4 bg-gray-50/80 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4" style={{ color: accent }} />
            <span className="text-sm font-semibold text-gray-700">Today's Sales</span>
          </div>
          <span className="text-xs text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full font-medium">
            {todayCount} {todayCount === 1 ? 'entry' : 'entries'}
          </span>
        </div>

        {sales.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <ShoppingBag className="w-14 h-14 mx-auto text-gray-200 mb-3" />
            <p className="text-gray-400 font-medium">No walk-in sales today</p>
            <p className="text-xs text-gray-300 mt-1">Start recording sales using the form above</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            <AnimatePresence>
              {sales.map((sale, i) => (
                <motion.div
                  key={sale.id}
                  className="flex items-center gap-3 px-5 py-3.5 hover:bg-blue-50/30 transition-colors group"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, height: 0, padding: 0 }}
                  transition={{ delay: i * 0.02 }}
                >
                  {/* Index number */}
                  <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                       style={{ backgroundColor: accent + '15' }}>
                    <span className="text-xs font-bold" style={{ color: accent }}>
                      {sales.length - i}
                    </span>
                  </div>

                  {/* Sale details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-gray-900">
                        {settings.currency_symbol}{formatCurrency(sale.amount)}
                      </p>
                      {/* Payment method badge */}
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                        sale.payment_method === 'online' ? 'bg-blue-50 text-blue-600' :
                        sale.payment_method === 'split' ? 'bg-purple-50 text-purple-600' :
                        'bg-green-50 text-green-600'
                      }`}>
                        {sale.payment_method === 'online' ? '📱 Online' :
                         sale.payment_method === 'split' ? '🔀 Split' : '💵 Cash'}
                      </span>
                      {sale.customer_name && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 truncate max-w-[140px]">
                          {sale.customer_name}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {sale.payment_method === 'split' && sale.cash_amount && (
                        <span className="text-[10px] text-gray-400">
                          Cash {settings.currency_symbol}{formatCurrency(sale.cash_amount ?? 0)} + Online {settings.currency_symbol}{formatCurrency(sale.online_amount ?? 0)}
                        </span>
                      )}
                      {sale.notes && (
                        <p className="text-xs text-gray-500 truncate">{sale.notes}</p>
                      )}
                    </div>
                  </div>

                  {/* Time + admin + delete */}
                  <div className="flex items-center gap-3 shrink-0">
                    {sale.added_by_name && (
                      <span className="text-[10px] text-gray-400 hidden sm:inline">{sale.added_by_name}</span>
                    )}
                    <span className="text-xs text-gray-400 font-mono">{formatTime(sale.created_at)}</span>
                    <button
                      onClick={() => openReceipt(sale)}
                      className="p-1.5 rounded-lg text-gray-300 hover:text-blue-600 hover:bg-blue-50 transition-all
                                 opacity-0 group-hover:opacity-100"
                      title="Print Receipt"
                    >
                      <Printer className="w-3.5 h-3.5" />
                    </button>
                    {isSuperAdmin && (
                      <button
                        onClick={() => setDeleteTarget(sale)}
                        className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all
                                   opacity-0 group-hover:opacity-100"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Total bar at bottom */}
        {sales.length > 0 && (
          <div className="px-5 py-3 bg-gray-50/80 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500">Total</span>
            <span className="text-sm font-bold" style={{ color: accent }}>
              {settings.currency_symbol}{formatCurrency(todayTotal)}
            </span>
          </div>
        )}
      </motion.div>

      {/* Delete Confirm Modal */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        title="Delete Sale Entry"
        message={`Delete walk-in sale of ${settings.currency_symbol}${deleteTarget ? formatCurrency(deleteTarget.amount) : '0.00'}${deleteTarget?.customer_name ? ` - ${deleteTarget.customer_name}` : ''}${deleteTarget?.notes ? ` (${deleteTarget.notes})` : ''}?`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        loading={deleting}
      />

      {/* Receipt Modal */}
      <ReceiptModal
        isOpen={!!receiptData}
        onClose={() => setReceiptData(null)}
        data={receiptData}
      />
    </div>
  );
}
