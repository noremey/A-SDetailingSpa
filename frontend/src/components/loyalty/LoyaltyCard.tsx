import { motion } from 'framer-motion';
import { Gift, Sparkles } from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';
import TokenCircle from './TokenCircle';
import CardProgress from './CardProgress';
import type { LoyaltyCard as LoyaltyCardType } from '../../types';

interface Props {
  card: LoyaltyCardType;
  compact?: boolean;
}

export default function LoyaltyCard({ card, compact = false }: Props) {
  const { settings } = useSettings();
  const { tokens_earned, tokens_required, tokens, status } = card;
  const isComplete = status === 'completed' || status === 'redeemed';

  // Generate circle data
  const circles = Array.from({ length: tokens_required }, (_, i) => {
    const position = i + 1;
    const token = tokens?.find(t => t.token_position === position);
    return { position, token, isFilled: !!token };
  });

  // Split into rows (5 per row)
  const perRow = Math.ceil(tokens_required / 2);
  const rows: typeof circles[] = [];
  for (let i = 0; i < circles.length; i += perRow) {
    rows.push(circles.slice(i, i + perRow));
  }

  return (
    <motion.div
      className="relative rounded-2xl overflow-hidden shadow-xl"
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      {/* Card background */}
      <div
        className="p-5 sm:p-6 md:p-7"
        style={{
          background: `linear-gradient(135deg, ${settings.primary_color}, ${settings.secondary_color})`,
        }}
      >
        {/* Decorative circles */}
        <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-24 h-24 rounded-full bg-white/5 translate-y-1/2 -translate-x-1/2" />

        {/* Header: Business name + card number */}
        <div className="relative flex justify-between items-start mb-5">
          <div>
            <h2 className="text-white text-lg sm:text-xl md:text-2xl font-bold tracking-tight">
              {settings.business_name}
            </h2>
            <p className="text-white/50 text-xs mt-0.5 uppercase tracking-wider">
              Loyalty Card #{card.card_number}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {settings.business_logo ? (
              <img
                src={settings.business_logo}
                alt=""
                className="w-10 h-10 rounded-full bg-white/20 object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white/60" />
              </div>
            )}
          </div>
        </div>

        {/* Token circles grid */}
        {!compact && (
          <div className="space-y-3 mb-5">
            {rows.map((row, rowIdx) => (
              <div key={rowIdx} className="flex justify-center gap-2.5 sm:gap-3 md:gap-4">
                {row.map(({ position, token, isFilled }) => (
                  <TokenCircle
                    key={position}
                    position={position}
                    isFilled={isFilled}
                    token={token}
                    isLatest={position === tokens_earned}
                    isComplete={isComplete}
                    primaryColor={settings.primary_color}
                  />
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Progress bar */}
        <CardProgress
          current={tokens_earned}
          total={tokens_required}
          isComplete={isComplete}
        />

        {/* Total amount spent */}
        {card.total_amount != null && card.total_amount > 0 && (
          <div className="flex items-center justify-between mt-3 px-1">
            <p className="text-white/50 text-xs">Total Spent</p>
            <p className="text-white font-bold text-sm">
              {settings.currency_symbol}{card.total_amount.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
            </p>
          </div>
        )}

        {/* Status message */}
        <div className="text-center mt-4 relative">
          {isComplete ? (
            <motion.div
              className="flex items-center justify-center gap-2"
              animate={{ scale: [1, 1.03, 1] }}
              transition={{ repeat: Infinity, duration: 2.5 }}
            >
              <Gift className="w-5 h-5 text-yellow-300" />
              <p className="text-yellow-300 font-bold text-base sm:text-lg">
                {status === 'redeemed' ? 'REWARD CLAIMED!' : 'FREE REWARD EARNED!'}
              </p>
              <Gift className="w-5 h-5 text-yellow-300" />
            </motion.div>
          ) : tokens_earned >= tokens_required - 2 && tokens_earned > 0 ? (
            <motion.p
              className="text-yellow-200 font-semibold text-sm"
              animate={{ opacity: [0.7, 1, 0.7] }}
              transition={{ repeat: Infinity, duration: 2 }}
            >
              Almost there! Just {tokens_required - tokens_earned} more to go! 🔥
            </motion.p>
          ) : (
            <p className="text-white/60 text-xs">
              Collect {tokens_required} tokens to earn {settings.reward_description}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
