/**
 * resultsTheme.ts
 *
 * Theme system for Trip Results page.
 * Allows switching between visual templates without ripping up the page.
 *
 * Priority order:
 * 1. URL param: ?theme=cinematic
 * 2. localStorage: voyageai.resultsTheme
 * 3. Default: cinematic
 */

// ============================================================================
// TYPES
// ============================================================================

export type ResultsTheme = 'cinematic' | 'ambient' | 'split' | 'minimal';

export const THEME_LABELS: Record<ResultsTheme, string> = {
  cinematic: 'Cinematic',
  ambient: 'Ambient',
  split: 'Split',
  minimal: 'Minimal',
};

export const THEME_DESCRIPTIONS: Record<ResultsTheme, string> = {
  cinematic: 'Full destination imagery with motion overlay',
  ambient: 'Animated gradients, no photos',
  split: 'Image rail + data columns',
  minimal: 'Clean, no background effects',
};

// ============================================================================
// CONSTANTS
// ============================================================================

const STORAGE_KEY = 'voyageai.resultsTheme';
const URL_PARAM = 'theme';
const DEFAULT_THEME: ResultsTheme = 'cinematic';

const VALID_THEMES: ResultsTheme[] = ['cinematic', 'ambient', 'split', 'minimal'];

// ============================================================================
// HELPERS
// ============================================================================

function isValidTheme(value: unknown): value is ResultsTheme {
  return typeof value === 'string' && VALID_THEMES.includes(value as ResultsTheme);
}

// ============================================================================
// GETTERS
// ============================================================================

/**
 * Get the current results theme.
 * Priority: URL param > localStorage > default
 */
export function getResultsTheme(): ResultsTheme {
  // 1. Check URL param first
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const urlTheme = params.get(URL_PARAM);
    if (isValidTheme(urlTheme)) {
      return urlTheme;
    }
  }

  // 2. Check localStorage
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (isValidTheme(stored)) {
        return stored;
      }
    } catch {
      // localStorage unavailable
    }
  }

  // 3. Default
  return DEFAULT_THEME;
}

/**
 * Check if user prefers reduced motion.
 * Used to disable animations.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// ============================================================================
// SETTERS
// ============================================================================

/**
 * Set the results theme in localStorage.
 * Does not update URL (that's controlled by navigation).
 */
export function setResultsTheme(theme: ResultsTheme): void {
  if (!isValidTheme(theme)) return;

  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // localStorage unavailable
  }
}

/**
 * Clear stored theme preference (revert to default).
 */
export function clearResultsTheme(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // localStorage unavailable
  }
}

// ============================================================================
// URL HELPERS
// ============================================================================

/**
 * Build a URL with theme param.
 * Useful for sharing specific theme views.
 */
export function buildThemeUrl(theme: ResultsTheme, baseUrl?: string): string {
  const url = new URL(baseUrl || window.location.href);
  url.searchParams.set(URL_PARAM, theme);
  return url.toString();
}

/**
 * Remove theme param from current URL.
 */
export function clearThemeFromUrl(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete(URL_PARAM);
  window.history.replaceState({}, '', url.toString());
}
