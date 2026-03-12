import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Minus, Sparkles } from 'lucide-react';
import type { Service } from '../../types';

interface QuantityPickerModalProps {
  isOpen: boolean;
  onConfirm: (quantity: number) => void;
  onCancel: () => void;
  service: Service | null;
  quickQuantities: number[];
  currencySymbol: string;
  accentColor: string;
  currentQuantity?: number;
}

export default function QuantityPickerModal({
  isOpen,
  onConfirm,
  onCancel,
  service,
  quickQuantities,
  currencySymbol,
  accentColor,
  currentQuantity = 0,
}: QuantityPickerModalProps) {
  const [quantity, setQuantity] = useState(1);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset quantity when modal opens
  useEffect(() => {
    if (isOpen) {
      setQuantity(currentQuantity > 0 ? currentQuantity : 1);
      document.body.style.overflow = 'hidden';
      // Focus input after animation
      setTimeout(() => inputRef.current?.select(), 300);
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, currentQuantity]);

  // Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onCancel]);

  if (!service) return null;

  const subtotal = quantity * service.price;
  const fmt = (n: number) => `${currencySymbol}${n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const handleConfirm = () => {
    if (quantity > 0) onConfirm(quantity);
  };

  const handleInputChange = (val: string) => {
    const num = parseInt(val, 10);
    if (!isNaN(num) && num >= 0 && num <= 999) {
      setQuantity(num);
    } else if (val === '') {
      setQuantity(0);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center"
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
            onClick={onCancel}
          />

          {/* Bottom sheet (mobile) / Center modal (desktop) */}
          <motion.div
            className="relative bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-sm overflow-hidden"
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          >
            {/* Drag handle (mobile) */}
            <div className="flex justify-center pt-3 pb-1 sm:hidden">
              <div className="w-10 h-1 rounded-full bg-gray-300" />
            </div>

            {/* Header */}
            <div className="px-5 pt-3 sm:pt-5 pb-4 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${accentColor}15` }}
                >
                  <Sparkles className="w-5 h-5" style={{ color: accentColor }} />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-gray-900 text-base truncate">{service.name}</h3>
                  <p className="text-sm text-gray-500">{fmt(service.price)} each</p>
                </div>
              </div>
              <button
                onClick={onCancel}
                className="p-1.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Select */}
            {quickQuantities.length > 0 && (
              <div className="px-5 pb-4">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Quick Select</p>
                <div className="grid grid-cols-3 gap-2">
                  {quickQuantities.map((q) => (
                    <button
                      key={q}
                      onClick={() => setQuantity(q)}
                      className={`py-2.5 rounded-xl text-sm font-semibold transition-all ${
                        quantity === q
                          ? 'text-white shadow-sm'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-300'
                      }`}
                      style={quantity === q ? { backgroundColor: accentColor } : undefined}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Custom Quantity */}
            <div className="px-5 pb-4">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Custom Quantity</p>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-11 h-11 rounded-full bg-gray-100 hover:bg-gray-200 active:bg-gray-300 flex items-center justify-center transition-colors"
                >
                  <Minus className="w-5 h-5 text-gray-600" />
                </button>
                <input
                  ref={inputRef}
                  type="text"
                  inputMode="numeric"
                  value={quantity}
                  onChange={(e) => handleInputChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleConfirm();
                  }}
                  className="w-20 h-11 text-center text-lg font-bold rounded-xl border-2 focus:outline-none transition-colors"
                  style={{ borderColor: accentColor, color: accentColor }}
                />
                <button
                  onClick={() => setQuantity(Math.min(999, quantity + 1))}
                  className="w-11 h-11 rounded-full flex items-center justify-center text-white transition-colors"
                  style={{ backgroundColor: accentColor }}
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Subtotal */}
            <div className="mx-5 mb-4 py-3 px-4 bg-gray-50 rounded-xl flex items-center justify-between">
              <span className="text-sm text-gray-500 font-medium">Subtotal</span>
              <span className="text-lg font-bold" style={{ color: accentColor }}>{fmt(subtotal)}</span>
            </div>

            {/* Confirm Button */}
            <div className="px-5 pb-6">
              <button
                onClick={handleConfirm}
                disabled={quantity <= 0}
                className="w-full py-3.5 rounded-xl text-white font-bold text-base transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ backgroundColor: accentColor }}
              >
                <Plus className="w-5 h-5" />
                {currentQuantity > 0 ? `Update to ${quantity}x` : `Add ${quantity}x to Order`}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
