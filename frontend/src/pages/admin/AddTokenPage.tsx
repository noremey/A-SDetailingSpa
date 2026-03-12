import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Plus, User, X, Check, AlertCircle, Car, Coins, Sparkles, Receipt, Banknote, Smartphone, ArrowLeftRight } from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';
import { useAuth } from '../../context/AuthContext';
import { adminService } from '../../services/api';
import LoyaltyCard from '../../components/loyalty/LoyaltyCard';
import { useToast } from '../../components/ui/Toast';
import ConfirmModal from '../../components/ui/ConfirmModal';
import ReceiptModal, { type ReceiptData } from '../../components/ui/ReceiptModal';
import type { CustomerWithCard, LoyaltyCard as LoyaltyCardType, Vehicle, Service } from '../../types';

export default function AddTokenPage() {
  const { settings } = useSettings();
  const { user } = useAuth();
  const toast = useToast();
  const location = useLocation();
  const preSelectHandled = useRef(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CustomerWithCard[]>([]);
  const [searching, setSearching] = useState(false);

  const [selectedCustomer, setSelectedCustomer] = useState<CustomerWithCard | null>(null);
  const [customerCard, setCustomerCard] = useState<LoyaltyCardType | null>(null);
  const [loadingCard, setLoadingCard] = useState(false);

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loadingVehicles, setLoadingVehicles] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);

  const [amount, setAmount] = useState('');
  const [displayAmount, setDisplayAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [addingToken, setAddingToken] = useState(false);

  // Payment method
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'online' | 'split'>('cash');
  const [cashAmount, setCashAmount] = useState('');

  // Services
  const [services, setServices] = useState<Service[]>([]);
  const [selectedService, setSelectedService] = useState<Service | null>(null);

  // Settings
  const minSpendEnabled = settings.min_spend_enabled === '1';
  const minSpendAmount = parseFloat(settings.min_spend) || 0;
  const requireVehicle = settings.require_vehicle === '1';

  // Auto-calculate token count from amount
  const parsedAmount = parseFloat(amount) || 0;
  const calculatedTokens = (minSpendEnabled && minSpendAmount > 0)
    ? (parsedAmount >= minSpendAmount ? Math.floor(parsedAmount / minSpendAmount) : 0)
    : (parsedAmount > 0 ? 1 : 0);

  const vehicleReady = requireVehicle ? !!selectedVehicle : true;
  const canAddToken = vehicleReady && !addingToken && parsedAmount > 0 && calculatedTokens > 0;
  const isBelowMinSpend = minSpendEnabled && minSpendAmount > 0 && parsedAmount > 0 && parsedAmount < minSpendAmount;
  const canRecordPayment = vehicleReady && !addingToken && isBelowMinSpend;

  // Load services on mount
  useEffect(() => {
    const loadServices = async () => {
      try {
        const { data } = await adminService.getServices();
        if (data.success) {
          setServices(data.services || []);
        }
      } catch {
        // silently fail - services are optional
      }
    };
    loadServices();
  }, []);

  // Pre-select customer from void re-create flow
  useEffect(() => {
    const prePhone = (location.state as any)?.preSelectPhone;
    if (prePhone && !preSelectHandled.current) {
      preSelectHandled.current = true;
      // Clear navigation state to prevent re-trigger
      window.history.replaceState({}, document.title);
      // Auto-search by phone number
      const autoSearch = async () => {
        setSearchQuery(prePhone);
        setSearching(true);
        try {
          const { data } = await adminService.searchCustomers(prePhone);
          if (data.success && data.customers?.length > 0) {
            // Auto-select first match
            selectCustomer(data.customers[0]);
            toast.info(`Auto-selected: ${data.customers[0].name}`);
          } else {
            setSearchResults([]);
            toast.warning('Customer not found — search manually');
          }
        } catch {
          toast.error('Auto-search failed');
        } finally {
          setSearching(false);
        }
      };
      autoSearch();
    }
  }, [location.state]);

  // Format number as currency with commas: 1000 -> 1,000.00
  const formatCurrency = (value: string) => {
    const num = parseFloat(value);
    if (isNaN(num)) return '';
    return num.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Handle amount input: allow only numbers and one decimal point
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/,/g, '');
    if (raw === '' || /^\d*\.?\d{0,2}$/.test(raw)) {
      setAmount(raw);
      setDisplayAmount(raw);
      setSelectedService(null); // deselect service on manual input
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

  // Select a service -> fill amount and notes
  const selectService = (service: Service) => {
    if (selectedService?.id === service.id) {
      // deselect
      setSelectedService(null);
      setAmount('');
      setDisplayAmount('');
      setNotes('');
      return;
    }
    setSelectedService(service);
    const priceStr = service.price.toFixed(2);
    setAmount(priceStr);
    setDisplayAmount(formatCurrency(priceStr));
    setNotes(service.name);
  };

  // Redeem confirm modal
  const [showRedeemConfirm, setShowRedeemConfirm] = useState(false);

  // Receipt
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);

  // Search customers
  const handleSearch = async () => {
    if (searchQuery.trim().length < 1) return;
    setSearching(true);
    try {
      const { data } = await adminService.searchCustomers(searchQuery.trim());
      if (data.success) {
        setSearchResults(data.customers || []);
        if (data.customers?.length === 0) {
          toast.warning('No customers found');
        }
      }
    } catch {
      toast.error('Search failed');
    } finally {
      setSearching(false);
    }
  };

  // Select customer and load their card + vehicles (separate try-catch so one failure doesn't kill both)
  const selectCustomer = async (customer: CustomerWithCard) => {
    setSelectedCustomer(customer);
    setSearchResults([]);
    setSearchQuery('');
    setLoadingCard(true);
    setSelectedVehicle(null);
    setVehicles([]);
    setLoadingVehicles(true);

    // Load card details
    try {
      const cardRes = await adminService.getCustomerDetail(customer.id);
      if (cardRes.data.success && cardRes.data.cards) {
        const active = cardRes.data.cards.find((c: any) => c.status === 'active');
        const completed = cardRes.data.cards.find((c: any) => c.status === 'completed');
        setCustomerCard(active || completed || null);
      }
    } catch {
      toast.error('Failed to load card details');
    } finally {
      setLoadingCard(false);
    }

    // Load vehicles separately — so card still works even if vehicles fail
    try {
      const vehiclesRes = await adminService.getCustomerVehicles(customer.id);
      if (vehiclesRes.data.success) {
        const vehicleList: Vehicle[] = vehiclesRes.data.vehicles || [];
        setVehicles(vehicleList);
        if (vehicleList.length === 1) {
          setSelectedVehicle(vehicleList[0]);
        }
        if (vehicleList.length > 1) {
          const primary = vehicleList.find((v) => v.is_primary);
          if (primary) setSelectedVehicle(primary);
        }
      }
    } catch {
      toast.error('Failed to load vehicles');
    } finally {
      setLoadingVehicles(false);
    }
  };

  // Add token(s)
  const handleAddToken = async () => {
    if (!selectedCustomer || (requireVehicle && !selectedVehicle)) return;
    if (parsedAmount <= 0) {
      toast.error('Enter total amount');
      return;
    }
    if (minSpendEnabled && parsedAmount < minSpendAmount) {
      toast.error(`Minimum amount is ${settings.currency_symbol}${minSpendAmount.toFixed(2)}`);
      return;
    }
    setAddingToken(true);

    try {
      const paymentData: any = {
        customer_id: selectedCustomer.id,
        vehicle_id: selectedVehicle?.id || 0,
        amount: parsedAmount,
        token_count: calculatedTokens,
        notes,
        payment_method: paymentMethod,
      };
      if (paymentMethod === 'cash') {
        paymentData.cash_amount = parsedAmount;
      } else if (paymentMethod === 'online') {
        paymentData.online_amount = parsedAmount;
      } else if (paymentMethod === 'split') {
        paymentData.cash_amount = parseFloat(cashAmount) || 0;
        paymentData.online_amount = parseFloat((parsedAmount - (parseFloat(cashAmount) || 0)).toFixed(2));
      }
      const { data } = await adminService.addToken(paymentData);

      if (data.success) {
        // Capture receipt data before form reset
        const cashAmt = paymentMethod === 'split' ? (parseFloat(cashAmount) || 0) : paymentMethod === 'cash' ? parsedAmount : null;
        const onlineAmt = paymentMethod === 'split' ? parseFloat((parsedAmount - (parseFloat(cashAmount) || 0)).toFixed(2)) : paymentMethod === 'online' ? parsedAmount : null;
        setReceiptData({
          id: data.token_id || data.transaction_id || data.id || Date.now(),
          type: 'loyalty',
          created_at: new Date().toISOString(),
          amount: parsedAmount,
          payment_method: paymentMethod,
          cash_amount: cashAmt,
          online_amount: onlineAmt,
          customer_name: selectedCustomer.name || null,
          customer_phone: selectedCustomer.phone || null,
          staff_name: user?.name || null,
          token_count: calculatedTokens,
          tokens_earned: data.card?.tokens_earned ?? undefined,
          tokens_required: data.card?.tokens_required ?? parseInt(settings.tokens_per_card) ?? undefined,
          plate_number: selectedVehicle?.plate_number || null,
          notes: notes || null,
        });

        setCustomerCard(data.card);
        toast.success(
          data.message
            ? `${data.message}`
            : `${calculatedTokens} token(s) added for ${requireVehicle && selectedVehicle ? selectedVehicle.plate_number : selectedCustomer.name}!`
        );
        setAmount('');
        setDisplayAmount('');
        setNotes('');
        setSelectedService(null);
        setPaymentMethod('cash');
        setCashAmount('');
      } else {
        toast.error(data.message || 'Failed to add token');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to add token');
    } finally {
      setAddingToken(false);
    }
  };

  // Record payment only (no token)
  const handleRecordPayment = async () => {
    if (!selectedCustomer || (requireVehicle && !selectedVehicle)) return;
    if (parsedAmount <= 0) {
      toast.error('Enter amount');
      return;
    }
    setAddingToken(true);

    try {
      const rpData: any = {
        customer_id: selectedCustomer.id,
        vehicle_id: selectedVehicle?.id || 0,
        amount: parsedAmount,
        notes,
        payment_method: paymentMethod,
      };
      if (paymentMethod === 'cash') {
        rpData.cash_amount = parsedAmount;
      } else if (paymentMethod === 'online') {
        rpData.online_amount = parsedAmount;
      } else if (paymentMethod === 'split') {
        rpData.cash_amount = parseFloat(cashAmount) || 0;
        rpData.online_amount = parseFloat((parsedAmount - (parseFloat(cashAmount) || 0)).toFixed(2));
      }
      const { data } = await adminService.recordPayment(rpData);

      if (data.success) {
        // Capture receipt data before form reset
        const cashAmtRP = paymentMethod === 'split' ? (parseFloat(cashAmount) || 0) : paymentMethod === 'cash' ? parsedAmount : null;
        const onlineAmtRP = paymentMethod === 'split' ? parseFloat((parsedAmount - (parseFloat(cashAmount) || 0)).toFixed(2)) : paymentMethod === 'online' ? parsedAmount : null;
        setReceiptData({
          id: data.transaction_id || data.id || Date.now(),
          type: 'loyalty',
          created_at: new Date().toISOString(),
          amount: parsedAmount,
          payment_method: paymentMethod,
          cash_amount: cashAmtRP,
          online_amount: onlineAmtRP,
          customer_name: selectedCustomer!.name || null,
          customer_phone: selectedCustomer!.phone || null,
          staff_name: user?.name || null,
          token_count: 0,
          plate_number: selectedVehicle?.plate_number || null,
          notes: notes || null,
        });

        toast.success(data.message || 'Payment recorded');
        setAmount('');
        setDisplayAmount('');
        setNotes('');
        setSelectedService(null);
        setPaymentMethod('cash');
        setCashAmount('');
      } else {
        toast.error(data.message || 'Failed to record payment');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to record payment');
    } finally {
      setAddingToken(false);
    }
  };

  // Redeem card
  const handleRedeem = async () => {
    if (!customerCard) return;
    setAddingToken(true);

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
      setAddingToken(false);
      setShowRedeemConfirm(false);
    }
  };

  const clearSelection = () => {
    setSelectedCustomer(null);
    setCustomerCard(null);
    setVehicles([]);
    setSelectedVehicle(null);
    setAmount('');
    setDisplayAmount('');
    setNotes('');
    setSelectedService(null);
    setPaymentMethod('cash');
    setCashAmount('');
  };

  return (
    <div className="pb-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-5">Add Token</h1>

      {/* Search bar - full width */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-5">
        <label className="block text-sm font-medium text-gray-700 mb-2">Search Customer</label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="ID, name, or phone..."
              className="input-field pl-10"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={searching}
            className="px-5 py-3 rounded-xl font-medium text-white shrink-0"
            style={{ backgroundColor: settings.primary_color }}
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
              {searchResults.map(customer => (
                <button
                  key={customer.id}
                  onClick={() => selectCustomer(customer)}
                  className="w-full p-3 flex items-center gap-3 hover:bg-gray-50 text-left transition-colors"
                >
                  {customer.avatar ? (
                    <img
                      src={customer.avatar}
                      alt={customer.name}
                      className="w-10 h-10 rounded-full object-cover shrink-0 ring-2 ring-white shadow-sm"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                         style={{ backgroundColor: settings.primary_color + '15' }}>
                      <User className="w-5 h-5" style={{ color: settings.primary_color }} />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{customer.name}</p>
                    <p className="text-sm text-gray-500">{customer.user_code} | {customer.phone}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs font-medium px-2 py-1 rounded-full"
                          style={{ backgroundColor: settings.primary_color + '15', color: settings.primary_color }}>
                      {customer.tokens_earned}/{customer.tokens_required}
                    </span>
                    {(customer.completed_cards ?? 0) > 0 && (
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {customer.completed_cards} card{customer.completed_cards !== 1 ? 's' : ''} done
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Selected customer - 2 column layout */}
      <AnimatePresence>
        {selectedCustomer && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
          >
            {/* Customer badge - full width */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                {selectedCustomer.avatar ? (
                  <img
                    src={selectedCustomer.avatar}
                    alt={selectedCustomer.name}
                    className="w-12 h-12 rounded-full object-cover border-2 shadow-sm"
                    style={{ borderColor: settings.primary_color }}
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full flex items-center justify-center"
                       style={{ backgroundColor: settings.primary_color }}>
                    <User className="w-6 h-6 text-white" />
                  </div>
                )}
                <div>
                  <p className="font-bold text-gray-900">{selectedCustomer.name}</p>
                  <p className="text-sm text-gray-500">{selectedCustomer.user_code} | {selectedCustomer.phone}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-right">
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                        style={{ backgroundColor: settings.primary_color + '15', color: settings.primary_color }}>
                    {selectedCustomer.tokens_earned}/{selectedCustomer.tokens_required}
                  </span>
                  {(selectedCustomer.completed_cards ?? 0) > 0 && (
                    <p className="text-[10px] text-gray-400 mt-1 text-center">
                      ({selectedCustomer.completed_cards} card{selectedCustomer.completed_cards !== 1 ? 's' : ''})
                    </p>
                  )}
                </div>
                <button onClick={clearSelection} className="p-2 rounded-full hover:bg-gray-100">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
            </div>

            {/* 2-column grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">

              {/* LEFT COLUMN: Card display + Vehicle selection */}
              <div className="space-y-5">
                {/* Card display */}
                {loadingCard ? (
                  <div className="rounded-2xl bg-gray-100 animate-pulse h-64" />
                ) : customerCard ? (
                  <LoyaltyCard card={customerCard} />
                ) : (
                  <div className="bg-yellow-50 rounded-2xl p-5 text-center border border-yellow-200">
                    <AlertCircle className="w-8 h-8 mx-auto text-yellow-500 mb-2" />
                    <p className="text-yellow-700">No active card. Token will create a new card.</p>
                  </div>
                )}

                {/* Vehicle selection */}
                {requireVehicle && (!customerCard || customerCard.status === 'active') && (
                  <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                    <label className="block text-sm font-medium text-gray-700 mb-3">Select Vehicle</label>
                    {loadingVehicles ? (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-xl bg-gray-100 animate-pulse h-24" />
                        <div className="rounded-xl bg-gray-100 animate-pulse h-24" />
                      </div>
                    ) : vehicles.length === 0 ? (
                      <div className="text-center py-6">
                        <Car className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                        <p className="text-sm text-gray-500">No vehicles registered for this customer.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3">
                        {vehicles.map((vehicle) => {
                          const isSelected = selectedVehicle?.id === vehicle.id;
                          return (
                            <motion.button
                              key={vehicle.id}
                              onClick={() => setSelectedVehicle(vehicle)}
                              className={`relative p-4 rounded-xl border-2 text-left transition-all ${
                                isSelected
                                  ? 'border-current shadow-md'
                                  : 'border-gray-200 hover:border-gray-300'
                              }`}
                              style={isSelected ? { borderColor: settings.primary_color, backgroundColor: settings.primary_color + '08' } : {}}
                              whileTap={{ scale: 0.97 }}
                            >
                              {vehicle.is_primary && (
                                <span
                                  className="absolute -top-2 -right-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white"
                                  style={{ backgroundColor: settings.primary_color }}
                                >
                                  PRIMARY
                                </span>
                              )}
                              <Car
                                className="w-5 h-5 mb-2"
                                style={{ color: isSelected ? settings.primary_color : '#9ca3af' }}
                              />
                              <p className="font-bold text-gray-900 text-sm tracking-wide">{vehicle.plate_number}</p>
                              <p className="text-xs text-gray-500 mt-0.5 capitalize">{vehicle.vehicle_type}</p>
                              {vehicle.vehicle_model && (
                                <p className="text-xs text-gray-400 truncate">{vehicle.vehicle_model}</p>
                              )}
                              {isSelected && (
                                <motion.div
                                  className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center"
                                  style={{ backgroundColor: settings.primary_color }}
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                >
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

                {/* Redeem button for completed cards */}
                {customerCard?.status === 'completed' && (
                  <button
                    onClick={() => setShowRedeemConfirm(true)}
                    disabled={addingToken}
                    className="w-full py-4 bg-yellow-500 hover:bg-yellow-600 text-white font-bold text-lg rounded-xl
                               transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg"
                  >
                    <Check className="w-5 h-5" />
                    {addingToken ? 'Processing...' : 'Redeem Free Reward'}
                  </button>
                )}
              </div>

              {/* RIGHT COLUMN: Service + Amount + Notes + Add button */}
              {(!customerCard || customerCard.status === 'active') && (
                <div className="space-y-5">
                  {/* Quick Select Service */}
                  {services.length > 0 && (
                    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <Sparkles className="w-3.5 h-3.5 inline mr-1" />
                        Quick Select Service
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {services.map((service) => {
                          const isSelected = selectedService?.id === service.id;
                          return (
                            <motion.button
                              key={service.id}
                              onClick={() => selectService(service)}
                              className={`relative p-3 rounded-xl border-2 text-left transition-all ${
                                isSelected
                                  ? 'shadow-md'
                                  : 'border-gray-200 hover:border-gray-300'
                              }`}
                              style={isSelected ? {
                                borderColor: settings.primary_color,
                                backgroundColor: settings.primary_color + '08',
                              } : {}}
                              whileTap={{ scale: 0.97 }}
                            >
                              <p className={`font-semibold text-sm ${isSelected ? 'text-gray-900' : 'text-gray-700'}`}>
                                {service.name}
                              </p>
                              <p className="font-bold mt-0.5" style={{ color: isSelected ? settings.primary_color : '#6b7280' }}>
                                {settings.currency_symbol}{service.price.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                              </p>
                              {isSelected && (
                                <motion.div
                                  className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full flex items-center justify-center"
                                  style={{ backgroundColor: settings.primary_color }}
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                >
                                  <Check className="w-2.5 h-2.5 text-white" />
                                </motion.div>
                              )}
                            </motion.button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Amount + Notes + Add button */}
                  <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4">

                    {/* Divider if services exist */}
                    {services.length > 0 && (
                      <div className="flex items-center gap-3">
                        <div className="flex-1 border-t border-gray-200" />
                        <span className="text-xs text-gray-400 font-medium">or enter manually</span>
                        <div className="flex-1 border-t border-gray-200" />
                      </div>
                    )}

                    {/* Total Amount */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Total Amount <span className="text-red-500">*</span>
                        {minSpendEnabled && minSpendAmount > 0 && (
                          <span className="text-gray-400 font-normal">
                            {' '}(min {settings.currency_symbol}{minSpendAmount.toFixed(2)} per token)
                          </span>
                        )}
                      </label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 font-semibold text-sm pointer-events-none">
                          {settings.currency_symbol}
                        </span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={displayAmount}
                          onChange={handleAmountChange}
                          onBlur={handleAmountBlur}
                          onFocus={handleAmountFocus}
                          placeholder="0.00"
                          className="input-field pl-12 text-lg font-semibold"
                          required
                        />
                      </div>
                    </div>

                    {/* Token count indicator */}
                    <AnimatePresence>
                      {calculatedTokens > 0 && (
                        <motion.div
                          className="flex items-center gap-3 p-3 rounded-xl border-2"
                          style={{
                            borderColor: settings.primary_color + '40',
                            backgroundColor: settings.primary_color + '08',
                          }}
                          initial={{ opacity: 0, y: -8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                        >
                          <div
                            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                            style={{ backgroundColor: settings.primary_color }}
                          >
                            <Coins className="w-5 h-5 text-white" />
                          </div>
                          <div className="flex-1">
                            <p className="font-bold text-gray-900">
                              {calculatedTokens} Token{calculatedTokens > 1 ? 's' : ''}
                            </p>
                            <p className="text-xs text-gray-500">
                              {minSpendEnabled && minSpendAmount > 0
                                ? `${settings.currency_symbol}${formatCurrency(amount)} \u00F7 ${settings.currency_symbol}${minSpendAmount.toFixed(2)} = ${calculatedTokens} token${calculatedTokens > 1 ? 's' : ''}`
                                : `1 token for ${settings.currency_symbol}${formatCurrency(amount)}`
                              }
                            </p>
                          </div>
                          <div
                            className="text-2xl font-bold shrink-0"
                            style={{ color: settings.primary_color }}
                          >
                            +{calculatedTokens}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Below min spend - Record Payment option */}
                    <AnimatePresence>
                      {isBelowMinSpend && (
                        <motion.div
                          className="rounded-xl border-2 border-amber-200 bg-amber-50 p-4 space-y-3"
                          initial={{ opacity: 0, y: -8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
                              <AlertCircle className="w-5 h-5 text-amber-600" />
                            </div>
                            <div className="flex-1">
                              <p className="font-semibold text-amber-800 text-sm">Below minimum for token</p>
                              <p className="text-xs text-amber-600 mt-0.5">
                                Min {settings.currency_symbol}{minSpendAmount.toFixed(2)} per token. You can still record this payment for your records.
                              </p>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Notes */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Notes <span className="text-gray-400 font-normal">(optional)</span>
                      </label>
                      <input
                        type="text"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder={requireVehicle ? "e.g., Premium wash, Full detail..." : "e.g., Set A, Combo meal, Service..."}
                        className="input-field"
                      />
                    </div>

                    {/* Payment Method */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Payment Method</label>
                      <div className="flex rounded-xl border border-gray-200 overflow-hidden">
                        {([
                          { key: 'cash' as const, label: 'Cash', Icon: Banknote, color: 'green' },
                          { key: 'online' as const, label: 'Online', Icon: Smartphone, color: 'blue' },
                          { key: 'split' as const, label: 'Split', Icon: ArrowLeftRight, color: 'purple' },
                        ]).map(({ key, label, Icon, color }) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() => { setPaymentMethod(key); if (key !== 'split') setCashAmount(''); }}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors ${
                              paymentMethod === key
                                ? `bg-${color}-600 text-white`
                                : 'bg-white text-gray-600 hover:bg-gray-50'
                            }`}
                            style={paymentMethod === key ? {
                              backgroundColor: color === 'green' ? '#16a34a' : color === 'blue' ? '#2563eb' : '#9333ea'
                            } : {}}
                          >
                            <Icon className="w-3.5 h-3.5" />
                            {label}
                          </button>
                        ))}
                      </div>

                      {/* Split inputs */}
                      {paymentMethod === 'split' && parsedAmount > 0 && (
                        <motion.div
                          className="mt-3 p-3 rounded-xl border border-purple-200 bg-purple-50/50 space-y-2"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                        >
                          <div className="flex items-center gap-3">
                            <label className="text-xs font-semibold text-gray-600 w-16">Cash</label>
                            <div className="relative flex-1">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs font-semibold">{settings.currency_symbol}</span>
                              <input
                                type="text"
                                inputMode="decimal"
                                value={cashAmount}
                                onChange={(e) => {
                                  const raw = e.target.value.replace(/[^0-9.]/g, '');
                                  setCashAmount(raw);
                                }}
                                placeholder="0.00"
                                className="w-full pl-10 pr-3 py-2 rounded-lg border border-gray-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400"
                              />
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <label className="text-xs font-semibold text-gray-600 w-16">Online</label>
                            <p className="flex-1 text-sm font-bold text-gray-700 pl-3">
                              {settings.currency_symbol} {Math.max(0, parsedAmount - (parseFloat(cashAmount) || 0)).toFixed(2)}
                            </p>
                          </div>
                          {(parseFloat(cashAmount) || 0) >= parsedAmount && cashAmount !== '' && (
                            <p className="text-xs text-red-500 text-center">Cash must be less than total</p>
                          )}
                        </motion.div>
                      )}
                    </div>

                    {/* Action buttons */}
                    {isBelowMinSpend ? (
                      <button
                        onClick={handleRecordPayment}
                        disabled={!canRecordPayment}
                        className="w-full py-4 bg-amber-500 hover:bg-amber-600 text-white font-bold text-lg rounded-xl
                                   transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg"
                      >
                        <Receipt className="w-5 h-5" />
                        {addingToken
                          ? 'Recording...'
                          : requireVehicle && !selectedVehicle
                          ? 'Select a Vehicle First'
                          : `Record Payment (${settings.currency_symbol}${formatCurrency(amount)}) — No Token`
                        }
                      </button>
                    ) : (
                      <button
                        onClick={handleAddToken}
                        disabled={!canAddToken}
                        className="w-full py-4 bg-green-600 hover:bg-green-700 text-white font-bold text-lg rounded-xl
                                   transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg"
                      >
                        <Plus className="w-5 h-5" />
                        {addingToken
                          ? 'Adding...'
                          : requireVehicle && !selectedVehicle
                          ? 'Select a Vehicle First'
                          : parsedAmount <= 0
                          ? 'Enter Amount'
                          : `Add ${calculatedTokens} Token${calculatedTokens > 1 ? 's' : ''} (${settings.currency_symbol}${formatCurrency(amount)})`
                        }
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Redeem Confirm Modal */}
      <ConfirmModal
        isOpen={showRedeemConfirm}
        onConfirm={handleRedeem}
        onCancel={() => setShowRedeemConfirm(false)}
        title="Redeem Reward"
        message={`Redeem free reward for ${selectedCustomer?.name}? This will complete the current card and start a new one.`}
        confirmText="Redeem"
        cancelText="Cancel"
        variant="success"
        loading={addingToken}
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
