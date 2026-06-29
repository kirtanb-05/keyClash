import React, { useEffect, useRef, useCallback } from 'react';
import { useTypingStore } from '../store/useTypingStore';
import { useKeyboardCapture } from '../hooks/useKeyboardCapture';
import type { WordData } from '../types';

// ─── Sub-component: a single word ────────────────────────────────────────────

interface WordProps {
  word: WordData;
  isCurrent: boolean;
  currentInput: string;
  isRef: boolean;
  wordRef?: React.RefObject<HTMLSpanElement>;
}

const Word: React.FC<WordProps> = ({ word, isCurrent, currentInput, wordRef }) => {
  return (
    <span
      ref={wordRef}
      className={[
        'relative inline-flex font-mono text-[1.15rem] leading-[2] mx-[3px] px-1 rounded transition-colors duration-75',
        isCurrent ? 'bg-bg-tertiary/60' : '',
      ].join(' ')}
    >
      {/* Expected characters */}
      {word.chars.map((c, i) => {
        let colorClass = 'text-word-pending';
        if (!isCurrent && word.isCorrect !== null) {
          // Completed word
          colorClass = c.state === 'correct' ? 'text-word-correct' : 'text-word-incorrect';
        } else if (isCurrent && i < currentInput.length) {
          colorClass = c.state === 'correct' ? 'text-word-correct' : 'text-word-incorrect';
        } else if (isCurrent && i === currentInput.length) {
          // The next character to type
          colorClass = 'text-word-current';
        }

        const isCaret = isCurrent && i === currentInput.length;

        return (
          <span key={i} className="relative">
            {/* Blinking caret before this character */}
            {isCaret && (
              <span
                className="absolute -left-px top-[0.2em] bottom-[0.2em] w-[2px] bg-text-cursor animate-blink rounded-full"
                aria-hidden="true"
              />
            )}
            <span className={`transition-colors duration-75 ${colorClass}`}>{c.char}</span>
          </span>
        );
      })}

      {/* Caret at end of word when fully typed (and possibly overflowing) */}
      {isCurrent && currentInput.length >= word.chars.length && word.extras.length === 0 && (
        <span
          className="absolute right-0 top-[0.2em] bottom-[0.2em] w-[2px] -mr-px bg-text-cursor animate-blink rounded-full"
          aria-hidden="true"
        />
      )}

      {/* Extra (overflow) characters */}
      {(isCurrent ? word.extras : !isCurrent && word.extras.length > 0 ? word.extras : []).map(
        (ex, i) => (
          <span
            key={`extra-${i}`}
            className="relative text-word-incorrect"
          >
            {i === word.extras.length - 1 && isCurrent && (
              <span
                className="absolute right-0 top-[0.2em] bottom-[0.2em] w-[2px] bg-text-cursor animate-blink rounded-full"
                aria-hidden="true"
              />
            )}
            {ex.char}
          </span>
        )
      )}
    </span>
  );
};

// ─── Main WordDisplay ─────────────────────────────────────────────────────────

/**
 * WordDisplay – renders the scrolling word area with a hidden input to
 * capture keystrokes.
 *
 * Layout: words flow naturally. We track the current word's DOM position and
 * scroll the container so the current line is always at the top.
 *
 * IMPORTANT: the bottom fade mask lives in a separate, non-scrolling wrapper
 * (`viewportRef`) rather than inside the scrollable element (`containerRef`).
 * If the mask were a sibling of the word list *inside* the scrolled element,
 * its `bottom-0` would be resolved against the scrollable content's box and
 * it would visibly ride upward in sync with `scrollTo()` as lines advance.
 * Keeping it in an outer, never-scrolled box pins it to the true visible
 * bottom edge at all times.
 */
const WordDisplay: React.FC = () => {
  const words = useTypingStore(s => s.words);
  const currentWordIndex = useTypingStore(s => s.currentWordIndex);
  const currentInput = useTypingStore(s => s.currentInput);
  const phase = useTypingStore(s => s.phase);

  const { inputRef, onKeyDown, onInputChange } = useKeyboardCapture();

  // Outer, fixed-height, NEVER-scrolled box. Owns the fade mask.
  const viewportRef = useRef<HTMLDivElement>(null);
  // Inner, absolutely-positioned box that actually scrolls.
  const containerRef = useRef<HTMLDivElement>(null);
  const currentWordRef = useRef<HTMLSpanElement>(null);

  // Track the row offset so we only scroll when the current word moves to a new line
  const lastTopRef = useRef<number>(0);

  const scrollToCurrentWord = useCallback(() => {
    const container = containerRef.current;
    const currentEl = currentWordRef.current;
    if (!container || !currentEl) return;

    const wordTop = currentEl.offsetTop;

    // Only scroll when the current word starts a new visible line
    if (wordTop !== lastTopRef.current) {
      lastTopRef.current = wordTop;
      // Scroll container so the current line is always at the top of the visible area
      container.scrollTo({ top: wordTop - 8, behavior: 'smooth' });
    }
  }, []);

  useEffect(() => {
    scrollToCurrentWord();
  }, [currentWordIndex, scrollToCurrentWord]);

  return (
    <div className="relative w-full select-none">
      {/* Hidden input – captures all keyboard events */}
      <input
        ref={inputRef}
        value={currentInput}
        onChange={onInputChange}
        onKeyDown={onKeyDown}
        className="absolute opacity-0 w-0 h-0 pointer-events-none"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        aria-label="Type here"
        tabIndex={0}
      />

      {/* Non-scrolling viewport — fixed height, fade mask lives here */}
      <div
        ref={viewportRef}
        className="relative overflow-hidden"
        style={{ height: '9rem' }} // ~3 visible lines with bigger line-height
      >
        {/* Scrollable content lives in its own absolutely-positioned box,
            so its internal scrollTop never affects the mask's positioning context. */}
        <div
          ref={containerRef}
          className="absolute inset-0 overflow-hidden"
          onClick={() => inputRef.current?.focus()}
        >
          <div className="flex flex-wrap gap-y-1 leading-relaxed pr-2">
            {words.map((word, i) => (
              <Word
                key={word.id}
                word={word}
                isCurrent={i === currentWordIndex}
                currentInput={i === currentWordIndex ? currentInput : ''}
                isRef={i === currentWordIndex}
                wordRef={i === currentWordIndex ? currentWordRef : undefined}
              />
            ))}
          </div>
        </div>

        {/* Fade mask bottom — pinned to the true visible bottom edge,
            since `viewportRef` itself is never scrolled. */}
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-8 z-10 bg-gradient-to-t from-bg-primary to-transparent" />
      </div>

      {/* Idle hint */}
      {phase === 'idle' && (
        <p className="text-center text-text-muted text-sm font-mono mt-6 animate-fadeIn">
          start typing to begin
        </p>
      )}
    </div>
  );
};

export default WordDisplay;