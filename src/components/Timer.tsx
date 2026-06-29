import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTypingStore } from '../store/useTypingStore';
import { formatTime } from '../utils/typing';

/**
 * Timer – displays the countdown above the word area.
 * Pulses to accent colour in the last 10 seconds.
 */
const Timer: React.FC = () => {
  const timeLeft = useTypingStore(s => s.timeLeft);
  const phase = useTypingStore(s => s.phase);

  const isUrgent = timeLeft <= 10 && phase === 'running';
  const isIdle = phase === 'idle';

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={timeLeft}
        initial={{ opacity: 0.6, y: -2 }}
        animate={{ opacity: 1, y: 0 }}
        className={[
          'text-5xl font-mono font-bold tabular-nums select-none mb-2 tracking-tight transition-colors duration-300',
          isUrgent ? 'text-accent-primary' : isIdle ? 'text-text-muted' : 'text-text-primary',
        ].join(' ')}
      >
        {formatTime(timeLeft)}
      </motion.div>
    </AnimatePresence>
  );
};

export default Timer;
