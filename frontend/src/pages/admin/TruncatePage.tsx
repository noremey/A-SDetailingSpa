import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trash2, AlertTriangle, Database, Users, CreditCard, ShoppingBag,
  Receipt, Gift, Activity, UserPlus, RefreshCw, Check, X, Shield,
  ChevronDown, ChevronUp, Car, Loader2
} from 'lucide-react';
import { adminService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

/* ── Types ── */
interface AffectedTable {
  table: string;
  rows: number;
}

interface TruncateAction {
  label: string;
  description: string;
  affected: AffectedTable[];
  preserved: string[];
}

interface TruncatePreview {
  summary: Record<string, number>;
  actions: Record<string, TruncateAction>;
}

/* ── Table icon map ── */
const tableIcons: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  'users (customers)': { icon: Users, color: 'text-purple-600', bg: 'bg-purple-50' },
  vehicles:            { icon: Car, color: 'text-cyan-600', bg: 'bg-cyan-50' },
  loyalty_cards:       { icon: CreditCard, color: 'text-amber-600', bg: 'bg-amber-50' },
  tokens:              { icon: Database, color: 'text-blue-600', bg: 'bg-blue-50' },
  transactions:        { icon: Receipt, color: 'text-indigo-600', bg: 'bg-indigo-50' },
  walkin_sales:        { icon: ShoppingBag, color: 'text-orange-600', bg: 'bg-orange-50' },
  redemptions:         { icon: Gift, color: 'text-yellow-600', bg: 'bg-yellow-50' },
  activity_log:        { icon: Activity, color: 'text-green-600', bg: 'bg-green-50' },
  staff_invites:       { icon: UserPlus, color: 'text-pink-600', bg: 'bg-pink-50' },
};

const actionStyles: Record<string, { gradient: string; border: string; badge: string }> = {
  truncate_customers:    { gradient: 'from-purple-500 to-indigo-600', border: 'border-purple-200 hover:border-purple-300', badge: 'bg-purple-100 text-purple-700' },
  truncate_transactions: { gradient: 'from-orange-500 to-amber-600', border: 'border-orange-200 hover:border-orange-300', badge: 'bg-orange-100 text-orange-700' },
  truncate_all:          { gradient: 'from-red-500 to-rose-600', border: 'border-red-200 hover:border-red-300', badge: 'bg-red-100 text-red-700' },
};

export default function TruncatePage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';

  const [preview, setPreview] = useState<TruncatePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedAction, setExpandedAction] = useState<string | null>(null);

  // Confirm modal
  const [confirmAction, setConfirmAction] = useState<string | null>(null);
  const [confirmInput, setConfirmInput] = useState('');
  const [truncating, setTruncating] = useState(false);

  // Result
  const [result, setResult] = useState<{ success: boolean; message: string; deleted?: Record<string, number | string> } | null>(null);

  /* ── Load preview ── */
  const loadPreview = async () => {
    setLoading(true);
    try {
      const res = await adminService.getTruncatePreview();
      if (res.data.success) {
        setPreview({ summary: res.data.summary, actions: res.data.actions });
      }
    } catch (err) {
      console.error('Failed to load truncate preview:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPreview(); }, []);

  /* ── Execute truncate ── */
  const handleTruncate = async () => {
    if (!confirmAction || confirmInput !== 'TRUNCATE') return;
    setTruncating(true);
    setResult(null);
    try {
      const res = await adminService.truncateData(confirmAction, confirmInput);
      if (res.data.success) {
        setResult({ success: true, message: res.data.message, deleted: res.data.deleted });
        setConfirmAction(null);
        setConfirmInput('');
        loadPreview(); // Refresh counts
      } else {
        setResult({ success: false, message: res.data.message || 'Truncation failed' });
      }
    } catch (err: any) {
      setResult({ success: false, message: err.response?.data?.message || 'Server error occurred' });
    } finally {
      setTruncating(false);
    }
  };

  /* ── Not super admin ── */
  if (!isSuperAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto">
            <Shield className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-xl font-bold text-gray-800">Access Denied</h2>
          <p className="text-gray-500 text-sm">Only Super Admin can access data truncation tools.</p>
        </div>
      </div>
    );
  }

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 bg-gray-200 rounded-lg animate-pulse" />
        <div className="grid gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
              <div className="h-6 w-48 bg-gray-200 rounded animate-pulse" />
              <div className="h-4 w-full bg-gray-100 rounded animate-pulse" />
              <div className="grid grid-cols-3 gap-3">
                {[1, 2, 3].map(j => <div key={j} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!preview) return null;

  const totalRecords = Object.values(preview.summary).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6 max-w-4xl">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
              <Database className="w-5 h-5 text-red-500" />
            </div>
            Data Management
          </h1>
          <p className="text-sm text-gray-500 mt-1">Truncate tables and reset data. This action is irreversible.</p>
        </div>
        <button
          onClick={loadPreview}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* ── Database Overview ── */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Database Overview</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {[
            { label: 'Customers', value: preview.summary.total_customers, icon: Users, color: 'text-purple-600', bg: 'bg-purple-50' },
            { label: 'Vehicles', value: preview.summary.total_vehicles, icon: Car, color: 'text-cyan-600', bg: 'bg-cyan-50' },
            { label: 'Cards', value: preview.summary.total_loyalty_cards, icon: CreditCard, color: 'text-amber-600', bg: 'bg-amber-50' },
            { label: 'Tokens', value: preview.summary.total_tokens, icon: Database, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Transactions', value: preview.summary.total_transactions, icon: Receipt, color: 'text-indigo-600', bg: 'bg-indigo-50' },
            { label: 'Walk-in', value: preview.summary.total_walkin_sales, icon: ShoppingBag, color: 'text-orange-600', bg: 'bg-orange-50' },
            { label: 'Redemptions', value: preview.summary.total_redemptions, icon: Gift, color: 'text-yellow-600', bg: 'bg-yellow-50' },
            { label: 'Activity', value: preview.summary.total_activity_log, icon: Activity, color: 'text-green-600', bg: 'bg-green-50' },
            { label: 'Staff', value: preview.summary.total_staff, icon: Shield, color: 'text-pink-600', bg: 'bg-pink-50' },
            { label: 'Total', value: totalRecords, icon: Database, color: 'text-gray-600', bg: 'bg-gray-100' },
          ].map(item => (
            <div key={item.label} className={`rounded-xl p-3 ${item.bg} text-center`}>
              <item.icon className={`w-5 h-5 mx-auto mb-1 ${item.color}`} />
              <div className={`text-lg font-bold ${item.color}`}>{item.value.toLocaleString()}</div>
              <div className="text-xs text-gray-500 font-medium">{item.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Success/Error Result ── */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`rounded-2xl border p-5 ${
              result.success
                ? 'bg-green-50 border-green-200'
                : 'bg-red-50 border-red-200'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                result.success ? 'bg-green-100' : 'bg-red-100'
              }`}>
                {result.success ? <Check className="w-4 h-4 text-green-600" /> : <X className="w-4 h-4 text-red-600" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`font-semibold text-sm ${result.success ? 'text-green-800' : 'text-red-800'}`}>
                  {result.success ? 'Truncation Complete' : 'Truncation Failed'}
                </p>
                <p className={`text-sm mt-0.5 ${result.success ? 'text-green-600' : 'text-red-600'}`}>{result.message}</p>
                {result.deleted && (
                  <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {Object.entries(result.deleted).map(([table, count]) => (
                      <div key={table} className="bg-white/60 rounded-lg px-3 py-2 text-xs">
                        <span className="font-medium text-gray-700">{table}:</span>{' '}
                        <span className="font-bold text-green-700">{typeof count === 'number' ? `${count} deleted` : count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button onClick={() => setResult(null)} className="p-1 hover:bg-white/50 rounded-lg">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Truncate Actions ── */}
      <div className="space-y-4">
        {Object.entries(preview.actions).map(([actionKey, action]) => {
          const style = actionStyles[actionKey];
          const isExpanded = expandedAction === actionKey;
          const totalAffected = action.affected.reduce((a, b) => a + b.rows, 0);
          const isDanger = actionKey === 'truncate_all';

          return (
            <motion.div
              key={actionKey}
              layout
              className={`bg-white rounded-2xl border ${style.border} overflow-hidden transition-colors`}
            >
              {/* Action Header */}
              <button
                onClick={() => setExpandedAction(isExpanded ? null : actionKey)}
                className="w-full flex items-center gap-4 p-5 text-left hover:bg-gray-50/50 transition-colors"
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${style.gradient} flex items-center justify-center shrink-0 shadow-sm`}>
                  <Trash2 className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h3 className="font-bold text-gray-900">{action.label}</h3>
                    {isDanger && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-bold uppercase">
                        <AlertTriangle className="w-3 h-3" />
                        Danger
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 line-clamp-1">{action.description}</p>
                </div>
                <div className="text-right shrink-0">
                  <div className={`text-xs font-bold px-3 py-1 rounded-full ${style.badge}`}>
                    {totalAffected.toLocaleString()} rows
                  </div>
                </div>
                <div className="text-gray-400">
                  {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </div>
              </button>

              {/* Expanded Details */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 pb-5 space-y-4 border-t border-gray-100 pt-4">
                      {/* Affected tables */}
                      <div>
                        <h4 className="text-xs font-bold text-red-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <Trash2 className="w-3.5 h-3.5" />
                          Will be DELETED
                        </h4>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {action.affected.map(item => {
                            const tIcon = tableIcons[item.table] || { icon: Database, color: 'text-gray-600', bg: 'bg-gray-50' };
                            return (
                              <div key={item.table} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl ${tIcon.bg}`}>
                                <tIcon.icon className={`w-4 h-4 ${tIcon.color} shrink-0`} />
                                <div className="min-w-0">
                                  <div className="text-xs font-semibold text-gray-700 truncate">{item.table}</div>
                                  <div className={`text-xs font-bold ${tIcon.color}`}>{item.rows.toLocaleString()} rows</div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Preserved */}
                      <div>
                        <h4 className="text-xs font-bold text-green-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <Shield className="w-3.5 h-3.5" />
                          Will be PRESERVED
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {action.preserved.map(item => (
                            <span key={item} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 text-xs font-medium rounded-lg">
                              <Check className="w-3 h-3" />
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Truncate Button */}
                      <div className="pt-2">
                        <button
                          onClick={() => { setConfirmAction(actionKey); setConfirmInput(''); setResult(null); }}
                          disabled={totalAffected === 0}
                          className={`
                            w-full py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2
                            ${totalAffected === 0
                              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                              : isDanger
                                ? 'bg-gradient-to-r from-red-500 to-rose-600 text-white hover:from-red-600 hover:to-rose-700 shadow-sm hover:shadow-md'
                                : `bg-gradient-to-r ${style.gradient} text-white hover:shadow-md shadow-sm`
                            }
                          `}
                        >
                          <Trash2 className="w-4 h-4" />
                          {totalAffected === 0 ? 'No Data to Truncate' : `Truncate ${totalAffected.toLocaleString()} Rows`}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {/* ── Relationship Diagram ── */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Table Relationships</h3>
        <div className="bg-gray-50 rounded-xl p-4 font-mono text-xs text-gray-600 leading-relaxed overflow-x-auto">
          <pre>{`users (customers)
  ├── vehicles          (1 customer → many vehicles)
  ├── loyalty_cards     (1 customer → many cards)
  │     ├── tokens      (1 card → many tokens)
  │     └── redemptions (1 card → 1 redemption)
  └── transactions      (1 customer → many transactions)

walkin_sales            (independent, linked to staff only)
activity_log            (audit trail, linked to all users)
settings                (key-value config, never deleted)
staff_invites           (invitation codes)`}</pre>
        </div>
      </div>

      {/* ═══════ Confirmation Modal ═══════ */}
      <AnimatePresence>
        {confirmAction && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => { if (!truncating) { setConfirmAction(null); setConfirmInput(''); } }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-red-500 to-rose-600 p-5 text-white">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Confirm Truncation</h3>
                    <p className="text-sm text-red-100">{preview.actions[confirmAction]?.label}</p>
                  </div>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-5 space-y-4">
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-red-800">This action is IRREVERSIBLE!</p>
                      <p className="text-xs text-red-600 mt-1">
                        All affected data will be permanently deleted. Make sure you have a backup before proceeding.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Affected summary */}
                <div className="space-y-1.5">
                  <p className="text-xs font-bold text-gray-500 uppercase">Tables to be truncated:</p>
                  {preview.actions[confirmAction]?.affected.map(item => (
                    <div key={item.table} className="flex items-center justify-between text-sm py-1 px-2 rounded-lg hover:bg-gray-50">
                      <span className="text-gray-600">{item.table}</span>
                      <span className="font-bold text-red-600">{item.rows.toLocaleString()} rows</span>
                    </div>
                  ))}
                </div>

                {/* Confirmation input */}
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1.5">
                    Type <span className="font-mono bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs font-bold">TRUNCATE</span> to confirm:
                  </label>
                  <input
                    type="text"
                    value={confirmInput}
                    onChange={e => setConfirmInput(e.target.value)}
                    placeholder="Type TRUNCATE here..."
                    disabled={truncating}
                    autoFocus
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm font-mono font-bold text-center tracking-widest focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 transition-all disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-5 pb-5 flex gap-3">
                <button
                  onClick={() => { setConfirmAction(null); setConfirmInput(''); }}
                  disabled={truncating}
                  className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-medium text-sm hover:bg-gray-200 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleTruncate}
                  disabled={confirmInput !== 'TRUNCATE' || truncating}
                  className={`
                    flex-1 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all
                    ${confirmInput === 'TRUNCATE' && !truncating
                      ? 'bg-gradient-to-r from-red-500 to-rose-600 text-white hover:from-red-600 hover:to-rose-700 shadow-sm'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }
                  `}
                >
                  {truncating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Truncating...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      Confirm Truncate
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
