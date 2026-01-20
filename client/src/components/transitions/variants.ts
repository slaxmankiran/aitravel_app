/**
 * Page Transition Variants
 *
 * Animation presets for VoyageAI page transitions.
 * Uses Framer Motion spring physics as specified:
 * - stiffness: 100
 * - damping: 20
 *
 * Inspired by Apple.com's smooth, cinematic feel.
 */

import { Variants, Transition } from 'framer-motion';

// ============================================================================
// SPRING PHYSICS (Master Spec)
// ============================================================================

export const springTransition: Transition = {
  type: 'spring',
  stiffness: 100,
  damping: 20,
};

export const fastSpring: Transition = {
  type: 'spring',
  stiffness: 200,
  damping: 25,
};

export const gentleSpring: Transition = {
  type: 'spring',
  stiffness: 80,
  damping: 18,
};

// Ease for non-spring animations
export const easeOut: Transition = {
  duration: 0.4,
  ease: [0.25, 0.46, 0.45, 0.94], // Apple-like ease
};

// ============================================================================
// PAGE TRANSITION VARIANTS
// ============================================================================

/**
 * Fade - Simple crossfade (default)
 * Use for: General navigation, fallback
 */
export const fadeVariants: Variants = {
  initial: {
    opacity: 0,
  },
  animate: {
    opacity: 1,
    transition: {
      duration: 0.3,
      ease: 'easeOut',
    },
  },
  exit: {
    opacity: 0,
    transition: {
      duration: 0.2,
      ease: 'easeIn',
    },
  },
};

/**
 * Fade + Scale - Subtle Apple-like transition
 * Use for: Home, general pages
 */
export const fadeScaleVariants: Variants = {
  initial: {
    opacity: 0,
    scale: 0.98,
  },
  animate: {
    opacity: 1,
    scale: 1,
    transition: springTransition,
  },
  exit: {
    opacity: 0,
    scale: 0.98,
    transition: {
      duration: 0.2,
      ease: 'easeIn',
    },
  },
};

/**
 * Slide Up - For modals, sheets, create flow
 * Use for: /create, modal pages
 */
export const slideUpVariants: Variants = {
  initial: {
    opacity: 0,
    y: 40,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: springTransition,
  },
  exit: {
    opacity: 0,
    y: 20,
    transition: {
      duration: 0.25,
      ease: 'easeIn',
    },
  },
};

/**
 * Slide Down - For returning from elevated views
 * Use for: Back from create flow
 */
export const slideDownVariants: Variants = {
  initial: {
    opacity: 0,
    y: -40,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: springTransition,
  },
  exit: {
    opacity: 0,
    y: -20,
    transition: {
      duration: 0.25,
      ease: 'easeIn',
    },
  },
};

/**
 * Zoom In - Cinematic entrance for results
 * Use for: Trip results, immersive views
 */
export const zoomInVariants: Variants = {
  initial: {
    opacity: 0,
    scale: 0.92,
    filter: 'blur(8px)',
  },
  animate: {
    opacity: 1,
    scale: 1,
    filter: 'blur(0px)',
    transition: {
      ...springTransition,
      filter: { duration: 0.4 },
    },
  },
  exit: {
    opacity: 0,
    scale: 1.05,
    filter: 'blur(4px)',
    transition: {
      duration: 0.3,
      ease: 'easeIn',
    },
  },
};

/**
 * Zoom Out - Reverse of zoom in
 * Use for: Exiting from immersive views
 */
export const zoomOutVariants: Variants = {
  initial: {
    opacity: 0,
    scale: 1.08,
    filter: 'blur(4px)',
  },
  animate: {
    opacity: 1,
    scale: 1,
    filter: 'blur(0px)',
    transition: {
      ...springTransition,
      filter: { duration: 0.4 },
    },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    filter: 'blur(8px)',
    transition: {
      duration: 0.3,
      ease: 'easeIn',
    },
  },
};

/**
 * Slide Left - Forward navigation feel
 * Use for: List to detail navigation
 */
export const slideLeftVariants: Variants = {
  initial: {
    opacity: 0,
    x: 60,
  },
  animate: {
    opacity: 1,
    x: 0,
    transition: springTransition,
  },
  exit: {
    opacity: 0,
    x: -30,
    transition: {
      duration: 0.25,
      ease: 'easeIn',
    },
  },
};

/**
 * Slide Right - Back navigation feel
 * Use for: Detail to list navigation
 */
export const slideRightVariants: Variants = {
  initial: {
    opacity: 0,
    x: -60,
  },
  animate: {
    opacity: 1,
    x: 0,
    transition: springTransition,
  },
  exit: {
    opacity: 0,
    x: 30,
    transition: {
      duration: 0.25,
      ease: 'easeIn',
    },
  },
};

// ============================================================================
// STAGGER VARIANTS (For child elements)
// ============================================================================

/**
 * Stagger Container - Parent for staggered children
 */
export const staggerContainerVariants: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
  exit: {
    transition: {
      staggerChildren: 0.05,
      staggerDirection: -1,
    },
  },
};

/**
 * Stagger Item - Child element in staggered list
 */
export const staggerItemVariants: Variants = {
  initial: {
    opacity: 0,
    y: 20,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: springTransition,
  },
  exit: {
    opacity: 0,
    y: -10,
    transition: {
      duration: 0.2,
    },
  },
};

/**
 * Stagger Item with Scale - For cards, tiles
 */
export const staggerCardVariants: Variants = {
  initial: {
    opacity: 0,
    y: 30,
    scale: 0.95,
  },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: springTransition,
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: {
      duration: 0.2,
    },
  },
};

// ============================================================================
// VARIANT MAP (For dynamic selection)
// ============================================================================

export type TransitionType =
  | 'fade'
  | 'fadeScale'
  | 'slideUp'
  | 'slideDown'
  | 'slideLeft'
  | 'slideRight'
  | 'zoomIn'
  | 'zoomOut';

export const transitionVariants: Record<TransitionType, Variants> = {
  fade: fadeVariants,
  fadeScale: fadeScaleVariants,
  slideUp: slideUpVariants,
  slideDown: slideDownVariants,
  slideLeft: slideLeftVariants,
  slideRight: slideRightVariants,
  zoomIn: zoomInVariants,
  zoomOut: zoomOutVariants,
};

/**
 * Get variants by name
 */
export function getVariants(type: TransitionType): Variants {
  return transitionVariants[type] || fadeVariants;
}
