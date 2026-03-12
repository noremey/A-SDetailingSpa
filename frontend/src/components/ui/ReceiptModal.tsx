import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Printer, Download, Check } from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';
import html2canvas from 'html2canvas';
import type { ReceiptLineItem } from '../../types';

export interface ReceiptData {
  id: number;
  type: 'walkin' | 'loyalty';
  created_at: string;
  amount: number;
  subtotal?: number;
  discount?: number;
  payment_method: 'cash' | 'online' | 'split' | null;
  cash_amount?: number | null;
  online_amount?: number | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  staff_name?: string | null;
  token_count?: number;
  tokens_earned?: number;
  tokens_required?: number;
  plate_number?: string | null;
  notes?: string | null;
  line_items?: ReceiptLineItem[];
}

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: ReceiptData | null;
}

export default function ReceiptModal({ isOpen, onClose, data }: ReceiptModalProps) {
  const { settings } = useSettings();
  const receiptRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = 'hidden';
    setDownloaded(false);
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
  const receiptNo = data.type === 'walkin' ? `WS-${data.id}` : `LT-${data.id}`;

  const paymentLabel = data.payment_method === 'cash' ? 'Cash' : data.payment_method === 'online' ? 'Online' : data.payment_method === 'split' ? 'Split' : '-';

  const handlePrint = () => window.print();

  const handleDownloadImage = async () => {
    if (!receiptRef.current) return;
    setDownloading(true);
    try {
      const canvas = await html2canvas(receiptRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        logging: false,
      });
      const blob = await new Promise<Blob | null>(resolve => {
        canvas.toBlob(b => resolve(b), 'image/png', 1.0);
      });
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `receipt-${receiptNo}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setDownloaded(true);
        setTimeout(() => setDownloaded(false), 2000);
      }
    } catch (err) {
      console.error('Download receipt image failed:', err);
    } finally {
      setDownloading(false);
    }
  };

  const hasCustomer = data.customer_name || data.customer_phone;
  const hasLoyalty = data.type === 'loyalty' && data.token_count && data.token_count > 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm no-print"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xs overflow-hidden max-h-[90vh] flex flex-col"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-3 right-3 p-1.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors no-print z-10"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Scrollable receipt content */}
            <div className="overflow-y-auto flex-1">
              <div ref={receiptRef} id="receipt-print-area" className="font-mono text-xs p-5 pt-6 bg-white">

                {/* ─── Business Header ─── */}
                <div className="text-center">
                  {settings.business_logo && (
                    <img
                      src={settings.business_logo}
                      alt={settings.business_name}
                      className="w-12 h-12 object-contain mx-auto mb-1.5"
                      crossOrigin="anonymous"
                    />
                  )}
                  <p className="font-bold text-sm">{settings.business_name || 'Business'}</p>
                  {settings.business_address && (
                    <p className="text-[10px] text-gray-500 mt-0.5 leading-tight">{settings.business_address}</p>
                  )}
                  {settings.business_phone && (
                    <p className="text-[10px] text-gray-500">Tel: {settings.business_phone}</p>
                  )}
                </div>

                <Separator />

                {/* ─── Receipt Info ─── */}
                <div className="text-center mb-1">
                  <p className="font-bold text-sm tracking-widest">RECEIPT</p>
                </div>
                <div className="space-y-0.5">
                  <Row label="No" value={receiptNo} />
                  <Row label="Date" value={dateStr} />
                  <Row label="Time" value={timeStr} />
                  {data.staff_name && <Row label="Staff" value={data.staff_name} />}
                </div>

                <Separator />

                {/* ─── Customer Info ─── */}
                {hasCustomer && (
                  <>
                    <div className="space-y-0.5">
                      {data.customer_name && <Row label="Customer" value={data.customer_name} />}
                      {data.customer_phone && <Row label="Phone" value={data.customer_phone} />}
                      {data.plate_number && <Row label="Vehicle" value={data.plate_number} />}
                    </div>
                    <Separator />
                  </>
                )}

                {/* ─── Type & Notes ─── */}
                <div className="space-y-0.5">
                  <Row label="Type" value={data.type === 'walkin' ? 'Walk-in Sale' : 'Loyalty Token'} />
                  {data.notes && !data.line_items?.length && <Row label="Notes" value={data.notes} />}
                </div>

                {/* ─── Order Items ─── */}
                {data.line_items && data.line_items.length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-1">
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Order Items</p>
                      {data.line_items.map((item, i) => (
                        <div key={i} className="flex justify-between gap-2">
                          <span className="text-gray-700 min-w-0">
                            {item.quantity}x {item.name}
                          </span>
                          <span className="font-medium text-right shrink-0">
                            {fmt(item.subtotal)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                <Separator />

                {/* ─── Payment Summary ─── */}
                {data.discount && data.discount > 0 && data.subtotal ? (
                  <div className="my-2 space-y-0.5">
                    <Row label="Subtotal" value={fmt(data.subtotal)} />
                    <div className="flex justify-between text-green-600">
                      <span className="text-xs">Discount</span>
                      <span className="text-xs font-medium">-{fmt(data.discount)}</span>
                    </div>
                    <div className="text-center pt-1">
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider">Total</p>
                      <p className="text-xl font-bold">{fmt(data.amount)}</p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center my-2">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">Total</p>
                    <p className="text-xl font-bold">{fmt(data.amount)}</p>
                  </div>
                )}
                <div className="space-y-0.5">
                  <Row label="Payment" value={paymentLabel} />
                  {data.payment_method === 'split' && (
                    <>
                      {data.cash_amount != null && <Row label="  Cash" value={fmt(data.cash_amount)} />}
                      {data.online_amount != null && <Row label="  Online" value={fmt(data.online_amount)} />}
                    </>
                  )}
                </div>

                {/* ─── Loyalty Info ─── */}
                {hasLoyalty && (
                  <>
                    <Separator />
                    <div className="space-y-0.5">
                      <Row label="Tokens" value={`+${data.token_count}`} />
                      {data.tokens_earned != null && data.tokens_required != null && (
                        <>
                          <Row label="Progress" value={`${data.tokens_earned}/${data.tokens_required}`} />
                          <div className="mt-1.5">
                            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-green-500 rounded-full transition-all"
                                style={{ width: `${Math.min((data.tokens_earned / data.tokens_required) * 100, 100)}%` }}
                              />
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </>
                )}

                <Separator />

                {/* ─── Footer ─── */}
                <div className="text-center mt-2">
                  <p className="font-bold text-sm">Thank you!</p>
                  <p className="text-[10px] text-gray-400 mt-1">{settings.business_name}</p>
                  <p className="text-[9px] text-gray-300 mt-0.5">{dateStr} {timeStr}</p>
                </div>
              </div>
            </div>

            {/* ─── Action Buttons ─── */}
            <div className="p-4 border-t border-gray-100 no-print space-y-2">
              <div className="flex gap-2">
                <button
                  onClick={handlePrint}
                  className="flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 transition-colors flex items-center justify-center gap-2"
                >
                  <Printer className="w-4 h-4" />
                  Print
                </button>
                <button
                  onClick={handleDownloadImage}
                  disabled={downloading}
                  className="flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold text-white transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
                  style={{
                    backgroundColor: downloaded ? '#22c55e' : '#8b5cf6',
                    opacity: downloading ? 0.7 : 1,
                  }}
                >
                  {downloading ? (
                    <>
                      <motion.div
                        className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      />
                      Saving...
                    </>
                  ) : downloaded ? (
                    <>
                      <Check className="w-4 h-4" />
                      Saved!
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      Image
                    </>
                  )}
                </button>
              </div>
              <button
                onClick={onClose}
                className="w-full py-2 rounded-xl text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
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

function Separator() {
  return <div className="receipt-separator border-t border-dashed border-gray-300 my-2.5" />;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className="text-right font-medium break-words min-w-0">{value}</span>
    </div>
  );
}
