import { create } from 'zustand';
import type {
  TestMode,
  TestDuration,
  WordCount,
  WordSet,
  WordData,
  LiveMetrics,
  TestPhase,
  TestResult,
} from '../types';
import {
  generateWords,
  computeWordChars,
  finalizeWord,
  computeMetrics,
  countChars,
} from '../utils/typing';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Initial word count for time mode (always generate a big buffer up front) */
const TIME_MODE_WORD_COUNT = 80;

/** When fewer than this many un-typed words remain in the buffer, top it up.
 *  Keep this comfortably higher than any realistic per-tick word consumption
 *  (even ~250+ WPM typists won't burn through this many words between renders). */
const REFILL_THRESHOLD = 20;

/** How many extra words to append each time we top up the buffer */
const REFILL_BATCH = 40;

/** localStorage key for persisted settings */
const SETTINGS_STORAGE_KEY = 'keyclash-settings';

/** Load saved settings from localStorage */
function loadSettings(): { mode: TestMode; duration: TestDuration; wordCount: WordCount; wordSet: WordSet } {
  const defaults = { mode: 'time' as TestMode, duration: 30 as TestDuration, wordCount: 25 as WordCount, wordSet: 'english200' as WordSet };
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    return {
      mode: ['time', 'words'].includes(parsed.mode) ? parsed.mode : defaults.mode,
      duration: [15, 30, 60, 120].includes(parsed.duration) ? parsed.duration : defaults.duration,
      wordCount: [10, 25, 50, 100].includes(parsed.wordCount) ? parsed.wordCount : defaults.wordCount,
      wordSet: ['english200', 'english1k', 'common'].includes(parsed.wordSet) ? parsed.wordSet : defaults.wordSet,
    };
  } catch {
    return defaults;
  }
}

/** Save current settings to localStorage */
function saveSettings(s: { mode: TestMode; duration: TestDuration; wordCount: WordCount; wordSet: WordSet }) {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(s));
  } catch { /* ignore quota errors */ }
}

// ─── Store Shape ──────────────────────────────────────────────────────────────

interface TypingState {
  // ── Config ──────────────────────────────────────────────────────────────────
  mode: TestMode;
  duration: TestDuration;
  wordCount: WordCount;
  wordSet: WordSet;

  // ── Test State ───────────────────────────────────────────────────────────────
  phase: TestPhase;
  words: WordData[];
  currentWordIndex: number;
  currentInput: string;

  // ── Timer (time mode only) ───────────────────────────────────────────────────
  timeLeft: number;
  startTime: number | null;

  // ── Metrics ──────────────────────────────────────────────────────────────────
  metrics: LiveMetrics;
  totalKeystrokes: number;
  result: TestResult | null;

  // ── Actions ──────────────────────────────────────────────────────────────────
  setMode: (m: TestMode) => void;
  setDuration: (d: TestDuration) => void;
  setWordCount: (wc: WordCount) => void;
  setWordSet: (ws: WordSet) => void;
  initTest: () => void;
  startTest: () => void;
  handleInput: (value: string) => void;
  handleKeyDown: (e: KeyboardEvent) => void;
  tick: () => void;
  finishTest: () => void;
  restart: () => void;
}

// ─── Store Implementation ─────────────────────────────────────────────────────

const _saved = loadSettings();

export const useTypingStore = create<TypingState>((set, get) => ({
  // ── Config (restored from localStorage) ─────────────────────────────────────
  mode: _saved.mode,
  duration: _saved.duration,
  wordCount: _saved.wordCount,
  wordSet: _saved.wordSet,

  // ── Initial State ────────────────────────────────────────────────────────────
  phase: 'idle',
  words: [],
  currentWordIndex: 0,
  currentInput: '',
  timeLeft: _saved.duration,
  startTime: null,
  metrics: { wpm: 0, rawWpm: 0, accuracy: 100, correctChars: 0, incorrectChars: 0 },
  totalKeystrokes: 0,
  result: null,

  // ── Config Actions ───────────────────────────────────────────────────────────

  setMode: (mode) => {
    set({ mode });
    const s = get();
    saveSettings({ mode, duration: s.duration, wordCount: s.wordCount, wordSet: s.wordSet });
    s.initTest();
  },

  setDuration: (duration) => {
    set({ duration, timeLeft: duration });
    const s = get();
    saveSettings({ mode: s.mode, duration, wordCount: s.wordCount, wordSet: s.wordSet });
    if (s.phase === 'idle') {
      s.initTest();
    }
  },

  setWordCount: (wordCount) => {
    set({ wordCount });
    const s = get();
    saveSettings({ mode: s.mode, duration: s.duration, wordCount, wordSet: s.wordSet });
    s.initTest();
  },

  setWordSet: (wordSet) => {
    set({ wordSet });
    const s = get();
    saveSettings({ mode: s.mode, duration: s.duration, wordCount: s.wordCount, wordSet });
    s.initTest();
  },

  // ── Initialise a new test (but don't start the clock) ────────────────────────

  initTest: () => {
    const { mode, duration, wordCount, wordSet } = get();

    // In time mode generate a big buffer; in words mode generate exactly wordCount.
    // Time mode's buffer is topped up dynamically in handleInput as it's consumed,
    // so this initial count just needs to comfortably cover the opening stretch.
    const count = mode === 'words' ? wordCount : TIME_MODE_WORD_COUNT;
    const words = generateWords(wordSet, count);

    set({
      phase: 'idle',
      words,
      currentWordIndex: 0,
      currentInput: '',
      timeLeft: duration,
      startTime: null,
      metrics: { wpm: 0, rawWpm: 0, accuracy: 100, correctChars: 0, incorrectChars: 0 },
      totalKeystrokes: 0,
      result: null,
    });
  },

  // ── Start the clock (called on first keystroke) ──────────────────────────────

  startTest: () => {
    set({ phase: 'running', startTime: Date.now() });
  },

  // ── Handle character input ───────────────────────────────────────────────────

  handleInput: (value: string) => {
    const { phase, mode, words, currentWordIndex, startTime, totalKeystrokes, wordSet } = get();

    if (phase === 'finished') return;

    if (phase === 'idle') {
      get().startTest();
    }

    // Space pressed → advance to next word
    if (value.endsWith(' ')) {
      if (value.trim() === '') return;

      const updatedWords = [...words];
      const typedWord = value.trim();

      updatedWords[currentWordIndex] = finalizeWord(
        computeWordChars(updatedWords[currentWordIndex], typedWord)
      );

      const nextIndex = currentWordIndex + 1;

      // In words mode: finish when all words are completed
      if (mode === 'words' && nextIndex >= updatedWords.length) {
        set({ words: updatedWords, currentInput: '', currentWordIndex: nextIndex });
        get().finishTest();
        return;
      }

      // In time mode: NEVER finish just because the buffer ran out — the test
      // should only end when the timer hits 0 (see tick()). Instead, keep the
      // buffer topped up well ahead of the typist, no matter how fast they go.
      if (mode === 'time' && updatedWords.length - nextIndex < REFILL_THRESHOLD) {
        updatedWords.push(...generateWords(wordSet, REFILL_BATCH));
      }

      const elapsed = startTime ? (Date.now() - startTime) / 1000 : 0;
      const ks = totalKeystrokes + 1;
      const metrics = computeMetrics(updatedWords, nextIndex, elapsed, ks);

      set({
        words: updatedWords,
        currentWordIndex: nextIndex,
        currentInput: '',
        totalKeystrokes: ks,
        metrics,
      });
      return;
    }

    // Normal character typing
    const updatedWords = [...words];
    updatedWords[currentWordIndex] = computeWordChars(updatedWords[currentWordIndex], value);

    const ks = totalKeystrokes + 1;
    const elapsed = startTime ? (Date.now() - startTime) / 1000 : 0;
    const metrics = computeMetrics(updatedWords, currentWordIndex, elapsed, ks);

    // Words mode: auto-finish when the last word is fully typed (no space needed)
    const isLastWord = mode === 'words' && currentWordIndex === updatedWords.length - 1;
    const expectedLen = updatedWords[currentWordIndex].chars.length;
    if (isLastWord && value.length >= expectedLen) {
      updatedWords[currentWordIndex] = finalizeWord(updatedWords[currentWordIndex]);
      set({
        words: updatedWords,
        currentInput: value,
        currentWordIndex: currentWordIndex + 1,
        totalKeystrokes: ks,
        metrics,
      });
      get().finishTest();
      return;
    }

    set({
      words: updatedWords,
      currentInput: value,
      totalKeystrokes: ks,
      metrics,
    });
  },

  handleKeyDown: (e: KeyboardEvent) => {
    const { phase, currentWordIndex, words, currentInput } = get();
    if (phase === 'finished') return;

    if (e.key === 'Backspace' && currentInput === '' && currentWordIndex > 0) {
      e.preventDefault();
      const prevIndex = currentWordIndex - 1;
      const prevWord = words[prevIndex];
      const restoredWords = [...words];
      restoredWords[prevIndex] = computeWordChars(
        { ...prevWord, isCorrect: null },
        prevWord.typed
      );
      set({
        currentWordIndex: prevIndex,
        currentInput: prevWord.typed,
        words: restoredWords,
      });
    }
  },

  // ── Tick: called every second (time mode only) ───────────────────────────────

  tick: () => {
    const { phase, mode, timeLeft, words, currentWordIndex, totalKeystrokes, startTime } = get();
    if (phase !== 'running') return;

    // In words mode the timer doesn't count down — finishing all words ends the test
    if (mode === 'words') return;

    const newTimeLeft = timeLeft - 1;
    const elapsed = startTime ? (Date.now() - startTime) / 1000 : 0;
    const metrics = computeMetrics(words, currentWordIndex, elapsed, totalKeystrokes);

    if (newTimeLeft <= 0) {
      set({ timeLeft: 0, metrics });
      get().finishTest();
    } else {
      set({ timeLeft: newTimeLeft, metrics });
    }
  },

  // ── Finish and compute results ────────────────────────────────────────────────

  finishTest: () => {
    const {
      mode, words, currentWordIndex, totalKeystrokes,
      duration, wordCount, wordSet, startTime,
    } = get();

    const elapsed = startTime ? (Date.now() - startTime) / 1000 : duration;
    const metrics = computeMetrics(words, currentWordIndex, elapsed, totalKeystrokes);
    const { correct: _c, incorrect: _i, total } = countChars(words, currentWordIndex);

    const result: TestResult = {
      ...metrics,
      mode,
      duration,
      wordCount,
      wordSet,
      timestamp: Date.now(),
      wordsTyped: words.slice(0, currentWordIndex).filter(w => w.isCorrect === true).length,
      totalChars: total,
    };

    set({ phase: 'finished', result, metrics });
  },

  // ── Restart ───────────────────────────────────────────────────────────────────

  restart: () => {
    get().initTest();
  },
}));