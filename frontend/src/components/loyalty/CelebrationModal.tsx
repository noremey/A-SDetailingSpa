import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { Gift, PartyPopper, X } from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function CelebrationModal({ isOpen, onClose }: Props) {
  const { settings } = useSettings();

  useEffect(() => {
    if (isOpen) {
      // Fire confetti from both sides
      const fire = (x: number) => {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { x, y: 0.6 },
          colors: [settings.primary_color, '#fbbf24', '#34d399', '#f472b6', '#60a5fa'],
        });
      };
      fire(0.15);
      fire(0.85);
      setTimeout(() => {
        confetti({
          particleCount: 60,
          spread: 120,
          origin: { x: 0.5, y: 0.4 },
          colors: ['#fbbf24', '#f59e0b', '#eab308'],
        });
      }, 400);
    }
  }, [isOpen, settings.primary_color]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl relative"
            initial={{ scale: 0.3, y: 100, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.3, y: 100, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>

            <motion.div
              animate={{ rotate: [0, -15, 15, -15, 15, 0] }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <PartyPopper className="w-16 h-16 mx-auto text-yellow-500 mb-4" />
            </motion.div>

            <motion.h2
              className="text-2xl font-extrabold text-gray-900 mb-2"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              Tahniah! 🎉
            </motion.h2>

            <motion.p
              className="text-gray-500 mb-5"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              Your loyalty card is complete!
            </motion.p>

            <motion.div
              className="rounded-2xl p-5 mb-6"
              style={{ backgroundColor: settings.primary_color + '12' }}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <Gift className="w-10 h-10 mx-auto mb-3" style={{ color: settings.primary_color }} />
              <p className="font-bold text-xl" style={{ color: settings.primary_color }}>
                {settings.reward_description}
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Show this to the staff to claim your reward!
              </p>
            </motion.div>

            <motion.button
              onClick={onClose}
              className="w-full py-3.5 rounded-xl font-bold text-white text-lg shadow-lg"
              style={{ backgroundColor: settings.primary_color }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.6 }}
            >
              Awesome! 🙌
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
