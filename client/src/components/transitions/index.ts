/**
 * Transitions Module
 *
 * VoyageAI page transition system using Framer Motion.
 *
 * Quick Start:
 * ```tsx
 * import { PageTransition, AnimatedRoutes } from '@/components/transitions';
 *
 * // In App.tsx:
 * <AnimatedRoutes>
 *   <Route path="/" component={Home} />
 * </AnimatedRoutes>
 *
 * // Or wrap individual pages:
 * <PageTransition type="zoomIn">
 *   <TripResults />
 * </PageTransition>
 * ```
 */

// Components
export {
  PageTransition,
  FadeTransition,
  FadeScaleTransition,
  SlideUpTransition,
  SlideDownTransition,
  ZoomTransition,
  SlideLeftTransition,
  SlideRightTransition,
  FullPageTransition,
} from './PageTransition';

// Variants & Types
export {
  // Spring presets
  springTransition,
  fastSpring,
  gentleSpring,
  easeOut,
  // Page variants
  fadeVariants,
  fadeScaleVariants,
  slideUpVariants,
  slideDownVariants,
  slideLeftVariants,
  slideRightVariants,
  zoomInVariants,
  zoomOutVariants,
  // Stagger variants
  staggerContainerVariants,
  staggerItemVariants,
  staggerCardVariants,
  // Utilities
  transitionVariants,
  getVariants,
  // Types
  type TransitionType,
} from './variants';
