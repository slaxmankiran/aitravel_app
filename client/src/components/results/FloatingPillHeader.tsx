/**
 * FloatingPillHeader Component
 *
 * Merges HeaderBar + CertaintyBar into a single floating pill.
 * Premium glassmorphism styling with spring animations.
 *
 * Layout: [Logo] [Destination • Dates] [Certainty Score] [Actions]
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'wouter';
import {
  Share2,
  Download,
  Pencil,
  ChevronDown,
  ShieldCheck,
  AlertTriangle,
  Calendar,
  Users,
  Plane,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { TripResponse, VisaDetails } from '@shared/schema';
import { springTransition } from '@/components/transitions';

// ============================================================================
// TYPES
// ============================================================================

interface FloatingPillHeaderProps {
  trip: TripResponse;
  onShare?: () => void;
  onExport?: () => void;
  onDetailsClick?: () => void;
  isDemo?: boolean;
  className?: string;
}

// ============================================================================
// HELPERS
// ============================================================================

function getVisaLabel(visaType?: VisaDetails['type']): string {
  switch (visaType) {
    case 'visa_free': return 'Visa Free';
    case 'visa_on_arrival': return 'VOA';
    case 'e_visa': return 'e-Visa';
    case 'embassy_visa': return 'Embassy Visa';
    default: return 'Check Visa';
  }
}

function getVisaColor(visaType?: VisaDetails['type']) {
  switch (visaType) {
    case 'visa_free': return 'text-emerald-400';
    case 'visa_on_arrival': return 'text-blue-400';
    case 'e_visa': return 'text-amber-400';
    default: return 'text-orange-400';
  }
}

function getCertaintyColor(score: number) {
  if (score >= 70) return { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30' };
  if (score >= 40) return { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30' };
  return { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' };
}

function formatDateRange(dates: string): string {
  // Parse dates like "2026-02-15 to 2026-02-22"
  if (!dates) return '';

  const parts = dates.split(' to ');
  if (parts.length !== 2) return dates;

  try {
    const start = new Date(parts[0]);
    const end = new Date(parts[1]);

    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    const startStr = start.toLocaleDateString('en-US', options);
    const endStr = end.toLocaleDateString('en-US', options);

    // Calculate duration
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return `${startStr} - ${endStr} (${diffDays}d)`;
  } catch {
    return dates;
  }
}

// ============================================================================
// COMPONENT
// ============================================================================

function FloatingPillHeaderComponent({
  trip,
  onShare,
  onExport,
  onDetailsClick,
  isDemo = false,
  className = '',
}: FloatingPillHeaderProps) {
  const [showQuickInfo, setShowQuickInfo] = useState(false);

  const feasibility = trip.feasibilityReport as any;
  const visaDetails = feasibility?.visaDetails as VisaDetails | undefined;
  const certaintyScore = feasibility?.score ?? 0;
  const certaintyColors = getCertaintyColor(certaintyScore);

  const destination = trip.destination?.split(',')[0] || 'Trip';
  const dateRange = formatDateRange(trip.dates || '');
  const travelers = trip.groupSize || 1;

  // Build edit URL
  const returnTo = encodeURIComponent(`/trips/${trip.id}/results-v1`);
  const editUrl = `/create?editTripId=${trip.id}&returnTo=${returnTo}`;

  const handleShare = async () => {
    if (onShare) {
      onShare();
    } else {
      const shareUrl = `${window.location.origin}/share/${trip.id}`;
      try {
        await navigator.clipboard.writeText(shareUrl);
      } catch (err) {
        console.warn('Failed to copy:', err);
      }
    }
  };

  const handleExport = () => {
    if (onExport) {
      onExport();
    } else {
      window.open(`/trips/${trip.id}/export`, '_blank');
    }
  };

  return (
    <motion.header
      initial={{ y: -50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={springTransition}
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 ${className}`}
    >
      {/* Main pill container */}
      <div className="bg-slate-900/70 backdrop-blur-2xl rounded-full border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] px-3 py-2">
        <div className="flex items-center gap-3">
          {/* Logo */}
          <Link href="/">
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white font-bold text-sm cursor-pointer shadow-lg"
            >
              V
            </motion.div>
          </Link>

          {/* Destination & Meta */}
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-white font-medium truncate max-w-[120px] sm:max-w-[180px]">
              {destination}
            </span>
            <span className="hidden sm:inline text-white/30">•</span>
            <span className="hidden sm:inline text-white/50 text-sm whitespace-nowrap">
              {dateRange}
            </span>
          </div>

          {/* Divider */}
          <div className="w-px h-6 bg-white/10" />

          {/* Certainty Score Pill */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowQuickInfo(!showQuickInfo)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${certaintyColors.bg} border ${certaintyColors.border} cursor-pointer transition-colors`}
          >
            <span className={`text-sm font-semibold ${certaintyColors.text}`}>
              {certaintyScore}%
            </span>
            <ChevronDown className={`w-3.5 h-3.5 ${certaintyColors.text} transition-transform ${showQuickInfo ? 'rotate-180' : ''}`} />
          </motion.button>

          {/* Visa Badge (compact) */}
          {visaDetails && (
            <div className="hidden md:flex items-center gap-1.5 px-2 py-1 rounded-full bg-white/5 border border-white/10">
              <Plane className={`w-3.5 h-3.5 ${getVisaColor(visaDetails.type)}`} />
              <span className={`text-xs font-medium ${getVisaColor(visaDetails.type)}`}>
                {getVisaLabel(visaDetails.type)}
              </span>
            </div>
          )}

          {/* Divider */}
          <div className="hidden sm:block w-px h-6 bg-white/10" />

          {/* Actions */}
          <div className="flex items-center gap-0.5">
            {/* Edit - prominent if not demo */}
            {!isDemo && (
              <Link href={editUrl}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span className="hidden lg:inline ml-1.5 text-xs">Edit</span>
                </Button>
              </Link>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={handleShare}
              className="h-8 px-2 text-white/50 hover:text-white/80 hover:bg-white/5 rounded-full"
            >
              <Share2 className="w-3.5 h-3.5" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleExport}
              className="h-8 px-2 text-white/50 hover:text-white/80 hover:bg-white/5 rounded-full"
            >
              <Download className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Quick info dropdown */}
      <AnimatePresence>
        {showQuickInfo && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-72"
          >
            <div className="bg-slate-900/90 backdrop-blur-2xl rounded-2xl border border-white/10 shadow-2xl p-4">
              {/* Trip Stats */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="text-center">
                  <div className="text-lg font-semibold text-white">{travelers}</div>
                  <div className="text-xs text-white/50 flex items-center justify-center gap-1">
                    <Users className="w-3 h-3" />
                    Travelers
                  </div>
                </div>
                <div className="text-center">
                  <div className={`text-lg font-semibold ${certaintyColors.text}`}>{certaintyScore}%</div>
                  <div className="text-xs text-white/50 flex items-center justify-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    Certainty
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold text-white">
                    {trip.budget ? `$${trip.budget}` : '—'}
                  </div>
                  <div className="text-xs text-white/50">Budget</div>
                </div>
              </div>

              {/* Visa Quick Info */}
              {visaDetails && (
                <div className="bg-white/5 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/50">Visa Type</span>
                    <span className={`text-sm font-medium ${getVisaColor(visaDetails.type)}`}>
                      {getVisaLabel(visaDetails.type)}
                    </span>
                  </div>
                  {visaDetails.processingDays && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-white/50">Processing</span>
                      <span className="text-sm text-white">
                        {visaDetails.processingDays.minimum === 0
                          ? 'Instant'
                          : `${visaDetails.processingDays.minimum}-${visaDetails.processingDays.maximum} days`}
                      </span>
                    </div>
                  )}
                  {visaDetails.cost && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-white/50">Cost</span>
                      <span className="text-sm text-white">
                        {visaDetails.cost.totalPerPerson === 0
                          ? 'Free'
                          : `${visaDetails.cost.currency} ${visaDetails.cost.totalPerPerson}`}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* View Details Button */}
              <button
                onClick={() => {
                  setShowQuickInfo(false);
                  onDetailsClick?.();
                }}
                className="w-full mt-3 py-2 text-xs text-white/50 hover:text-white/70 hover:bg-white/5 rounded-lg transition-colors"
              >
                View Full Details →
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}

export const FloatingPillHeader = React.memo(FloatingPillHeaderComponent);
