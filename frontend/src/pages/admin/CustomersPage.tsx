import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Search, ChevronLeft, ChevronRight, Phone, Mail, CreditCard, Car, Calendar, Trash2, Pencil, X, User, Save, Plus, Star, XCircle, Eye } from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';
import { useAuth } from '../../context/AuthContext';
import { adminService, customerService } from '../../services/api';
import { useToast } from '../../components/ui/Toast';
import ConfirmModal from '../../components/ui/ConfirmModal';
import CustomerDetailModal from '../../components/admin/CustomerDetailModal';
import type { CustomerWithCard, Vehicle } from '../../types';

interface EditFormData {
  name: string;
  phone: string;
  email: string;
}

export default function CustomersPage() {
  const { settings } = useSettings();
  const { user } = useAuth();
  const toast = useToast();
  const [customers, setCustomers] = useState<CustomerWithCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<CustomerWithCard | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Edit modal state
  const [editTarget, setEditTarget] = useState<CustomerWithCard | null>(null);
  const [editForm, setEditForm] = useState<EditFormData>({ name: '', phone: '', email: '' });
  const [saving, setSaving] = useState(false);

  // Detail modal state
  const [detailTarget, setDetailTarget] = useState<CustomerWithCard | null>(null);
  const [detailData, setDetailData] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Vehicle management in edit modal
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loadingVehicles, setLoadingVehicles] = useState(false);
  const [newPlate, setNewPlate] = useState('');
  const [newVehicleType, setNewVehicleType] = useState('car');
  const [addingVehicle, setAddingVehicle] = useState(false);
  const [removingVehicleId, setRemovingVehicleId] = useState<number | null>(null);

  const isSuperAdmin = user?.role === 'super_admin';
  const requireVehicle = settings.require_vehicle === '1';

  const fetchVehicles = async (customerId: number) => {
    setLoadingVehicles(true);
    try {
      const res = await adminService.getCustomerVehicles(customerId);
      if (res.data.success) {
        setVehicles(res.data.vehicles || []);
      }
    } catch {
      // silent
    } finally {
      setLoadingVehicles(false);
    }
  };

  const openEditModal = (customer: CustomerWithCard) => {
    setEditTarget(customer);
    setEditForm({
      name: customer.name || '',
      phone: customer.phone || '',
      email: customer.email || '',
    });
    setNewPlate('');
    setNewVehicleType('car');
    fetchVehicles(customer.id);
  };

  const closeEditModal = () => {
    if (saving) return;
    setEditTarget(null);
    setEditForm({ name: '', phone: '', email: '' });
    setVehicles([]);
    setNewPlate('');
  };

  const openDetailModal = async (customer: CustomerWithCard) => {
    setDetailTarget(customer);
    setDetailData(null);
    setLoadingDetail(true);
    try {
      const res = await adminService.getCustomerDetail(customer.id);
      if (res.data.success) {
        setDetailData(res.data);
      } else {
        toast.error('Failed to load customer details');
        setDetailTarget(null);
      }
    } catch {
      toast.error('Failed to load customer details');
      setDetailTarget(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  const closeDetailModal = () => {
    setDetailTarget(null);
    setDetailData(null);
  };

  const handleEdit = async () => {
    if (!editTarget) return;
    if (!editForm.name.trim()) {
      toast.error('Customer name cannot be empty');
      return;
    }
    setSaving(true);
    try {
      const res = await adminService.updateCustomer(editTarget.id, {
        name: editForm.name.trim(),
        phone: editForm.phone.trim(),
        email: editForm.email.trim(),
      });
      if (res.data.success) {
        toast.success(res.data.message || 'Customer updated successfully');
        setSaving(false);
        setEditTarget(null);
        setEditForm({ name: '', phone: '', email: '' });
        setVehicles([]);
        setNewPlate('');
        fetchCustomers(page, search || undefined);
      } else {
        toast.error(res.data.message || 'Failed to update customer');
        setSaving(false);
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to update customer';
      toast.error(msg);
      setSaving(false);
    }
  };

  const handleAddVehicle = async () => {
    if (!editTarget || !newPlate.trim()) return;
    setAddingVehicle(true);
    try {
      const res = await customerService.addVehicle({
        plate_number: newPlate.trim().toUpperCase(),
        vehicle_type: newVehicleType,
        user_id: editTarget.id,
      });
      if (res.data.success) {
        toast.success('Vehicle added successfully');
        setVehicles(res.data.vehicles || []);
        setNewPlate('');
        setNewVehicleType('car');
      } else {
        toast.error(res.data.message || 'Failed to add vehicle');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to add vehicle');
    } finally {
      setAddingVehicle(false);
    }
  };

  const handleRemoveVehicle = async (vehicleId: number) => {
    if (!editTarget) return;
    setRemovingVehicleId(vehicleId);
    try {
      const res = await customerService.removeVehicle(vehicleId, editTarget.id);
      if (res.data.success) {
        toast.success('Vehicle removed');
        setVehicles(res.data.vehicles || []);
      } else {
        toast.error(res.data.message || 'Failed to remove vehicle');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to remove vehicle');
    } finally {
      setRemovingVehicleId(null);
    }
  };

  const handleSetPrimary = async (vehicleId: number) => {
    if (!editTarget) return;
    try {
      const res = await customerService.setPrimaryVehicle(vehicleId, editTarget.id);
      if (res.data.success) {
        toast.success('Primary vehicle updated');
        fetchVehicles(editTarget.id);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to set primary');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await adminService.deleteCustomer(deleteTarget.id);
      if (res.data.success) {
        toast.success(res.data.message || 'Customer deleted successfully');
        setDeleteTarget(null);
        fetchCustomers(page, search || undefined);
      } else {
        toast.error(res.data.message || 'Failed to delete customer');
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to delete customer';
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  };

  const fetchCustomers = async (p: number, q?: string) => {
    setLoading(true);
    try {
      let data;
      if (q && q.length >= 1) {
        const res = await adminService.searchCustomers(q);
        data = res.data;
        if (data.success) {
          setCustomers(data.customers || []);
          setTotal(data.customers?.length || 0);
          setTotalPages(1);
        }
      } else {
        const res = await adminService.listCustomers(p, 10);
        data = res.data;
        if (data.success) {
          setCustomers(data.customers || []);
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
    fetchCustomers(page);
  }, [page]);

  const handleSearch = () => {
    setPage(1);
    fetchCustomers(1, search);
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
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
            placeholder="Search by name, phone, plate, ID..."
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
            onClick={() => { setSearch(''); fetchCustomers(1); }}
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
      ) : customers.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <Users className="w-14 h-14 mx-auto text-gray-200 mb-3" />
          <p className="text-gray-400 font-medium">No customers found</p>
          <p className="text-xs text-gray-300 mt-1">{search ? 'Try different search terms' : 'Customers will appear here'}</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Table header info bar */}
          <div className="px-4 py-3 bg-gray-50/80 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4" style={{ color: settings.primary_color }} />
              <span className="text-sm font-semibold text-gray-700">Customer List</span>
            </div>
            <span className="text-xs text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full font-medium">
              {total} customer{total !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/30">
                  <th className="text-center px-3 py-3 font-semibold text-gray-500 text-[10px] uppercase tracking-wider w-10">#</th>
                  <th className="text-left px-3 py-3 font-semibold text-gray-500 text-[10px] uppercase tracking-wider">Customer</th>
                  <th className="text-left px-3 py-3 font-semibold text-gray-500 text-[10px] uppercase tracking-wider hidden sm:table-cell">Contact</th>
                  {requireVehicle && <th className="text-left px-3 py-3 font-semibold text-gray-500 text-[10px] uppercase tracking-wider hidden md:table-cell">Vehicle</th>}
                  <th className="text-center px-3 py-3 font-semibold text-gray-500 text-[10px] uppercase tracking-wider">Card</th>
                  <th className="text-center px-3 py-3 font-semibold text-gray-500 text-[10px] uppercase tracking-wider hidden sm:table-cell">Completed</th>
                  <th className="text-right px-3 py-3 font-semibold text-gray-500 text-[10px] uppercase tracking-wider hidden lg:table-cell">Joined</th>
                  <th className="text-center px-3 py-3 font-semibold text-gray-500 text-[10px] uppercase tracking-wider w-20">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {customers.map((customer, i) => {
                  const rowNum = (page - 1) * 10 + i + 1;
                  return (
                    <motion.tr
                      key={customer.id}
                      className={`hover:bg-blue-50/30 transition-colors group ${customer.status !== 'active' ? 'opacity-60' : ''}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.02 }}
                    >
                      <td className="px-3 py-3 text-center">
                        <span className="text-[10px] font-medium text-gray-400">{rowNum}</span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2.5">
                          {customer.avatar ? (
                            <img
                              src={customer.avatar}
                              alt={customer.name}
                              className="w-9 h-9 rounded-full object-cover shrink-0 ring-2 ring-white shadow-sm"
                              referrerPolicy="no-referrer"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden'); }}
                            />
                          ) : null}
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${customer.avatar ? 'hidden' : ''}`}
                               style={{ backgroundColor: settings.primary_color + '15' }}>
                            <span className="text-xs font-bold" style={{ color: settings.primary_color }}>
                              {customer.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p
                                className="font-semibold text-gray-900 truncate text-[13px] cursor-pointer hover:underline"
                                style={{ color: customer.status === 'active' ? settings.primary_color : '#9ca3af' }}
                                onClick={() => openDetailModal(customer)}
                              >{customer.name}</p>
                              {customer.google_id && (
                                <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
                                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                                </svg>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] text-gray-400 font-mono">{customer.user_code}</span>
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                                customer.status === 'banned' ? 'bg-red-50 text-red-600 border border-red-200' :
                                customer.status === 'inactive' ? 'bg-yellow-50 text-yellow-600 border border-yellow-200' :
                                'bg-green-50 text-green-600 border border-green-200'
                              }`}>
                                {customer.status === 'banned' ? 'Banned' : customer.status === 'inactive' ? 'Inactive' : 'Active'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 hidden sm:table-cell">
                        <div className="space-y-0.5">
                          {customer.phone && (
                            <div className="flex items-center gap-1 text-xs text-gray-600">
                              <Phone className="w-3 h-3 text-gray-400" />{customer.phone}
                            </div>
                          )}
                          {customer.email && (
                            <div className="flex items-center gap-1 text-[10px] text-gray-400 truncate max-w-[180px]">
                              <Mail className="w-3 h-3 shrink-0" />{customer.email}
                            </div>
                          )}
                          {!customer.phone && !customer.email && (
                            <span className="text-gray-300 text-xs">-</span>
                          )}
                        </div>
                      </td>
                      {requireVehicle && (
                      <td className="px-3 py-3 hidden md:table-cell">
                        {(customer.plate_numbers && customer.plate_numbers.length > 0) ? (
                          <div className="flex flex-wrap gap-1">
                            {customer.plate_numbers.map((plate, idx) => (
                              <span key={idx} className="inline-flex items-center gap-1 text-xs font-medium text-gray-700 bg-gray-100 px-2 py-0.5 rounded-md">
                                <Car className="w-3 h-3 text-gray-400" />{plate}
                              </span>
                            ))}
                          </div>
                        ) : customer.plate_number ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-700 bg-gray-100 px-2 py-0.5 rounded-md">
                            <Car className="w-3 h-3 text-gray-400" />{customer.plate_number}
                          </span>
                        ) : <span className="text-gray-300 text-xs">-</span>}
                      </td>
                      )}
                      <td className="px-3 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <CreditCard className="w-3 h-3 text-gray-400" />
                          <span className="font-bold text-xs" style={{ color: settings.primary_color }}>
                            {customer.tokens_earned}/{customer.tokens_required}
                          </span>
                        </div>
                        {/* Progress bar */}
                        <div className="w-14 h-1.5 bg-gray-100 rounded-full mt-1 mx-auto overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${Math.min(100, (customer.tokens_earned / (customer.tokens_required || 10)) * 100)}%`,
                              backgroundColor: customer.tokens_earned >= (customer.tokens_required || 10) ? '#22c55e' : settings.primary_color,
                            }}
                          />
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center hidden sm:table-cell">
                        {(customer.completed_cards ?? 0) > 0 ? (
                          <span className="inline-flex items-center justify-center text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">
                            {customer.completed_cards} card{(customer.completed_cards ?? 0) !== 1 ? 's' : ''}
                          </span>
                        ) : (
                          <span className="text-gray-300 text-xs">-</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right hidden lg:table-cell">
                        <div className="flex items-center justify-end gap-1">
                          <Calendar className="w-3 h-3 text-gray-400" />
                          <span className="text-xs text-gray-500 whitespace-nowrap">{formatDate(customer.created_at)}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <div className="flex items-center justify-center gap-0.5">
                          <button
                            onClick={() => openDetailModal(customer)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
                            title="View details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openEditModal(customer)}
                            className="p-1.5 rounded-lg text-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all"
                            title="Edit customer"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          {isSuperAdmin && (
                            <button
                              onClick={() => setDeleteTarget(customer)}
                              className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-all"
                              title="Delete customer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
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
              <span className="font-semibold text-gray-700">{total}</span> customers
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

                {/* Page numbers */}
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

      {/* ===== Edit Customer Modal ===== */}
      <AnimatePresence>
        {editTarget && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* Backdrop */}
            <motion.div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeEditModal}
            />

            {/* Modal */}
            <motion.div
              className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] flex flex-col"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            >
              {/* Close button */}
              <button
                onClick={closeEditModal}
                className="absolute top-3 right-3 p-1.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors z-10"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Scrollable content */}
              <div className="overflow-y-auto flex-1">
                {/* Header */}
                <div className="p-6 pb-0 text-center">
                  <motion.div
                    className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
                    style={{ backgroundColor: settings.primary_color + '15' }}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', damping: 15, stiffness: 300, delay: 0.1 }}
                  >
                    {editTarget.avatar ? (
                      <img
                        src={editTarget.avatar}
                        alt={editTarget.name}
                        className="w-14 h-14 rounded-full object-cover ring-2 ring-white shadow-sm"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <User className="w-7 h-7" style={{ color: settings.primary_color }} />
                    )}
                  </motion.div>
                  <h3 className="text-lg font-bold text-gray-900 mb-0.5">Edit Customer</h3>
                  <p className="text-xs text-gray-400 font-mono">{editTarget.user_code}</p>
                </div>

                {/* Form */}
                <div className="p-6 space-y-4">
                  {/* Name */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                      <span className="flex items-center gap-1"><User className="w-3 h-3" /> Full Name</span>
                    </label>
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:border-transparent transition-all"
                      style={{ '--tw-ring-color': settings.primary_color } as any}
                      placeholder="Customer name"
                      autoFocus
                    />
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                      <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> Phone Number</span>
                    </label>
                    <input
                      type="tel"
                      value={editForm.phone}
                      onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:border-transparent transition-all"
                      style={{ '--tw-ring-color': settings.primary_color } as any}
                      placeholder="e.g. 012-3456789"
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                      <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> Email Address</span>
                    </label>
                    <input
                      type="email"
                      value={editForm.email}
                      onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:border-transparent transition-all"
                      style={{ '--tw-ring-color': settings.primary_color } as any}
                      placeholder="customer@email.com"
                    />
                    {editTarget.google_id && (
                      <p className="mt-1.5 text-[10px] text-amber-500 flex items-center gap-1">
                        <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24">
                          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                        </svg>
                        Google linked account - email changes won't affect login
                      </p>
                    )}
                  </div>

                  {/* ===== Vehicles Section ===== */}
                  {requireVehicle && <div className="pt-2">
                    <div className="flex items-center justify-between mb-2.5">
                      <label className="text-xs font-semibold text-gray-600 flex items-center gap-1">
                        <Car className="w-3 h-3" /> Vehicles (Plate Number)
                      </label>
                      <span className="text-[10px] text-gray-400 font-medium">
                        {vehicles.length} vehicle{vehicles.length !== 1 ? 's' : ''}
                      </span>
                    </div>

                    {/* Existing vehicles */}
                    {loadingVehicles ? (
                      <div className="space-y-2">
                        {[1, 2].map(i => (
                          <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />
                        ))}
                      </div>
                    ) : vehicles.length > 0 ? (
                      <div className="space-y-1.5 mb-3">
                        {vehicles.map((v) => (
                          <div
                            key={v.id}
                            className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2 border border-gray-100 group/vehicle"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <Car className="w-4 h-4 text-gray-400 shrink-0" />
                              <span className="text-sm font-bold text-gray-800 tracking-wide uppercase">{v.plate_number}</span>
                              {v.is_primary && (
                                <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600">
                                  <Star className="w-2.5 h-2.5" fill="currentColor" />
                                  Primary
                                </span>
                              )}
                              {v.vehicle_type && (
                                <span className="text-[10px] text-gray-400 capitalize">{v.vehicle_type}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {!v.is_primary && (
                                <button
                                  onClick={() => handleSetPrimary(v.id)}
                                  className="p-1 rounded-md text-gray-300 hover:text-amber-500 hover:bg-amber-50 transition-all opacity-0 group-hover/vehicle:opacity-100"
                                  title="Set as primary"
                                >
                                  <Star className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                onClick={() => handleRemoveVehicle(v.id)}
                                disabled={removingVehicleId === v.id}
                                className="p-1 rounded-md text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover/vehicle:opacity-100 disabled:opacity-50"
                                title="Remove vehicle"
                              >
                                {removingVehicleId === v.id ? (
                                  <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                  </svg>
                                ) : (
                                  <XCircle className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-3 bg-gray-50 rounded-xl border border-dashed border-gray-200 mb-3">
                        <Car className="w-5 h-5 mx-auto text-gray-300 mb-1" />
                        <p className="text-[10px] text-gray-400">No vehicles registered</p>
                      </div>
                    )}

                    {/* Add new vehicle */}
                    <div className="flex gap-2">
                      <div className="flex-1 relative">
                        <input
                          type="text"
                          value={newPlate}
                          onChange={(e) => setNewPlate(e.target.value.toUpperCase())}
                          onKeyDown={(e) => e.key === 'Enter' && newPlate.trim() && handleAddVehicle()}
                          className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm font-bold tracking-wide uppercase focus:outline-none focus:ring-2 focus:border-transparent transition-all placeholder:font-normal placeholder:normal-case placeholder:tracking-normal"
                          style={{ '--tw-ring-color': settings.primary_color } as any}
                          placeholder="Add plate number..."
                        />
                      </div>
                      <select
                        value={newVehicleType}
                        onChange={(e) => setNewVehicleType(e.target.value)}
                        className="px-2 py-2 rounded-xl border border-gray-200 text-xs text-gray-600 focus:outline-none focus:ring-2 focus:border-transparent bg-white"
                        style={{ '--tw-ring-color': settings.primary_color } as any}
                      >
                        <option value="car">Car</option>
                        <option value="motorcycle">Motor</option>
                        <option value="suv">SUV</option>
                        <option value="van">Van</option>
                        <option value="truck">Truck</option>
                      </select>
                      <button
                        onClick={handleAddVehicle}
                        disabled={addingVehicle || !newPlate.trim()}
                        className="px-3 py-2 rounded-xl text-white text-sm font-semibold transition-all disabled:opacity-40 flex items-center gap-1"
                        style={{ backgroundColor: settings.primary_color }}
                      >
                        {addingVehicle ? (
                          <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                        ) : (
                          <Plus className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>}
                </div>
              </div>

              {/* Actions - fixed at bottom */}
              <div className="flex gap-3 p-4 pt-3 pb-6 px-6 border-t border-gray-100 bg-white shrink-0">
                <button
                  onClick={closeEditModal}
                  disabled={saving}
                  className="flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleEdit}
                  disabled={saving || !editForm.name.trim()}
                  className="flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold text-white transition-colors disabled:opacity-70 focus:outline-none focus:ring-2 focus:ring-offset-2"
                  style={{ backgroundColor: settings.primary_color }}
                >
                  {saving ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Saving...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-1.5">
                      <Save className="w-4 h-4" />
                      Save Changes
                    </span>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Customer Detail Modal */}
      <CustomerDetailModal
        isOpen={!!detailTarget}
        onClose={closeDetailModal}
        customer={detailTarget}
        data={detailData}
        loading={loadingDetail}
        onStatusChange={() => fetchCustomers(page, search || undefined)}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Customer"
        message={`Are you sure you want to delete "${deleteTarget?.name}" (${deleteTarget?.user_code})? All their cards, tokens, vehicles, and redemption history will be permanently removed. This action cannot be undone.`}
        confirmText={deleting ? 'Deleting...' : 'Delete'}
        variant="danger"
        loading={deleting}
      />
    </div>
  );
}
