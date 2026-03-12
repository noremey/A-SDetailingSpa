import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, Printer, Check } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useSettings } from '../../context/SettingsContext';
import html2canvas from 'html2canvas';

interface QRPosterModalProps {
  isOpen: boolean;
  onClose: () => void;
  registrationUrl: string;
}

export default function QRPosterModal({ isOpen, onClose, registrationUrl }: QRPosterModalProps) {
  const { settings } = useSettings();
  const posterRef = useRef<HTMLDivElement>(null);
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

  const primaryColor = settings.primary_color || '#6366f1';
  const businessName = settings.business_name || 'Our Business';
  const rewardDesc = settings.reward_description || 'FREE reward';
  const tokensPerCard = settings.tokens_per_card || '10';

  const handleDownload = async () => {
    if (!posterRef.current) return;
    setDownloading(true);
    try {
      const canvas = await html2canvas(posterRef.current, {
        scale: 3,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });
      const link = document.createElement('a');
      link.download = `${businessName.replace(/\s+/g, '-')}-QR-Poster.png`;
      link.href = canvas.toDataURL('image/png');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setDownloaded(true);
      setTimeout(() => setDownloaded(false), 2500);
    } catch {
      // silent
    } finally {
      setDownloading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

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
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[92vh] flex flex-col overflow-hidden"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-900 text-base">QR Poster</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrint}
                  className="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                  title="Print poster"
                >
                  <Printer className="w-4 h-4" />
                </button>
                <button
                  onClick={handleDownload}
                  disabled={downloading}
                  className="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                  title="Download as PNG"
                >
                  {downloaded ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : downloading ? (
                    <motion.div
                      className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                </button>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Poster Preview (scrollable) */}
            <div className="overflow-y-auto flex-1 p-5 bg-gray-50">
              <div
                ref={posterRef}
                id="qr-poster-print"
                className="bg-white mx-auto shadow-lg"
                style={{
                  width: '100%',
                  maxWidth: '420px',
                  aspectRatio: '210 / 297',
                  padding: '40px 32px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                {/* Top Section */}
                <div style={{ textAlign: 'center', width: '100%' }}>
                  {/* Logo */}
                  {settings.business_logo && (
                    <img
                      src={settings.business_logo}
                      alt={businessName}
                      crossOrigin="anonymous"
                      style={{
                        width: '72px',
                        height: '72px',
                        objectFit: 'contain',
                        margin: '0 auto 12px',
                        borderRadius: '16px',
                      }}
                    />
                  )}
                  {/* Business Name */}
                  <h1 style={{
                    fontSize: '28px',
                    fontWeight: 800,
                    color: '#111827',
                    margin: '0 0 4px',
                    lineHeight: 1.2,
                  }}>
                    {businessName}
                  </h1>
                  {/* Tagline */}
                  <p style={{
                    fontSize: '13px',
                    color: '#6b7280',
                    margin: 0,
                    fontWeight: 500,
                  }}>
                    Loyalty & Rewards Program
                  </p>
                </div>

                {/* Middle Section - QR Code */}
                <div style={{ textAlign: 'center', padding: '16px 0' }}>
                  {/* Scan instruction */}
                  <div style={{
                    display: 'inline-block',
                    padding: '8px 20px',
                    borderRadius: '24px',
                    backgroundColor: primaryColor + '10',
                    marginBottom: '20px',
                  }}>
                    <p style={{
                      fontSize: '14px',
                      fontWeight: 700,
                      color: primaryColor,
                      margin: 0,
                      letterSpacing: '0.5px',
                    }}>
                      SCAN TO JOIN
                    </p>
                  </div>

                  {/* QR Code with border */}
                  <div style={{
                    display: 'inline-block',
                    padding: '16px',
                    border: `3px solid ${primaryColor}20`,
                    borderRadius: '20px',
                    backgroundColor: '#ffffff',
                  }}>
                    <QRCodeSVG
                      value={registrationUrl}
                      size={200}
                      level="M"
                      bgColor="#ffffff"
                      fgColor="#111827"
                    />
                  </div>

                  {/* Reward info */}
                  <div style={{ marginTop: '20px' }}>
                    <p style={{
                      fontSize: '15px',
                      fontWeight: 600,
                      color: '#374151',
                      margin: '0 0 6px',
                    }}>
                      Collect {tokensPerCard} tokens, earn:
                    </p>
                    <div style={{
                      display: 'inline-block',
                      padding: '10px 24px',
                      borderRadius: '12px',
                      background: `linear-gradient(135deg, ${primaryColor}, ${settings.secondary_color || primaryColor})`,
                    }}>
                      <p style={{
                        fontSize: '16px',
                        fontWeight: 800,
                        color: '#ffffff',
                        margin: 0,
                      }}>
                        {rewardDesc}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Bottom Section */}
                <div style={{ textAlign: 'center', width: '100%' }}>
                  {/* Divider */}
                  <div style={{
                    width: '60px',
                    height: '3px',
                    borderRadius: '2px',
                    backgroundColor: primaryColor + '30',
                    margin: '0 auto 12px',
                  }} />
                  {/* Contact info */}
                  {settings.business_phone && (
                    <p style={{ fontSize: '12px', color: '#9ca3af', margin: '0 0 2px', fontWeight: 500 }}>
                      Tel: {settings.business_phone}
                    </p>
                  )}
                  {settings.business_address && (
                    <p style={{ fontSize: '11px', color: '#d1d5db', margin: 0, lineHeight: 1.4 }}>
                      {settings.business_address}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="px-5 py-4 border-t border-gray-100 bg-white flex gap-3 no-print">
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                style={{
                  backgroundColor: downloaded ? '#22c55e' : primaryColor,
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
                    Downloading...
                  </>
                ) : downloaded ? (
                  <>
                    <Check className="w-4 h-4" />
                    Downloaded!
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Download PNG
                  </>
                )}
              </button>
              <button
                onClick={handlePrint}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                style={{ borderColor: primaryColor + '40', color: primaryColor }}
              >
                <Printer className="w-4 h-4" />
                Print A4
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
