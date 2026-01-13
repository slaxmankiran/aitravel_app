/**
 * MapPlaceholder Component
 *
 * Lightweight placeholder shown while the heavy 3D MapBackground loads.
 * Provides instant visual feedback with a "waking up" animation.
 */

import { Loader2, Globe } from 'lucide-react';
import { motion } from 'framer-motion';

interface MapPlaceholderProps {
  className?: string;
}

export function MapPlaceholder({ className = '' }: MapPlaceholderProps) {
  return (
    <div className={`fixed inset-0 z-0 bg-slate-900 ${className}`}>
      {/* Animated gradient background - simulates map "waking up" */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="absolute inset-0"
      >
        {/* Deep space gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950" />

        {/* Subtle grid pattern - hints at map structure */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(99, 102, 241, 0.5) 1px, transparent 1px),
              linear-gradient(90deg, rgba(99, 102, 241, 0.5) 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px',
          }}
        />

        {/* Radial glow in center */}
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse at 60% 50%, rgba(99, 102, 241, 0.08) 0%, transparent 60%)',
          }}
        />
      </motion.div>

      {/* Loading indicator */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="absolute inset-0 flex flex-col items-center justify-center"
      >
        {/* Globe icon with pulse */}
        <motion.div
          animate={{
            scale: [1, 1.05, 1],
            opacity: [0.4, 0.6, 0.4],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="mb-4"
        >
          <Globe className="w-16 h-16 text-indigo-400/30" strokeWidth={1} />
        </motion.div>

        {/* Spinner */}
        <div className="flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-indigo-400/60 animate-spin" />
          <span className="text-sm text-slate-400 font-medium tracking-wide">
            Loading 3D World...
          </span>
        </div>
      </motion.div>

      {/* Gradient overlays to match MapBackground (ensures seamless transition) */}
      {/* Left fade */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(to right, rgba(15, 23, 42, 0.92) 0%, rgba(15, 23, 42, 0.6) 30%, transparent 55%)',
        }}
      />

      {/* Top fade */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(to bottom, rgba(15, 23, 42, 0.75) 0%, transparent 25%)',
        }}
      />

      {/* Vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          boxShadow: 'inset 0 0 250px rgba(0, 0, 0, 0.4)',
        }}
      />
    </div>
  );
}

export default MapPlaceholder;
