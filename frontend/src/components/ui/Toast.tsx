import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

// ============================================
// Types
// ============================================
type ToastVariant = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
  duration: number;
}

interface ToastContextType {
  showToast: (message: string, variant?: ToastVariant, duration?: number) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
}

// ============================================
// Context
// ============================================
const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}

// ============================================
// Variant Configs
// ============================================
const variantStyles: Record<ToastVariant, {
  icon: typeof CheckCircle;
  bg: string;
  border: string;
  text: string;
  iconColor: string;
  progressColor: string;
}> = {
  success: {
    icon: CheckCircle,
    bg: 'bg-white',
    border: 'border-green-200',
    text: 'text-gray-800',
    iconColor: 'text-green-500',
    progressColor: 'bg-green-500',
  },
  error: {
    icon: XCircle,
    bg: 'bg-white',
    border: 'border-red-200',
    text: 'text-gray-800',
    iconColor: 'text-red-500',
    progressColor: 'bg-red-500',
  },
  warning: {
    icon: AlertTriangle,
    bg: 'bg-white',
    border: 'border-amber-200',
    text: 'text-gray-800',
    iconColor: 'text-amber-500',
    progressColor: 'bg-amber-500',
  },
  info: {
    icon: Info,
    bg: 'bg-white',
    border: 'border-blue-200',
    text: 'text-gray-800',
    iconColor: 'text-blue-500',
    progressColor: 'bg-blue-500',
  },
};

// ============================================
// Single Toast Component
// ============================================
function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const style = variantStyles[toast.variant];
  const Icon = style.icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 100, scale: 0.95 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className={`relative flex items-start gap-3 w-full max-w-sm px-4 py-3.5 rounded-xl border shadow-lg ${style.bg} ${style.border} overflow-hidden`}
    >
      {/* Icon */}
      <div className="flex-shrink-0 mt-0.5">
        <Icon className={`w-5 h-5 ${style.iconColor}`} />
      </div>

      {/* Message */}
      <p className={`flex-1 text-sm font-medium ${style.text} leading-snug pr-6`}>
        {toast.message}
      </p>

      {/* Close button */}
      <button
        onClick={() => onRemove(toast.id)}
        className="absolute top-2.5 right-2.5 p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>

      {/* Progress bar */}
      {toast.duration > 0 && (
        <motion.div
          className={`absolute bottom-0 left-0 h-0.5 ${style.progressColor}`}
          initial={{ width: '100%' }}
          animate={{ width: '0%' }}
          transition={{ duration: toast.duration / 1000, ease: 'linear' }}
        />
      )}
    </motion.div>
  );
}

// ============================================
// Toast Provider
// ============================================
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showToast = useCallback((message: string, variant: ToastVariant = 'info', duration = 4000) => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const toast: Toast = { id, message, variant, duration };

    setToasts(prev => {
      // Max 5 toasts visible
      const next = [...prev, toast];
      if (next.length > 5) next.shift();
      return next;
    });

    if (duration > 0) {
      setTimeout(() => removeToast(id), duration);
    }
  }, [removeToast]);

  const success = useCallback((msg: string, duration?: number) => showToast(msg, 'success', duration), [showToast]);
  const error = useCallback((msg: string, duration?: number) => showToast(msg, 'error', duration ?? 6000), [showToast]);
  const warning = useCallback((msg: string, duration?: number) => showToast(msg, 'warning', duration), [showToast]);
  const info = useCallback((msg: string, duration?: number) => showToast(msg, 'info', duration), [showToast]);

  return (
    <ToastContext.Provider value={{ showToast, success, error, warning, info }}>
      {children}

      {/* Toast Container - fixed top right */}
      <div className="fixed top-4 right-4 z-[200] flex flex-col items-end gap-2 pointer-events-none">
        <AnimatePresence mode="popLayout">
          {toasts.map(toast => (
            <div key={toast.id} className="pointer-events-auto">
              <ToastItem toast={toast} onRemove={removeToast} />
            </div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
