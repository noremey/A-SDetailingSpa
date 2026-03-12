import { motion } from 'framer-motion';

interface Props {
  current: number;
  total: number;
  isComplete: boolean;
}

export default function CardProgress({ current, total, isComplete }: Props) {
  const percentage = Math.min((current / total) * 100, 100);

  return (
    <div className="w-full">
      <div className="flex justify-between text-xs md:text-sm text-white/60 mb-1.5">
        <span className="font-medium">{current}/{total} tokens</span>
        <span>{Math.round(percentage)}%</span>
      </div>
      <div className="h-2.5 md:h-3 bg-white/10 rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${
            isComplete
              ? 'bg-gradient-to-r from-yellow-300 to-yellow-400'
              : 'bg-gradient-to-r from-white/40 to-white/60'
          }`}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
        />
      </div>
    </div>
  );
}
