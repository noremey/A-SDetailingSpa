import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileBarChart, Calendar, ChevronDown, Coins, TrendingUp, Users, Gift, ShoppingBag, CreditCard, Eye, X, Clock, User, CreditCard as CardIcon, Wallet } from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';
import { adminService } from '../../services/api';

type ViewType = 'day' | 'month' | 'year';

interface ReportRow {
  period: number | string;
  label: string;
  total_tokens: number;
  total_revenue: number;
  member_revenue?: number;
  walkin_revenue?: number;
  walkin_count?: number;
  unique_customers: number;
  total_redemptions: number;
  new_customers?: number;
}

interface ReportTotals {
  total_tokens: number;
  total_revenue: number;
  total_redemptions: number;
  new_customers?: number;
  unique_customers?: number;
  walkin_revenue?: number;
  walkin_count?: number;
}

interface Transaction {
  id: number;
  amount: number;
  created_at: string;
  customer_name: string;
  customer_phone: string;
  staff_name: string;
  type: 'loyalty' | 'walkin';
}

interface DetailSummary {
  total_count: number;
  total_revenue: number;
  loyalty_count: number;
  loyalty_revenue: number;
  walkin_count: number;
  walkin_revenue: number;
}

interface DetailData {
  period_label: string;
  view: string;
  transactions: Transaction[];
  summary: DetailSummary;
}

const monthOptions = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 12 }, (_, i) => currentYear + i);

export default function ReportPage() {
  const { settings } = useSettings();
  const [view, setView] = useState<ViewType>('day');
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [totals, setTotals] = useState<ReportTotals | null>(null);
  const [loading, setLoading] = useState(true);

  const [showYearPicker, setShowYearPicker] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);

  // Detail modal state
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailData, setDetailData] = useState<DetailData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailLabel, setDetailLabel] = useState('');

  const fetchReport = async () => {
    setLoading(true);
    try {
      const { data } = await adminService.getReport(view, year, month);
      if (data.success) {
        setRows(data.rows || []);
        setTotals(data.totals || null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [view, year, month]);

  const handleViewDetail = async (row: ReportRow) => {
    setDetailLabel(row.label);
    setDetailVisible(true);
    setDetailLoading(true);
    setDetailData(null);
    try {
      let dayParam: number | undefined;
      let monthParam = month;
      let yearParam = year;
      if (view === 'day') {
        dayParam = row.period as number;
      } else if (view === 'month') {
        monthParam = row.period as number;
      } else if (view === 'year') {
        yearParam = parseInt(String(row.period));
      }
      const { data } = await adminService.getTransactionDetails(view, yearParam, monthParam, dayParam);
      if (data.success) {
        setDetailData(data);
      }
    } catch (err) {
      console.error('Detail fetch error:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const formatDateTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getDate()} ${monthOptions[d.getMonth()]?.label?.substring(0, 3)} ${d.toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit', hour12: true })}`;
  };

  const viewTabs: { key: ViewType; label: string }[] = [
    { key: 'day', label: 'Daily' },
    { key: 'month', label: 'Monthly' },
    { key: 'year', label: 'Yearly' },
  ];

  const formatCurrency = (amount: number) => {
    return settings.currency_symbol + amount.toLocaleString('en-MY', { minimumFractionDigits: 2 });
  };

  // Find the max revenue for row highlighting
  const maxRevenue = rows.length > 0 ? Math.max(...rows.map(r => r.total_revenue)) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <FileBarChart className="w-6 h-6" style={{ color: settings.primary_color }} />
          Report
        </h1>
      </div>

      {/* View Tabs + Filters */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          {/* View tabs */}
          <div className="flex bg-gray-100 rounded-xl p-1 shrink-0">
            {viewTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setView(tab.key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  view === tab.key
                    ? 'bg-white shadow-sm text-gray-900'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
                style={view === tab.key ? { color: settings.primary_color } : {}}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex gap-2 flex-1 justify-end flex-wrap">
            {/* Year picker */}
            {(view === 'day' || view === 'month') && (
              <div className="relative">
                <button
                  onClick={() => { setShowYearPicker(!showYearPicker); setShowMonthPicker(false); }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Calendar className="w-4 h-4 text-gray-400" />
                  {year}
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showYearPicker ? 'rotate-180' : ''}`} />
                </button>
                {showYearPicker && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowYearPicker(false)} />
                    <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-20 w-28 max-h-52 overflow-y-auto">
                      {years.map((y) => (
                        <button
                          key={y}
                          onClick={() => { setYear(y); setShowYearPicker(false); }}
                          className={`w-full px-3 py-1.5 text-sm text-left hover:bg-gray-50 transition-colors ${
                            y === year ? 'font-bold' : 'text-gray-600'
                          }`}
                          style={y === year ? { color: settings.primary_color } : {}}
                        >
                          {y}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Month picker (only for day view) */}
            {view === 'day' && (
              <div className="relative">
                <button
                  onClick={() => { setShowMonthPicker(!showMonthPicker); setShowYearPicker(false); }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  {monthOptions.find(m => m.value === month)?.label}
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showMonthPicker ? 'rotate-180' : ''}`} />
                </button>
                {showMonthPicker && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowMonthPicker(false)} />
                    <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-20 w-36 max-h-52 overflow-y-auto">
                      {monthOptions.map((m) => (
                        <button
                          key={m.value}
                          onClick={() => { setMonth(m.value); setShowMonthPicker(false); }}
                          className={`w-full px-3 py-1.5 text-sm text-left hover:bg-gray-50 transition-colors ${
                            m.value === month ? 'font-bold' : 'text-gray-600'
                          }`}
                          style={m.value === month ? { color: settings.primary_color } : {}}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      {totals && !loading && (() => {
        // Build sparkline data from rows (last N periods with data)
        const sparkData = rows.filter(r => r.total_revenue > 0 || r.total_tokens > 0 || r.total_redemptions > 0 || (r.walkin_revenue ?? 0) > 0);
        const lastN = sparkData.slice(-8); // Last 8 periods
        const maxRev = Math.max(...lastN.map(r => r.total_revenue), 1);
        const maxTok = Math.max(...lastN.map(r => r.total_tokens), 1);
        const maxRed = Math.max(...lastN.map(r => r.total_redemptions), 1);
        const maxCust = Math.max(...lastN.map(r => r.new_customers ?? 0), 1);
        const maxWalkin = Math.max(...lastN.map(r => r.walkin_revenue ?? 0), 1);
        const hasWalkinData = (totals.walkin_revenue ?? 0) > 0;

        const MiniChart = ({ data, maxVal, color }: { data: number[]; maxVal: number; color: string }) => (
          <div className="flex items-end gap-[3px] h-8">
            {data.map((val, i) => (
              <div
                key={i}
                className="w-[5px] rounded-full transition-all"
                style={{
                  height: `${Math.max(8, (val / maxVal) * 100)}%`,
                  backgroundColor: val > 0 ? color : '#e5e7eb',
                  opacity: val > 0 ? 0.4 + (i / data.length) * 0.6 : 0.3,
                }}
              />
            ))}
          </div>
        );

        return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <motion.div
            className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100"
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0 }}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-white" />
              </div>
              <span className="text-xs text-gray-500">Revenue</span>
            </div>
            <div className="flex items-end justify-between gap-2">
              <div>
                <p className="text-lg font-bold text-gray-900">{formatCurrency(totals.total_revenue)}</p>
                {hasWalkinData && (
                  <p className="text-[10px] text-blue-600 font-medium mt-0.5">
                    incl. {formatCurrency(totals.walkin_revenue ?? 0)} walk-in
                  </p>
                )}
              </div>
              {lastN.length > 1 && (
                <MiniChart data={lastN.map(r => r.total_revenue)} maxVal={maxRev} color="#22c55e" />
              )}
            </div>
          </motion.div>

          {hasWalkinData && (
            <motion.div
              className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100"
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.05 }}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center">
                  <ShoppingBag className="w-4 h-4 text-white" />
                </div>
                <span className="text-xs text-gray-500">Walk-in Sales</span>
              </div>
              <div className="flex items-end justify-between gap-2">
                <div>
                  <p className="text-lg font-bold text-gray-900">{formatCurrency(totals.walkin_revenue ?? 0)}</p>
                  <p className="text-[10px] text-gray-500 font-medium mt-0.5">
                    {(totals.walkin_count ?? 0).toLocaleString()} sales
                  </p>
                </div>
                {lastN.length > 1 && (
                  <MiniChart data={lastN.map(r => r.walkin_revenue ?? 0)} maxVal={maxWalkin} color="#a855f7" />
                )}
              </div>
            </motion.div>
          )}

          <motion.div
            className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100"
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.07 }}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-cyan-500 rounded-lg flex items-center justify-center">
                <CreditCard className="w-4 h-4 text-white" />
              </div>
              <span className="text-xs text-gray-500">Pay (Card)</span>
            </div>
            <div className="flex items-end justify-between gap-2">
              <div>
                <p className="text-lg font-bold text-gray-900">{formatCurrency(totals.total_revenue - (totals.walkin_revenue ?? 0))}</p>
                <p className="text-[10px] text-gray-500 font-medium mt-0.5">
                  loyalty card payments
                </p>
              </div>
              {lastN.length > 1 && (
                <MiniChart data={lastN.map(r => r.member_revenue ?? 0)} maxVal={Math.max(...lastN.map(r => r.member_revenue ?? 0), 1)} color="#06b6d4" />
              )}
            </div>
          </motion.div>

          <motion.div
            className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100"
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                <Coins className="w-4 h-4 text-white" />
              </div>
              <span className="text-xs text-gray-500">Tokens</span>
            </div>
            <div className="flex items-end justify-between gap-2">
              <p className="text-lg font-bold text-gray-900">{totals.total_tokens.toLocaleString()}</p>
              {lastN.length > 1 && (
                <MiniChart data={lastN.map(r => r.total_tokens)} maxVal={maxTok} color="#3b82f6" />
              )}
            </div>
          </motion.div>

          <motion.div
            className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100"
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-yellow-500 rounded-lg flex items-center justify-center">
                <Gift className="w-4 h-4 text-white" />
              </div>
              <span className="text-xs text-gray-500">Redeemed</span>
            </div>
            <div className="flex items-end justify-between gap-2">
              <p className="text-lg font-bold text-gray-900">{totals.total_redemptions.toLocaleString()}</p>
              {lastN.length > 1 && (
                <MiniChart data={lastN.map(r => r.total_redemptions)} maxVal={maxRed} color="#eab308" />
              )}
            </div>
          </motion.div>

          {totals.new_customers !== undefined && (
            <motion.div
              className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100"
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.15 }}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center">
                  <Users className="w-4 h-4 text-white" />
                </div>
                <span className="text-xs text-gray-500">New Customers</span>
              </div>
              <div className="flex items-end justify-between gap-2">
                <p className="text-lg font-bold text-gray-900">{totals.new_customers.toLocaleString()}</p>
                {lastN.length > 1 && (
                  <MiniChart data={lastN.map(r => r.new_customers ?? 0)} maxVal={maxCust} color="#6366f1" />
                )}
              </div>
            </motion.div>
          )}
        </div>
        );
      })()}

      {/* Data Table */}
      <motion.div
        className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider">
                    {view === 'day' ? 'Date' : view === 'month' ? 'Month' : 'Year'}
                  </th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider">
                    Revenue
                  </th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider">
                    Walk-in
                  </th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider">
                    Pay (Card)
                  </th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider">
                    Tokens
                  </th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider hidden sm:table-cell">
                    Customers
                  </th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider hidden sm:table-cell">
                    Redeemed
                  </th>
                  {(view === 'month' || view === 'year') && (
                    <th className="text-right px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider hidden md:table-cell">
                      New Cust.
                    </th>
                  )}
                  <th className="text-center px-3 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider w-20">
                    Detail
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map((row, i) => {
                  const hasData = row.total_tokens > 0 || row.total_revenue > 0 || (row.walkin_revenue ?? 0) > 0;
                  const isTopRevenue = maxRevenue > 0 && row.total_revenue === maxRevenue;
                  return (
                    <tr
                      key={i}
                      className={`transition-colors ${
                        hasData
                          ? 'hover:bg-gray-50/80'
                          : 'opacity-50'
                      } ${isTopRevenue ? 'bg-green-50/50' : ''}`}
                    >
                      <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {isTopRevenue && (
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                          )}
                          {row.label}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-medium whitespace-nowrap">
                        {row.total_revenue > 0 ? (
                          <span className="text-green-600">{formatCurrency(row.total_revenue)}</span>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {(row.walkin_revenue ?? 0) > 0 ? (
                          <div>
                            <span className="text-purple-600 font-medium">{formatCurrency(row.walkin_revenue ?? 0)}</span>
                            <span className="text-[10px] text-gray-400 ml-1">({row.walkin_count})</span>
                          </div>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {(row.member_revenue ?? 0) > 0 ? (
                          <span className="text-cyan-600 font-medium">{formatCurrency(row.member_revenue ?? 0)}</span>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {row.total_tokens > 0 ? (
                          <span className="text-gray-900">{row.total_tokens}</span>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap hidden sm:table-cell">
                        {row.unique_customers > 0 ? (
                          <span className="text-gray-900">{row.unique_customers}</span>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap hidden sm:table-cell">
                        {row.total_redemptions > 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                            {row.total_redemptions}
                          </span>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                      {(view === 'month' || view === 'year') && (
                        <td className="px-4 py-3 text-right whitespace-nowrap hidden md:table-cell">
                          {(row.new_customers ?? 0) > 0 ? (
                            <span className="text-indigo-600 font-medium">+{row.new_customers}</span>
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </td>
                      )}
                      <td className="px-3 py-3 text-center">
                        {hasData ? (
                          <button
                            onClick={() => handleViewDetail(row)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all hover:scale-105 hover:shadow-md active:scale-95"
                            style={{ backgroundColor: settings.primary_color }}
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Detail
                          </button>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {/* Totals footer */}
              {totals && (
                <tfoot>
                  <tr className="border-t-2 border-gray-200 bg-gray-50 font-bold">
                    <td className="px-4 py-3 text-gray-900">Total</td>
                    <td className="px-4 py-3 text-right text-green-600 whitespace-nowrap">
                      {formatCurrency(totals.total_revenue)}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {(totals.walkin_revenue ?? 0) > 0 ? (
                        <div>
                          <span className="text-purple-600">{formatCurrency(totals.walkin_revenue ?? 0)}</span>
                          <span className="text-[10px] text-gray-400 ml-1">({totals.walkin_count})</span>
                        </div>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {(totals.total_revenue - (totals.walkin_revenue ?? 0)) > 0 ? (
                        <span className="text-cyan-600">{formatCurrency(totals.total_revenue - (totals.walkin_revenue ?? 0))}</span>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900">
                      {totals.total_tokens.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900 hidden sm:table-cell">
                      -
                    </td>
                    <td className="px-4 py-3 text-right hidden sm:table-cell">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                        {totals.total_redemptions}
                      </span>
                    </td>
                    {(view === 'month' || view === 'year') && (
                      <td className="px-4 py-3 text-right text-indigo-600 hidden md:table-cell">
                        +{(totals.new_customers ?? 0).toLocaleString()}
                      </td>
                    )}
                    <td className="px-3 py-3"></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </motion.div>

      {/* Transaction Detail Modal */}
      <AnimatePresence>
        {detailVisible && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setDetailVisible(false)}
            />

            {/* Modal */}
            <motion.div
              className="relative bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden"
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
            >
              {/* Header */}
              <div className="px-6 py-4 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: settings.primary_color + '15' }}>
                      <FileBarChart className="w-5 h-5" style={{ color: settings.primary_color }} />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-gray-900">Payment Details</h2>
                      <p className="text-sm text-gray-500">{detailLabel}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setDetailVisible(false)}
                    className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                  >
                    <X className="w-4 h-4 text-gray-500" />
                  </button>
                </div>

                {/* Summary badges */}
                {detailData?.summary && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: settings.primary_color + '15', color: settings.primary_color }}>
                      {detailData.summary.total_count} transactions
                    </span>
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-600">
                      <Wallet className="w-3 h-3" />
                      {detailData.summary.walkin_count} Walk-in ({formatCurrency(detailData.summary.walkin_revenue)})
                    </span>
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-cyan-50 text-cyan-600">
                      <CardIcon className="w-3 h-3" />
                      {detailData.summary.loyalty_count} Loyalty ({formatCurrency(detailData.summary.loyalty_revenue)})
                    </span>
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-green-50 text-green-600">
                      Total: {formatCurrency(detailData.summary.total_revenue)}
                    </span>
                  </div>
                )}
              </div>

              {/* Body */}
              {detailLoading ? (
                <div className="flex-1 flex items-center justify-center py-16">
                  <div className="text-center">
                    <div className="animate-spin w-8 h-8 border-3 border-gray-200 border-t-blue-500 rounded-full mx-auto mb-3" style={{ borderTopColor: settings.primary_color }}></div>
                    <p className="text-sm text-gray-500">Loading details...</p>
                  </div>
                </div>
              ) : detailData?.transactions && detailData.transactions.length > 0 ? (
                <div className="flex-1 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-gray-50/95 backdrop-blur-sm">
                      <tr className="border-b border-gray-100">
                        <th className="text-center px-3 py-2.5 font-semibold text-gray-500 text-xs uppercase w-10">#</th>
                        <th className="text-left px-3 py-2.5 font-semibold text-gray-500 text-xs uppercase">Customer</th>
                        <th className="text-center px-3 py-2.5 font-semibold text-gray-500 text-xs uppercase">Type</th>
                        <th className="text-right px-3 py-2.5 font-semibold text-gray-500 text-xs uppercase">Amount</th>
                        <th className="text-center px-3 py-2.5 font-semibold text-gray-500 text-xs uppercase">Time</th>
                        <th className="text-right px-3 py-2.5 font-semibold text-gray-500 text-xs uppercase">Staff</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {detailData.transactions.map((tx, idx) => {
                        const isLoyalty = tx.type === 'loyalty';
                        return (
                          <tr key={`${tx.type}-${tx.id}`} className={`transition-colors hover:bg-gray-50/80 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                            <td className="px-3 py-2.5 text-center text-gray-400 text-xs">{idx + 1}</td>
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-2">
                                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs ${isLoyalty ? 'bg-cyan-50' : 'bg-purple-50'}`}>
                                  {isLoyalty ? '💳' : '🚶'}
                                </div>
                                <div>
                                  <p className="font-medium text-gray-900 text-sm">{tx.customer_name}</p>
                                  {tx.customer_phone && (
                                    <p className="text-[10px] text-gray-400">{tx.customer_phone}</p>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                                isLoyalty ? 'bg-cyan-50 text-cyan-600' : 'bg-purple-50 text-purple-600'
                              }`}>
                                {isLoyalty ? 'Card' : 'Walk-in'}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-right font-bold text-gray-900">
                              {formatCurrency(tx.amount)}
                            </td>
                            <td className="px-3 py-2.5 text-center text-gray-500 text-xs">
                              {view === 'day' ? formatTime(tx.created_at) : formatDateTime(tx.created_at)}
                            </td>
                            <td className="px-3 py-2.5 text-right text-gray-500 text-xs">
                              {tx.staff_name}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center py-16">
                  <div className="text-center">
                    <p className="text-4xl mb-2">📭</p>
                    <p className="text-sm text-gray-500">No transactions found</p>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
