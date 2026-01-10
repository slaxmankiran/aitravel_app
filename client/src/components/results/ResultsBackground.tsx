/**
 * ResultsBackground.tsx
 *
 * Premium visual background layer for Trip Results.
 * Renders behind all content to create immersive atmosphere.
 *
 * Themes:
 * - cinematic: Full destination image + dark vignette + ambient motion + destination accents
 * - ambient: Animated gradients only, no photos
 * - split: Reserved for future (image rail layout)
 * - minimal: No background effects, current look
 *
 * Layers (bottom → top):
 * 1. Destination image with parallax drift (cinematic only)
 * 2. Dark vignette + readability gradients
 * 3. Ambient light bloom orbs
 * 4. Destination-aware motion accents (ocean shimmer, city lights, mountain fog)
 * 5. Animated ambient gradient (slow movement)
 * 6. Noise texture (tiny opacity)
 * 7. Children (page content)
 *
 * Premium features:
 * - Subtle parallax drift on background image
 * - Pulsing ambient light bloom orbs
 * - Destination-aware motion accents (beach/city/mountain/default)
 * - Scroll progress indicator
 */

import React, { memo, useState, useEffect, useMemo, useRef } from 'react';
import { motion, useScroll, useTransform, useSpring, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  getDestinationImageUrl,
  fetchDestinationImage,
  getDestinationFallbackGradient,
  getDestinationType,
} from '@/lib/destinationImages';
import {
  type ResultsTheme,
  prefersReducedMotion,
} from '@/lib/resultsTheme';

// ============================================================================
// TYPES
// ============================================================================

interface ResultsBackgroundProps {
  destination: string;
  theme: ResultsTheme;
  /** Optional verdict for color-biased ambient gradient */
  verdictBias?: 'go' | 'possible' | 'difficult';
  /** Show scroll progress indicator */
  showScrollProgress?: boolean;
  children: React.ReactNode;
  className?: string;
}

type DestinationType = 'beach' | 'mountain' | 'city' | 'default';

// ============================================================================
// AMBIENT GRADIENT CONFIG
// ============================================================================

const AMBIENT_GRADIENTS = {
  neutral: [
    'radial-gradient(ellipse at 20% 80%, rgba(59, 130, 246, 0.08) 0%, transparent 50%)',
    'radial-gradient(ellipse at 80% 20%, rgba(139, 92, 246, 0.06) 0%, transparent 50%)',
    'radial-gradient(ellipse at 50% 50%, rgba(16, 185, 129, 0.04) 0%, transparent 60%)',
  ],
  go: [
    'radial-gradient(ellipse at 20% 80%, rgba(16, 185, 129, 0.10) 0%, transparent 50%)',
    'radial-gradient(ellipse at 80% 20%, rgba(52, 211, 153, 0.08) 0%, transparent 50%)',
    'radial-gradient(ellipse at 50% 50%, rgba(16, 185, 129, 0.05) 0%, transparent 60%)',
  ],
  possible: [
    'radial-gradient(ellipse at 20% 80%, rgba(245, 158, 11, 0.08) 0%, transparent 50%)',
    'radial-gradient(ellipse at 80% 20%, rgba(251, 191, 36, 0.06) 0%, transparent 50%)',
    'radial-gradient(ellipse at 50% 50%, rgba(217, 119, 6, 0.04) 0%, transparent 60%)',
  ],
  difficult: [
    'radial-gradient(ellipse at 20% 80%, rgba(239, 68, 68, 0.08) 0%, transparent 50%)',
    'radial-gradient(ellipse at 80% 20%, rgba(248, 113, 113, 0.06) 0%, transparent 50%)',
    'radial-gradient(ellipse at 50% 50%, rgba(220, 38, 38, 0.04) 0%, transparent 60%)',
  ],
};

// ============================================================================
// NOISE TEXTURE (inline SVG data URI)
// ============================================================================

const NOISE_SVG = `data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E`;

// ============================================================================
// LIGHT BLOOM CONFIG
// ============================================================================

const BLOOM_ORBS = [
  { x: '15%', y: '25%', size: 300, color: 'rgba(59, 130, 246, 0.12)', delay: 0 },
  { x: '75%', y: '15%', size: 250, color: 'rgba(139, 92, 246, 0.10)', delay: 2 },
  { x: '85%', y: '70%', size: 200, color: 'rgba(16, 185, 129, 0.08)', delay: 4 },
  { x: '25%', y: '80%', size: 180, color: 'rgba(245, 158, 11, 0.06)', delay: 6 },
];

// ============================================================================
// DESTINATION MOTION ACCENTS CONFIG
// ============================================================================

const MOTION_ACCENTS = {
  beach: {
    // Ocean shimmer - horizontal waves with blue tints
    gradients: [
      'linear-gradient(90deg, transparent 0%, rgba(14, 165, 233, 0.06) 50%, transparent 100%)',
      'linear-gradient(90deg, transparent 0%, rgba(56, 189, 248, 0.04) 50%, transparent 100%)',
    ],
    animation: {
      x: ['-100%', '100%'],
      transition: { duration: 8, repeat: Infinity, ease: 'linear' },
    },
  },
  city: {
    // City light sweep - vertical light bars
    gradients: [
      'linear-gradient(0deg, transparent 0%, rgba(99, 102, 241, 0.05) 50%, transparent 100%)',
      'linear-gradient(0deg, transparent 0%, rgba(168, 85, 247, 0.04) 50%, transparent 100%)',
    ],
    animation: {
      y: ['100%', '-100%'],
      transition: { duration: 12, repeat: Infinity, ease: 'linear' },
    },
  },
  mountain: {
    // Mountain fog - horizontal drift with soft white
    gradients: [
      'linear-gradient(90deg, transparent 0%, rgba(148, 163, 184, 0.08) 30%, rgba(148, 163, 184, 0.08) 70%, transparent 100%)',
      'linear-gradient(90deg, transparent 0%, rgba(203, 213, 225, 0.05) 40%, rgba(203, 213, 225, 0.05) 60%, transparent 100%)',
    ],
    animation: {
      x: ['-50%', '50%'],
      transition: { duration: 20, repeat: Infinity, ease: 'easeInOut', repeatType: 'reverse' as const },
    },
  },
  default: {
    // Generic ambient motion
    gradients: [
      'radial-gradient(ellipse at 30% 70%, rgba(99, 102, 241, 0.05) 0%, transparent 50%)',
    ],
    animation: {
      scale: [1, 1.1, 1],
      opacity: [0.5, 0.8, 0.5],
      transition: { duration: 15, repeat: Infinity, ease: 'easeInOut' },
    },
  },
};

// ============================================================================
// SCROLL PROGRESS INDICATOR
// ============================================================================

function ScrollProgressIndicator() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30 });

  return (
    <motion.div
      className="fixed top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-primary/60 via-primary to-primary/60 z-50 origin-left"
      style={{ scaleX }}
    />
  );
}

// ============================================================================
// LIGHT BLOOM LAYER
// ============================================================================

function LightBloomLayer({ reducedMotion }: { reducedMotion: boolean }) {
  if (reducedMotion) return null;

  return (
    <div className="fixed inset-0 z-[2] pointer-events-none overflow-hidden">
      {BLOOM_ORBS.map((orb, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full blur-3xl"
          style={{
            left: orb.x,
            top: orb.y,
            width: orb.size,
            height: orb.size,
            background: orb.color,
            transform: 'translate(-50%, -50%)',
          }}
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.4, 0.7, 0.4],
          }}
          transition={{
            duration: 8 + i * 2,
            delay: orb.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}

// ============================================================================
// DESTINATION MOTION ACCENTS LAYER
// ============================================================================

function DestinationAccentsLayer({
  destType,
  reducedMotion,
}: {
  destType: DestinationType;
  reducedMotion: boolean;
}) {
  if (reducedMotion) return null;

  const accent = MOTION_ACCENTS[destType];
  if (!accent) return null;

  return (
    <div className="fixed inset-0 z-[3] pointer-events-none overflow-hidden">
      {accent.gradients.map((gradient, i) => (
        <motion.div
          key={i}
          className="absolute inset-0"
          style={{ background: gradient }}
          animate={accent.animation}
          transition={{
            ...accent.animation.transition,
            delay: i * 2,
          }}
        />
      ))}
    </div>
  );
}

// ============================================================================
// PARALLAX IMAGE LAYER
// ============================================================================

function ParallaxImageLayer({
  imageUrl,
  fallbackGradient,
  isLoading,
  reducedMotion,
}: {
  imageUrl: string | null;
  fallbackGradient: string;
  isLoading: boolean;
  reducedMotion: boolean;
}) {
  const { scrollY } = useScroll();

  // Subtle parallax - image moves slower than scroll (0.3x speed)
  const y = useTransform(scrollY, [0, 1000], [0, reducedMotion ? 0 : -150]);
  const smoothY = useSpring(y, { stiffness: 50, damping: 20 });

  // Subtle scale on scroll for depth
  const scale = useTransform(scrollY, [0, 500], [1.05, 1]);
  const smoothScale = useSpring(scale, { stiffness: 50, damping: 20 });

  return (
    <div className="fixed inset-0 z-0 overflow-hidden">
      {imageUrl ? (
        <motion.div
          initial={{ scale: 1.1, opacity: 0 }}
          animate={{ scale: 1.05, opacity: 1 }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
          className="absolute inset-0"
          style={{
            y: reducedMotion ? 0 : smoothY,
            scale: reducedMotion ? 1 : smoothScale,
          }}
        >
          <img
            src={imageUrl}
            alt=""
            className="w-full h-[120%] object-cover"
            style={{ objectPosition: 'center 30%' }}
          />
        </motion.div>
      ) : (
        <div
          className="absolute inset-0"
          style={{ background: fallbackGradient }}
        />
      )}

      {/* Shimmer while loading */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer"
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// CINEMATIC BACKGROUND
// ============================================================================

function CinematicBackground({
  destination,
  verdictBias = 'neutral',
  reducedMotion,
}: {
  destination: string;
  verdictBias: 'go' | 'possible' | 'difficult' | 'neutral';
  reducedMotion: boolean;
}) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Get cached state + fallback
  const cached = useMemo(
    () => getDestinationImageUrl(destination),
    [destination]
  );

  const fallbackGradient = getDestinationFallbackGradient(destination);
  const destType = useMemo(() => getDestinationType(destination), [destination]);
  const ambientGradients = AMBIENT_GRADIENTS[verdictBias] || AMBIENT_GRADIENTS.neutral;

  // Fetch image if not cached
  useEffect(() => {
    let cancelled = false;

    if (cached.url) {
      setImageUrl(cached.url);
      setIsLoading(false);
    } else {
      fetchDestinationImage(destination)
        .then((url) => {
          if (cancelled) return;
          if (url) setImageUrl(url);
          setIsLoading(false);
        })
        .catch(() => {
          if (cancelled) return;
          setIsLoading(false);
        });
    }

    return () => {
      cancelled = true;
    };
  }, [destination, cached.url]);

  return (
    <>
      {/* Layer 1: Destination image with parallax */}
      <ParallaxImageLayer
        imageUrl={imageUrl}
        fallbackGradient={fallbackGradient}
        isLoading={isLoading}
        reducedMotion={reducedMotion}
      />

      {/* Layer 2: Dark vignette + readability gradient */}
      <div className="fixed inset-0 z-[1]">
        {/* Top fade for header readability */}
        <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-slate-900/95 via-slate-900/70 to-transparent" />

        {/* Bottom fade for content readability */}
        <div className="absolute inset-x-0 bottom-0 h-96 bg-gradient-to-t from-slate-900 via-slate-900/90 to-transparent" />

        {/* Overall darken - slightly reduced for parallax visibility */}
        <div className="absolute inset-0 bg-slate-900/55" />

        {/* Vignette edges */}
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse at center, transparent 0%, rgba(15, 23, 42, 0.5) 100%)',
          }}
        />
      </div>

      {/* Layer 3: Light bloom orbs */}
      <LightBloomLayer reducedMotion={reducedMotion} />

      {/* Layer 4: Destination-aware motion accents */}
      <DestinationAccentsLayer destType={destType} reducedMotion={reducedMotion} />

      {/* Layer 5: Animated ambient gradients */}
      {!reducedMotion && (
        <div className="fixed inset-0 z-[4] pointer-events-none overflow-hidden">
          {ambientGradients.map((gradient, i) => (
            <motion.div
              key={i}
              className="absolute inset-0"
              style={{ background: gradient }}
              animate={{
                x: [0, 50, -30, 0],
                y: [0, -40, 30, 0],
                scale: [1, 1.1, 0.95, 1],
              }}
              transition={{
                duration: 30 + i * 10,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
          ))}
        </div>
      )}

      {/* Layer 6: Noise texture */}
      <div
        className="fixed inset-0 z-[5] pointer-events-none opacity-[0.012]"
        style={{
          backgroundImage: `url("${NOISE_SVG}")`,
          backgroundRepeat: 'repeat',
        }}
      />
    </>
  );
}

// ============================================================================
// AMBIENT BACKGROUND (no photo)
// ============================================================================

function AmbientBackground({
  verdictBias = 'neutral',
  reducedMotion,
}: {
  verdictBias: 'go' | 'possible' | 'difficult' | 'neutral';
  reducedMotion: boolean;
}) {
  const ambientGradients = AMBIENT_GRADIENTS[verdictBias] || AMBIENT_GRADIENTS.neutral;

  return (
    <>
      {/* Layer 1: Base dark gradient */}
      <div
        className="fixed inset-0 z-0"
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
        }}
      />

      {/* Layer 2: Light bloom orbs */}
      <LightBloomLayer reducedMotion={reducedMotion} />

      {/* Layer 3: Animated ambient gradients */}
      {!reducedMotion && (
        <div className="fixed inset-0 z-[1] pointer-events-none overflow-hidden">
          {ambientGradients.map((gradient, i) => (
            <motion.div
              key={i}
              className="absolute inset-0"
              style={{ background: gradient }}
              animate={{
                x: [0, 80, -60, 0],
                y: [0, -60, 50, 0],
                scale: [1, 1.2, 0.9, 1],
              }}
              transition={{
                duration: 25 + i * 8,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
          ))}
        </div>
      )}

      {/* Layer 4: Noise texture */}
      <div
        className="fixed inset-0 z-[2] pointer-events-none opacity-[0.02]"
        style={{
          backgroundImage: `url("${NOISE_SVG}")`,
          backgroundRepeat: 'repeat',
        }}
      />
    </>
  );
}

// ============================================================================
// MINIMAL BACKGROUND
// ============================================================================

function MinimalBackground() {
  return (
    <div
      className="fixed inset-0 z-0"
      style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 30%, #0f172a 100%)',
      }}
    />
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

function ResultsBackgroundComponent({
  destination,
  theme,
  verdictBias,
  showScrollProgress = true,
  children,
  className,
}: ResultsBackgroundProps) {
  const reducedMotion = prefersReducedMotion();

  // Map verdict to bias key
  const bias = verdictBias || 'neutral';

  return (
    <div className={cn('relative min-h-screen', className)}>
      {/* Scroll progress indicator */}
      {showScrollProgress && theme === 'cinematic' && !reducedMotion && (
        <ScrollProgressIndicator />
      )}

      {/* Background layer based on theme */}
      {theme === 'cinematic' && (
        <CinematicBackground
          destination={destination}
          verdictBias={bias}
          reducedMotion={reducedMotion}
        />
      )}

      {theme === 'ambient' && (
        <AmbientBackground
          verdictBias={bias}
          reducedMotion={reducedMotion}
        />
      )}

      {theme === 'minimal' && <MinimalBackground />}

      {/* Split theme - placeholder for future */}
      {theme === 'split' && <MinimalBackground />}

      {/* Content layer - above all background layers */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}

// Add shimmer keyframes if not already present
if (typeof document !== 'undefined') {
  const styleId = 'results-background-styles';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      @keyframes shimmer {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(100%); }
      }
      .animate-shimmer {
        animation: shimmer 1.5s infinite;
      }
    `;
    document.head.appendChild(style);
  }
}

export const ResultsBackground = memo(ResultsBackgroundComponent);
