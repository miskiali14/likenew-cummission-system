'use client';

import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

// Applies .dark to <html> based on a saved preference, falling back to the
// OS setting when nothing's been chosen yet. Runs once on mount; the actual
// "no flash of wrong theme" guard lives in the inline script in layout.tsx.
export default function ThemeToggle({ className = '' }) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
  }, []);

  const toggle = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle('dark', next);
    try {
      localStorage.setItem('theme', next ? 'dark' : 'light');
    } catch (e) {
      // localStorage unavailable — theme just won't persist across reloads
    }
  };

  return (
    <button
      onClick={toggle}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={`p-2.5 bg-slate-100 dark:bg-ink-800 border border-slate-200 dark:border-ink-700 hover:bg-slate-200 dark:hover:bg-ink-700 rounded-xl text-slate-600 dark:text-ink-300 transition ${className}`}
    >
      {isDark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
