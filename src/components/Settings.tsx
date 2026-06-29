import React from 'react';
import { motion } from 'framer-motion';
import { Clock, Type } from 'lucide-react';
import { useTypingStore } from '../store/useTypingStore';
import type { TestDuration, TestMode, WordCount, WordSet } from '../types';

const DURATIONS: TestDuration[] = [15, 30, 60, 120];
const WORD_COUNTS: WordCount[] = [10, 25, 50, 100];

const WORD_SETS: { id: WordSet; label: string }[] = [
  { id: 'english200', label: 'english 200' },
  { id: 'english1k', label: 'english 1k' },
  { id: 'common', label: 'common' },
];

/** Reusable pill button for settings */
const Pill: React.FC<{
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ active, disabled, onClick, children }) => (
  <button
    onClick={() => !disabled && onClick()}
    disabled={disabled}
    className={[
      'relative px-3 py-1.5 rounded-md text-sm font-mono transition-all duration-150',
      active
        ? 'text-accent-primary font-medium'
        : 'text-text-muted hover:text-text-secondary',
      disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer',
    ].join(' ')}
  >
    {children}
    {/* Active underline indicator */}
    {active && (
      <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full bg-accent-primary" />
    )}
  </button>
);

const Settings: React.FC = () => {
  const mode      = useTypingStore(s => s.mode);
  const duration  = useTypingStore(s => s.duration);
  const wordCount = useTypingStore(s => s.wordCount);
  const wordSet   = useTypingStore(s => s.wordSet);
  const setMode      = useTypingStore(s => s.setMode);
  const setDuration  = useTypingStore(s => s.setDuration);
  const setWordCount = useTypingStore(s => s.setWordCount);
  const setWordSet   = useTypingStore(s => s.setWordSet);
  const phase = useTypingStore(s => s.phase);

  const locked = phase === 'running';

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-wrap items-center gap-3 justify-center mb-8 select-none"
    >
      {/* Word set selector */}
      <div className="flex items-center gap-0.5 bg-bg-secondary rounded-lg px-1.5 py-1 border border-bg-tertiary/50">
        {WORD_SETS.map(ws => (
          <Pill key={ws.id} active={wordSet === ws.id} disabled={locked} onClick={() => setWordSet(ws.id)}>
            {ws.label}
          </Pill>
        ))}
      </div>

      {/* Divider */}
      <div className="h-5 w-px bg-bg-tertiary/60" />

      {/* Mode toggle: time | words */}
      <div className="flex items-center gap-0.5 bg-bg-secondary rounded-lg px-1.5 py-1 border border-bg-tertiary/50">
        {(['time', 'words'] as TestMode[]).map(m => (
          <Pill key={m} active={mode === m} disabled={locked} onClick={() => setMode(m)}>
            <span className="flex items-center gap-1.5">
              {m === 'time'
                ? <Clock size={12} strokeWidth={2} />
                : <Type size={12} strokeWidth={2} />
              }
              {m}
            </span>
          </Pill>
        ))}
      </div>

      {/* Divider */}
      <div className="h-5 w-px bg-bg-tertiary/60" />

      {/* Duration or word-count pills depending on mode */}
      <div className="flex items-center gap-0.5 bg-bg-secondary rounded-lg px-1.5 py-1 border border-bg-tertiary/50">
        {mode === 'time'
          ? DURATIONS.map(d => (
              <Pill key={d} active={duration === d} disabled={locked} onClick={() => setDuration(d)}>
                {d}
              </Pill>
            ))
          : WORD_COUNTS.map(wc => (
              <Pill key={wc} active={wordCount === wc} disabled={locked} onClick={() => setWordCount(wc)}>
                {wc}
              </Pill>
            ))
        }
      </div>
    </motion.div>
  );
};

export default Settings;