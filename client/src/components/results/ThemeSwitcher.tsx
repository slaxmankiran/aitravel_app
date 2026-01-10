/**
 * ThemeSwitcher.tsx
 *
 * Dev-only theme switcher for Trip Results page.
 * Allows instant switching between visual templates.
 *
 * Only renders in development mode (import.meta.env.DEV).
 */

import React, { useState } from 'react';
import { Palette, ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  type ResultsTheme,
  THEME_LABELS,
  THEME_DESCRIPTIONS,
  setResultsTheme,
} from '@/lib/resultsTheme';

interface ThemeSwitcherProps {
  currentTheme: ResultsTheme;
  onThemeChange: (theme: ResultsTheme) => void;
}

const THEMES: ResultsTheme[] = ['cinematic', 'ambient', 'split', 'minimal'];

export function ThemeSwitcher({ currentTheme, onThemeChange }: ThemeSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Only render in development
  if (!import.meta.env.DEV) {
    return null;
  }

  const handleSelect = (theme: ResultsTheme) => {
    setResultsTheme(theme);
    onThemeChange(theme);
    setIsOpen(false);
  };

  return (
    <div className="fixed bottom-4 left-4 z-50">
      {/* Toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all',
          'bg-slate-800/90 backdrop-blur border border-white/10 shadow-lg',
          'hover:bg-slate-700/90 hover:border-white/20',
          isOpen && 'border-primary/50'
        )}
      >
        <Palette className="w-3.5 h-3.5 text-primary" />
        <span className="text-white/70">{THEME_LABELS[currentTheme]}</span>
        {isOpen ? (
          <ChevronDown className="w-3 h-3 text-white/40" />
        ) : (
          <ChevronUp className="w-3 h-3 text-white/40" />
        )}
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute bottom-full left-0 mb-2 w-56 bg-slate-800/95 backdrop-blur border border-white/10 rounded-lg shadow-xl overflow-hidden">
          <div className="px-3 py-2 border-b border-white/10">
            <span className="text-[10px] text-white/40 uppercase tracking-wider">
              Visual Theme
            </span>
          </div>
          <div className="py-1">
            {THEMES.map((theme) => (
              <button
                key={theme}
                onClick={() => handleSelect(theme)}
                className={cn(
                  'w-full flex flex-col items-start px-3 py-2 text-left transition-colors',
                  theme === currentTheme
                    ? 'bg-primary/20 text-white'
                    : 'text-white/70 hover:bg-white/5 hover:text-white'
                )}
              >
                <span className="text-xs font-medium">{THEME_LABELS[theme]}</span>
                <span className="text-[10px] text-white/40 mt-0.5">
                  {THEME_DESCRIPTIONS[theme]}
                </span>
              </button>
            ))}
          </div>
          <div className="px-3 py-2 border-t border-white/10 bg-white/5">
            <span className="text-[10px] text-white/30">
              Dev only • Saves to localStorage
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
