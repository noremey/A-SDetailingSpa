import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Activity, ChevronLeft, ChevronRight, Search, ChevronDown, Filter,
  Coins, Gift, UserPlus, LogIn, CreditCard, Settings, Car, Server
} from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';
import { adminService } from '../../services/api';
import type { ActivityLog } from '../../types';

interface Pagination {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

const typeConfig: Record<string, { label: string; icon: React.ElementType; bg: string; text: string }> = {
  token:    { label: 'Token',    icon: Coins,    bg: 'bg-green-100',  text: 'text-green-700' },
  redeem:   { label: 'Redeem',   icon: Gift,     bg: 'bg-yellow-100', text: 'text-yellow-700' },
  register: { label: 'Register', icon: UserPlus, bg: 'bg-blue-100',   text: 'text-blue-700' },
  login:    { label: 'Login',    icon: LogIn,    bg: 'bg-gray-100',   text: 'text-gray-600' },
  card:     { label: 'Card',     icon: CreditCard, bg: 'bg-purple-100', text: 'text-purple-700' },
  setting:  { label: 'Setting',  icon: Settings, bg: 'bg-orange-100', text: 'text-orange-700' },
  vehicle:  { label: 'Vehicle',  icon: Car,      bg: 'bg-cyan-100',   text: 'text-cyan-700' },
  system:   { label: 'System',   icon: Server,   bg: 'bg-gray-100',   text: 'text-gray-600' },
};

function getActionType(action: string): string {
  if (action.includes('token')) return 'token';
  if (action.includes('redeem')) return 'redeem';
  if (action.includes('register')) return 'register';
  if (action.includes('login')) return 'login';
  if (action.includes('card')) return 'card';
  if (action.includes('setting')) return 'setting';
  if (action.includes('vehicle')) return 'vehicle';
  return 'system';
}

export default function ActivityPage() {
  const { settings } = useSettings();
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [actionTypes, setActionTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1, limit: 10, total: 0, total_pages: 0,
  });

  // Filters
  const [searchQ, setSearchQ] = useState('');
  const [filterType, setFilterType] = useState('');
  const [showTypePicker, setShowTypePicker] = useState(false);

  const fetchActivity = async (page: number, q?: string, type?: string) => {
    setLoading(true);
    try {
      const { data } = await adminService.getActivityLog(page, 10, q || undefined, type || undefined);
      if (data.success) {
        setActivities(data.activities || []);
        setPagination(data.pagination);
        if (data.action_types) setActionTypes(data.action_types);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivity(1);
  }, []);

  const handleSearch = () => {
    fetchActivity(1, searchQ, filterType);
  };

  const handleFilterType = (type: string) => {
    setFilterType(type);
    setShowTypePicker(false);
    fetchActivity(1, searchQ, type);
  };

  const handlePageChange = (p: number) => {
    fetchActivity(p, searchQ, filterType);
  };

  const handleClear = () => {
    setSearchQ('');
    setFilterType('');
    fetchActivity(1);
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' });

  const formatTime = (d: string) =>
    new Date(d).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' });

  const getRelativeTime = (d: string) => {
    const ms = Date.now() - new Date(d).getTime();
    const mins = Math.floor(ms / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    return formatDate(d);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Activity className="w-6 h-6" style={{ color: settings.primary_color }} />
          Activity Log
        </h1>
      </div>

      {/* Search + Filter Bar */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search activity, user..."
            className="input-field pl-9 py-2.5 text-sm"
          />
        </div>

        {/* Type filter dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowTypePicker(!showTypePicker)}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Filter className="w-3.5 h-3.5 text-gray-400" />
            {filterType ? (typeConfig[filterType]?.label || filterType) : 'All Types'}
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showTypePicker ? 'rotate-180' : ''}`} />
          </button>
          {showTypePicker && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowTypePicker(false)} />
              <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-20 w-36 max-h-64 overflow-y-auto">
                <button
                  onClick={() => handleFilterType('')}
                  className={`w-full px-3 py-2 text-sm text-left hover:bg-gray-50 flex items-center gap-2 ${!filterType ? 'font-bold' : 'text-gray-600'}`}
                  style={!filterType ? { color: settings.primary_color } : {}}
                >
                  All Types
                </button>
                {actionTypes.map(t => {
                  const cfg = typeConfig[t] || typeConfig.system;
                  const Icon = cfg.icon;
                  return (
                    <button
                      key={t}
                      onClick={() => handleFilterType(t)}
                      className={`w-full px-3 py-2 text-sm text-left hover:bg-gray-50 flex items-center gap-2 ${t === filterType ? 'font-bold' : 'text-gray-600'}`}
                      style={t === filterType ? { color: settings.primary_color } : {}}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {cfg.label}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <button
          onClick={handleSearch}
          className="px-4 py-2.5 rounded-xl text-white text-sm font-medium"
          style={{ backgroundColor: settings.primary_color }}
        >
          Search
        </button>

        {(searchQ || filterType) && (
          <button
            onClick={handleClear}
            className="px-3 py-2.5 rounded-xl text-gray-600 bg-gray-100 text-sm"
          >
            Clear
          </button>
        )}
      </div>

      {/* DataTable */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Table header bar */}
        <div className="px-4 py-3 bg-gray-50/80 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4" style={{ color: settings.primary_color }} />
            <span className="text-sm font-semibold text-gray-700">System Activity</span>
          </div>
          <div className="flex items-center gap-2">
            {filterType && (() => {
              const cfg = typeConfig[filterType] || typeConfig.system;
              return (
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>
                  {cfg.label}
                </span>
              );
            })()}
            <span className="text-xs text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full font-medium">
              {pagination.total} record{pagination.total !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {loading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => (
              <div key={i} className="h-10 bg-gray-50 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : activities.length === 0 ? (
          <div className="text-center py-16">
            <Activity className="w-14 h-14 mx-auto text-gray-200 mb-3" />
            <p className="text-gray-400 font-medium">No activity found</p>
            <p className="text-xs text-gray-300 mt-1">
              {searchQ || filterType ? 'Try different search or filter' : 'Activity will be recorded here'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/30">
                  <th className="text-center px-3 py-3 font-semibold text-gray-500 text-[10px] uppercase tracking-wider w-10">#</th>
                  <th className="text-left px-3 py-3 font-semibold text-gray-500 text-[10px] uppercase tracking-wider w-20">Type</th>
                  <th className="text-left px-3 py-3 font-semibold text-gray-500 text-[10px] uppercase tracking-wider">Description</th>
                  <th className="text-left px-3 py-3 font-semibold text-gray-500 text-[10px] uppercase tracking-wider hidden sm:table-cell">User</th>
                  <th className="text-right px-3 py-3 font-semibold text-gray-500 text-[10px] uppercase tracking-wider">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {activities.map((item, i) => {
                  const rowNum = (pagination.page - 1) * 10 + i + 1;
                  const actionType = getActionType(item.action);
                  const cfg = typeConfig[actionType] || typeConfig.system;
                  const Icon = cfg.icon;
                  return (
                    <motion.tr
                      key={item.id}
                      className="hover:bg-blue-50/30 transition-colors"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.02 }}
                    >
                      <td className="px-3 py-3 text-center">
                        <span className="text-[10px] font-medium text-gray-400">{rowNum}</span>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>
                          <Icon className="w-3 h-3" />
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <p className="text-[13px] text-gray-800 leading-snug">{item.description || item.action}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5 font-mono">{item.action}</p>
                      </td>
                      <td className="px-3 py-3 hidden sm:table-cell">
                        {item.user_name ? (
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                                 style={{ backgroundColor: settings.primary_color + '15' }}>
                              <span className="text-[10px] font-bold" style={{ color: settings.primary_color }}>
                                {item.user_name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-gray-700 truncate">{item.user_name}</p>
                              {item.user_code && (
                                <p className="text-[9px] text-gray-400 font-mono">{item.user_code}</p>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-300 italic">System</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <p className="text-xs font-medium text-gray-700 whitespace-nowrap">{getRelativeTime(item.created_at)}</p>
                        <p className="text-[10px] text-gray-400">{formatTime(item.created_at)}</p>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination footer */}
        <div className="border-t border-gray-100 px-4 py-3 flex items-center justify-between bg-gray-50/50">
          <p className="text-xs text-gray-500">
            {pagination.total > 0 ? (
              <>
                Showing{' '}
                <span className="font-semibold text-gray-700">{(pagination.page - 1) * 10 + 1}</span>
                {' '}-{' '}
                <span className="font-semibold text-gray-700">{Math.min(pagination.page * 10, pagination.total)}</span>
                {' '}of{' '}
                <span className="font-semibold text-gray-700">{pagination.total}</span> records
              </>
            ) : (
              <span>0 records</span>
            )}
          </p>
          {pagination.total_pages > 1 && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => handlePageChange(1)}
                disabled={pagination.page <= 1}
                className="w-8 h-8 rounded-lg text-xs font-medium border border-gray-200 bg-white
                           hover:bg-gray-50 disabled:opacity-30 flex items-center justify-center"
              >
                «
              </button>
              <button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="w-8 h-8 rounded-lg text-xs font-medium border border-gray-200 bg-white
                           hover:bg-gray-50 disabled:opacity-30 flex items-center justify-center"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {/* Page numbers */}
              {(() => {
                const pages: number[] = [];
                const start = Math.max(1, pagination.page - 2);
                const end = Math.min(pagination.total_pages, pagination.page + 2);
                for (let p = start; p <= end; p++) pages.push(p);
                return pages.map(p => (
                  <button
                    key={p}
                    onClick={() => handlePageChange(p)}
                    className={`w-8 h-8 rounded-lg text-xs font-bold border transition-all flex items-center justify-center ${
                      p === pagination.page
                        ? 'text-white shadow-sm'
                        : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                    style={p === pagination.page ? { backgroundColor: settings.primary_color, borderColor: settings.primary_color } : {}}
                  >
                    {p}
                  </button>
                ));
              })()}

              <button
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page >= pagination.total_pages}
                className="w-8 h-8 rounded-lg text-xs font-medium border border-gray-200 bg-white
                           hover:bg-gray-50 disabled:opacity-30 flex items-center justify-center"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => handlePageChange(pagination.total_pages)}
                disabled={pagination.page >= pagination.total_pages}
                className="w-8 h-8 rounded-lg text-xs font-medium border border-gray-200 bg-white
                           hover:bg-gray-50 disabled:opacity-30 flex items-center justify-center"
              >
                »
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
