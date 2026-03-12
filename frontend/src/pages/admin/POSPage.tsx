import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingCart, Plus, Minus, Trash2, Search, User, X, Check,
  AlertCircle, Car, Coins, Sparkles, Receipt, Banknote, Smartphone,
  ArrowLeftRight, Users, CreditCard, LayoutGrid,
} from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';
import { useAuth } from '../../context/AuthContext';
import { adminService } from '../../services/api';
import LoyaltyCard from '../../components/loyalty/LoyaltyCard';
import { useToast } from '../../components/ui/Toast';
import ConfirmModal from '../../components/ui/ConfirmModal';
import ReceiptModal, { type ReceiptData } from '../../components/ui/ReceiptModal';
import QuantityPickerModal from '../../components/ui/QuantityPickerModal';
import type { Service, ServiceCategory, CartItem, CustomerWithCard, LoyaltyCard as LoyaltyCardType, Vehicle } from '../../types';

type POSMode = 'walkin' | 'member';

export default function POSPage() {
  const { settings } = useSettings();
  const { user } = useAuth();
  const toast = useToast();
  const accent = settings.primary_color || '#6366f1';
  const currency = settings.currency_symbol || 'RM';

  // ─── Mode ───
  const [mode, setMode] = useState<POSMode>('walkin');

  // ─── Cart ───
  const [cart, setCart] = useState<CartItem[]>([]);

  // ─── Services & Categories ───
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [activeCategory, setActiveCategory] = useState<number | 'all'>('all');

  // ─── Quantity Picker ───
  const [pickerService, setPickerService] = useState<Service | null>(null);

  // ─── Walk-in fields ───
  const [customerName, setCustomerName] = useState('');

  // ─── Member fields ───
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CustomerWithCard[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerWithCard | null>(null);
  const [customerCard, setCustomerCard] = useState<LoyaltyCardType | null>(null);
  const [loadingCard, setLoadingCard] = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loadingVehicles, setLoadingVehicles] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);

  // ─── Discount ───
  const [discount, setDiscount] = useState('');

  // ─── Payment ───
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'online' | 'split'>('cash');
  const [cashAmount, setCashAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // ─── Modals ───
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showModeSwitch, setShowModeSwitch] = useState<POSMode | null>(null);
  const [showRedeemConfirm, setShowRedeemConfirm] = useState(false);

  // ─── Settings ───
  const minSpendEnabled = settings.min_spend_enabled === '1';
  const minSpendAmount = parseFloat(settings.min_spend) || 0;
  const requireVehicle = settings.require_vehicle === '1';
  const quantityPickerEnabled = settings.pos_quantity_picker === '1';

  // ─── Derived values ───
  const cartTotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.service.price * item.quantity, 0), [cart]
  );
  const cartItemCount = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]
  );
  const discountAmount = useMemo(() => {
    const val = parseFloat(discount) || 0;
    return Math.min(Math.max(val, 0), cartTotal);
  }, [discount, cartTotal]);
  const finalAmount = cartTotal - discountAmount;

  const quickQuantities = useMemo(() => {
    const raw = settings.pos_quick_quantities || '5,10,15,20,25,30';
    return raw.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n) && n > 0);
  }, [settings.pos_quick_quantities]);

  // Token calculation (member mode) — based on finalAmount (after discount)
  const calculatedTokens = useMemo(() => {
    if (mode !== 'member' || finalAmount <= 0) return 0;
    if (minSpendEnabled && minSpendAmount > 0) {
      return finalAmount >= minSpendAmount ? Math.floor(finalAmount / minSpendAmount) : 0;
    }
    return 1;
  }, [mode, finalAmount, minSpendEnabled, minSpendAmount]);

  const isBelowMinSpend = mode === 'member' && minSpendEnabled && minSpendAmount > 0 && finalAmount > 0 && finalAmount < minSpendAmount;
  const vehicleReady = mode === 'member' && requireVehicle ? !!selectedVehicle : true;

  const fmt = useCallback((n: number) =>
    `${currency}${n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    [currency]
  );

  // ─── Load services & categories ───
  useEffect(() => {
    (async () => {
      try {
        const [sRes, cRes] = await Promise.all([
          adminService.getServices(),
          adminService.getCategories(),
        ]);
        if (sRes.data.success) setServices(sRes.data.services || []);
        if (cRes.data.success) setCategories(cRes.data.categories || []);
      } catch { /* ignore */ }
      finally { setLoadingServices(false); }
    })();
  }, []);

  // Filter services by active category
  const filteredServices = useMemo(() => {
    if (activeCategory === 'all') return services;
    return services.filter(s => s.category_id === activeCategory);
  }, [services, activeCategory]);

  // ─── Cart helpers ───
  const addToCart = (service: Service, quantity: number) => {
    setCart(prev => {
      const existing = prev.find(i => i.service.id === service.id);
      if (existing) {
        return prev.map(i =>
          i.service.id === service.id
            ? { ...i, quantity: i.quantity + quantity }
            : i
        );
      }
      return [...prev, { service, quantity }];
    });
  };

  const updateCartQuantity = (serviceId: number, qty: number) => {
    if (qty <= 0) {
      setCart(prev => prev.filter(i => i.service.id !== serviceId));
    } else {
      setCart(prev => prev.map(i =>
        i.service.id === serviceId ? { ...i, quantity: qty } : i
      ));
    }
  };

  const getCartQty = (serviceId: number) =>
    cart.find(i => i.service.id === serviceId)?.quantity || 0;

  const clearCart = () => { setCart([]); setDiscount(''); setShowClearConfirm(false); };

  // ─── Format order notes ───
  const formatOrderNotes = () => {
    if (cart.length === 0) return '';
    return cart.map(item => {
      const sub = (item.service.price * item.quantity).toFixed(2);
      return `${item.quantity}x ${item.service.name} @ ${currency}${item.service.price.toFixed(2)} = ${currency}${sub}`;
    }).join(' | ');
  };

  // ─── Mode switching ───
  const handleModeSwitch = (newMode: POSMode) => {
    if (newMode === mode) return;
    if (cart.length > 0 || selectedCustomer) {
      setShowModeSwitch(newMode);
    } else {
      setMode(newMode);
    }
  };
  const confirmModeSwitch = () => {
    if (!showModeSwitch) return;
    setCart([]);
    setCustomerName('');
    clearMemberState();
    setPaymentMethod('cash');
    setCashAmount('');
    setMode(showModeSwitch);
    setShowModeSwitch(null);
  };

  const clearMemberState = () => {
    setSearchQuery('');
    setSearchResults([]);
    setSelectedCustomer(null);
    setCustomerCard(null);
    setVehicles([]);
    setSelectedVehicle(null);
  };

  // ─── Customer search (member mode) ───
  const handleSearch = async () => {
    if (searchQuery.trim().length < 1) return;
    setSearching(true);
    try {
      const { data } = await adminService.searchCustomers(searchQuery.trim());
      if (data.success) {
        setSearchResults(data.customers || []);
        if (data.customers?.length === 0) toast.warning('No customers found');
      }
    } catch { toast.error('Search failed'); }
    finally { setSearching(false); }
  };

  const selectCustomer = async (customer: CustomerWithCard) => {
    setSelectedCustomer(customer);
    setSearchResults([]);
    setSearchQuery('');
    setLoadingCard(true);
    setSelectedVehicle(null);
    setVehicles([]);
    setLoadingVehicles(true);

    try {
      const cardRes = await adminService.getCustomerDetail(customer.id);
      if (cardRes.data.success && cardRes.data.cards) {
        const active = cardRes.data.cards.find((c: any) => c.status === 'active');
        const completed = cardRes.data.cards.find((c: any) => c.status === 'completed');
        setCustomerCard(active || completed || null);
      }
    } catch { toast.error('Failed to load card'); }
    finally { setLoadingCard(false); }

    try {
      const vRes = await adminService.getCustomerVehicles(customer.id);
      if (vRes.data.success) {
        const list: Vehicle[] = vRes.data.vehicles || [];
        setVehicles(list);
        if (list.length === 1) setSelectedVehicle(list[0]);
        else if (list.length > 1) {
          const primary = list.find(v => v.is_primary);
          if (primary) setSelectedVehicle(primary);
        }
      }
    } catch { toast.error('Failed to load vehicles'); }
    finally { setLoadingVehicles(false); }
  };

  const clearCustomer = () => {
    clearMemberState();
  };

  // ─── Charge ───
  const handleCharge = async () => {
    if (finalAmount <= 0 || cart.length === 0) { toast.error('Add items to order'); return; }
    if (mode === 'member' && !selectedCustomer) { toast.error('Select a customer'); return; }
    if (mode === 'member' && requireVehicle && !selectedVehicle) { toast.error('Select a vehicle'); return; }

    // Split validation
    const parsedCash = parseFloat(cashAmount) || 0;
    if (paymentMethod === 'split' && (parsedCash <= 0 || parsedCash >= finalAmount)) {
      toast.error('Split: cash must be between 0 and total');
      return;
    }

    setSubmitting(true);
    const notes = formatOrderNotes();
    const lineItems = cart.map(item => ({
      name: item.service.name,
      quantity: item.quantity,
      unit_price: item.service.price,
      subtotal: item.service.price * item.quantity,
    }));

    try {
      if (mode === 'walkin') {
        await chargeWalkin(notes, lineItems, parsedCash);
      } else {
        await chargeMember(notes, lineItems, parsedCash);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Transaction failed');
    } finally {
      setSubmitting(false);
    }
  };

  const chargeWalkin = async (notes: string, lineItems: any[], parsedCash: number) => {
    const payload: any = {
      amount: finalAmount,
      discount: discountAmount > 0 ? discountAmount : undefined,
      customer_name: customerName.trim() || undefined,
      notes,
      payment_method: paymentMethod,
    };
    if (paymentMethod === 'split') {
      payload.cash_amount = parsedCash;
      payload.online_amount = parseFloat((finalAmount - parsedCash).toFixed(2));
    }

    const { data } = await adminService.addWalkInSale(payload);
    if (data.success) {
      const cashAmt = paymentMethod === 'split' ? parsedCash : paymentMethod === 'cash' ? finalAmount : null;
      const onlineAmt = paymentMethod === 'split' ? parseFloat((finalAmount - parsedCash).toFixed(2)) : paymentMethod === 'online' ? finalAmount : null;
      setReceiptData({
        id: data.sale?.id || data.id || Date.now(),
        type: 'walkin',
        created_at: data.sale?.created_at || new Date().toISOString(),
        amount: finalAmount,
        subtotal: discountAmount > 0 ? cartTotal : undefined,
        discount: discountAmount > 0 ? discountAmount : undefined,
        payment_method: paymentMethod,
        cash_amount: cashAmt,
        online_amount: onlineAmt,
        customer_name: customerName.trim() || null,
        staff_name: user?.name || null,
        notes,
        line_items: lineItems,
      });
      toast.success(`${fmt(finalAmount)} recorded`);
      resetForm();
    } else {
      toast.error(data.message || 'Failed to record sale');
    }
  };

  const chargeMember = async (notes: string, lineItems: any[], parsedCash: number) => {
    if (!selectedCustomer) return;
    const isRecordOnly = isBelowMinSpend;

    const payload: any = {
      customer_id: selectedCustomer.id,
      vehicle_id: selectedVehicle?.id || 0,
      amount: finalAmount,
      discount: discountAmount > 0 ? discountAmount : undefined,
      notes,
      payment_method: paymentMethod,
    };
    if (!isRecordOnly) {
      payload.token_count = calculatedTokens;
    }
    if (paymentMethod === 'cash') {
      payload.cash_amount = finalAmount;
    } else if (paymentMethod === 'online') {
      payload.online_amount = finalAmount;
    } else if (paymentMethod === 'split') {
      payload.cash_amount = parsedCash;
      payload.online_amount = parseFloat((finalAmount - parsedCash).toFixed(2));
    }

    const apiCall = isRecordOnly ? adminService.recordPayment : adminService.addToken;
    const { data } = await apiCall(payload);

    if (data.success) {
      const cashAmt = paymentMethod === 'split' ? parsedCash : paymentMethod === 'cash' ? finalAmount : null;
      const onlineAmt = paymentMethod === 'split' ? parseFloat((finalAmount - parsedCash).toFixed(2)) : paymentMethod === 'online' ? finalAmount : null;
      setReceiptData({
        id: data.token_id || data.transaction_id || data.id || Date.now(),
        type: 'loyalty',
        created_at: new Date().toISOString(),
        amount: finalAmount,
        subtotal: discountAmount > 0 ? cartTotal : undefined,
        discount: discountAmount > 0 ? discountAmount : undefined,
        payment_method: paymentMethod,
        cash_amount: cashAmt,
        online_amount: onlineAmt,
        customer_name: selectedCustomer.name || null,
        customer_phone: selectedCustomer.phone || null,
        staff_name: user?.name || null,
        token_count: isRecordOnly ? 0 : calculatedTokens,
        tokens_earned: data.card?.tokens_earned ?? undefined,
        tokens_required: data.card?.tokens_required ?? parseInt(settings.tokens_per_card) ?? undefined,
        plate_number: selectedVehicle?.plate_number || null,
        notes,
        line_items: lineItems,
      });

      if (data.card) setCustomerCard(data.card);
      toast.success(data.message || (isRecordOnly ? 'Payment recorded' : `${calculatedTokens} token(s) added`));
      resetForm(false); // keep customer in member mode
    } else {
      toast.error(data.message || 'Transaction failed');
    }
  };

  const resetForm = (clearAll = true) => {
    setCart([]);
    setDiscount('');
    setCustomerName('');
    setPaymentMethod('cash');
    setCashAmount('');
    if (clearAll) {
      clearMemberState();
    }
  };

  // ─── Redeem ───
  const handleRedeem = async () => {
    if (!customerCard) return;
    setSubmitting(true);
    try {
      const { data } = await adminService.redeemCard(customerCard.id);
      if (data.success) {
        setCustomerCard(data.new_card ? { ...data.new_card, tokens: [] } : null);
        toast.success(data.message || 'Reward redeemed!');
      } else {
        toast.error(data.message || 'Failed to redeem');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to redeem');
    } finally {
      setSubmitting(false);
      setShowRedeemConfirm(false);
    }
  };

  // ═══════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════

  return (
    <div className="pb-8">
      {/* ─── Header ─── */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: accent + '15' }}>
          <ShoppingCart className="w-5 h-5" style={{ color: accent }} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">POS Terminal</h1>
          <p className="text-sm text-gray-500">Tap items to build order</p>
        </div>
      </div>

      {/* ─── Mode Toggle ─── */}
      <div className="flex gap-2 mb-5">
        {([
          { key: 'walkin' as POSMode, label: 'Walk-in Mode', icon: ShoppingCart },
          { key: 'member' as POSMode, label: 'Member Mode', icon: CreditCard },
        ]).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => handleModeSwitch(key)}
            className={`flex-1 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
              mode === key ? 'text-white shadow-sm' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
            style={mode === key ? { backgroundColor: accent } : undefined}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ─── Member: Customer Search ─── */}
      <AnimatePresence>
        {mode === 'member' && !selectedCustomer && (
          <motion.div
            className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-5"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <label className="block text-sm font-medium text-gray-700 mb-2">Search Customer</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  placeholder="ID, name, or phone..."
                  className="input-field pl-10"
                />
              </div>
              <button
                onClick={handleSearch}
                disabled={searching}
                className="px-5 py-3 rounded-xl font-medium text-white shrink-0"
                style={{ backgroundColor: accent }}
              >
                {searching ? '...' : 'Search'}
              </button>
            </div>

            {/* Search results */}
            <AnimatePresence>
              {searchResults.length > 0 && (
                <motion.div
                  className="mt-3 border rounded-xl divide-y bg-white overflow-hidden shadow-lg"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  {searchResults.map(cust => (
                    <button
                      key={cust.id}
                      onClick={() => selectCustomer(cust)}
                      className="w-full p-3 flex items-center gap-3 hover:bg-gray-50 text-left transition-colors"
                    >
                      {cust.avatar ? (
                        <img src={cust.avatar} alt={cust.name} className="w-10 h-10 rounded-full object-cover shrink-0 ring-2 ring-white shadow-sm" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: accent + '15' }}>
                          <User className="w-5 h-5" style={{ color: accent }} />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{cust.name}</p>
                        <p className="text-sm text-gray-500">{cust.user_code} | {cust.phone}</p>
                      </div>
                      <span className="text-xs font-medium px-2 py-1 rounded-full shrink-0" style={{ backgroundColor: accent + '15', color: accent }}>
                        {cust.tokens_earned}/{cust.tokens_required}
                      </span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Member: Selected Customer Banner ─── */}
      <AnimatePresence>
        {mode === 'member' && selectedCustomer && (
          <motion.div
            className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center justify-between mb-5"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <div className="flex items-center gap-3">
              {selectedCustomer.avatar ? (
                <img src={selectedCustomer.avatar} alt={selectedCustomer.name} className="w-11 h-11 rounded-full object-cover border-2 shadow-sm" style={{ borderColor: accent }} referrerPolicy="no-referrer" />
              ) : (
                <div className="w-11 h-11 rounded-full flex items-center justify-center" style={{ backgroundColor: accent }}><User className="w-5 h-5 text-white" /></div>
              )}
              <div>
                <p className="font-bold text-gray-900">{selectedCustomer.name}</p>
                <p className="text-xs text-gray-500">{selectedCustomer.user_code} | {selectedCustomer.phone}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: accent + '15', color: accent }}>
                {selectedCustomer.tokens_earned}/{selectedCustomer.tokens_required}
              </span>
              <button onClick={clearCustomer} className="p-2 rounded-full hover:bg-gray-100"><X className="w-4 h-4 text-gray-400" /></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── 2-Column Layout: Left (Order) + Right (Services) ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 items-start">

        {/* ═══ LEFT: Order + Payment (3/5) ═══ */}
        <div className="lg:col-span-3 space-y-5">

          {/* ── Order Summary ── */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Order header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-gray-500" />
                <span className="font-semibold text-gray-800">Order</span>
                {cartItemCount > 0 && (
                  <motion.span
                    className="min-w-[22px] h-[22px] rounded-full text-white text-xs font-bold flex items-center justify-center px-1.5"
                    style={{ backgroundColor: accent }}
                    key={cartItemCount}
                    initial={{ scale: 0.5 }}
                    animate={{ scale: 1 }}
                  >
                    {cartItemCount}
                  </motion.span>
                )}
              </div>
              {cart.length > 0 && (
                <button onClick={() => setShowClearConfirm(true)} className="text-xs font-semibold text-red-500 hover:text-red-600 flex items-center gap-1">
                  <Trash2 className="w-3 h-3" /> Clear
                </button>
              )}
            </div>

            {/* Order items */}
            <div className="px-5 py-3">
              {cart.length === 0 ? (
                <div className="text-center py-8">
                  <ShoppingCart className="w-10 h-10 mx-auto text-gray-200 mb-2" />
                  <p className="text-sm text-gray-400">No items yet — tap a service below</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {cart.map(item => (
                    <div key={item.service.id} className="flex items-center gap-3 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 text-sm truncate">{item.service.name}</p>
                        <p className="text-xs text-gray-500">{fmt(item.service.price)} each</p>
                      </div>
                      {/* Qty controls */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => updateCartQuantity(item.service.id, item.quantity - 1)}
                          className="w-8 h-8 rounded-full bg-gray-100 hover:bg-red-100 flex items-center justify-center transition-colors"
                        >
                          <Minus className="w-3.5 h-3.5 text-gray-600" />
                        </button>
                        <span className="w-8 text-center font-bold text-sm">{item.quantity}</span>
                        <button
                          onClick={() => updateCartQuantity(item.service.id, item.quantity + 1)}
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white transition-colors"
                          style={{ backgroundColor: accent }}
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {/* Line total */}
                      <p className="font-bold text-sm w-24 text-right shrink-0" style={{ color: accent }}>
                        {fmt(item.service.price * item.quantity)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Subtotal, Discount & Total */}
            {cart.length > 0 && (
              <div className="border-t border-gray-100 bg-gray-50/50">
                {/* Subtotal */}
                {discountAmount > 0 && (
                  <div className="flex items-center justify-between px-5 pt-3 pb-1">
                    <span className="text-sm text-gray-400">Subtotal</span>
                    <span className="text-sm text-gray-400">{fmt(cartTotal)}</span>
                  </div>
                )}
                {/* Discount input */}
                <div className="flex items-center justify-between px-5 py-2 gap-3">
                  <span className="text-sm text-gray-500">Discount</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-gray-400">{currency}</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={discount}
                      onChange={(e) => setDiscount(e.target.value)}
                      placeholder="0.00"
                      className="w-24 text-right text-sm font-medium bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:border-transparent transition-shadow [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      style={{ focusRingColor: accent } as any}
                      onFocus={(e) => { e.target.style.boxShadow = `0 0 0 2px ${accent}33`; e.target.style.borderColor = accent; }}
                      onBlur={(e) => { e.target.style.boxShadow = 'none'; e.target.style.borderColor = '#e5e7eb'; }}
                    />
                  </div>
                </div>
                {/* Discount amount display */}
                {discountAmount > 0 && (
                  <div className="flex items-center justify-between px-5 pb-1">
                    <span className="text-sm text-green-600 font-medium">Discount</span>
                    <span className="text-sm text-green-600 font-medium">-{fmt(discountAmount)}</span>
                  </div>
                )}
                {/* Total */}
                <div className="flex items-center justify-between px-5 py-3">
                  <span className="font-semibold text-gray-600">Total</span>
                  <span className="text-xl font-bold" style={{ color: accent }}>{fmt(finalAmount)}</span>
                </div>
              </div>
            )}
          </div>

          {/* ── Member: Loyalty Card + Vehicle ── */}
          {mode === 'member' && selectedCustomer && (
            <div className="space-y-5">
              {/* Loyalty card */}
              {loadingCard ? (
                <div className="rounded-2xl bg-gray-100 animate-pulse h-48" />
              ) : customerCard ? (
                <LoyaltyCard card={customerCard} />
              ) : (
                <div className="bg-yellow-50 rounded-2xl p-4 text-center border border-yellow-200">
                  <AlertCircle className="w-7 h-7 mx-auto text-yellow-500 mb-1.5" />
                  <p className="text-sm text-yellow-700">No active card. Transaction will create a new card.</p>
                </div>
              )}

              {/* Vehicle selection */}
              {requireVehicle && (!customerCard || customerCard.status === 'active') && (
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                  <label className="block text-sm font-medium text-gray-700 mb-3">Select Vehicle</label>
                  {loadingVehicles ? (
                    <div className="grid grid-cols-2 gap-3"><div className="rounded-xl bg-gray-100 animate-pulse h-20" /><div className="rounded-xl bg-gray-100 animate-pulse h-20" /></div>
                  ) : vehicles.length === 0 ? (
                    <div className="text-center py-4"><Car className="w-7 h-7 mx-auto text-gray-300 mb-1.5" /><p className="text-sm text-gray-500">No vehicles registered</p></div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      {vehicles.map(v => {
                        const sel = selectedVehicle?.id === v.id;
                        return (
                          <motion.button
                            key={v.id}
                            onClick={() => setSelectedVehicle(v)}
                            className={`relative p-3.5 rounded-xl border-2 text-left transition-all ${sel ? 'shadow-md' : 'border-gray-200 hover:border-gray-300'}`}
                            style={sel ? { borderColor: accent, backgroundColor: accent + '08' } : {}}
                            whileTap={{ scale: 0.97 }}
                          >
                            {v.is_primary && <span className="absolute -top-2 -right-2 text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: accent }}>PRIMARY</span>}
                            <Car className="w-4 h-4 mb-1.5" style={{ color: sel ? accent : '#9ca3af' }} />
                            <p className="font-bold text-gray-900 text-sm tracking-wide">{v.plate_number}</p>
                            <p className="text-xs text-gray-500 capitalize">{v.vehicle_type}</p>
                            {sel && (
                              <motion.div className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: accent }} initial={{ scale: 0 }} animate={{ scale: 1 }}>
                                <Check className="w-3 h-3 text-white" />
                              </motion.div>
                            )}
                          </motion.button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Token indicator */}
              <AnimatePresence>
                {calculatedTokens > 0 && cart.length > 0 && (
                  <motion.div
                    className="flex items-center gap-3 p-3 rounded-xl border-2"
                    style={{ borderColor: accent + '40', backgroundColor: accent + '08' }}
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                  >
                    <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: accent }}>
                      <Coins className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-gray-900">{calculatedTokens} Token{calculatedTokens > 1 ? 's' : ''}</p>
                      <p className="text-xs text-gray-500">
                        {minSpendEnabled && minSpendAmount > 0
                          ? `${fmt(finalAmount)} ÷ ${fmt(minSpendAmount)} = ${calculatedTokens} token${calculatedTokens > 1 ? 's' : ''}`
                          : `1 token for ${fmt(finalAmount)}`}
                      </p>
                    </div>
                    <div className="text-2xl font-bold shrink-0" style={{ color: accent }}>+{calculatedTokens}</div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Below min spend warning */}
              <AnimatePresence>
                {isBelowMinSpend && cart.length > 0 && (
                  <motion.div
                    className="rounded-xl border-2 border-amber-200 bg-amber-50 p-4"
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
                        <AlertCircle className="w-4 h-4 text-amber-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-amber-800 text-sm">Below minimum for token</p>
                        <p className="text-xs text-amber-600 mt-0.5">Min {fmt(minSpendAmount)} per token. Payment will still be recorded.</p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Redeem button */}
              {customerCard?.status === 'completed' && (
                <button
                  onClick={() => setShowRedeemConfirm(true)}
                  disabled={submitting}
                  className="w-full py-4 bg-yellow-500 hover:bg-yellow-600 text-white font-bold text-lg rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg"
                >
                  <Check className="w-5 h-5" />
                  Redeem Free Reward
                </button>
              )}
            </div>
          )}

          {/* ── Customer Name (walk-in only) ── */}
          {mode === 'walkin' && (
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <input
                type="text"
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                placeholder="Customer name (optional)"
                className="input-field"
              />
            </div>
          )}

          {/* ── Payment Method ── */}
          {cart.length > 0 && (
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-3">
              <div className="flex rounded-xl border border-gray-200 overflow-hidden">
                {([
                  { key: 'cash' as const, label: 'Cash', Icon: Banknote, color: '#16a34a' },
                  { key: 'online' as const, label: 'Online', Icon: Smartphone, color: '#2563eb' },
                  { key: 'split' as const, label: 'Split', Icon: ArrowLeftRight, color: '#9333ea' },
                ]).map(({ key, label, Icon, color }) => (
                  <button
                    key={key}
                    onClick={() => { setPaymentMethod(key); if (key !== 'split') setCashAmount(''); }}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors ${
                      paymentMethod === key ? 'text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                    style={paymentMethod === key ? { backgroundColor: color } : {}}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                  </button>
                ))}
              </div>

              {/* Split inputs */}
              {paymentMethod === 'split' && finalAmount > 0 && (
                <motion.div className="p-3 rounded-xl border border-purple-200 bg-purple-50/50 space-y-2" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                  <div className="flex items-center gap-3">
                    <label className="text-xs font-semibold text-gray-600 w-16">Cash</label>
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs font-semibold">{currency}</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={cashAmount}
                        onChange={e => setCashAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                        placeholder="0.00"
                        className="w-full pl-10 pr-3 py-2 rounded-lg border border-gray-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="text-xs font-semibold text-gray-600 w-16">Online</label>
                    <p className="flex-1 text-sm font-bold text-gray-700 pl-3">
                      {currency} {Math.max(0, finalAmount - (parseFloat(cashAmount) || 0)).toFixed(2)}
                    </p>
                  </div>
                  {(parseFloat(cashAmount) || 0) >= finalAmount && cashAmount !== '' && (
                    <p className="text-xs text-red-500 text-center">Cash must be less than total</p>
                  )}
                </motion.div>
              )}
            </div>
          )}

          {/* ── Charge Button ── */}
          <button
            onClick={handleCharge}
            disabled={submitting || cart.length === 0 || (mode === 'member' && !selectedCustomer) || (mode === 'member' && requireVehicle && !selectedVehicle)}
            className="w-full py-4 rounded-2xl text-white font-bold text-lg transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg"
            style={{ backgroundColor: cart.length > 0 ? accent : '#9ca3af' }}
          >
            {submitting ? (
              <>
                <motion.div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full" animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} />
                Processing...
              </>
            ) : cart.length === 0 ? (
              'Add items to order'
            ) : mode === 'member' && !selectedCustomer ? (
              'Select a customer first'
            ) : mode === 'member' && requireVehicle && !selectedVehicle ? (
              'Select a vehicle first'
            ) : isBelowMinSpend ? (
              <>
                <Receipt className="w-5 h-5" />
                Record Payment {fmt(finalAmount)} — No Token
              </>
            ) : (
              <>
                <Banknote className="w-5 h-5" />
                Charge {fmt(finalAmount)}
              </>
            )}
          </button>
        </div>

        {/* ═══ RIGHT: Service Catalog (2/5) ═══ */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Category Tabs - clean inline filter */}
            <div className="px-4 pt-4 pb-2">
              <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                <button
                  onClick={() => setActiveCategory('all')}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all shrink-0 ${
                    activeCategory === 'all' ? 'text-white shadow-sm' : 'text-gray-500 bg-gray-50 hover:bg-gray-100'
                  }`}
                  style={activeCategory === 'all' ? { backgroundColor: accent } : {}}
                >
                  All{services.length > 0 && ` (${filteredServices.length})`}
                </button>
                {categories.map(cat => {
                  const catColor = cat.color || accent;
                  const isActive = activeCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setActiveCategory(cat.id)}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all shrink-0 ${
                        isActive ? 'text-white shadow-sm' : 'hover:bg-gray-100'
                      }`}
                      style={isActive
                        ? { backgroundColor: catColor }
                        : { backgroundColor: catColor + '0a', color: catColor }}
                    >
                      {cat.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="p-3 pt-1">
              {loadingServices ? (
                <div className="grid grid-cols-2 gap-2">
                  {[1,2,3,4].map(i => <div key={i} className="rounded-xl bg-gray-50 animate-pulse h-[72px]" />)}
                </div>
              ) : services.length === 0 ? (
                <div className="text-center py-10">
                  <Sparkles className="w-6 h-6 mx-auto text-gray-200 mb-2" />
                  <p className="text-sm text-gray-400">No services configured</p>
                  <p className="text-xs text-gray-300 mt-0.5">Add services in Settings</p>
                </div>
              ) : filteredServices.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-sm text-gray-400">No services in this category</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {filteredServices.map(service => {
                    const qty = getCartQty(service.id);
                    const inCart = qty > 0;
                    const svcColor = service.category_color || accent;
                    return (
                      <motion.button
                        key={service.id}
                        onClick={() => quantityPickerEnabled ? setPickerService(service) : addToCart(service, 1)}
                        className={`relative rounded-xl text-left transition-all ${
                          inCart
                            ? 'ring-2 shadow-sm'
                            : 'bg-gray-50/80 hover:bg-gray-100/80'
                        }`}
                        style={inCart
                          ? { boxShadow: `0 0 0 2px ${svcColor}`, backgroundColor: svcColor + '06' }
                          : {}}
                        whileTap={{ scale: 0.97 }}
                        layout
                      >
                        {/* Quantity badge */}
                        {inCart && (
                          <motion.div
                            className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center px-1 shadow-sm"
                            style={{ backgroundColor: svcColor }}
                            key={qty}
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                          >
                            {qty}
                          </motion.div>
                        )}
                        <div className="px-3 py-2.5">
                          {/* Category tag */}
                          {activeCategory === 'all' && service.category_name && (
                            <span className="text-[9px] uppercase tracking-wider font-semibold leading-none" style={{ color: svcColor }}>
                              {service.category_name}
                            </span>
                          )}
                          <p className={`font-medium text-[13px] leading-tight truncate ${activeCategory === 'all' && service.category_name ? 'mt-0.5' : ''} ${inCart ? 'text-gray-900' : 'text-gray-700'}`}>
                            {service.name}
                          </p>
                          <p className={`text-sm font-semibold mt-1 ${inCart ? '' : 'text-gray-400'}`} style={inCart ? { color: svcColor } : {}}>
                            {fmt(service.price)}
                          </p>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ═══ Modals ═══ */}

      {/* Quantity Picker */}
      <QuantityPickerModal
        isOpen={!!pickerService}
        onConfirm={(qty) => {
          if (pickerService) addToCart(pickerService, qty);
          setPickerService(null);
        }}
        onCancel={() => setPickerService(null)}
        service={pickerService}
        quickQuantities={quickQuantities}
        currencySymbol={currency}
        accentColor={accent}
        currentQuantity={pickerService ? getCartQty(pickerService.id) : 0}
      />

      {/* Clear Cart Confirm */}
      <ConfirmModal
        isOpen={showClearConfirm}
        onConfirm={clearCart}
        onCancel={() => setShowClearConfirm(false)}
        title="Clear Order?"
        message="This will remove all items from the current order."
        confirmText="Clear"
        cancelText="Keep"
        variant="danger"
      />

      {/* Mode Switch Confirm */}
      <ConfirmModal
        isOpen={!!showModeSwitch}
        onConfirm={confirmModeSwitch}
        onCancel={() => setShowModeSwitch(null)}
        title="Switch Mode?"
        message="Switching modes will clear your current order and customer selection."
        confirmText="Switch"
        cancelText="Cancel"
        variant="warning"
      />

      {/* Redeem Confirm */}
      <ConfirmModal
        isOpen={showRedeemConfirm}
        onConfirm={handleRedeem}
        onCancel={() => setShowRedeemConfirm(false)}
        title="Redeem Reward"
        message={`Redeem free reward for ${selectedCustomer?.name}? This will complete the current card and start a new one.`}
        confirmText="Redeem"
        cancelText="Cancel"
        variant="success"
        loading={submitting}
      />

      {/* Receipt */}
      <ReceiptModal
        isOpen={!!receiptData}
        onClose={() => setReceiptData(null)}
        data={receiptData}
      />
    </div>
  );
}
