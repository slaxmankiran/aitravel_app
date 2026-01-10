/**
 * CertaintyBar.tsx
 *
 * Sticky bar showing the VoyageAI wedge:
 * - Certainty score
 * - Visa type badge
 * - Processing time
 * - Apply-by date
 * - Verification status
 *
 * This is what makes VoyageAI unique.
 *
 * Performance: Memoized to prevent page-wide cascades.
 */

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle,
  Clock,
  Calendar,
  ChevronDown,
  ChevronUp,
  FileCheck,
  Plane
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TripResponse, VisaDetails } from "@shared/schema";
import { CertaintyTimeline } from "./CertaintyTimeline";
import type { CertaintyPoint } from "@/pages/TripResultsV1";
import { CertaintyBreakdown } from "./CertaintyBreakdown";
import { buildCertaintyBreakdown } from "@/lib/certaintyBreakdown";

interface CertaintyBarProps {
  trip: TripResponse;
  className?: string;
  onExplainCertainty?: () => void;
  certaintyHistory?: CertaintyPoint[];
}

// Get visa badge styling
function getVisaBadgeStyle(visaType?: VisaDetails['type']) {
  switch (visaType) {
    case 'visa_free':
      return { bg: 'bg-emerald-500/20', text: 'text-emerald-300', border: 'border-emerald-500/30' };
    case 'visa_on_arrival':
      return { bg: 'bg-blue-500/20', text: 'text-blue-300', border: 'border-blue-500/30' };
    case 'e_visa':
      return { bg: 'bg-amber-500/20', text: 'text-amber-300', border: 'border-amber-500/30' };
    case 'embassy_visa':
    case 'not_allowed':
    default:
      return { bg: 'bg-red-500/20', text: 'text-red-300', border: 'border-red-500/30' };
  }
}

// Format visa type for display
function getVisaLabel(visaType?: VisaDetails['type'], name?: string): string {
  if (name) return name;
  switch (visaType) {
    case 'visa_free': return 'Visa Free';
    case 'visa_on_arrival': return 'Visa on Arrival';
    case 'e_visa': return 'e-Visa';
    case 'embassy_visa': return 'Embassy Visa';
    case 'not_allowed': return 'Not Allowed';
    default: return 'Unknown';
  }
}

// Format processing time
function getProcessingTime(processingDays?: VisaDetails['processingDays']): string | null {
  if (!processingDays) return null;
  // For visa-free (0 days), show "Instant" instead of awkward "0 days"
  if (processingDays.minimum === 0 && processingDays.maximum === 0) {
    return 'Instant';
  }
  if (processingDays.minimum === processingDays.maximum) {
    return `${processingDays.minimum} days`;
  }
  return `${processingDays.minimum}-${processingDays.maximum} days`;
}

// Get certainty score color
function getCertaintyColor(score: number) {
  if (score >= 70) return { bg: 'bg-emerald-500/20', text: 'text-emerald-400', ring: 'ring-emerald-500/30' };
  if (score >= 40) return { bg: 'bg-amber-500/20', text: 'text-amber-400', ring: 'ring-amber-500/30' };
  return { bg: 'bg-red-500/20', text: 'text-red-400', ring: 'ring-red-500/30' };
}

function CertaintyBarComponent({ trip, className = '', onExplainCertainty, certaintyHistory = [] }: CertaintyBarProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const feasibility = trip.feasibilityReport as any;
  const score = Number(feasibility?.score) || 0;
  const visaDetails = feasibility?.visaDetails as VisaDetails | undefined;
  const overall = feasibility?.overall;

  const certaintyColor = getCertaintyColor(score);
  const visaStyle = getVisaBadgeStyle(visaDetails?.type);
  const visaLabel = getVisaLabel(visaDetails?.type, visaDetails?.name);
  const processingTime = getProcessingTime(visaDetails?.processingDays);

  // Determine status chip
  const isVerified = overall === 'yes';
  const hasWarnings = overall === 'warning';

  // Build certainty breakdown (memoized for performance)
  const breakdown = useMemo(() => buildCertaintyBreakdown(trip), [trip]);

  return (
    <div className={`sticky top-[56px] z-40 ${className}`}>
      {/* Main bar */}
      <div className="bg-slate-800/95 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-2.5">
          <div className="flex items-center justify-between gap-4">
            {/* Left: Certainty + Visa info */}
            <div className="flex items-center gap-4 md:gap-6 overflow-x-auto scrollbar-hide">
              {/* Certainty Score */}
              <button
                onClick={onExplainCertainty}
                disabled={!onExplainCertainty}
                className={`flex items-center gap-2.5 shrink-0 group ${onExplainCertainty ? "cursor-pointer" : "cursor-default opacity-80"}`}
                aria-label="Why this score?"
              >
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ring-2 transition-all ${onExplainCertainty ? "group-hover:ring-white/30" : ""} ${certaintyColor.bg} ${certaintyColor.text} ${certaintyColor.ring}`}>
                  {score}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-[10px] text-white/40 uppercase tracking-wider">Certainty</p>
                  <div className="flex items-center gap-1.5">
                    <p className={`text-sm font-medium ${certaintyColor.text}`}>
                      {score >= 70 ? 'High' : score >= 40 ? 'Medium' : 'Low'}
                    </p>
                    {onExplainCertainty && (
                      <span className="text-[10px] text-white/40 group-hover:text-white/60 transition-colors">
                        Why?
                      </span>
                    )}
                  </div>
                </div>
              </button>

              {/* Divider */}
              <div className="w-px h-8 bg-white/10 hidden sm:block" />

              {/* Visa Badge */}
              {visaDetails && (
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`px-2.5 py-1 rounded-md text-xs font-medium border ${visaStyle.bg} ${visaStyle.text} ${visaStyle.border}`}>
                    {visaLabel}
                  </span>
                </div>
              )}

              {/* Processing Time */}
              {processingTime && (
                <div className="flex items-center gap-1.5 text-white/60 shrink-0">
                  <Clock className="w-3.5 h-3.5" />
                  <span className="text-xs">{processingTime}</span>
                </div>
              )}

              {/* Timing Urgency */}
              {visaDetails?.timing?.urgency && visaDetails.timing.urgency !== 'ok' && (
                <div className="flex items-center gap-1.5 text-white/60 shrink-0 hidden md:flex">
                  <Calendar className="w-3.5 h-3.5" />
                  <span className="text-xs">{visaDetails.timing.recommendation}</span>
                </div>
              )}
            </div>

            {/* Right: Status + Expand */}
            <div className="flex items-center gap-3 shrink-0">
              {/* Status chip */}
              {isVerified && (
                <span className="flex items-center gap-1.5 text-emerald-400 text-xs font-medium bg-emerald-500/10 px-2.5 py-1 rounded-full">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Verified</span>
                </span>
              )}
              {hasWarnings && (
                <span className="flex items-center gap-1.5 text-amber-400 text-xs font-medium bg-amber-500/10 px-2.5 py-1 rounded-full">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Risks noted</span>
                </span>
              )}

              {/* Expand button */}
              {visaDetails && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="text-white/60 hover:text-white hover:bg-white/10 h-8 px-2"
                  aria-expanded={isExpanded}
                  aria-controls="certaintybar-expanded"
                >
                  <span className="text-xs mr-1 hidden sm:inline">Details</span>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Expanded visa details - solid bg to properly overlay content when sticky */}
      <AnimatePresence>
        {isExpanded && visaDetails && (
          <motion.div
            id="certaintybar-expanded"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden bg-slate-900 border-b border-white/10 shadow-xl"
          >
            <div className="max-w-7xl mx-auto px-4 md:px-6 py-4">
              {/* Certainty Timeline - shows evolution across changes */}
              {certaintyHistory.length > 1 && (
                <div className="mb-4 p-3 bg-white/5 rounded-lg">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <span className="text-xs text-white/50 uppercase tracking-wider">Score History</span>
                    <CertaintyTimeline history={certaintyHistory} />
                  </div>
                </div>
              )}

              {/* Certainty Breakdown - shows factor scores */}
              <div className="mb-4 p-4 bg-white/5 rounded-lg">
                <CertaintyBreakdown
                  factors={breakdown.factors}
                  totalScore={breakdown.totalScore}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Visa Requirements */}
                <div className="bg-white/5 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <FileCheck className="w-4 h-4 text-primary" />
                    <h4 className="text-sm font-medium text-white">Requirements</h4>
                  </div>
                  {visaDetails.documentsRequired && visaDetails.documentsRequired.length > 0 ? (
                    <ul className="space-y-1.5 text-sm text-white/70">
                      {visaDetails.documentsRequired.slice(0, 4).map((doc, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <CheckCircle className="w-3.5 h-3.5 text-white/40 mt-0.5 shrink-0" />
                          <span>{doc}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-white/50">
                      {visaDetails.type === 'visa_free'
                        ? 'No visa required. Just bring your valid passport.'
                        : 'No specific documents listed.'}
                    </p>
                  )}
                </div>

                {/* Timing */}
                <div className="bg-white/5 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Clock className="w-4 h-4 text-primary" />
                    <h4 className="text-sm font-medium text-white">Timing</h4>
                  </div>
                  <div className="space-y-2 text-sm">
                    {processingTime && (
                      <div className="flex justify-between">
                        <span className="text-white/50">Processing</span>
                        <span className="text-white">{processingTime}</span>
                      </div>
                    )}
                    {visaDetails.timing?.hasEnoughTime !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-white/50">Time Status</span>
                        <span className={visaDetails.timing.hasEnoughTime ? 'text-emerald-400' : 'text-amber-400'}>
                          {visaDetails.timing.hasEnoughTime ? 'Sufficient' : 'Tight timeline'}
                        </span>
                      </div>
                    )}
                    {visaDetails.timing?.daysUntilTrip !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-white/50">Days Until Trip</span>
                        <span className="text-white">{visaDetails.timing.daysUntilTrip} days</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Entry Costs */}
                <div className="bg-white/5 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Plane className="w-4 h-4 text-primary" />
                    <h4 className="text-sm font-medium text-white">Entry Costs</h4>
                  </div>
                  <div className="space-y-2 text-sm">
                    {visaDetails.cost && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-white/50">Total per Person</span>
                          <span className="text-white">
                            {visaDetails.cost.totalPerPerson === 0
                              ? 'Free'
                              : `${visaDetails.cost.currency} ${visaDetails.cost.totalPerPerson}`}
                          </span>
                        </div>
                        {visaDetails.cost.breakdownLabel && (
                          <div className="text-xs text-white/40">
                            {visaDetails.cost.breakdownLabel}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Timing warning */}
              {visaDetails.timing && visaDetails.timing.urgency !== 'ok' && (
                <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                    <div className="text-sm text-amber-200">
                      {visaDetails.timing.recommendation}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Memoize to prevent page-wide rerenders
export const CertaintyBar = React.memo(CertaintyBarComponent);
