import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Star } from 'lucide-react';
import type { Token } from '../../types';

interface Props {
  position: number;
  isFilled: boolean;
  token?: Token;
  isLatest: boolean;
  isComplete: boolean;
  primaryColor: string;
}

export default function TokenCircle({ position, isFilled, token, isLatest, isComplete, primaryColor }: Props) {
  const [showTooltip, setShowTooltip] = useState(false);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <motion.div
      className={`
        w-11 h-11 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center
        border-2 transition-all duration-300 relative cursor-pointer
        ${isFilled
          ? 'bg-white/30 border-white shadow-lg shadow-white/20'
          : 'bg-white/5 border-white/25 border-dashed'
        }
        ${isLatest && isFilled ? 'ring-2 ring-yellow-300 ring-offset-2 ring-offset-transparent' : ''}
      `}
      initial={isFilled ? { scale: 0, rotate: -180 } : false}
      animate={isFilled ? { scale: 1, rotate: 0 } : {}}
      transition={{
        type: 'spring',
        stiffness: 400,
        damping: 15,
        delay: position * 0.06
      }}
      whileTap={{ scale: 0.9 }}
      onMouseEnter={() => isFilled && setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onTouchStart={() => isFilled && setShowTooltip(prev => !prev)}
    >
      {isFilled ? (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: position * 0.06 + 0.15, type: 'spring', stiffness: 500 }}
        >
          {isComplete ? (
            <Star className="w-5 h-5 md:w-6 md:h-6 text-yellow-300 fill-yellow-300" />
          ) : (
            <Check className="w-5 h-5 md:w-6 md:h-6 text-white stroke-[3]" />
          )}
        </motion.div>
      ) : (
        <span className="text-white/30 text-xs font-bold">{position}</span>
      )}

      {/* Tooltip: show date when token was added */}
      <AnimatePresence>
        {showTooltip && isFilled && token?.created_at && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.9 }}
            transition={{ duration: 0.15 }}
            className="absolute -top-12 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
          >
            <div className="bg-gray-900 text-white text-[10px] px-2.5 py-1.5 rounded-lg shadow-xl whitespace-nowrap font-medium">
              {formatDate(token.created_at)}
              {/* Arrow */}
              <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Glow effect for latest token */}
      {isLatest && isFilled && (
        <motion.div
          className="absolute inset-0 rounded-full"
          animate={{
            boxShadow: [
              '0 0 0px rgba(253, 224, 71, 0)',
              '0 0 15px rgba(253, 224, 71, 0.5)',
              '0 0 0px rgba(253, 224, 71, 0)',
            ]
          }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      )}
    </motion.div>
  );
}
