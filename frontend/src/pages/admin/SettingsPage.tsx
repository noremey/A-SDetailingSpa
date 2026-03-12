import { useState, useEffect, useRef, Fragment } from 'react';
import {
  Save, Store, Palette, Coins, Gift, DollarSign, Upload, X, Camera, Trash2,
  Sparkles, Pencil, Plus, Check, GripVertical, Globe, Clock, ChevronRight, ChevronDown, ChevronUp,
  Building2, Phone, Mail, MapPin, CreditCard, Eye, Image, AlertCircle, Shield,
  Users as UsersIcon, Lock, QrCode, Download, Printer, Copy, Bell,
  FolderOpen, Layers, ArrowUp, ArrowDown,
  type LucideIcon,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { useSettings } from '../../context/SettingsContext';
import { useAuth } from '../../context/AuthContext';
import { adminService } from '../../services/api';
import { useToast } from '../../components/ui/Toast';
import { Service, ServiceCategory } from '../../types';
import { allNavItems } from '../../components/layout/AdminLayout';
import QRPosterModal from '../../components/ui/QRPosterModal';
import html2canvas from 'html2canvas';

// ─── Shared Components ───────────────────────────────────────────────

function SectionCard({
  icon: Icon,
  title,
  description,
  children,
  accentColor,
  actions,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  children: React.ReactNode;
  accentColor: string;
  actions?: React.ReactNode;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
    >
      <div className="px-6 py-5 border-b border-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: accentColor + '14' }}
            >
              <Icon className="w-5 h-5" style={{ color: accentColor }} />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900 text-[15px]">{title}</h2>
              {description && (
                <p className="text-xs text-gray-500 mt-0.5">{description}</p>
              )}
            </div>
          </div>
          {actions}
        </div>
      </div>
      <div className="px-6 py-5">{children}</div>
    </motion.section>
  );
}

function FieldGroup({
  label,
  hint,
  icon: Icon,
  children,
  error,
}: {
  label: string;
  hint?: string;
  icon?: LucideIcon;
  children: React.ReactNode;
  error?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
        {Icon && <Icon className="w-3.5 h-3.5 text-gray-400" />}
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-gray-400 pl-0.5">{hint}</p>}
      {error && (
        <p className="text-xs text-red-500 pl-0.5 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" /> {error}
        </p>
      )}
    </div>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
  accentColor,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: () => void;
  accentColor: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5 group">
      <div className="min-w-0">
        <p className="font-medium text-gray-900 text-sm">{label}</p>
        <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={onChange}
        className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        style={{ backgroundColor: checked ? accentColor : '#d1d5db' }}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition-transform duration-200 ease-in-out ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}

function Spinner({ size = 16 }: { size?: number }) {
  return (
    <svg className="animate-spin" width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

const colorPresets = [
  { name: 'Indigo', primary: '#6366f1', secondary: '#8b5cf6' },
  { name: 'Blue', primary: '#3b82f6', secondary: '#06b6d4' },
  { name: 'Emerald', primary: '#10b981', secondary: '#14b8a6' },
  { name: 'Rose', primary: '#f43f5e', secondary: '#ec4899' },
  { name: 'Amber', primary: '#f59e0b', secondary: '#f97316' },
  { name: 'Slate', primary: '#475569', secondary: '#64748b' },
];

// ─── ServiceRow Component ────────────────────────────────────────────

function ServiceRow({
  service, accent, currency,
  editingService, editName, editPrice, savingService, deletingService,
  onEdit, onDelete, onToggleStatus,
  onEditNameChange, onEditPriceChange,
  onSaveEdit, onCancelEdit, onConfirmDelete, onCancelDelete,
}: {
  service: Service; accent: string; currency: string;
  editingService: number | null; editName: string; editPrice: string;
  savingService: boolean; deletingService: number | null;
  onEdit: () => void; onDelete: () => void; onToggleStatus: () => void;
  onEditNameChange: (v: string) => void; onEditPriceChange: (v: string) => void;
  onSaveEdit: () => void; onCancelEdit: () => void;
  onConfirmDelete: () => void; onCancelDelete: () => void;
}) {
  if (deletingService === service.id) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
        className="flex items-center justify-between bg-red-50 px-4 py-2.5">
        <p className="text-sm text-red-700">Delete <span className="font-semibold">{service.name}</span>?</p>
        <div className="flex gap-2">
          <button onClick={onConfirmDelete} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-red-500 hover:bg-red-600">Delete</button>
          <button onClick={onCancelDelete} className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 bg-white border border-gray-200 hover:bg-gray-50">Cancel</button>
        </div>
      </motion.div>
    );
  }

  if (editingService === service.id) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 px-4 py-2.5">
        <input type="text" value={editName} onChange={e => onEditNameChange(e.target.value)}
          className="input-field flex-1 text-sm !py-2" autoFocus
          onKeyDown={e => { if (e.key === 'Enter') onSaveEdit(); if (e.key === 'Escape') onCancelEdit(); }} />
        <div className="relative w-24">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">{currency}</span>
          <input type="text" inputMode="decimal" value={editPrice}
            onChange={e => { const v = e.target.value.replace(/[^0-9.]/g, ''); const p = v.split('.'); onEditPriceChange(p.length > 2 ? p[0] + '.' + p.slice(1).join('') : v); }}
            className="input-field pl-8 text-right text-sm !py-2 font-medium w-full"
            onKeyDown={e => { if (e.key === 'Enter') onSaveEdit(); if (e.key === 'Escape') onCancelEdit(); }} />
        </div>
        <button onClick={onSaveEdit} disabled={savingService} className="p-2 rounded-lg text-white" style={{ backgroundColor: accent }}><Check className="w-4 h-4" /></button>
        <button onClick={onCancelEdit} className="p-2 rounded-lg text-gray-400 hover:bg-gray-100"><X className="w-4 h-4" /></button>
      </motion.div>
    );
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 group hover:bg-gray-50/50 transition-colors">
      <div className="flex-1 min-w-0">
        <p className={`font-medium text-sm truncate ${service.status === 'inactive' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{service.name}</p>
      </div>
      <span className={`text-sm font-semibold whitespace-nowrap tabular-nums ${service.status === 'inactive' ? 'text-gray-300' : 'text-gray-700'}`}>
        {currency}{service.price.toFixed(2)}
      </span>
      <button onClick={onToggleStatus}
        className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200"
        style={{ backgroundColor: service.status === 'active' ? '#22c55e' : '#d1d5db' }}>
        <span className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${service.status === 'active' ? 'translate-x-4' : 'translate-x-0'}`} />
      </button>
      <button onClick={onEdit} className="p-1.5 rounded-lg text-gray-300 hover:text-gray-600 hover:bg-gray-100 transition-all opacity-0 group-hover:opacity-100"><Pencil className="w-3.5 h-3.5" /></button>
      <button onClick={onDelete} className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"><Trash2 className="w-3.5 h-3.5" /></button>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────

export default function SettingsPage() {
  const { settings, refreshSettings } = useSettings();
  const { user } = useAuth();
  const toast = useToast();
  const isSuperAdmin = user?.role === 'super_admin';

  // Check if broadcast menu is visible for this user's role
  const isBroadcastVisible = (() => {
    const role = user?.role;
    let menuSetting = '';
    if (role === 'super_admin') menuSetting = settings.super_admin_visible_menus;
    else if (role === 'admin') menuSetting = settings.admin_visible_menus;
    else if (role === 'staff') menuSetting = settings.staff_visible_menus;
    if (!menuSetting) return true; // no restriction = all visible
    try {
      const keys: string[] = JSON.parse(menuSetting);
      return keys.includes('broadcast');
    } catch { return true; }
  })();
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Logo upload state
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Categories state
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState('#6366f1');
  const [savingCategory, setSavingCategory] = useState(false);
  const [editingCategory, setEditingCategory] = useState<number | null>(null);
  const [editCategoryName, setEditCategoryName] = useState('');
  const [editCategoryColor, setEditCategoryColor] = useState('');
  const [deletingCategory, setDeletingCategory] = useState<number | null>(null);
  const [colorPickerCat, setColorPickerCat] = useState<number | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<number | 'uncategorized'>>(new Set());

  // Services state
  const [services, setServices] = useState<Service[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [showAddService, setShowAddService] = useState<number | 'uncategorized' | null>(null);
  const [newServiceName, setNewServiceName] = useState('');
  const [newServicePrice, setNewServicePrice] = useState('');
  const [editingService, setEditingService] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [savingService, setSavingService] = useState(false);
  const [deletingService, setDeletingService] = useState<number | null>(null);

  // Saved feedback
  const [saveSuccess, setSaveSuccess] = useState(false);

  // QR Code & Push state
  const [showPosterModal, setShowPosterModal] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [downloadingQr, setDownloadingQr] = useState(false);
  const [generatingVapid, setGeneratingVapid] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);

  // Build registration URL
  const basePath = import.meta.env.BASE_URL || '/ansspa/';
  const registrationUrl = `${window.location.origin}${basePath}users/?register=1`;

  useEffect(() => {
    setForm({ ...settings });
    setHasChanges(false);
  }, [settings]);

  const handleChange = (key: string, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleToggle = (key: string) => {
    setForm(prev => ({ ...prev, [key]: prev[key] === '1' ? '0' : '1' }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data } = await adminService.updateSettings(form);
      if (data.success) {
        toast.success('Settings saved successfully!');
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
        setHasChanges(false);
        refreshSettings();
      } else {
        toast.error('Failed to save settings');
      }
    } catch (err: any) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  // Logo handlers
  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be under 2MB');
      return;
    }
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setLogoPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleLogoUpload = async () => {
    if (!logoFile) return;
    setUploadingLogo(true);
    try {
      const { data } = await adminService.uploadLogo(logoFile);
      if (data.success) {
        toast.success('Logo uploaded successfully!');
        setLogoFile(null);
        setLogoPreview(null);
        refreshSettings();
      } else {
        toast.error(data.message || 'Upload failed');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Upload failed');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleLogoRemove = async () => {
    setUploadingLogo(true);
    try {
      const { data } = await adminService.removeLogo();
      if (data.success) {
        toast.success('Logo removed');
        setLogoFile(null);
        setLogoPreview(null);
        refreshSettings();
      }
    } catch {
      toast.error('Failed to remove logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  const cancelLogoPreview = () => {
    setLogoFile(null);
    setLogoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Load categories & services
  useEffect(() => {
    loadCategories();
    loadServices();
  }, []);

  const loadCategories = async () => {
    try {
      const { data } = await adminService.getCategories(true);
      if (data.success) {
        setCategories(data.categories);
        // Auto-expand all categories on first load
        if (expandedCategories.size === 0) {
          const ids = new Set<number | 'uncategorized'>(data.categories.map((c: ServiceCategory) => c.id));
          ids.add('uncategorized');
          setExpandedCategories(ids);
        }
      }
    } catch { /* silent */ }
    finally { setLoadingCategories(false); }
  };

  const loadServices = async () => {
    try {
      const { data } = await adminService.getServices(true);
      if (data.success) {
        setServices(data.services);
      }
    } catch { /* silent */ }
    finally { setLoadingServices(false); }
  };

  // ─── Category handlers ───
  const handleAddCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) { toast.error('Enter a category name'); return; }
    setSavingCategory(true);
    try {
      const { data } = await adminService.addCategory({ name, color: newCategoryColor });
      if (data.success) {
        toast.success('Category added!');
        setNewCategoryName('');
        setNewCategoryColor('#6366f1');
        setShowAddCategory(false);
        loadCategories();
        // Auto-expand new category
        if (data.category) {
          setExpandedCategories(prev => new Set([...prev, data.category.id]));
        }
      } else { toast.error(data.message || 'Failed'); }
    } catch { toast.error('Failed to add category'); }
    finally { setSavingCategory(false); }
  };

  const handleUpdateCategory = async (id: number) => {
    const name = editCategoryName.trim();
    if (!name) { toast.error('Enter a category name'); return; }
    setSavingCategory(true);
    try {
      const { data } = await adminService.updateCategory({ id, name, color: editCategoryColor });
      if (data.success) {
        toast.success('Category updated!');
        setEditingCategory(null);
        loadCategories();
      }
    } catch { toast.error('Failed to update category'); }
    finally { setSavingCategory(false); }
  };

  const confirmDeleteCategory = async (id: number) => {
    try {
      const { data } = await adminService.deleteCategory(id);
      if (data.success) {
        toast.success('Category deleted');
        setDeletingCategory(null);
        loadCategories();
        loadServices(); // services move to uncategorized
      }
    } catch { toast.error('Failed to delete category'); }
  };

  const handleCategoryColorChange = async (id: number, color: string) => {
    // Optimistic update
    setCategories(prev => prev.map(c => c.id === id ? { ...c, color } : c));
    try {
      const cat = categories.find(c => c.id === id);
      if (cat) await adminService.updateCategory({ id, name: cat.name, color });
    } catch { toast.error('Failed to update color'); loadCategories(); }
  };

  const toggleCategoryExpand = (id: number | 'uncategorized') => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleReorderCategory = async (index: number, direction: 'up' | 'down') => {
    const newCategories = [...categories];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= newCategories.length) return;
    [newCategories[index], newCategories[swapIndex]] = [newCategories[swapIndex], newCategories[index]];
    setCategories(newCategories);
    try {
      await adminService.reorderCategories(newCategories.map(c => c.id));
    } catch {
      toast.error('Failed to reorder');
      loadCategories();
    }
  };

  // ─── Service handlers ───
  const handleAddService = async () => {
    const name = newServiceName.trim();
    const price = parseFloat(newServicePrice);
    if (!name || isNaN(price) || price <= 0) {
      toast.error('Enter a valid name and price');
      return;
    }
    const categoryId = showAddService === 'uncategorized' ? null : (showAddService as number);
    setSavingService(true);
    try {
      const { data } = await adminService.addService({ name, price, category_id: categoryId });
      if (data.success) {
        toast.success('Service added!');
        setNewServiceName('');
        setNewServicePrice('');
        setShowAddService(null);
        loadServices();
      } else {
        toast.error(data.message || 'Failed to add service');
      }
    } catch {
      toast.error('Failed to add service');
    } finally {
      setSavingService(false);
    }
  };

  const handleUpdateService = async (id: number) => {
    const name = editName.trim();
    const price = parseFloat(editPrice);
    if (!name || isNaN(price) || price <= 0) {
      toast.error('Enter a valid name and price');
      return;
    }
    const service = services.find(s => s.id === id);
    if (!service) return;
    setSavingService(true);
    try {
      const { data } = await adminService.updateService({ id, name, price, status: service.status });
      if (data.success) {
        toast.success('Service updated!');
        setEditingService(null);
        loadServices();
      } else {
        toast.error(data.message || 'Failed to update');
      }
    } catch {
      toast.error('Failed to update service');
    } finally {
      setSavingService(false);
    }
  };

  const handleToggleServiceStatus = async (service: Service) => {
    const newStatus = service.status === 'active' ? 'inactive' : 'active';
    try {
      const { data } = await adminService.updateService({
        id: service.id,
        name: service.name,
        price: service.price,
        status: newStatus,
      });
      if (data.success) {
        toast.success(newStatus === 'active' ? 'Service activated' : 'Service deactivated');
        loadServices();
      }
    } catch {
      toast.error('Failed to update status');
    }
  };

  const handleDeleteService = async (id: number) => {
    setDeletingService(id);
  };

  const confirmDeleteService = async (id: number) => {
    try {
      const { data } = await adminService.deleteService(id);
      if (data.success) {
        toast.success('Service deleted');
        setDeletingService(null);
        loadServices();
      }
    } catch {
      toast.error('Failed to delete service');
    }
  };

  const startEditService = (service: Service) => {
    setEditingService(service.id);
    setEditName(service.name);
    setEditPrice(service.price.toFixed(2));
  };

  const currentLogo = settings.business_logo;
  const accent = form.primary_color || settings.primary_color || '#6366f1';

  return (
    <div className="pb-8">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your business profile, loyalty program, and appearance.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        {/* ═══════════ LEFT COLUMN ═══════════ */}
        <div className="space-y-5">
        {/* ─── Company Logo ──────────────────────────────────── */}
        <SectionCard
          icon={Image}
          title="Brand Logo"
          description="Your logo appears on loyalty cards and customer screens"
          accentColor={accent}
        >
          <div className="flex flex-col sm:flex-row items-start gap-5">
            {/* Logo Preview */}
            <div className="shrink-0">
              <div
                className={`w-28 h-28 rounded-2xl overflow-hidden flex items-center justify-center relative transition-all duration-200 ${
                  logoPreview || currentLogo
                    ? 'bg-gray-50 border border-gray-100 shadow-sm'
                    : 'border-2 border-dashed border-gray-200 bg-gray-50/50'
                }`}
              >
                {logoPreview ? (
                  <motion.img
                    src={logoPreview}
                    alt="Preview"
                    className="w-full h-full object-cover"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                  />
                ) : currentLogo ? (
                  <img src={currentLogo} alt="Business logo" className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center p-3">
                    <Camera className="w-7 h-7 text-gray-300 mx-auto" />
                    <p className="text-[10px] text-gray-400 mt-1.5 font-medium">No logo</p>
                  </div>
                )}
              </div>
            </div>

            {/* Upload Zone */}
            <div className="flex-1 w-full space-y-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileSelect(file);
                }}
              />

              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`
                  relative cursor-pointer rounded-xl border-2 border-dashed px-4 py-5 text-center
                  transition-all duration-200
                  ${dragOver
                    ? 'border-blue-400 bg-blue-50/50 scale-[1.01]'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50/50'
                  }
                `}
              >
                <Upload className={`w-5 h-5 mx-auto mb-1.5 ${dragOver ? 'text-blue-500' : 'text-gray-400'}`} />
                <p className="text-sm text-gray-600">
                  <span className="font-medium" style={{ color: accent }}>Click to upload</span> or drag & drop
                </p>
                <p className="text-[11px] text-gray-400 mt-1">JPG, PNG, GIF, WebP, SVG &middot; Max 2MB</p>
              </div>

              {/* Upload / Cancel actions */}
              <AnimatePresence>
                {logoPreview && logoFile && (
                  <motion.div
                    className="flex items-center gap-2"
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                  >
                    <button
                      onClick={handleLogoUpload}
                      disabled={uploadingLogo}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-medium text-white transition-all disabled:opacity-50 hover:opacity-90 active:scale-[0.98]"
                      style={{ backgroundColor: accent }}
                    >
                      {uploadingLogo ? <Spinner /> : <Upload className="w-4 h-4" />}
                      {uploadingLogo ? 'Uploading...' : 'Save Logo'}
                    </button>
                    <button
                      onClick={cancelLogoPreview}
                      className="p-2.5 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Remove existing logo */}
              {currentLogo && !logoPreview && (
                <button
                  onClick={handleLogoRemove}
                  disabled={uploadingLogo}
                  className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50 group"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="group-hover:underline">Remove logo</span>
                </button>
              )}
            </div>
          </div>
        </SectionCard>

        {/* ─── Business Information ──────────────────────────── */}
        <SectionCard
          icon={Building2}
          title="Business Information"
          description="Your business details shown to customers"
          accentColor={accent}
        >
          <div className="space-y-4">
            <FieldGroup label="Business Name" icon={Store}>
              <input
                type="text"
                value={form.business_name || ''}
                onChange={e => handleChange('business_name', e.target.value)}
                className="input-field"
                placeholder="Enter your business name"
              />
            </FieldGroup>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FieldGroup label="Phone" icon={Phone}>
                <input
                  type="tel"
                  value={form.business_phone || ''}
                  onChange={e => handleChange('business_phone', e.target.value)}
                  className="input-field"
                  placeholder="e.g. +60 12-345 6789"
                />
              </FieldGroup>
              <FieldGroup label="Email" icon={Mail}>
                <input
                  type="email"
                  value={form.business_email || ''}
                  onChange={e => handleChange('business_email', e.target.value)}
                  className="input-field"
                  placeholder="contact@business.com"
                />
              </FieldGroup>
            </div>

            <FieldGroup label="Business Type">
              <select
                value={form.business_type || 'general'}
                onChange={e => handleChange('business_type', e.target.value)}
                className="input-field appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2220%22%20height%3D%2220%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22%236b7280%22%3E%3Cpath%20fill-rule%3D%22evenodd%22%20d%3D%22M5.293%207.293a1%201%200%20011.414%200L10%2010.586l3.293-3.293a1%201%200%20111.414%201.414l-4%204a1%201%200%2001-1.414%200l-4-4a1%201%200%20010-1.414z%22%20clip-rule%3D%22evenodd%22%2F%3E%3C%2Fsvg%3E')] bg-[length:20px] bg-[right_12px_center] bg-no-repeat pr-10"
              >
                <option value="general">General</option>
                <option value="carwash">Car Wash</option>
                <option value="restaurant">Restaurant</option>
                <option value="cafe">Cafe</option>
                <option value="salon">Salon</option>
                <option value="retail">Retail</option>
                <option value="laundry">Laundry</option>
              </select>
            </FieldGroup>

            <FieldGroup label="Address" icon={MapPin}>
              <input
                type="text"
                value={form.business_address || ''}
                onChange={e => handleChange('business_address', e.target.value)}
                className="input-field"
                placeholder="Street address, city, state"
              />
            </FieldGroup>
          </div>
        </SectionCard>

        {/* ─── Theme & Appearance ─────────────────────────────── */}
        <SectionCard
          icon={Palette}
          title="Theme & Appearance"
          description="Customize your brand colors"
          accentColor={accent}
        >
          <div className="space-y-5">
            {/* Color presets */}
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2.5">Quick Presets</p>
              <div className="flex gap-2 flex-wrap">
                {colorPresets.map(preset => {
                  const isActive = form.primary_color === preset.primary && form.secondary_color === preset.secondary;
                  return (
                    <button
                      key={preset.name}
                      onClick={() => {
                        handleChange('primary_color', preset.primary);
                        handleChange('secondary_color', preset.secondary);
                      }}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-xs font-medium transition-all ${
                        isActive
                          ? 'border-gray-900 bg-gray-50 text-gray-900 shadow-sm'
                          : 'border-gray-100 text-gray-600 hover:border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <div
                        className="w-4 h-4 rounded-full shadow-inner"
                        style={{ background: `linear-gradient(135deg, ${preset.primary}, ${preset.secondary})` }}
                      />
                      {preset.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom color pickers */}
            <div className="grid grid-cols-2 gap-4">
              <FieldGroup label="Primary Color">
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <input
                      type="color"
                      value={form.primary_color || '#6366f1'}
                      onChange={e => handleChange('primary_color', e.target.value)}
                      className="w-10 h-10 rounded-xl border border-gray-200 cursor-pointer appearance-none bg-transparent p-0.5"
                      style={{ colorScheme: 'normal' }}
                    />
                  </div>
                  <input
                    type="text"
                    value={form.primary_color || ''}
                    onChange={e => handleChange('primary_color', e.target.value)}
                    className="input-field flex-1 font-mono text-sm !py-2.5"
                    placeholder="#6366f1"
                  />
                </div>
              </FieldGroup>
              <FieldGroup label="Secondary Color">
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <input
                      type="color"
                      value={form.secondary_color || '#8b5cf6'}
                      onChange={e => handleChange('secondary_color', e.target.value)}
                      className="w-10 h-10 rounded-xl border border-gray-200 cursor-pointer appearance-none bg-transparent p-0.5"
                      style={{ colorScheme: 'normal' }}
                    />
                  </div>
                  <input
                    type="text"
                    value={form.secondary_color || ''}
                    onChange={e => handleChange('secondary_color', e.target.value)}
                    className="input-field flex-1 font-mono text-sm !py-2.5"
                    placeholder="#8b5cf6"
                  />
                </div>
              </FieldGroup>
            </div>

            {/* Gradient preview */}
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2.5 flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5" /> Live Preview
              </p>
              <div
                className="h-20 rounded-2xl flex items-center justify-center text-white font-bold shadow-sm relative overflow-hidden"
                style={{ background: `linear-gradient(135deg, ${form.primary_color || '#6366f1'}, ${form.secondary_color || '#8b5cf6'})` }}
              >
                <div className="absolute inset-0 opacity-[0.07]" style={{
                  backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
                  backgroundSize: '24px 24px',
                }} />
                <span className="relative text-sm tracking-wide">Your Brand Gradient</span>
              </div>
            </div>
          </div>
        </SectionCard>

        {/* ─── QR Code & Registration ──────────────────────────── */}
        <SectionCard
          icon={QrCode}
          title="QR Code & Registration"
          description="Customer self-registration via QR code"
          accentColor="#8b5cf6"
        >
          <div className="space-y-5">
            {/* QR Code Display */}
            <div className="flex flex-col items-center">
              <div ref={qrRef} className="bg-white p-4 rounded-2xl border-2 border-gray-100 inline-block">
                <QRCodeSVG
                  value={registrationUrl}
                  size={180}
                  level="M"
                  bgColor="#ffffff"
                  fgColor="#111827"
                />
              </div>
              <p className="text-xs text-gray-400 mt-3 text-center">
                Customers scan this QR to register
              </p>
            </div>

            {/* URL Display + Copy */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={registrationUrl}
                className="flex-1 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-600 font-mono truncate"
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(registrationUrl);
                  setCopiedUrl(true);
                  setTimeout(() => setCopiedUrl(false), 2000);
                }}
                className="px-3 py-2.5 rounded-xl border border-gray-200 text-xs font-semibold transition-all hover:bg-gray-50 flex items-center gap-1.5 shrink-0"
                style={{ color: copiedUrl ? '#22c55e' : '#6b7280' }}
              >
                {copiedUrl ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedUrl ? 'Copied!' : 'Copy'}
              </button>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={async () => {
                  if (!qrRef.current) return;
                  setDownloadingQr(true);
                  try {
                    const canvas = await html2canvas(qrRef.current, { scale: 3, backgroundColor: '#ffffff', logging: false });
                    const link = document.createElement('a');
                    link.download = 'qr-code.png';
                    link.href = canvas.toDataURL('image/png');
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    toast.success('QR code downloaded!');
                  } catch { /* silent */ } finally {
                    setDownloadingQr(false);
                  }
                }}
                disabled={downloadingQr}
                className="py-2.5 rounded-xl border-2 text-sm font-semibold flex items-center justify-center gap-2 transition-all hover:bg-gray-50 active:scale-[0.98]"
                style={{ borderColor: '#8b5cf620', color: '#7c3aed' }}
              >
                {downloadingQr ? <Spinner size={14} /> : <Download className="w-4 h-4" />}
                Download QR
              </button>
              <button
                onClick={() => setShowPosterModal(true)}
                className="py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                style={{ background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)' }}
              >
                <Printer className="w-4 h-4" />
                Generate Poster
              </button>
            </div>
          </div>
        </SectionCard>

        {/* ─── Payment Settings ───────────────────────────────── */}
        <SectionCard
          icon={CreditCard}
          title="Payment Settings"
          description="Control payment tracking and spending requirements"
          accentColor={accent}
        >
          <div className="space-y-1">
            <Toggle
              label="Payment Tracking"
              description="Record payment amount each time a token is added"
              checked={form.payment_tracking_enabled === '1'}
              onChange={() => handleToggle('payment_tracking_enabled')}
              accentColor={accent}
            />

            <div className="border-t border-gray-100" />

            <Toggle
              label="Minimum Spend Requirement"
              description="Set a minimum spend per visit to earn a loyalty token"
              checked={form.min_spend_enabled === '1'}
              onChange={() => handleToggle('min_spend_enabled')}
              accentColor={accent}
            />

            <AnimatePresence>
              {form.min_spend_enabled === '1' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="pt-2 pb-1">
                    <FieldGroup label="Minimum Spend Amount">
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium text-sm">
                          {form.currency_symbol || 'RM'}
                        </span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={form.min_spend || '0'}
                          onChange={e => {
                            const val = e.target.value.replace(/[^0-9.]/g, '');
                            const parts = val.split('.');
                            const sanitized = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : val;
                            handleChange('min_spend', sanitized);
                          }}
                          onBlur={() => {
                            const num = parseFloat(form.min_spend || '0');
                            if (!isNaN(num)) {
                              handleChange('min_spend', num.toFixed(2));
                            }
                          }}
                          className="input-field pl-12 text-right font-medium"
                          placeholder="0.00"
                        />
                      </div>
                    </FieldGroup>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="border-t border-gray-100" />

            <Toggle
              label="Require Vehicle / Plate Number"
              description="Enable for car wash, disable for F&B or general retail (phone number only)"
              checked={form.require_vehicle === '1'}
              onChange={() => handleToggle('require_vehicle')}
              accentColor={accent}
            />
            <AnimatePresence>
              {form.require_vehicle !== '1' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="flex items-start gap-2 px-3 py-2 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-700">
                    <svg className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                    </svg>
                    <span>Vehicle info will be hidden from registration & token pages. Customers will be identified by phone number only.</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </SectionCard>

        {/* ─── POS Terminal ──────────────────────────── */}
        <SectionCard
          icon={CreditCard}
          title="POS Terminal"
          description="Configure your point-of-sale quick-select buttons"
          accentColor={accent}
        >
          <div className="space-y-1">
            <Toggle
              label="Quantity Picker"
              description="Show quantity calculator when adding items. Turn OFF for single-item services like car wash."
              checked={form.pos_quantity_picker === '1'}
              onChange={() => handleToggle('pos_quantity_picker')}
              accentColor={accent}
            />

            <AnimatePresence>
              {form.pos_quantity_picker === '1' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="pt-3 space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">Quick-Select Quantities</label>
                      <input
                        type="text"
                        value={form.pos_quick_quantities || ''}
                        onChange={(e) => handleChange('pos_quick_quantities', e.target.value)}
                        placeholder="5,10,15,20,25,30"
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:border-transparent transition-shadow"
                        style={{ '--tw-ring-color': accent + '40' } as any}
                      />
                      <p className="text-[11px] text-gray-400 mt-1.5">
                        Comma-separated numbers shown as quick buttons in the POS quantity picker
                      </p>
                    </div>

                    {/* Preview */}
                    {form.pos_quick_quantities && (
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-2">Preview</label>
                        <div className="flex flex-wrap gap-2">
                          {form.pos_quick_quantities.split(',').map((q, i) => {
                            const num = q.trim();
                            if (!num || isNaN(Number(num))) return null;
                            return (
                              <span
                                key={i}
                                className="inline-flex items-center justify-center min-w-[48px] px-3 py-2 rounded-xl text-sm font-bold border-2 transition-colors"
                                style={{ borderColor: accent + '40', color: accent, backgroundColor: accent + '08' }}
                              >
                                {num}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {form.pos_quantity_picker !== '1' && (
              <div className="flex items-start gap-2 px-3 py-2 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-700 mt-2">
                <svg className="w-4 h-4 shrink-0 mt-0.5 text-blue-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                </svg>
                <span>Tapping a service will instantly add 1 item to the order without the quantity picker.</span>
              </div>
            )}
          </div>
        </SectionCard>

        {/* ─── Push Notifications (only if broadcast is visible) ──────────────────────────── */}
        {isBroadcastVisible && (
        <SectionCard
          icon={Bell}
          title="Push Notifications"
          description="Send notifications to customer phones"
          accentColor="#f59e0b"
        >
          <div className="space-y-4">
            <Toggle
              label="Enable Push Notifications"
              description="Notify customers when tokens are earned, cards completed, or rewards redeemed"
              checked={form.push_notifications_enabled === '1'}
              onChange={() => handleToggle('push_notifications_enabled')}
              accentColor="#f59e0b"
            />

            {form.push_notifications_enabled === '1' && (
              <div className="pt-2 space-y-3">
                {form.vapid_public_key ? (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Check className="w-4 h-4 text-green-600" />
                      <span className="text-sm font-medium text-green-800">Push notifications configured</span>
                    </div>
                    <p className="text-xs text-green-600">VAPID keys are generated. Customers will be prompted to enable notifications.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                      <p className="text-xs text-amber-700">VAPID keys need to be generated before push notifications can work.</p>
                    </div>
                    <button
                      onClick={async () => {
                        setGeneratingVapid(true);
                        try {
                          const res = await fetch(`${import.meta.env.BASE_URL}api/generate-vapid-keys.php`, {
                            headers: { Authorization: `Bearer ${localStorage.getItem('auth_token')}` }
                          });
                          const data = await res.json();
                          if (data.success) {
                            handleChange('vapid_public_key', data.public_key);
                            toast.success('VAPID keys generated! Save settings to apply.');
                          } else {
                            toast.error(data.message || 'Failed to generate keys');
                          }
                        } catch {
                          toast.error('Failed to generate VAPID keys');
                        } finally {
                          setGeneratingVapid(false);
                        }
                      }}
                      disabled={generatingVapid}
                      className="w-full py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                      style={{ backgroundColor: '#f59e0b' }}
                    >
                      {generatingVapid ? <Spinner size={14} /> : <Bell className="w-4 h-4" />}
                      {generatingVapid ? 'Generating...' : 'Generate VAPID Keys'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </SectionCard>
        )}

        </div>

        {/* ═══════════ RIGHT COLUMN ═══════════ */}
        <div className="space-y-5">
        {/* ─── Loyalty Card Settings ─────────────────────────── */}
        <SectionCard
          icon={Coins}
          title="Loyalty Program"
          description="Configure how your loyalty card system works"
          accentColor={accent}
        >
          <div className="space-y-4">
            <FieldGroup
              label="Tokens Per Card"
              hint="Number of stamps needed to complete one card and earn a reward"
            >
              <div className="relative">
                <input
                  type="number"
                  value={form.tokens_per_card || '10'}
                  onChange={e => handleChange('tokens_per_card', e.target.value)}
                  className="input-field pr-16"
                  min="1"
                  max="20"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium">
                  stamps
                </span>
              </div>
            </FieldGroup>

            <FieldGroup
              label="Reward Description"
              icon={Gift}
              hint="What customers receive when they complete a card"
            >
              <input
                type="text"
                value={form.reward_description || ''}
                onChange={e => handleChange('reward_description', e.target.value)}
                className="input-field"
                placeholder="e.g. 1 FREE car wash, Free drink, 50% off"
              />
            </FieldGroup>

            {/* Live card preview */}
            <div className="mt-2 pt-4 border-t border-gray-100">
              <p className="text-xs font-medium text-gray-500 mb-3 flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5" /> Card Preview
              </p>
              <div
                className="rounded-2xl p-4 text-white relative overflow-hidden"
                style={{ background: `linear-gradient(135deg, ${form.primary_color || '#6366f1'}, ${form.secondary_color || '#8b5cf6'})` }}
              >
                <div className="absolute inset-0 opacity-[0.07]" style={{
                  backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
                  backgroundSize: '24px 24px',
                }} />
                <div className="relative">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-bold opacity-90 truncate">{form.business_name || 'Your Business'}</p>
                    <p className="text-[10px] opacity-60 font-medium">LOYALTY CARD</p>
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    {Array.from({ length: parseInt(form.tokens_per_card || '10') || 10 }, (_, i) => (
                      <div
                        key={i}
                        className={`w-6 h-6 rounded-full border-2 border-white/30 flex items-center justify-center ${
                          i < 3 ? 'bg-white/25' : ''
                        }`}
                      >
                        {i < 3 && <Check className="w-3 h-3 text-white" />}
                      </div>
                    ))}
                  </div>
                  {form.reward_description && (
                    <p className="text-[10px] mt-3 opacity-70 font-medium">
                      Reward: {form.reward_description}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </SectionCard>

        {/* ─── Services / Price List ──────────────────────────── */}
        <SectionCard
          icon={Sparkles}
          title="Services & Pricing"
          description="Organize services by category"
          accentColor={accent}
          actions={
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowAddCategory(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all text-white shadow-sm hover:opacity-90"
              style={{ backgroundColor: accent }}
            >
              <Plus className="w-3.5 h-3.5" />
              Category
            </motion.button>
          }
        >
          {/* Add Category Form */}
          <AnimatePresence>
            {showAddCategory && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <div className="rounded-xl p-4 mb-4 border border-gray-100 bg-gray-50/70 space-y-3">
                  <p className="text-sm font-semibold text-gray-700">New Category</p>
                  <div className="flex gap-2 items-center">
                    <label className="relative shrink-0 cursor-pointer group/color" title="Pick color">
                      <div className="w-9 h-9 rounded-lg border-2 border-white shadow-sm ring-1 ring-gray-200 group-hover/color:ring-gray-300 transition-all"
                        style={{ backgroundColor: newCategoryColor }} />
                      <input type="color" value={newCategoryColor} onChange={e => setNewCategoryColor(e.target.value)}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                    </label>
                    <input
                      type="text" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)}
                      placeholder="Category name" className="input-field flex-1 text-sm !py-2.5" autoFocus
                      onKeyDown={e => e.key === 'Enter' && handleAddCategory()}
                    />
                    <button onClick={handleAddCategory} disabled={savingCategory}
                      className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-all disabled:opacity-50 hover:opacity-90"
                      style={{ backgroundColor: accent }}>
                      {savingCategory ? <Spinner /> : <Check className="w-4 h-4" />}
                      Add
                    </button>
                    <button onClick={() => { setShowAddCategory(false); setNewCategoryName(''); setNewCategoryColor('#6366f1'); }}
                      className="px-3 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:bg-gray-100 transition-colors">
                      Cancel
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Loading */}
          {(loadingServices || loadingCategories) ? (
            <div className="flex items-center justify-center py-10"><Spinner size={24} /></div>
          ) : categories.length === 0 && services.length === 0 ? (
            <div className="text-center py-10">
              <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-3">
                <Sparkles className="w-7 h-7 text-gray-300" />
              </div>
              <p className="text-sm font-medium text-gray-400">No services yet</p>
              <p className="text-xs text-gray-400 mt-1">Create a category first, then add services</p>
              <button onClick={() => setShowAddCategory(true)}
                className="inline-flex items-center gap-1.5 text-sm font-semibold mt-3 transition-colors hover:opacity-80" style={{ color: accent }}>
                <Plus className="w-4 h-4" /> Add a category
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Category groups */}
              {categories.map((cat, catIndex) => {
                const catServices = services.filter(s => s.category_id === cat.id);
                const expanded = expandedCategories.has(cat.id);
                return (
                  <div key={cat.id} className="rounded-xl border border-gray-100 overflow-hidden" style={{ borderLeftWidth: 3, borderLeftColor: cat.color || accent }}>
                    {/* Category header */}
                    {deletingCategory === cat.id ? (
                      <div className="flex items-center justify-between bg-red-50 p-3">
                        <p className="text-sm text-red-700">Delete <span className="font-semibold">{cat.name}</span>? Services will become uncategorized.</p>
                        <div className="flex gap-2">
                          <button onClick={() => confirmDeleteCategory(cat.id)} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-red-500 hover:bg-red-600">Delete</button>
                          <button onClick={() => setDeletingCategory(null)} className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 bg-white border border-gray-200 hover:bg-gray-50">Cancel</button>
                        </div>
                      </div>
                    ) : editingCategory === cat.id ? (
                      <div className="flex items-center gap-2 p-3 bg-gray-50">
                        <label className="relative shrink-0 cursor-pointer group/color" title="Pick color">
                          <div className="w-8 h-8 rounded-lg border-2 border-white shadow-sm ring-1 ring-gray-200 group-hover/color:ring-gray-300 transition-all"
                            style={{ backgroundColor: editCategoryColor }} />
                          <input type="color" value={editCategoryColor} onChange={e => setEditCategoryColor(e.target.value)}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                        </label>
                        <input type="text" value={editCategoryName} onChange={e => setEditCategoryName(e.target.value)}
                          className="input-field flex-1 text-sm !py-2" autoFocus
                          onKeyDown={e => { if (e.key === 'Enter') handleUpdateCategory(cat.id); if (e.key === 'Escape') setEditingCategory(null); }} />
                        <button onClick={() => handleUpdateCategory(cat.id)} disabled={savingCategory}
                          className="p-2 rounded-lg text-white" style={{ backgroundColor: accent }}><Check className="w-4 h-4" /></button>
                        <button onClick={() => setEditingCategory(null)} className="p-2 rounded-lg text-gray-400 hover:bg-gray-100"><X className="w-4 h-4" /></button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-50/80 group cursor-pointer" onClick={() => toggleCategoryExpand(cat.id)}>
                        <motion.div animate={{ rotate: expanded ? 0 : -90 }} transition={{ duration: 0.15 }}>
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        </motion.div>
                        <label className="relative shrink-0 cursor-pointer" title="Change color" onClick={e => e.stopPropagation()}>
                          <div className="w-4 h-4 rounded-full ring-2 ring-white shadow-sm" style={{ backgroundColor: cat.color || accent }} />
                          <input type="color" value={cat.color || '#6366f1'}
                            onChange={e => handleCategoryColorChange(cat.id, e.target.value)}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                        </label>
                        <span className="font-semibold text-sm text-gray-800 flex-1">{cat.name}</span>
                        <span className="text-[11px] text-gray-400 font-medium tabular-nums">{catServices.length} item{catServices.length !== 1 ? 's' : ''}</span>
                        {/* Reorder up/down */}
                        <div className="flex flex-col -space-y-0.5 opacity-0 group-hover:opacity-100 transition-all">
                          <button onClick={e => { e.stopPropagation(); handleReorderCategory(catIndex, 'up'); }}
                            disabled={catIndex === 0}
                            className="p-0.5 rounded text-gray-300 hover:text-gray-600 hover:bg-gray-200/60 transition-all disabled:opacity-30 disabled:cursor-not-allowed" title="Move up">
                            <ArrowUp className="w-3 h-3" />
                          </button>
                          <button onClick={e => { e.stopPropagation(); handleReorderCategory(catIndex, 'down'); }}
                            disabled={catIndex === categories.length - 1}
                            className="p-0.5 rounded text-gray-300 hover:text-gray-600 hover:bg-gray-200/60 transition-all disabled:opacity-30 disabled:cursor-not-allowed" title="Move down">
                            <ArrowDown className="w-3 h-3" />
                          </button>
                        </div>
                        <button onClick={e => { e.stopPropagation(); setShowAddService(cat.id); setExpandedCategories(prev => new Set([...prev, cat.id])); }}
                          className="p-1 rounded-lg text-gray-300 hover:text-gray-600 hover:bg-gray-200/60 transition-all opacity-0 group-hover:opacity-100" title="Add service">
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={e => { e.stopPropagation(); setEditingCategory(cat.id); setEditCategoryName(cat.name); setEditCategoryColor(cat.color || '#6366f1'); }}
                          className="p-1 rounded-lg text-gray-300 hover:text-gray-600 hover:bg-gray-200/60 transition-all opacity-0 group-hover:opacity-100" title="Edit category">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={e => { e.stopPropagation(); setDeletingCategory(cat.id); }}
                          className="p-1 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100" title="Delete category">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Services in category */}
                    <AnimatePresence>
                      {expanded && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}>
                          {/* Add service form for this category */}
                          <AnimatePresence>
                            {showAddService === cat.id && (
                              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                                <div className="px-4 py-3 border-b border-gray-100 bg-white">
                                  <div className="flex gap-2">
                                    <input type="text" value={newServiceName} onChange={e => setNewServiceName(e.target.value)}
                                      placeholder="Service name" className="input-field flex-1 text-sm !py-2" autoFocus
                                      onKeyDown={e => e.key === 'Enter' && handleAddService()} />
                                    <div className="relative w-24">
                                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">{settings.currency_symbol || 'RM'}</span>
                                      <input type="text" inputMode="decimal" value={newServicePrice}
                                        onChange={e => { const v = e.target.value.replace(/[^0-9.]/g, ''); const p = v.split('.'); setNewServicePrice(p.length > 2 ? p[0] + '.' + p.slice(1).join('') : v); }}
                                        placeholder="0.00" className="input-field pl-8 text-right text-sm !py-2 font-medium w-full"
                                        onKeyDown={e => e.key === 'Enter' && handleAddService()} />
                                    </div>
                                    <button onClick={handleAddService} disabled={savingService}
                                      className="p-2 rounded-lg text-white" style={{ backgroundColor: accent }}><Check className="w-4 h-4" /></button>
                                    <button onClick={() => { setShowAddService(null); setNewServiceName(''); setNewServicePrice(''); }}
                                      className="p-2 rounded-lg text-gray-400 hover:bg-gray-100"><X className="w-4 h-4" /></button>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>

                          {catServices.length === 0 && showAddService !== cat.id ? (
                            <div className="px-4 py-4 text-center">
                              <p className="text-xs text-gray-400">No services in this category</p>
                              <button onClick={() => setShowAddService(cat.id)}
                                className="text-xs font-semibold mt-1 inline-flex items-center gap-1" style={{ color: accent }}>
                                <Plus className="w-3 h-3" /> Add service
                              </button>
                            </div>
                          ) : (
                            <div className="divide-y divide-gray-100">
                              {catServices.map(service => (
                                <ServiceRow key={service.id} service={service} accent={accent} currency={settings.currency_symbol || 'RM'}
                                  editingService={editingService} editName={editName} editPrice={editPrice} savingService={savingService}
                                  deletingService={deletingService}
                                  onEdit={() => startEditService(service)} onDelete={() => handleDeleteService(service.id)}
                                  onToggleStatus={() => handleToggleServiceStatus(service)}
                                  onEditNameChange={setEditName} onEditPriceChange={setEditPrice}
                                  onSaveEdit={() => handleUpdateService(service.id)} onCancelEdit={() => setEditingService(null)}
                                  onConfirmDelete={() => confirmDeleteService(service.id)} onCancelDelete={() => setDeletingService(null)} />
                              ))}
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}

              {/* Uncategorized services */}
              {(() => {
                const uncategorized = services.filter(s => !s.category_id);
                if (uncategorized.length === 0 && categories.length > 0) return null;
                const expanded = expandedCategories.has('uncategorized');
                return (
                  <div className="rounded-xl border border-gray-100 overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-50/80 group cursor-pointer" onClick={() => toggleCategoryExpand('uncategorized')}>
                      <motion.div animate={{ rotate: expanded ? 0 : -90 }} transition={{ duration: 0.15 }}>
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      </motion.div>
                      <Sparkles className="w-4 h-4 text-gray-400" />
                      <span className="font-semibold text-sm text-gray-500 flex-1">Uncategorized</span>
                      <span className="text-[11px] text-gray-400 font-medium tabular-nums">{uncategorized.length} item{uncategorized.length !== 1 ? 's' : ''}</span>
                      <button onClick={e => { e.stopPropagation(); setShowAddService('uncategorized'); setExpandedCategories(prev => new Set([...prev, 'uncategorized'])); }}
                        className="p-1 rounded-lg text-gray-300 hover:text-gray-600 hover:bg-gray-200/60 transition-all opacity-0 group-hover:opacity-100" title="Add service">
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <AnimatePresence>
                      {expanded && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}>
                          <AnimatePresence>
                            {showAddService === 'uncategorized' && (
                              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                                <div className="px-4 py-3 border-b border-gray-100 bg-white">
                                  <div className="flex gap-2">
                                    <input type="text" value={newServiceName} onChange={e => setNewServiceName(e.target.value)}
                                      placeholder="Service name" className="input-field flex-1 text-sm !py-2" autoFocus
                                      onKeyDown={e => e.key === 'Enter' && handleAddService()} />
                                    <div className="relative w-24">
                                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">{settings.currency_symbol || 'RM'}</span>
                                      <input type="text" inputMode="decimal" value={newServicePrice}
                                        onChange={e => { const v = e.target.value.replace(/[^0-9.]/g, ''); const p = v.split('.'); setNewServicePrice(p.length > 2 ? p[0] + '.' + p.slice(1).join('') : v); }}
                                        placeholder="0.00" className="input-field pl-8 text-right text-sm !py-2 font-medium w-full"
                                        onKeyDown={e => e.key === 'Enter' && handleAddService()} />
                                    </div>
                                    <button onClick={handleAddService} disabled={savingService}
                                      className="p-2 rounded-lg text-white" style={{ backgroundColor: accent }}><Check className="w-4 h-4" /></button>
                                    <button onClick={() => { setShowAddService(null); setNewServiceName(''); setNewServicePrice(''); }}
                                      className="p-2 rounded-lg text-gray-400 hover:bg-gray-100"><X className="w-4 h-4" /></button>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                          {uncategorized.length === 0 && showAddService !== 'uncategorized' ? (
                            <div className="px-4 py-4 text-center">
                              <p className="text-xs text-gray-400">No uncategorized services</p>
                            </div>
                          ) : (
                            <div className="divide-y divide-gray-100">
                              {uncategorized.map(service => (
                                <ServiceRow key={service.id} service={service} accent={accent} currency={settings.currency_symbol || 'RM'}
                                  editingService={editingService} editName={editName} editPrice={editPrice} savingService={savingService}
                                  deletingService={deletingService}
                                  onEdit={() => startEditService(service)} onDelete={() => handleDeleteService(service.id)}
                                  onToggleStatus={() => handleToggleServiceStatus(service)}
                                  onEditNameChange={setEditName} onEditPriceChange={setEditPrice}
                                  onSaveEdit={() => handleUpdateService(service.id)} onCancelEdit={() => setEditingService(null)}
                                  onConfirmDelete={() => confirmDeleteService(service.id)} onCancelDelete={() => setDeletingService(null)} />
                              ))}
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })()}

              {/* Summary footer */}
              <div className="pt-2 flex items-center justify-between">
                <p className="text-xs text-gray-400">
                  {categories.length} categor{categories.length !== 1 ? 'ies' : 'y'} &middot; {services.filter(s => s.status === 'active').length} active &middot; {services.filter(s => s.status === 'inactive').length} inactive
                </p>
              </div>
            </div>
          )}
        </SectionCard>

        </div>

        {/* ─── Menu Access (Super Admin only) — 3 Panels ──────────── */}
        {isSuperAdmin && (
        <div className="lg:col-span-2 grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Super Admin Menu Access */}
          <SectionCard
            icon={Lock}
            title="Super Admin Menu"
            description="Control which menu items are visible to Super Admin users"
            accentColor="#8b5cf6"
          >
            <div className="space-y-3">
              <p className="text-xs text-gray-500 mb-4">
                Tick the menus that Super Admin can see. Unticked menus will be hidden from Super Admin sidebar.
              </p>
              {allNavItems.map((item) => {
                const Icon = item.icon;
                const isDashboard = item.key === 'dashboard';
                let visibleKeys: string[] = [];
                try {
                  visibleKeys = form.super_admin_visible_menus ? JSON.parse(form.super_admin_visible_menus) : [];
                } catch { visibleKeys = []; }
                const allChecked = !form.super_admin_visible_menus || form.super_admin_visible_menus === '';
                const isChecked = isDashboard || allChecked || visibleKeys.includes(item.key);

                return (
                  <label
                    key={`sa-${item.key}`}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all cursor-pointer select-none ${
                      isDashboard
                        ? 'bg-gray-50 border-gray-100 opacity-60 cursor-not-allowed'
                        : isChecked
                          ? 'bg-violet-50/50 border-violet-200 hover:bg-violet-50'
                          : 'bg-white border-gray-100 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={isDashboard}
                      onChange={() => {
                        if (isDashboard) return;
                        let keys: string[];
                        if (allChecked) {
                          keys = allNavItems.filter(n => n.key !== 'dashboard').map(n => n.key);
                          keys = keys.filter(k => k !== item.key);
                        } else {
                          keys = [...visibleKeys];
                          if (keys.includes(item.key)) {
                            keys = keys.filter(k => k !== item.key);
                          } else {
                            keys.push(item.key);
                          }
                        }
                        handleChange('super_admin_visible_menus', JSON.stringify(keys));
                      }}
                      className="w-4 h-4 rounded border-gray-300 text-violet-500 focus:ring-violet-500 cursor-pointer disabled:cursor-not-allowed"
                    />
                    <Icon className="w-4 h-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">{item.label}</span>
                    {isDashboard && (
                      <span className="ml-auto text-[10px] font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                        Always visible
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          </SectionCard>

          {/* Admin Menu Access */}
          <SectionCard
            icon={Lock}
            title="Admin Menu"
            description="Control which menu items are visible to Admin users"
            accentColor="#3b82f6"
          >
            <div className="space-y-3">
              <p className="text-xs text-gray-500 mb-4">
                Tick the menus that Admin can see. Unticked menus will be hidden from Admin sidebar.
              </p>
              {allNavItems.map((item) => {
                const Icon = item.icon;
                const isDashboard = item.key === 'dashboard';
                let visibleKeys: string[] = [];
                try {
                  visibleKeys = form.admin_visible_menus ? JSON.parse(form.admin_visible_menus) : [];
                } catch { visibleKeys = []; }
                const allChecked = !form.admin_visible_menus || form.admin_visible_menus === '';
                const isChecked = isDashboard || allChecked || visibleKeys.includes(item.key);

                return (
                  <label
                    key={`admin-${item.key}`}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all cursor-pointer select-none ${
                      isDashboard
                        ? 'bg-gray-50 border-gray-100 opacity-60 cursor-not-allowed'
                        : isChecked
                          ? 'bg-blue-50/50 border-blue-200 hover:bg-blue-50'
                          : 'bg-white border-gray-100 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={isDashboard}
                      onChange={() => {
                        if (isDashboard) return;
                        let keys: string[];
                        if (allChecked) {
                          keys = allNavItems.filter(n => n.key !== 'dashboard').map(n => n.key);
                          keys = keys.filter(k => k !== item.key);
                        } else {
                          keys = [...visibleKeys];
                          if (keys.includes(item.key)) {
                            keys = keys.filter(k => k !== item.key);
                          } else {
                            keys.push(item.key);
                          }
                        }
                        handleChange('admin_visible_menus', JSON.stringify(keys));
                      }}
                      className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500 cursor-pointer disabled:cursor-not-allowed"
                    />
                    <Icon className="w-4 h-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">{item.label}</span>
                    {isDashboard && (
                      <span className="ml-auto text-[10px] font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                        Always visible
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          </SectionCard>

          {/* Staff Menu Access */}
          <SectionCard
            icon={Lock}
            title="Staff Menu"
            description="Control which menu items are visible to Staff users"
            accentColor="#f59e0b"
          >
            <div className="space-y-3">
              <p className="text-xs text-gray-500 mb-4">
                Tick the menus that Staff can see. Unticked menus will be hidden from Staff sidebar.
              </p>
              {allNavItems.map((item) => {
                const Icon = item.icon;
                const isDashboard = item.key === 'dashboard';
                let visibleKeys: string[] = [];
                try {
                  visibleKeys = form.staff_visible_menus ? JSON.parse(form.staff_visible_menus) : [];
                } catch { visibleKeys = []; }
                const allChecked = !form.staff_visible_menus || form.staff_visible_menus === '';
                const isChecked = isDashboard || allChecked || visibleKeys.includes(item.key);

                return (
                  <label
                    key={item.key}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all cursor-pointer select-none ${
                      isDashboard
                        ? 'bg-gray-50 border-gray-100 opacity-60 cursor-not-allowed'
                        : isChecked
                          ? 'bg-amber-50/50 border-amber-200 hover:bg-amber-50'
                          : 'bg-white border-gray-100 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={isDashboard}
                      onChange={() => {
                        if (isDashboard) return;
                        let keys: string[];
                        if (allChecked) {
                          keys = allNavItems.filter(n => n.key !== 'dashboard').map(n => n.key);
                          keys = keys.filter(k => k !== item.key);
                        } else {
                          keys = [...visibleKeys];
                          if (keys.includes(item.key)) {
                            keys = keys.filter(k => k !== item.key);
                          } else {
                            keys.push(item.key);
                          }
                        }
                        handleChange('staff_visible_menus', JSON.stringify(keys));
                      }}
                      className="w-4 h-4 rounded border-gray-300 text-amber-500 focus:ring-amber-500 cursor-pointer disabled:cursor-not-allowed"
                    />
                    <Icon className="w-4 h-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">{item.label}</span>
                    {isDashboard && (
                      <span className="ml-auto text-[10px] font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                        Always visible
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          </SectionCard>
        </div>
        )}

      </div>

      {/* ─── Save Button (full width below grid) ──────────── */}
      <div className="sticky bottom-4 z-30 pt-2 mt-5">
        <motion.button
          onClick={handleSave}
          disabled={saving}
          whileTap={{ scale: 0.98 }}
          className={`w-full py-4 rounded-2xl font-semibold text-white flex items-center justify-center gap-2.5 transition-all duration-200 shadow-lg hover:shadow-xl ${
            saveSuccess ? 'bg-green-500' : ''
          }`}
          style={!saveSuccess ? { backgroundColor: accent } : undefined}
        >
          {saving ? (
            <>
              <Spinner />
              Saving...
            </>
          ) : saveSuccess ? (
            <>
              <Check className="w-5 h-5" />
              Saved!
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              Save All Settings
            </>
          )}
        </motion.button>
        {hasChanges && !saving && !saveSuccess && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center text-xs text-gray-400 mt-2"
          >
            You have unsaved changes
          </motion.p>
        )}
      </div>

      {/* ─── QR Poster Modal ──────────── */}
      <QRPosterModal
        isOpen={showPosterModal}
        onClose={() => setShowPosterModal(false)}
        registrationUrl={registrationUrl}
      />
    </div>
  );
}
