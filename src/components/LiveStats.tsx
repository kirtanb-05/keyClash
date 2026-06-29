import React from 'react';
import { useTypingStore } from '../store/useTypingStore';

/**
 * LiveStats – compact metric strip shown during a running test.
 */
const LiveStats: React.FC = () => {
  const metrics = useTypingStore(s => s.metrics);
  const phase = useTypingStore(s => s.phase);

  if (phase === 'idle') return null;

  const stats = [
    { label: 'wpm', value: metrics.wpm },
    { label: 'raw', value: metrics.rawWpm },
    { label: 'acc', value: `${metrics.accuracy}%` },
  ];

  return (
    <div className="flex items-center gap-1 mb-4 select-none">
      {stats.map((s, i) => (
        <React.Fragment key={s.label}>
          {i > 0 && <div className="h-3.5 w-px bg-bg-tertiary/60 mx-3" />}
          <div className="flex items-center gap-2">
            <span className="text-text-muted text-[10px] font-mono uppercase tracking-widest">
              {s.label}
            </span>
            <span className="text-text-primary font-mono font-semibold text-base tabular-nums">
              {s.value}
            </span>
          </div>
        </React.Fragment>
      ))}
    </div>
  );
};

export default LiveStats;
