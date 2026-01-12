/**
 * glassDesign.ts
 *
 * Premium Glass Design System
 *
 * Provides consistent glass tokens for the entire app.
 * Based on: Apple, Arc, Linear, Raycast aesthetic.
 *
 * Key principles:
 * - One dominant surface material (glass)
 * - Depth cues (blur, shadow, glow)
 * - Restraint (less contrast, not more)
 */

// ============================================================================
// GLASS TOKENS
// ============================================================================

/**
 * Primary glass - used for main cards (Decision Summary)
 * Features: Inner highlight, soft shadow, prominent blur
 */
export const glassPrimary = {
  bg: 'bg-slate-900/50',
  backdrop: 'backdrop-blur-xl',
  border: 'border border-white/[0.08]',
  shadow: 'shadow-[0_8px_32px_rgba(0,0,0,0.4)]',
  // Inner highlight - subtle top edge glow
  innerHighlight: 'before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/15 before:to-transparent',
  // Combined class string
  className: 'bg-slate-900/50 backdrop-blur-xl border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.4)]',
};

/**
 * Secondary glass - used for chips, drawers, secondary cards
 * Slightly darker, less prominent
 */
export const glassSecondary = {
  bg: 'bg-slate-900/40',
  backdrop: 'backdrop-blur-lg',
  border: 'border border-white/[0.06]',
  shadow: 'shadow-[0_4px_20px_rgba(0,0,0,0.25)]',
  innerHighlight: 'before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent',
  className: 'bg-slate-900/40 backdrop-blur-lg border border-white/[0.06] shadow-[0_4px_20px_rgba(0,0,0,0.25)]',
};

/**
 * Tertiary glass - used for chips, pills, subtle surfaces
 * Very subtle, almost transparent
 */
export const glassTertiary = {
  bg: 'bg-white/[0.04]',
  backdrop: 'backdrop-blur-md',
  border: 'border border-white/[0.04]',
  shadow: 'shadow-none',
  className: 'bg-white/[0.04] backdrop-blur-md border border-white/[0.04]',
};

/**
 * Drawer glass - slightly darker for layered feel
 */
export const glassDrawer = {
  bg: 'bg-slate-950/80',
  backdrop: 'backdrop-blur-2xl',
  border: 'border-l border-white/[0.08]',
  shadow: 'shadow-[-20px_0_60px_rgba(0,0,0,0.5)]',
  className: 'bg-slate-950/80 backdrop-blur-2xl border-l border-white/[0.08] shadow-[-20px_0_60px_rgba(0,0,0,0.5)]',
};

// ============================================================================
// VERDICT GLOW SYSTEM
// ============================================================================

export type VerdictType = 'GO' | 'POSSIBLE' | 'DIFFICULT';

/**
 * Verdict-based glow colors (subtle, not borders)
 */
export const verdictGlow = {
  GO: {
    // Emerald glow
    shadow: 'shadow-[0_0_60px_rgba(16,185,129,0.15),0_20px_50px_rgba(0,0,0,0.45)]',
    accent: 'bg-emerald-500',
    accentGlow: 'shadow-[0_0_20px_rgba(16,185,129,0.4)]',
    innerGlow: 'after:absolute after:inset-0 after:rounded-xl after:shadow-[inset_0_1px_1px_rgba(16,185,129,0.1)]',
  },
  POSSIBLE: {
    // Amber glow
    shadow: 'shadow-[0_0_60px_rgba(245,158,11,0.12),0_20px_50px_rgba(0,0,0,0.45)]',
    accent: 'bg-amber-500',
    accentGlow: 'shadow-[0_0_20px_rgba(245,158,11,0.4)]',
    innerGlow: 'after:absolute after:inset-0 after:rounded-xl after:shadow-[inset_0_1px_1px_rgba(245,158,11,0.1)]',
  },
  DIFFICULT: {
    // Rose glow
    shadow: 'shadow-[0_0_60px_rgba(244,63,94,0.12),0_20px_50px_rgba(0,0,0,0.45)]',
    accent: 'bg-rose-500',
    accentGlow: 'shadow-[0_0_20px_rgba(244,63,94,0.4)]',
    innerGlow: 'after:absolute after:inset-0 after:rounded-xl after:shadow-[inset_0_1px_1px_rgba(244,63,94,0.1)]',
  },
};

/**
 * Get verdict glow classes
 */
export function getVerdictGlow(verdict: VerdictType | string | null | undefined) {
  if (!verdict) return verdictGlow.POSSIBLE;
  const v = verdict.toUpperCase() as VerdictType;
  return verdictGlow[v] || verdictGlow.POSSIBLE;
}

// ============================================================================
// TYPOGRAPHY - LUXURY CONTRAST
// ============================================================================

/**
 * Typography tokens - less contrast = more luxury
 */
export const typography = {
  // Primary text - slightly reduced from pure white
  primary: 'text-white/[0.88]',
  // Secondary text - softer
  secondary: 'text-white/65',
  // Tertiary text - whisper
  tertiary: 'text-white/45',
  // Muted text - barely there
  muted: 'text-white/30',
  // Headings - can be stronger
  heading: 'text-white/95',
};

// ============================================================================
// MICRO-INTERACTIONS
// ============================================================================

/**
 * Hover depth effect - card raises slightly
 */
export const hoverDepth = {
  base: 'transition-all duration-200 ease-out',
  hover: 'hover:-translate-y-0.5 hover:shadow-[0_25px_60px_rgba(0,0,0,0.5)]',
  className: 'transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_25px_60px_rgba(0,0,0,0.5)]',
};

/**
 * Scale entrance animation
 */
export const entranceScale = {
  initial: { opacity: 0, scale: 0.98 },
  animate: { opacity: 1, scale: 1 },
  transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] },
};

/**
 * Fade entrance animation
 */
export const entranceFade = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] },
};

// ============================================================================
// ACCENT LINE ANIMATION
// ============================================================================

/**
 * Animated accent line config
 * 1px line that moves slowly across top of card
 */
export const accentLine = {
  height: 'h-px',
  width: 'w-1/3',
  duration: 20, // seconds for full cycle
  colors: {
    GO: 'bg-gradient-to-r from-transparent via-emerald-500/60 to-transparent',
    POSSIBLE: 'bg-gradient-to-r from-transparent via-amber-500/60 to-transparent',
    DIFFICULT: 'bg-gradient-to-r from-transparent via-rose-500/60 to-transparent',
  },
};

// ============================================================================
// DESTINATION MOTION THEMES
// ============================================================================

export type DestinationMotion = 'beach' | 'city' | 'mountain' | 'default';

/**
 * Auto-detect destination motion type from destination name
 */
export function getDestinationMotion(destination: string): DestinationMotion {
  const lower = destination.toLowerCase();

  // Beach destinations
  const beachKeywords = ['beach', 'island', 'coastal', 'bali', 'maldives', 'hawaii', 'caribbean', 'phuket', 'cancun', 'miami', 'goa', 'ibiza'];
  if (beachKeywords.some(k => lower.includes(k))) return 'beach';

  // Mountain destinations
  const mountainKeywords = ['mountain', 'alps', 'himalaya', 'rocky', 'swiss', 'nepal', 'colorado', 'patagonia', 'aspen', 'chamonix'];
  if (mountainKeywords.some(k => lower.includes(k))) return 'mountain';

  // City destinations
  const cityKeywords = ['city', 'tokyo', 'paris', 'london', 'new york', 'singapore', 'dubai', 'hong kong', 'bangkok', 'seoul', 'shanghai', 'berlin', 'rome', 'barcelona'];
  if (cityKeywords.some(k => lower.includes(k))) return 'city';

  return 'default';
}

/**
 * Motion config per destination type
 */
export const destinationMotionConfig = {
  beach: {
    name: 'Wave Refraction',
    direction: 'horizontal',
    speed: 45, // seconds per cycle
    opacity: 0.04,
  },
  city: {
    name: 'Neon Sweep',
    direction: 'vertical',
    speed: 30,
    opacity: 0.05,
  },
  mountain: {
    name: 'Fog Drift',
    direction: 'horizontal',
    speed: 60,
    opacity: 0.03,
  },
  default: {
    name: 'Ambient Pulse',
    direction: 'diagonal',
    speed: 40,
    opacity: 0.04,
  },
};
