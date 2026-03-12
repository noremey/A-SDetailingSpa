import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Megaphone, Send, Bell, Clock, Users, CheckCircle2,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, AlertTriangle,
  Search, Check, History, Trash2,
  Radio, TrendingUp, XCircle,
} from 'lucide-react';
import { adminService } from '../../services/api';
import { useToast } from '../../components/ui/Toast';
import { useSettings } from '../../context/SettingsContext';
import ConfirmModal from '../../components/ui/ConfirmModal';
import type { Broadcast } from '../../types';

type View = 'compose' | 'history';

interface Customer {
  id: number;
  name: string;
  phone: string;
}

export default function BroadcastsPage() {
  const toast = useToast();
  const { settings } = useSettings();
  const [view, setView] = useState<View>('compose');

  // Compose
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [confirmSend, setConfirmSend] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);

  // Customers
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [filterQuery, setFilterQuery] = useState('');

  // History
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Stats
  const [stats, setStats] = useState<{ total_broadcasts: number; total_push_sent: number; total_recipients: number } | null>(null);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<Broadcast | null>(null);
  const [deleting, setDeleting] = useState(false);

  const pushEnabled = (settings as any).push_notifications_enabled === '1';

  useEffect(() => { loadCustomers(); }, []);
  useEffect(() => { if (view === 'history') { loadHistory(); loadStats(); } }, [view, page]);

  const loadCustomers = async () => {
    setLoadingCustomers(true);
    try {
      const { data } = await adminService.listCustomers(1, 500, 'newest');
      if (data.success) setCustomers(data.customers || []);
    } catch {} finally { setLoadingCustomers(false); }
  };

  const filtered = useMemo(() => {
    if (!filterQuery.trim()) return customers;
    const q = filterQuery.toLowerCase();
    return customers.filter(c => c.name?.toLowerCase().includes(q) || c.phone?.includes(q));
  }, [customers, filterQuery]);

  const toggleCustomer = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelectedIds(prev =>
      prev.size === filtered.length ? new Set() : new Set(filtered.map(c => c.id))
    );
  };

  const loadStats = async () => {
    try {
      const { data } = await adminService.getBroadcastStats();
      if (data.success) setStats(data.stats);
    } catch {}
  };

  const loadHistory = async () => {
    setLoading(true);
    try {
      const { data } = await adminService.getBroadcasts(page);
      if (data.success) { setBroadcasts(data.broadcasts || []); setTotalPages(data.pages || 1); setTotalCount(data.total || 0); }
    } catch {} finally { setLoading(false); }
  };

  const handleSend = async () => {
    setConfirmSend(false);
    setSending(true);
    setLastResult(null);
    try {
      const payload: any = { title, message, channels: 'push' };
      if (selectedIds.size > 0 && selectedIds.size < customers.length) {
        payload.customer_ids = Array.from(selectedIds);
      }
      const { data } = await adminService.sendBroadcast(payload);
      if (data.success) {
        toast.success('Broadcast berjaya dihantar!');
        setLastResult(data);
        setTitle('');
        setMessage('');
        setSelectedIds(new Set());
      } else {
        toast.error(data.message || 'Gagal');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Gagal menghantar');
    } finally { setSending(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { data } = await adminService.deleteBroadcast(deleteTarget.id);
      if (data.success) {
        setBroadcasts(prev => prev.filter(b => b.id !== deleteTarget.id));
        toast.success('Broadcast berjaya dipadam');
      } else {
        toast.error(data.message || 'Gagal memadam');
      }
    } catch {
      toast.error('Gagal memadam broadcast');
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const sendToAll = selectedIds.size === 0 || selectedIds.size === customers.length;
  const recipientCount = sendToAll ? customers.length : selectedIds.size;
  const canSend = title.trim() && message.trim() && !sending && pushEnabled && recipientCount > 0;

  const allSelected = filtered.length > 0 && selectedIds.size === filtered.length;

  return (
    <div className="h-full">
      {/* Top Bar */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-indigo-50">
            <Megaphone className="w-[18px] h-[18px] text-indigo-500" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900 leading-tight">Broadcast</h1>
            <p className="text-[11px] text-gray-400">Hantar push notification kepada pelanggan</p>
          </div>
        </div>
        <button
          onClick={() => { setView(v => v === 'compose' ? 'history' : 'compose'); setLastResult(null); }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-all"
        >
          {view === 'compose' ? <><History className="w-3.5 h-3.5" /> Sejarah</> : <><Send className="w-3.5 h-3.5" /> Compose</>}
        </button>
      </div>

      {/* Push not enabled */}
      {!pushEnabled && view === 'compose' && (
        <div className="bg-red-50 border border-red-100 rounded-xl p-3 flex items-center gap-3 mb-5">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <p className="text-xs text-red-600"><span className="font-semibold">Push tidak aktif.</span> Aktifkan dalam Settings.</p>
        </div>
      )}

      {/* ══════════ COMPOSE VIEW ══════════ */}
      {view === 'compose' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">

          {/* ── LEFT: Customer List ── */}
          <div className="lg:col-span-5 bg-white border border-gray-100 rounded-2xl overflow-hidden">
            {/* Header */}
            <div className="px-4 pt-4 pb-3 border-b border-gray-50">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-gray-400" />
                  <span className="text-sm font-semibold text-gray-800">Pelanggan</span>
                </div>
                <span className="text-[11px] font-medium text-gray-400">
                  {customers.length} orang
                </span>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-300" />
                <input
                  type="text"
                  value={filterQuery}
                  onChange={e => setFilterQuery(e.target.value)}
                  placeholder="Cari nama / telefon..."
                  className="w-full pl-9 pr-3 py-2 bg-gray-50 rounded-lg text-xs border-0 placeholder:text-gray-300 focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all"
                />
              </div>
            </div>

            {/* Select All */}
            <div className="px-4 py-2 border-b border-gray-50 bg-gray-50/50">
              <button onClick={toggleAll} className="flex items-center gap-2.5 w-full group">
                <div className={`w-[18px] h-[18px] rounded flex items-center justify-center transition-all ${
                  allSelected ? 'bg-indigo-500 text-white' : 'border-[1.5px] border-gray-200 group-hover:border-gray-300'
                }`}>
                  {allSelected && <Check className="w-3 h-3" strokeWidth={3} />}
                </div>
                <span className="text-[11px] font-semibold text-gray-400 group-hover:text-gray-500 transition-colors">
                  {allSelected ? 'Nyahpilih semua' : 'Pilih semua'}
                </span>
                {selectedIds.size > 0 && !allSelected && (
                  <span className="ml-auto text-[11px] font-bold text-indigo-500">{selectedIds.size} dipilih</span>
                )}
              </button>
            </div>

            {/* List */}
            <div className="max-h-[420px] overflow-y-auto">
              {loadingCustomers ? (
                <div className="flex justify-center py-12">
                  <svg className="animate-spin w-5 h-5 text-gray-200" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>
              ) : filtered.length === 0 ? (
                <div className="py-12 text-center">
                  <Users className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                  <p className="text-xs text-gray-300">Tiada pelanggan dijumpai</p>
                </div>
              ) : (
                filtered.map((c, i) => {
                  const selected = selectedIds.has(c.id);
                  return (
                    <button
                      key={c.id}
                      onClick={() => toggleCustomer(c.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all hover:bg-gray-50/80 ${
                        selected ? 'bg-indigo-50/30' : ''
                      } ${i < filtered.length - 1 ? 'border-b border-gray-50' : ''}`}
                    >
                      <div className={`w-[18px] h-[18px] rounded flex items-center justify-center shrink-0 transition-all ${
                        selected ? 'bg-indigo-500 text-white shadow-sm shadow-indigo-500/30' : 'border-[1.5px] border-gray-200'
                      }`}>
                        {selected && <Check className="w-3 h-3" strokeWidth={3} />}
                      </div>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
                        selected ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-400'
                      }`}>
                        {(c.name || '?')[0].toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-medium truncate leading-tight ${selected ? 'text-gray-900' : 'text-gray-600'}`}>
                          {c.name}
                        </p>
                        <p className="text-[11px] text-gray-400 font-mono leading-tight mt-0.5">{c.phone}</p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Footer */}
            {selectedIds.size > 0 && (
              <div className="px-4 py-2.5 border-t border-gray-100 bg-indigo-50/50">
                <p className="text-[11px] font-semibold text-indigo-600 text-center">
                  {selectedIds.size === customers.length
                    ? `Semua ${customers.length} pelanggan dipilih`
                    : `${selectedIds.size} pelanggan dipilih`
                  }
                </p>
              </div>
            )}
          </div>

          {/* ── RIGHT: Compose Message ── */}
          <div className="lg:col-span-7 space-y-4">
            {/* Message Card */}
            <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-4">
              {/* Recipient Badge */}
              <div className="flex items-center gap-2">
                <Bell className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-xs font-semibold text-amber-600">Push Notification</span>
                <span className="ml-auto text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-500">
                  {sendToAll ? `Semua (${customers.length})` : `${selectedIds.size} penerima`}
                </span>
              </div>

              {/* Hint */}
              {!sendToAll && (
                <p className="text-[11px] text-indigo-500 bg-indigo-50 rounded-lg px-3 py-2">
                  ← Pilih pelanggan di sebelah kiri, atau biarkan kosong untuk hantar ke semua
                </p>
              )}
              {sendToAll && selectedIds.size === 0 && (
                <p className="text-[11px] text-gray-400 bg-gray-50 rounded-lg px-3 py-2">
                  Broadcast akan dihantar ke <span className="font-semibold text-gray-500">semua pelanggan aktif</span>. Pilih di sebelah kiri untuk hantar ke tertentu sahaja.
                </p>
              )}

              {/* Title */}
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Tajuk</label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. Promosi Hari Raya 🎉"
                  className="w-full px-4 py-3 bg-gray-50 border-0 rounded-xl text-sm placeholder:text-gray-300 focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all"
                />
              </div>

              {/* Message */}
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Mesej</label>
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="Tulis mesej promosi anda..."
                  rows={5}
                  className="w-full px-4 py-3 bg-gray-50 border-0 rounded-xl text-sm placeholder:text-gray-300 focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all resize-none"
                />
                <p className="text-[10px] text-gray-300 mt-1 text-right">{message.length}/1000</p>
              </div>

              {/* Send */}
              <button
                onClick={() => setConfirmSend(true)}
                disabled={!canSend}
                className="w-full py-3.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/25"
                style={{ background: 'linear-gradient(135deg, #6366f1, #818cf8)' }}
              >
                {sending ? (
                  <>
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Menghantar...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Hantar kepada {sendToAll ? 'semua pelanggan' : `${selectedIds.size} pelanggan`}
                  </>
                )}
              </button>
            </div>

            {/* Result */}
            <AnimatePresence>
              {lastResult && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="bg-green-50 border border-green-100 rounded-2xl p-5"
                >
                  <div className="flex items-center gap-2 text-green-700 mb-4">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="font-bold text-sm">Broadcast Berjaya!</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-white rounded-xl p-3 text-center">
                      <p className="text-xl font-bold text-gray-900">{lastResult.total_recipients}</p>
                      <p className="text-[10px] text-gray-400 font-medium mt-0.5">Penerima</p>
                    </div>
                    <div className="bg-white rounded-xl p-3 text-center">
                      <p className="text-xl font-bold text-green-600">{lastResult.push_sent}</p>
                      <p className="text-[10px] text-gray-400 font-medium mt-0.5">Berjaya</p>
                    </div>
                    <div className="bg-white rounded-xl p-3 text-center">
                      <p className="text-xl font-bold text-red-400">{lastResult.push_failed}</p>
                      <p className="text-[10px] text-gray-400 font-medium mt-0.5">Gagal</p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* ══════════ HISTORY VIEW ══════════ */}
      {view === 'history' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">

          {/* Summary Stats */}
          {stats && (
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Total Broadcast', value: stats.total_broadcasts ?? 0, icon: Radio, bg: 'bg-indigo-50', clr: 'text-indigo-500' },
                { label: 'Push Berjaya', value: stats.total_push_sent ?? 0, icon: TrendingUp, bg: 'bg-emerald-50', clr: 'text-emerald-500' },
                { label: 'Jumlah Penerima', value: stats.total_recipients ?? 0, icon: Users, bg: 'bg-violet-50', clr: 'text-violet-500' },
              ].map((s, i) => (
                <motion.div
                  key={s.label}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="bg-white rounded-2xl p-3.5 shadow-sm border border-gray-100"
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className={`${s.bg} rounded-lg p-2`}>
                      <s.icon className={`w-4 h-4 ${s.clr}`} />
                    </div>
                    <span className="text-xs text-gray-500">{s.label}</span>
                  </div>
                  <p className="text-lg font-bold text-gray-900">{Number(s.value).toLocaleString()}</p>
                </motion.div>
              ))}
            </div>
          )}

          {/* Datatable */}
          {loading ? (
            <div className="flex justify-center py-20">
              <svg className="animate-spin w-5 h-5 text-gray-300" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : broadcasts.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 py-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
                <Megaphone className="w-8 h-8 text-gray-200" />
              </div>
              <p className="text-sm font-semibold text-gray-400">Belum ada broadcast</p>
              <p className="text-xs text-gray-300 mt-1">Hantar broadcast pertama anda dari halaman Compose</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              {/* Table Header Bar */}
              <div className="px-4 py-3 bg-gray-50/80 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Megaphone className="w-4 h-4 text-indigo-500" />
                  <span className="text-sm font-semibold text-gray-700">Broadcast History</span>
                </div>
                <span className="text-xs text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full font-medium">
                  {totalCount} broadcast{totalCount !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead className="sticky top-0 z-10 bg-gray-50/95 backdrop-blur-sm">
                    <tr className="border-b border-gray-200">
                      <th className="text-center px-3 py-2.5 font-semibold text-gray-500 text-[10px] uppercase tracking-wider w-10">#</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-gray-500 text-[10px] uppercase tracking-wider">Tajuk / Mesej</th>
                      <th className="text-center px-3 py-2.5 font-semibold text-gray-500 text-[10px] uppercase tracking-wider">Penerima</th>
                      <th className="text-center px-3 py-2.5 font-semibold text-gray-500 text-[10px] uppercase tracking-wider hidden lg:table-cell">Berjaya</th>
                      <th className="text-center px-3 py-2.5 font-semibold text-gray-500 text-[10px] uppercase tracking-wider hidden lg:table-cell">Gagal</th>
                      <th className="text-center px-3 py-2.5 font-semibold text-gray-500 text-[10px] uppercase tracking-wider">Status</th>
                      <th className="text-right px-3 py-2.5 font-semibold text-gray-500 text-[10px] uppercase tracking-wider">Tarikh</th>
                      <th className="text-center px-3 py-2.5 w-16 font-semibold text-gray-500 text-[10px] uppercase tracking-wider">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {broadcasts.map((b, i) => (
                      <motion.tr
                        key={b.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.02 }}
                        className="hover:bg-blue-50/30 transition-colors group"
                      >
                        <td className="px-3 py-3 text-center">
                          <span className="text-xs text-gray-300 font-mono">{(page - 1) * 20 + i + 1}</span>
                        </td>
                        <td className="px-3 py-3">
                          <p className="text-sm font-semibold text-gray-900 truncate max-w-[300px]">{b.title}</p>
                          <p className="text-xs text-gray-400 truncate max-w-[300px] mt-0.5">{b.message}</p>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className="text-xs font-bold text-gray-700">{b.total_recipients}</span>
                        </td>
                        <td className="px-3 py-3 text-center hidden lg:table-cell">
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                            <CheckCircle2 className="w-3 h-3" /> {b.push_sent}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center hidden lg:table-cell">
                          {(b.push_failed ?? 0) > 0 ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-400">
                              <XCircle className="w-3 h-3" /> {b.push_failed}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-300">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            b.status === 'completed'
                              ? 'bg-green-100 text-green-700'
                              : b.status === 'sending'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-red-100 text-red-500'
                          }`}>
                            {b.status === 'completed' && <CheckCircle2 className="w-3 h-3" />}
                            {b.status === 'sending' && (
                              <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                            )}
                            {b.status === 'completed' ? 'Selesai' : b.status === 'sending' ? 'Menghantar' : 'Gagal'}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <span className="text-[11px] text-gray-500 whitespace-nowrap">
                            {new Date(b.created_at).toLocaleDateString('ms-MY', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                          <p className="text-[10px] text-gray-300">
                            {new Date(b.created_at).toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <button
                            onClick={() => setDeleteTarget(b)}
                            className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                            title="Padam"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden divide-y divide-gray-100">
                {broadcasts.map((b, i) => (
                  <motion.div
                    key={b.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                    className="p-4 space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-semibold text-gray-900 truncate">{b.title}</h3>
                        <p className="text-xs text-gray-400 line-clamp-1 mt-0.5">{b.message}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          b.status === 'completed' ? 'bg-green-100 text-green-700' :
                          b.status === 'sending' ? 'bg-amber-100 text-amber-700' :
                          'bg-red-100 text-red-500'
                        }`}>
                          {b.status === 'completed' && <CheckCircle2 className="w-2.5 h-2.5" />}
                          {b.status === 'completed' ? 'Selesai' : b.status === 'sending' ? '...' : 'Gagal'}
                        </span>
                        <button
                          onClick={() => setDeleteTarget(b)}
                          className="p-1 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-[11px]">
                      <span className="inline-flex items-center gap-1 text-gray-400">
                        <Users className="w-3 h-3" /> {b.total_recipients}
                      </span>
                      <span className="inline-flex items-center gap-1 text-emerald-500 font-medium">
                        <CheckCircle2 className="w-3 h-3" /> {b.push_sent}
                      </span>
                      {(b.push_failed ?? 0) > 0 && (
                        <span className="inline-flex items-center gap-1 text-red-400 font-medium">
                          <XCircle className="w-3 h-3" /> {b.push_failed}
                        </span>
                      )}
                      <span className="ml-auto text-[10px] text-gray-300 inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(b.created_at).toLocaleDateString('ms-MY', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Pagination Bar */}
              <div className="border-t border-gray-100 px-4 py-3 flex items-center justify-between bg-gray-50/50">
                <p className="text-[11px] text-gray-500">
                  Showing <span className="font-semibold text-gray-700">{Math.min((page - 1) * 20 + 1, totalCount)}</span>
                  –<span className="font-semibold text-gray-700">{Math.min(page * 20, totalCount)}</span>
                  {' '}of <span className="font-semibold text-gray-700">{totalCount}</span>
                </p>
                {totalPages > 1 && (
                  <div className="flex items-center gap-1">
                    <button onClick={() => setPage(1)} disabled={page <= 1}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                      <ChevronsLeft className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                      .reduce<(number | 'dots')[]>((acc, p, idx, arr) => {
                        if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('dots');
                        acc.push(p);
                        return acc;
                      }, [])
                      .map((p, idx) =>
                        p === 'dots' ? (
                          <span key={`dots-${idx}`} className="px-1 text-gray-300 text-xs">...</span>
                        ) : (
                          <button
                            key={p}
                            onClick={() => setPage(p as number)}
                            className={`w-8 h-8 rounded-lg text-xs font-bold border transition-all flex items-center justify-center ${
                              page === p
                                ? 'bg-indigo-500 text-white border-indigo-500 shadow-sm'
                                : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                            }`}
                          >
                            {p}
                          </button>
                        )
                      )}
                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setPage(totalPages)} disabled={page >= totalPages}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                      <ChevronsRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Confirm */}
      <ConfirmModal
        isOpen={confirmSend}
        onCancel={() => setConfirmSend(false)}
        onConfirm={handleSend}
        title="Hantar Broadcast?"
        message={`"${title}" akan dihantar kepada ${sendToAll ? 'semua pelanggan aktif' : `${selectedIds.size} pelanggan terpilih`} via Push Notification.`}
        confirmText="Hantar Sekarang"
        variant="info"
      />

      {/* Delete Confirm */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Padam Broadcast?"
        message={`"${deleteTarget?.title}" akan dipadam secara kekal.`}
        confirmText={deleting ? 'Memadam...' : 'Padam'}
        variant="danger"
      />
    </div>
  );
}
