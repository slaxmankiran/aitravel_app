/**
 * ModifyChips.tsx
 *
 * Premium glass chip card for AI modifications.
 * Shows intelligent action chips, not a chatty interface.
 * Chat opens on demand via drawer.
 *
 * Design: Glass material, magnetic hover, tool-like language.
 */

import React, { memo } from 'react';
import { motion } from 'framer-motion';
import {
  Sparkles,
  DollarSign,
  Gauge,
  Utensils,
  Zap,
  Clock,
  TrendingUp,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  glassSecondary,
  glassTertiary,
  typography,
  entranceFade,
} from '@/lib/glassDesign';

interface ModifyChip {
  id: string;
  label: string;
  icon: React.ReactNode;
  prompt: string;
}

// Tool-like language, not conversational
const DEFAULT_CHIPS: ModifyChip[] = [
  {
    id: 'reduce-cost',
    label: 'Reduce cost',
    icon: <DollarSign className="w-3.5 h-3.5" />,
    prompt: 'Find cheaper alternatives for accommodations and activities',
  },
  {
    id: 'simplify',
    label: 'Simplify itinerary',
    icon: <Gauge className="w-3.5 h-3.5" />,
    prompt: 'Reduce the number of activities per day for a more relaxed pace',
  },
  {
    id: 'local-food',
    label: 'More local food',
    icon: <Utensils className="w-3.5 h-3.5" />,
    prompt: 'Replace some meals with authentic local food experiences',
  },
  {
    id: 'faster-pace',
    label: 'Faster pace',
    icon: <Zap className="w-3.5 h-3.5" />,
    prompt: 'Pack more activities into fewer days',
  },
  {
    id: 'relaxed-pace',
    label: 'Relaxed pace',
    icon: <Clock className="w-3.5 h-3.5" />,
    prompt: 'Spread activities across more days for a relaxed trip',
  },
  {
    id: 'improve-certainty',
    label: 'Improve certainty',
    icon: <TrendingUp className="w-3.5 h-3.5" />,
    prompt: 'Suggest changes to improve trip certainty score',
  },
];

interface ModifyChipsProps {
  onChipClick: (prompt: string) => void;
  onCustomClick: () => void;
  disabled?: boolean;
  chips?: ModifyChip[];
  className?: string;
}

function ModifyChipsComponent({
  onChipClick,
  onCustomClick,
  disabled = false,
  chips = DEFAULT_CHIPS,
  className,
}: ModifyChipsProps) {
  return (
    <motion.div
      initial={entranceFade.initial}
      animate={entranceFade.animate}
      transition={{ ...entranceFade.transition, delay: 0.1 }}
      className={cn(
        // Glass material
        glassSecondary.bg,
        glassSecondary.backdrop,
        glassSecondary.border,
        glassSecondary.shadow,
        // Shape
        'rounded-xl overflow-hidden',
        className
      )}
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/[0.04]">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-emerald-400/80" />
          <span className={cn('text-sm font-medium', typography.primary)}>
            Modify with AI
          </span>
        </div>
      </div>

      {/* Chips grid */}
      <div className="p-4">
        <div className="flex flex-wrap gap-2">
          {chips.map((chip, index) => (
            <motion.button
              key={chip.id}
              onClick={() => !disabled && onChipClick(chip.prompt)}
              disabled={disabled}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.05 * index, duration: 0.2 }}
              whileHover={disabled ? {} : { scale: 1.03, y: -1 }}
              whileTap={disabled ? {} : { scale: 0.97 }}
              className={cn(
                'inline-flex items-center gap-2 px-3.5 py-2 rounded-full',
                'text-xs font-medium transition-all duration-200',
                disabled
                  ? 'bg-white/[0.03] text-white/25 cursor-not-allowed'
                  : cn(
                      // Glass pill
                      glassTertiary.bg,
                      'border border-white/[0.06]',
                      'backdrop-blur-sm',
                      typography.secondary,
                      // Hover
                      'hover:bg-emerald-500/15 hover:text-emerald-300',
                      'hover:border-emerald-500/25',
                      'hover:shadow-[0_0_20px_rgba(16,185,129,0.15)]'
                    )
              )}
            >
              <span className={disabled ? 'text-white/20' : 'text-white/50 group-hover:text-emerald-400'}>
                {chip.icon}
              </span>
              {chip.label}
            </motion.button>
          ))}
        </div>

        {/* Custom request link */}
        <motion.button
          onClick={() => !disabled && onCustomClick()}
          disabled={disabled}
          whileHover={disabled ? {} : { x: 2 }}
          className={cn(
            'mt-4 flex items-center gap-1.5 text-xs transition-all duration-200',
            disabled
              ? 'text-white/20 cursor-not-allowed'
              : cn(typography.tertiary, 'hover:text-white/60')
          )}
        >
          <span>Custom request</span>
          <ChevronRight className="w-3 h-3" />
        </motion.button>
      </div>

      {/* Demo mode message */}
      {disabled && (
        <div className="px-5 pb-5">
          <p className={cn('text-xs text-center', typography.muted)}>
            AI modifications available on your own trip
          </p>
        </div>
      )}
    </motion.div>
  );
}

export const ModifyChips = memo(ModifyChipsComponent);
