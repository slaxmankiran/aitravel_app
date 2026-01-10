/**
 * ResultsBackground.tsx
 *
 * Premium visual background layer for Trip Results.
 * Renders behind all content to create immersive atmosphere.
 *
 * Themes:
 * - cinematic: Full destination image + dark vignette + ambient motion
 * - ambient: Animated gradients only, no photos
 * - split: Reserved for future (image rail layout)
 * - minimal: No background effects, current look
 *
 * Layers (bottom → top):
 * 1. Destination image (cinematic only)
 * 2. Dark vignette + readability gradients
 * 3. Animated ambient gradient (slow movement)
 * 4. Noise texture (tiny opacity)
 * 5. Children (page content)
 */

import React, { memo, useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  getDestinationImageUrl,
  fetchDestinationImage,
  getDestinationFallbackGradient,
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
  children: React.ReactNode;
  className?: string;
}

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
      {/* Layer 1: Destination image or fallback gradient */}
      <div className="fixed inset-0 z-0">
        {imageUrl ? (
          <motion.div
            initial={{ scale: 1.05, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
            className="absolute inset-0"
          >
            <img
              src={imageUrl}
              alt=""
              className="w-full h-full object-cover"
            />
          </motion.div>
        ) : (
          <div
            className="absolute inset-0"
            style={{ background: fallbackGradient }}
          />
        )}

        {/* Shimmer while loading */}
        {isLoading && (
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />
        )}
      </div>

      {/* Layer 2: Dark vignette + readability gradient */}
      <div className="fixed inset-0 z-[1]">
        {/* Top fade for header readability */}
        <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-slate-900/95 via-slate-900/70 to-transparent" />

        {/* Bottom fade for content readability */}
        <div className="absolute inset-x-0 bottom-0 h-96 bg-gradient-to-t from-slate-900 via-slate-900/90 to-transparent" />

        {/* Overall darken */}
        <div className="absolute inset-0 bg-slate-900/60" />

        {/* Vignette edges */}
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse at center, transparent 0%, rgba(15, 23, 42, 0.4) 100%)',
          }}
        />
      </div>

      {/* Layer 3: Animated ambient gradients */}
      {!reducedMotion && (
        <div className="fixed inset-0 z-[2] pointer-events-none overflow-hidden">
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

      {/* Layer 4: Noise texture */}
      <div
        className="fixed inset-0 z-[3] pointer-events-none opacity-[0.015]"
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

      {/* Layer 2: Animated ambient gradients */}
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

      {/* Layer 3: Noise texture */}
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
  children,
  className,
}: ResultsBackgroundProps) {
  const reducedMotion = prefersReducedMotion();

  // Map verdict to bias key
  const bias = verdictBias || 'neutral';

  return (
    <div className={cn('relative min-h-screen', className)}>
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
