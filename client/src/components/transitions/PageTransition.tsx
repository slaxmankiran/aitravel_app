/**
 * PageTransition Component
 *
 * A reusable wrapper for page-level animations.
 * Wraps page content with Framer Motion for smooth entry/exit.
 *
 * Usage:
 * <PageTransition type="fadeScale">
 *   <YourPageContent />
 * </PageTransition>
 *
 * Or with custom variants:
 * <PageTransition variants={customVariants}>
 *   <YourPageContent />
 * </PageTransition>
 */

import React from 'react';
import { motion, Variants } from 'framer-motion';
import { TransitionType, getVariants, fadeScaleVariants } from './variants';

// ============================================================================
// TYPES
// ============================================================================

interface PageTransitionProps {
  children: React.ReactNode;
  /** Preset transition type */
  type?: TransitionType;
  /** Custom variants (overrides type) */
  variants?: Variants;
  /** Additional className for the wrapper */
  className?: string;
  /** Enable layout animations */
  layout?: boolean;
  /** Custom key for AnimatePresence */
  transitionKey?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const PageTransition: React.FC<PageTransitionProps> = ({
  children,
  type = 'fadeScale',
  variants,
  className = '',
  layout = false,
  transitionKey,
}) => {
  // Use custom variants if provided, otherwise get preset by type
  const activeVariants = variants || getVariants(type);

  return (
    <motion.div
      key={transitionKey}
      initial="initial"
      animate="animate"
      exit="exit"
      variants={activeVariants}
      layout={layout}
      className={`w-full ${className}`}
    >
      {children}
    </motion.div>
  );
};

// ============================================================================
// PRESET WRAPPERS (Convenience components)
// ============================================================================

/**
 * FadeTransition - Simple fade in/out
 */
export const FadeTransition: React.FC<Omit<PageTransitionProps, 'type'>> = (props) => (
  <PageTransition {...props} type="fade" />
);

/**
 * FadeScaleTransition - Apple-like fade with subtle scale
 */
export const FadeScaleTransition: React.FC<Omit<PageTransitionProps, 'type'>> = (props) => (
  <PageTransition {...props} type="fadeScale" />
);

/**
 * SlideUpTransition - Slide up from bottom
 */
export const SlideUpTransition: React.FC<Omit<PageTransitionProps, 'type'>> = (props) => (
  <PageTransition {...props} type="slideUp" />
);

/**
 * SlideDownTransition - Slide down from top
 */
export const SlideDownTransition: React.FC<Omit<PageTransitionProps, 'type'>> = (props) => (
  <PageTransition {...props} type="slideDown" />
);

/**
 * ZoomTransition - Cinematic zoom for immersive pages
 */
export const ZoomTransition: React.FC<Omit<PageTransitionProps, 'type'>> = (props) => (
  <PageTransition {...props} type="zoomIn" />
);

/**
 * SlideLeftTransition - Forward navigation
 */
export const SlideLeftTransition: React.FC<Omit<PageTransitionProps, 'type'>> = (props) => (
  <PageTransition {...props} type="slideLeft" />
);

/**
 * SlideRightTransition - Back navigation
 */
export const SlideRightTransition: React.FC<Omit<PageTransitionProps, 'type'>> = (props) => (
  <PageTransition {...props} type="slideRight" />
);

// ============================================================================
// FULL PAGE WRAPPER (For route-level transitions)
// ============================================================================

interface FullPageTransitionProps extends PageTransitionProps {
  /** Fill entire viewport */
  fullHeight?: boolean;
  /** Background color class */
  bg?: string;
}

/**
 * FullPageTransition - Route-level wrapper with full viewport support
 */
export const FullPageTransition: React.FC<FullPageTransitionProps> = ({
  children,
  fullHeight = true,
  bg = '',
  className = '',
  ...props
}) => {
  const heightClass = fullHeight ? 'min-h-screen' : '';

  return (
    <PageTransition
      {...props}
      className={`${heightClass} ${bg} ${className}`}
    >
      {children}
    </PageTransition>
  );
};

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default PageTransition;
