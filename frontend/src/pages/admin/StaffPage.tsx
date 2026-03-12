import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Search, ChevronLeft, ChevronRight, Phone, Mail, Calendar, Trash2, AlertTriangle, X, Shield, UserPlus, Eye, EyeOff, User, Lock, Link2, Copy, Check, Clock, ChevronDown, KeyRound } from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/ui/Toast';
import { adminService } from '../../services/api';
import type { Staff } from '../../types';

const initialForm = { name: '', phone: '', email: '', password: '', confirmPassword: '' };

export default function StaffPage() {
  const { settings } = useSettings();
  const { user } = useAuth();
  const toast = useToast();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<Staff | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Add staff modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState(initialForm);
  const [addError, setAddError] = useState('');
  const [adding, setAdding] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Role change
  const [roleDropdownId, setRoleDropdownId] = useState<number | null>(null);
  const [roleDropdownPos, setRoleDropdownPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [changingRole, setChangingRole] = useState(false);

  // Invite link modal
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [inviteExpiry, setInviteExpiry] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Password change modal
  const [passwordTarget, setPasswordTarget] = useState<Staff | null>(null);
  const [passwordForm, setPasswordForm] = useState({ password: '', confirmPassword: '' });
  const [passwordError, setPasswordError] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showNewConfirm, setShowNewConfirm] = useState(false);

  const fetchStaff = async (p: number, q?: string) => {
    setLoading(true);
    try {
      let data;
      if (q && q.length >= 1) {
        const res = await adminService.searchStaff(q);
        data = res.data;
        if (data.success) {
          setStaff(data.staff || []);
          setTotal(data.staff?.length || 0);
          setTotalPages(1);
        }
      } else {
        const res = await adminService.listStaff(p, 10);
        data = res.data;
        if (data.success) {
          setStaff(data.staff || []);
          setTotal(data.total || 0);
          setTotalPages(data.pages || 1);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff(page);
  }, [page]);

  const handleSearch = () => {
    setPage(1);
    fetchStaff(1, search);
  };

  // ---- Delete ----
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await adminService.deleteStaff(deleteTarget.id);
      if (res.data.success) {
        toast.success(res.data.message || 'Staff deleted successfully');
        setDeleteTarget(null);
        fetchStaff(page, search || undefined);
      } else {
        toast.error(res.data.message || 'Failed to delete staff');
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to delete staff';
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  };

  // ---- Change Role ----
  const handleChangeRole = async (staffId: number, newRole: string, staffName: string) => {
    setChangingRole(true);
    try {
      const res = await adminService.changeStaffRole(staffId, newRole);
      if (res.data.success) {
        toast.success(res.data.message || `${staffName} role updated`);
        setRoleDropdownId(null);
        fetchStaff(page, search || undefined);
      } else {
        toast.error(res.data.message || 'Failed to change role');
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to change role';
      toast.error(msg);
    } finally {
      setChangingRole(false);
    }
  };

  // ---- Change Password ----
  const openPasswordModal = (s: Staff) => {
    setPasswordTarget(s);
    setPasswordForm({ password: '', confirmPassword: '' });
    setPasswordError('');
    setShowNewPassword(false);
    setShowNewConfirm(false);
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');

    if (passwordForm.password.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      return;
    }
    if (passwordForm.password !== passwordForm.confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }
    if (!passwordTarget) return;

    setSavingPassword(true);
    try {
      const res = await adminService.updateStaffPassword(passwordTarget.id, passwordForm.password);
      if (res.data.success) {
        toast.success(res.data.message || 'Password updated successfully');
        setPasswordTarget(null);
        setPasswordForm({ password: '', confirmPassword: '' });
      } else {
        setPasswordError(res.data.message || 'Failed to update password');
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to update password';
      setPasswordError(msg);
    } finally {
      setSavingPassword(false);
    }
  };

  // ---- Add Staff ----
  const openAddModal = () => {
    setAddForm(initialForm);
    setAddError('');
    setShowPassword(false);
    setShowConfirm(false);
    setShowAddModal(true);
  };

  // ---- Invite Link ----
  const handleCreateInvite = async () => {
    setInviteLoading(true);
    setInviteCode('');
    setInviteExpiry('');
    setCopied(false);
    try {
      const res = await adminService.createStaffInvite();
      if (res.data.success) {
        setInviteCode(res.data.invite.code);
        setInviteExpiry(res.data.invite.expires_at);
        setShowInviteModal(true);
      } else {
        toast.error(res.data.message || 'Failed to create invite link');
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to create invite link';
      toast.error(msg);
    } finally {
      setInviteLoading(false);
    }
  };

  const inviteUrl = inviteCode
    ? `${window.location.origin}${import.meta.env.BASE_URL}staff-register?code=${inviteCode}`
    : '';

  const handleCopyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      toast.success('Invite link copied!');
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = inviteUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      toast.success('Invite link copied!');
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError('');

    // Client-side validation
    if (!addForm.name.trim()) {
      setAddError('Name is required');
      return;
    }
    if (!addForm.phone.trim()) {
      setAddError('Phone number is required');
      return;
    }
    if (addForm.phone.replace(/\D/g, '').length < 10) {
      setAddError('Please enter a valid phone number (min 10 digits)');
      return;
    }
    if (addForm.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addForm.email)) {
      setAddError('Please enter a valid email address');
      return;
    }
    if (addForm.password.length < 6) {
      setAddError('Password must be at least 6 characters');
      return;
    }
    if (addForm.password !== addForm.confirmPassword) {
      setAddError('Passwords do not match');
      return;
    }

    setAdding(true);
    try {
      const res = await adminService.addStaff({
        name: addForm.name.trim(),
        phone: addForm.phone.trim(),
        email: addForm.email.trim() || undefined,
        password: addForm.password,
        role: 'admin',
      });
      if (res.data.success) {
        toast.success(res.data.message || 'Staff created successfully');
        setShowAddModal(false);
        setAddForm(initialForm);
        fetchStaff(1);
        setPage(1);
      } else {
        setAddError(res.data.message || 'Failed to create staff');
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to create staff';
      setAddError(msg);
    } finally {
      setAdding(false);
    }
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' });

  const getRoleBadge = (role: string) => {
    if (role === 'super_admin') {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">
          <ShieldCheck className="w-3 h-3" />Super Admin
        </span>
      );
    }
    if (role === 'staff') {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">
          <Shield className="w-3 h-3" />Staff
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
        <Shield className="w-3 h-3" />Admin
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Staff Management</h1>
        {user?.role === 'super_admin' && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleCreateInvite}
              disabled={inviteLoading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border-2 shadow-sm hover:shadow-md transition-all active:scale-[0.97] disabled:opacity-50"
              style={{ borderColor: settings.primary_color, color: settings.primary_color }}
            >
              {inviteLoading ? (
                <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
              ) : (
                <Link2 className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">Invite Link</span>
            </button>
            <button
              onClick={openAddModal}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm hover:shadow-md transition-all active:scale-[0.97]"
              style={{ backgroundColor: settings.primary_color }}
            >
              <UserPlus className="w-4 h-4" />
              <span className="hidden sm:inline">Add Staff</span>
            </button>
          </div>
        )}
      </div>

      {/* Search */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search by name, phone, email, ID..."
            className="input-field pl-10"
          />
        </div>
        <button
          onClick={handleSearch}
          className="px-5 py-3 rounded-xl font-medium text-white"
          style={{ backgroundColor: settings.primary_color }}
        >
          Search
        </button>
        {search && (
          <button
            onClick={() => { setSearch(''); fetchStaff(1); }}
            className="px-4 py-3 rounded-xl text-gray-600 bg-gray-100"
          >
            Clear
          </button>
        )}
      </div>

      {/* DataTable */}
      {loading ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
      ) : staff.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <ShieldCheck className="w-14 h-14 mx-auto text-gray-200 mb-3" />
          <p className="text-gray-400 font-medium">No staff found</p>
          <p className="text-xs text-gray-300 mt-1">{search ? 'Try different search terms' : 'Staff members will appear here'}</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Table header info bar */}
          <div className="px-4 py-3 bg-gray-50/80 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" style={{ color: settings.primary_color }} />
              <span className="text-sm font-semibold text-gray-700">Staff List</span>
            </div>
            <span className="text-xs text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full font-medium">
              {total} staff
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/30">
                  <th className="text-center px-3 py-3 font-semibold text-gray-500 text-[10px] uppercase tracking-wider w-10">#</th>
                  <th className="text-left px-3 py-3 font-semibold text-gray-500 text-[10px] uppercase tracking-wider">Staff</th>
                  <th className="text-left px-3 py-3 font-semibold text-gray-500 text-[10px] uppercase tracking-wider hidden sm:table-cell">Contact</th>
                  <th className="text-center px-3 py-3 font-semibold text-gray-500 text-[10px] uppercase tracking-wider">Role</th>
                  <th className="text-center px-3 py-3 font-semibold text-gray-500 text-[10px] uppercase tracking-wider hidden sm:table-cell">Status</th>
                  <th className="text-right px-3 py-3 font-semibold text-gray-500 text-[10px] uppercase tracking-wider hidden lg:table-cell">Joined</th>
                  <th className="text-center px-3 py-3 font-semibold text-gray-500 text-[10px] uppercase tracking-wider w-24">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {staff.map((s, i) => {
                  const rowNum = (page - 1) * 10 + i + 1;
                  const isSelf = s.id === user?.id;
                  const isSuperAdmin = s.role === 'super_admin';
                  const canDelete = user?.role === 'super_admin' && !isSelf && !isSuperAdmin;

                  return (
                    <motion.tr
                      key={s.id}
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
                          {s.avatar ? (
                            <img
                              src={s.avatar}
                              alt={s.name}
                              className="w-9 h-9 rounded-full object-cover shrink-0 ring-2 ring-white shadow-sm"
                              referrerPolicy="no-referrer"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden'); }}
                            />
                          ) : null}
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${s.avatar ? 'hidden' : ''}`}
                               style={{ backgroundColor: settings.primary_color + '15' }}>
                            <span className="text-xs font-bold" style={{ color: settings.primary_color }}>
                              {s.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="font-semibold text-gray-900 truncate text-[13px]">{s.name}</p>
                              {isSelf && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-green-50 text-green-600">YOU</span>
                              )}
                              {s.google_id && (
                                <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
                                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                                </svg>
                              )}
                            </div>
                            <span className="text-[10px] text-gray-400 font-mono">{s.user_code}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 hidden sm:table-cell">
                        <div className="space-y-0.5">
                          {s.phone && (
                            <div className="flex items-center gap-1 text-xs text-gray-600">
                              <Phone className="w-3 h-3 text-gray-400" />{s.phone}
                            </div>
                          )}
                          {s.email && (
                            <div className="flex items-center gap-1 text-[10px] text-gray-400 truncate max-w-[180px]">
                              <Mail className="w-3 h-3 shrink-0" />{s.email}
                            </div>
                          )}
                          {!s.phone && !s.email && (
                            <span className="text-gray-300 text-xs">-</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center">
                        {user?.role === 'super_admin' && !isSelf ? (
                          <button
                            onClick={(e) => {
                              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                              setRoleDropdownPos({ top: rect.bottom + 4, left: rect.left + rect.width / 2 - 80 });
                              setRoleDropdownId(roleDropdownId === s.id ? null : s.id);
                            }}
                            className="inline-flex items-center gap-0.5 cursor-pointer hover:opacity-80 transition-opacity group"
                            title="Click to change role"
                          >
                            {getRoleBadge(s.role)}
                            <ChevronDown className="w-3 h-3 text-gray-400 group-hover:text-gray-600 transition-colors" />
                          </button>
                        ) : (
                          getRoleBadge(s.role)
                        )}
                      </td>
                      <td className="px-3 py-3 text-center hidden sm:table-cell">
                        <span className={`inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          s.status === 'active'
                            ? 'bg-emerald-50 text-emerald-600'
                            : s.status === 'banned'
                            ? 'bg-red-50 text-red-600'
                            : 'bg-gray-100 text-gray-500'
                        }`}>
                          {s.status}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right hidden lg:table-cell">
                        <div className="flex items-center justify-end gap-1">
                          <Calendar className="w-3 h-3 text-gray-400" />
                          <span className="text-xs text-gray-500 whitespace-nowrap">{formatDate(s.created_at)}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <div className="flex items-center justify-center gap-0.5">
                          {/* Password change: super_admin can change anyone, others can change self */}
                          {(user?.role === 'super_admin' || isSelf) && (
                            <button
                              onClick={() => openPasswordModal(s)}
                              className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                              title={isSelf ? 'Change your password' : `Change password for ${s.name}`}
                            >
                              <KeyRound className="w-4 h-4" />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => setDeleteTarget(s)}
                              className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                              title={`Delete ${s.name}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                          {!canDelete && !(user?.role === 'super_admin' || isSelf) && (
                            <span className="text-gray-200 text-xs">-</span>
                          )}
                        </div>
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
              Showing <span className="font-semibold text-gray-700">{(page - 1) * 10 + 1}</span>
              {' '}-{' '}
              <span className="font-semibold text-gray-700">{Math.min(page * 10, total)}</span>
              {' '}of{' '}
              <span className="font-semibold text-gray-700">{total}</span> staff
            </p>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(1)}
                  disabled={page <= 1}
                  className="w-8 h-8 rounded-lg text-xs font-medium border border-gray-200 bg-white
                             hover:bg-gray-50 disabled:opacity-30 flex items-center justify-center"
                >
                  &laquo;
                </button>
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="w-8 h-8 rounded-lg text-xs font-medium border border-gray-200 bg-white
                             hover:bg-gray-50 disabled:opacity-30 flex items-center justify-center"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {(() => {
                  const pages: number[] = [];
                  const start = Math.max(1, page - 2);
                  const end = Math.min(totalPages, page + 2);
                  for (let p = start; p <= end; p++) pages.push(p);
                  return pages.map(p => (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`w-8 h-8 rounded-lg text-xs font-bold border transition-all flex items-center justify-center ${
                        p === page
                          ? 'text-white shadow-sm'
                          : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                      style={p === page ? { backgroundColor: settings.primary_color, borderColor: settings.primary_color } : {}}
                    >
                      {p}
                    </button>
                  ));
                })()}

                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="w-8 h-8 rounded-lg text-xs font-medium border border-gray-200 bg-white
                             hover:bg-gray-50 disabled:opacity-30 flex items-center justify-center"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage(totalPages)}
                  disabled={page >= totalPages}
                  className="w-8 h-8 rounded-lg text-xs font-medium border border-gray-200 bg-white
                             hover:bg-gray-50 disabled:opacity-30 flex items-center justify-center"
                >
                  &raquo;
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================== */}
      {/* Role Change Dropdown (Fixed) */}
      {/* ============================== */}
      <AnimatePresence>
        {roleDropdownId !== null && (() => {
          const target = staff.find(s => s.id === roleDropdownId);
          if (!target) return null;
          return (
            <>
              <div className="fixed inset-0 z-[90]" onClick={() => setRoleDropdownId(null)} />
              <motion.div
                className="fixed z-[95] bg-white rounded-xl shadow-2xl border border-gray-200 py-1.5 w-[170px]"
                style={{ top: roleDropdownPos.top, left: roleDropdownPos.left }}
                initial={{ opacity: 0, y: -4, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.95 }}
                transition={{ duration: 0.15 }}
              >
                <p className="px-3 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Change Role</p>
                <button
                  onClick={() => handleChangeRole(target.id, 'admin', target.name)}
                  disabled={changingRole || target.role === 'admin'}
                  className={`w-full px-3 py-2 flex items-center gap-2 text-left text-sm transition-colors ${
                    target.role === 'admin'
                      ? 'bg-blue-50 text-blue-700 font-semibold cursor-default'
                      : 'hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <Shield className="w-3.5 h-3.5 text-blue-500" />
                  <span>Admin</span>
                  {target.role === 'admin' && <Check className="w-3.5 h-3.5 ml-auto text-blue-500" />}
                </button>
                <button
                  onClick={() => handleChangeRole(target.id, 'super_admin', target.name)}
                  disabled={changingRole || target.role === 'super_admin'}
                  className={`w-full px-3 py-2 flex items-center gap-2 text-left text-sm transition-colors ${
                    target.role === 'super_admin'
                      ? 'bg-amber-50 text-amber-700 font-semibold cursor-default'
                      : 'hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
                  <span>Super Admin</span>
                  {target.role === 'super_admin' && <Check className="w-3.5 h-3.5 ml-auto text-amber-500" />}
                </button>
              </motion.div>
            </>
          );
        })()}
      </AnimatePresence>

      {/* ============================== */}
      {/* Add Staff Modal */}
      {/* ============================== */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => !adding && setShowAddModal(false)}
            />

            {/* Modal */}
            <motion.div
              className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            >
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between"
                   style={{ background: `linear-gradient(135deg, ${settings.primary_color}08, ${settings.primary_color}03)` }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                       style={{ backgroundColor: settings.primary_color + '15' }}>
                    <UserPlus className="w-5 h-5" style={{ color: settings.primary_color }} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Add New Staff</h3>
                    <p className="text-xs text-gray-400">Create a new admin account</p>
                  </div>
                </div>
                <button
                  onClick={() => !adding && setShowAddModal(false)}
                  className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <form onSubmit={handleAddSubmit} className="p-6 space-y-4">
                {/* Error Message */}
                <AnimatePresence>
                  {addError && (
                    <motion.div
                      className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm text-center"
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                    >
                      {addError}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Full Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={addForm.name}
                      onChange={(e) => setAddForm(f => ({ ...f, name: e.target.value }))}
                      className="input-field pl-11"
                      placeholder="Enter staff name"
                      autoFocus
                    />
                  </div>
                </div>

                {/* Phone & Email - 2 columns */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="tel"
                        value={addForm.phone}
                        onChange={(e) => setAddForm(f => ({ ...f, phone: e.target.value }))}
                        className="input-field pl-11"
                        placeholder="01xxxxxxxxx"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="email"
                        value={addForm.email}
                        onChange={(e) => setAddForm(f => ({ ...f, email: e.target.value }))}
                        className="input-field pl-11"
                        placeholder="staff@email.com"
                      />
                    </div>
                  </div>
                </div>

                {/* Role Badge (read-only info) */}
                <div className="flex items-center gap-2 px-3.5 py-2.5 bg-blue-50/60 border border-blue-100 rounded-xl">
                  <Shield className="w-4 h-4 text-blue-500" />
                  <span className="text-sm font-medium text-blue-700">Role: Admin</span>
                  <span className="text-xs text-blue-400 ml-auto">Can manage customers & tokens</span>
                </div>

                {/* Password */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={addForm.password}
                      onChange={(e) => setAddForm(f => ({ ...f, password: e.target.value }))}
                      className="input-field pl-11 pr-11"
                      placeholder="Min 6 characters"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Confirm Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      value={addForm.confirmPassword}
                      onChange={(e) => setAddForm(f => ({ ...f, confirmPassword: e.target.value }))}
                      className="input-field pl-11 pr-11"
                      placeholder="Re-enter password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {addForm.confirmPassword && addForm.password !== addForm.confirmPassword && (
                    <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
                  )}
                  {addForm.confirmPassword && addForm.password === addForm.confirmPassword && addForm.password.length >= 6 && (
                    <p className="text-xs text-emerald-500 mt-1">Passwords match</p>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    disabled={adding}
                    className="flex-1 px-4 py-3 rounded-xl text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={adding}
                    className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold text-white shadow-sm hover:shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    style={{ backgroundColor: settings.primary_color }}
                  >
                    {adding ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4" />
                        Create Staff
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ============================== */}
      {/* Invite Link Modal */}
      {/* ============================== */}
      <AnimatePresence>
        {showInviteModal && inviteCode && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setShowInviteModal(false)}
            />
            <motion.div
              className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            >
              {/* Header */}
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between"
                   style={{ background: `linear-gradient(135deg, ${settings.primary_color}08, ${settings.primary_color}03)` }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                       style={{ backgroundColor: settings.primary_color + '15' }}>
                    <Link2 className="w-5 h-5" style={{ color: settings.primary_color }} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Staff Invite Link</h3>
                    <p className="text-xs text-gray-400">Share this link with new staff</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowInviteModal(false)}
                  className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-4">
                <p className="text-sm text-gray-600">
                  Send this link to the new staff member. They can register using <strong>Google</strong> or create a <strong>manual account</strong>.
                </p>

                {/* Link display */}
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                  <p className="text-xs text-gray-400 mb-1.5 font-medium">Invite URL</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs text-gray-700 bg-white border border-gray-100 rounded-lg px-3 py-2.5 break-all select-all font-mono leading-relaxed">
                      {inviteUrl}
                    </code>
                    <button
                      onClick={handleCopyInvite}
                      className={`shrink-0 p-2.5 rounded-xl transition-all ${
                        copied
                          ? 'bg-emerald-50 text-emerald-600'
                          : 'bg-white border border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                      }`}
                      title="Copy link"
                    >
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Expiry warning */}
                <div className="flex items-center gap-2 px-3.5 py-2.5 bg-amber-50/60 border border-amber-100 rounded-xl">
                  <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                  <div className="text-xs">
                    <span className="text-amber-700 font-medium">Expires in 48 hours</span>
                    <span className="text-amber-500 ml-1">
                      ({new Date(inviteExpiry).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })})
                    </span>
                  </div>
                </div>

                {/* Info */}
                <div className="text-xs text-gray-400 space-y-1">
                  <p>&#8226; This link is single-use and will expire after registration</p>
                  <p>&#8226; The new staff will be assigned the <strong>Admin</strong> role</p>
                  <p>&#8226; After registering, they need to login separately</p>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-1">
                  <button
                    onClick={() => setShowInviteModal(false)}
                    className="flex-1 px-4 py-3 rounded-xl text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
                  >
                    Close
                  </button>
                  <button
                    onClick={handleCopyInvite}
                    className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold text-white shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2"
                    style={{ backgroundColor: settings.primary_color }}
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        Copy Link
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ============================== */}
      {/* Change Password Modal */}
      {/* ============================== */}
      <AnimatePresence>
        {passwordTarget && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => !savingPassword && setPasswordTarget(null)}
            />

            {/* Modal */}
            <motion.div
              className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            >
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between"
                   style={{ background: `linear-gradient(135deg, ${settings.primary_color}08, ${settings.primary_color}03)` }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-amber-50">
                    <KeyRound className="w-5 h-5 text-amber-500" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Change Password</h3>
                    <p className="text-xs text-gray-400">
                      {passwordTarget.id === user?.id ? 'Update your own password' : passwordTarget.name}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => !savingPassword && setPasswordTarget(null)}
                  className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <form onSubmit={handlePasswordSubmit} className="p-6 space-y-4">
                {/* Staff info card */}
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                  {passwordTarget.avatar ? (
                    <img
                      src={passwordTarget.avatar}
                      alt={passwordTarget.name}
                      className="w-10 h-10 rounded-full object-cover ring-2 ring-white shadow-sm"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                      style={{ backgroundColor: settings.primary_color }}
                    >
                      {passwordTarget.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900 text-sm truncate">{passwordTarget.name}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-400 font-mono">{passwordTarget.user_code}</span>
                      {getRoleBadge(passwordTarget.role)}
                    </div>
                  </div>
                </div>

                {/* Error Message */}
                <AnimatePresence>
                  {passwordError && (
                    <motion.div
                      className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm text-center"
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                    >
                      {passwordError}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* New Password */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    New Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={passwordForm.password}
                      onChange={(e) => setPasswordForm(f => ({ ...f, password: e.target.value }))}
                      className="input-field pl-11 pr-11"
                      placeholder="Min 6 characters"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {/* Password strength hint */}
                  {passwordForm.password.length > 0 && passwordForm.password.length < 6 && (
                    <p className="text-[11px] text-amber-500 mt-1">Password too short ({passwordForm.password.length}/6 chars)</p>
                  )}
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Confirm Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type={showNewConfirm ? 'text' : 'password'}
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm(f => ({ ...f, confirmPassword: e.target.value }))}
                      className="input-field pl-11 pr-11"
                      placeholder="Re-enter new password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewConfirm(!showNewConfirm)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showNewConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {passwordForm.confirmPassword && passwordForm.password !== passwordForm.confirmPassword && (
                    <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
                  )}
                  {passwordForm.confirmPassword && passwordForm.password === passwordForm.confirmPassword && passwordForm.password.length >= 6 && (
                    <p className="text-xs text-emerald-500 mt-1 flex items-center gap-1">
                      <Check className="w-3 h-3" /> Passwords match
                    </p>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setPasswordTarget(null)}
                    disabled={savingPassword}
                    className="flex-1 px-4 py-3 rounded-xl text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingPassword || passwordForm.password.length < 6 || passwordForm.password !== passwordForm.confirmPassword}
                    className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold text-white shadow-sm hover:shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    style={{ backgroundColor: settings.primary_color }}
                  >
                    {savingPassword ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <KeyRound className="w-4 h-4" />
                        Update Password
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ============================== */}
      {/* Delete Confirmation Modal */}
      {/* ============================== */}
      <AnimatePresence>
        {deleteTarget && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => !deleting && setDeleteTarget(null)}
            />

            {/* Modal */}
            <motion.div
              className="relative bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <button
                onClick={() => !deleting && setDeleteTarget(null)}
                className="absolute top-4 right-4 p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="text-center">
                <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="w-7 h-7 text-red-500" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Staff</h3>
                <p className="text-sm text-gray-500 mb-1">
                  Are you sure you want to delete this staff member?
                </p>
                <div className="bg-gray-50 rounded-xl p-3 mb-4">
                  <p className="font-semibold text-gray-900">{deleteTarget.name}</p>
                  <p className="text-xs text-gray-400">{deleteTarget.user_code} &bull; {deleteTarget.email || deleteTarget.phone || 'No contact'}</p>
                </div>
                <p className="text-xs text-red-500 font-medium mb-5">
                  This action cannot be undone.
                </p>

                <div className="flex gap-3">
                  <button
                    onClick={() => setDeleteTarget(null)}
                    disabled={deleting}
                    className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {deleting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
