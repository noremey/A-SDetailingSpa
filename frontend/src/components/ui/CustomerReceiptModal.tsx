import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Share2, Download, Check } from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';
import html2canvas from 'html2canvas';

export interface CustomerReceiptData {
  id: number;
  type: 'token' | 'redemption';
  created_at: string;
  amount: number | null;
  staff_name?: string | null;
  plate_number?: string | null;
  notes?: string | null;
  token_position?: number;
  card_number?: number;
  tokens_earned?: number;
  tokens_required?: number;
  reward_description?: string | null;
}

interface CustomerReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: CustomerReceiptData | null;
}

export default function CustomerReceiptModal({ isOpen, onClose, data }: CustomerReceiptModalProps) {
  const { settings } = useSettings();
  const receiptRef = useRef<HTMLDivElement>(null);
  const [sharing, setSharing] = useState(false);
  const [shared, setShared] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = 'hidden';
    setShared(false);
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!data) return null;

  const currency = settings.currency_symbol || 'RM';
  const fmt = (n: number) => `${currency}${n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const dt = new Date(data.created_at);
  const dateStr = dt.toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' });
  const timeStr = dt.toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit', hour12: true });
  const receiptNo = data.type === 'token'
    ? `TKN-${data.id}`
    : `RDM-${data.id}`;

  const captureReceipt = async (): Promise<Blob | null> => {
    if (!receiptRef.current) return null;
    try {
      const canvas = await html2canvas(receiptRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        logging: false,
      });
      return new Promise(resolve => {
        canvas.toBlob(blob => resolve(blob), 'image/png', 1.0);
      });
    } catch {
      return null;
    }
  };

  const handleShare = async () => {
    setSharing(true);
    try {
      const blob = await captureReceipt();
      if (!blob) { setSharing(false); return; }

      const file = new File([blob], `receipt-${receiptNo}.png`, { type: 'image/png' });

      // Try Web Share API (mobile native share sheet)
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: `Receipt ${receiptNo}`,
          text: `Receipt from ${settings.business_name || 'Business'}`,
          files: [file],
        });
        setShared(true);
        setTimeout(() => setShared(false), 2000);
      } else {
        // Fallback: download as image
        downloadBlob(blob, `receipt-${receiptNo}.png`);
        setShared(true);
        setTimeout(() => setShared(false), 2000);
      }
    } catch (err: any) {
      // User cancelled share — not an error
      if (err?.name !== 'AbortError') {
        // Fallback to download
        const blob = await captureReceipt();
        if (blob) downloadBlob(blob, `receipt-${receiptNo}.png`);
      }
    } finally {
      setSharing(false);
    }
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const progressPercent = data.tokens_earned != null && data.tokens_required
    ? Math.min((data.tokens_earned / data.tokens_required) * 100, 100)
    : null;

  const primaryColor = settings.primary_color || '#6366f1';

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
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Modal — slides up on mobile, centered on desktop */}
          <motion.div
            className="relative bg-white w-full sm:max-w-sm sm:rounded-2xl rounded-t-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col"
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          >
            {/* Drag indicator (mobile) */}
            <div className="sm:hidden flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-300" />
            </div>

            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-3 right-3 sm:top-4 sm:right-4 p-1.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors z-10"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Scrollable receipt */}
            <div className="overflow-y-auto flex-1 px-5 sm:px-6">
              <div ref={receiptRef} className="py-5 sm:py-6 bg-white">
                {/* ─── Business Header ─── */}
                <div className="text-center mb-4">
                  {settings.business_logo && (
                    <img
                      src={settings.business_logo}
                      alt={settings.business_name}
                      className="w-14 h-14 object-contain mx-auto mb-2 rounded-xl"
                      crossOrigin="anonymous"
                    />
                  )}
                  <h2 className="font-bold text-base text-gray-900">{settings.business_name || 'Business'}</h2>
                  {settings.business_address && (
                    <p className="text-[11px] text-gray-400 mt-0.5 leading-tight">{settings.business_address}</p>
                  )}
                  {settings.business_phone && (
                    <p className="text-[11px] text-gray-400">Tel: {settings.business_phone}</p>
                  )}
                </div>

                {/* ─── Decorative separator ─── */}
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex-1 border-t border-dashed border-gray-200" />
                  <span className="text-[10px] text-gray-300 font-medium tracking-widest uppercase">Receipt</span>
                  <div className="flex-1 border-t border-dashed border-gray-200" />
                </div>

                {/* ─── Receipt Details ─── */}
                <div className="space-y-2 text-sm">
                  <DetailRow label="Receipt No" value={receiptNo} />
                  <DetailRow label="Date" value={dateStr} />
                  <DetailRow label="Time" value={timeStr} />
                  {data.staff_name && <DetailRow label="Served by" value={data.staff_name} />}
                </div>

                {/* ─── Amount Card ─── */}
                {data.amount != null && data.amount > 0 && (
                  <div
                    className="mt-4 rounded-xl p-4 text-center"
                    style={{ backgroundColor: primaryColor + '0A' }}
                  >
                    <p className="text-[11px] text-gray-400 uppercase tracking-wider font-medium mb-0.5">Amount</p>
                    <p className="text-2xl font-bold text-gray-900">{fmt(data.amount)}</p>
                  </div>
                )}

                {/* ─── Service/Notes ─── */}
                {(data.notes || data.plate_number) && (
                  <div className="mt-4 space-y-2 text-sm">
                    {data.notes && <DetailRow label="Service" value={data.notes} />}
                    {data.plate_number && <DetailRow label="Vehicle" value={data.plate_number} />}
                  </div>
                )}

                {/* ─── Loyalty Progress ─── */}
                {data.type === 'token' && progressPercent != null && (
                  <div className="mt-4 bg-gray-50 rounded-xl p-3.5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-gray-500 font-medium">Loyalty Progress</span>
                      <span className="text-xs font-bold" style={{ color: primaryColor }}>
                        {data.tokens_earned}/{data.tokens_required}
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ backgroundColor: primaryColor }}
                        initial={{ width: 0 }}
                        animate={{ width: `${progressPercent}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                      />
                    </div>
                    {data.tokens_earned != null && data.tokens_required != null && data.tokens_earned < data.tokens_required && (
                      <p className="text-[11px] text-gray-400 mt-1.5 text-center">
                        {data.tokens_required - data.tokens_earned} more to earn your reward!
                      </p>
                    )}
                    {data.tokens_earned != null && data.tokens_required != null && data.tokens_earned >= data.tokens_required && (
                      <p className="text-[11px] font-medium mt-1.5 text-center" style={{ color: primaryColor }}>
                        Card complete! Claim your reward!
                      </p>
                    )}
                  </div>
                )}

                {/* ─── Redemption Info ─── */}
                {data.type === 'redemption' && data.reward_description && (
                  <div className="mt-4 bg-green-50 rounded-xl p-3.5 text-center">
                    <p className="text-xs text-green-600 font-medium mb-1">Reward Claimed</p>
                    <p className="text-sm font-bold text-green-800">{data.reward_description}</p>
                  </div>
                )}

                {/* ─── Footer ─── */}
                <div className="mt-5 text-center">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex-1 border-t border-dashed border-gray-200" />
                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: primaryColor + '40' }} />
                    <div className="flex-1 border-t border-dashed border-gray-200" />
                  </div>
                  <p className="text-sm font-semibold text-gray-700">Thank you for your visit!</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">{settings.business_name}</p>
                  <p className="text-[10px] text-gray-300 mt-0.5">{dateStr} {timeStr}</p>
                </div>
              </div>
            </div>

            {/* ─── Action Buttons ─── */}
            <div className="p-4 sm:p-5 border-t border-gray-100 bg-gray-50/50">
              <button
                onClick={handleShare}
                disabled={sharing}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
                style={{
                  backgroundColor: shared ? '#22c55e' : primaryColor,
                  opacity: sharing ? 0.7 : 1,
                }}
              >
                {sharing ? (
                  <>
                    <motion.div
                      className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    />
                    Preparing...
                  </>
                ) : shared ? (
                  <>
                    <Check className="w-4 h-4" />
                    Saved!
                  </>
                ) : (
                  <>
                    {typeof navigator !== 'undefined' && 'share' in navigator ? (
                      <>
                        <Share2 className="w-4 h-4" />
                        Share Receipt
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        Save Receipt
                      </>
                    )}
                  </>
                )}
              </button>
              <button
                onClick={onClose}
                className="w-full mt-2 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              >
                Close
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ─── Helper Components ─── */

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start gap-3">
      <span className="text-gray-400 text-xs shrink-0">{label}</span>
      <span className="text-right text-gray-800 font-medium text-xs break-words min-w-0">{value}</span>
    </div>
  );
}
