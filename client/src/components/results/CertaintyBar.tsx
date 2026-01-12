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
  Plane,
  ExternalLink,
  BadgeCheck,
  Info
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
    case 'requires_verification':
      return { bg: 'bg-orange-500/20', text: 'text-orange-300', border: 'border-orange-500/30' };
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
    case 'requires_verification': return 'Requires Verification';
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

// Get trust level styling for citations
function getTrustLevelStyle(level?: 'high' | 'medium' | 'low') {
  switch (level) {
    case 'high':
      return { bg: 'bg-emerald-500/10', text: 'text-emerald-400', label: 'Official' };
    case 'medium':
      return { bg: 'bg-blue-500/10', text: 'text-blue-400', label: 'Verified' };
    case 'low':
    default:
      return { bg: 'bg-white/5', text: 'text-white/50', label: 'Guide' };
  }
}

// Infer trust level from source name if not provided
function inferTrustLevel(sourceName: string): 'high' | 'medium' | 'low' {
  const lower = sourceName.toLowerCase();
  if (lower.includes('embassy') || lower.includes('immigration') || lower.includes('gov') || lower.includes('consulate')) {
    return 'high';
  }
  if (lower.includes('travel') || lower.includes('tourism') || lower.includes('organization')) {
    return 'medium';
  }
  return 'low';
}

/**
 * CertaintyBar - Thin facts strip showing visa info only.
 * NO numeric score, NO badges - just plain text facts.
 * Score is shown ONLY in DecisionStack.
 */
function CertaintyBarComponent({ trip, className = '', onExplainCertainty, certaintyHistory = [] }: CertaintyBarProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const feasibility = trip.feasibilityReport as any;
  const visaDetails = feasibility?.visaDetails as VisaDetails | undefined;
  const overall = feasibility?.overall;

  const visaLabel = getVisaLabel(visaDetails?.type, visaDetails?.name);
  const processingTime = getProcessingTime(visaDetails?.processingDays);

  // Status text (not badge)
  const isVerified = overall === 'yes';

  // Build certainty breakdown (memoized for performance)
  const breakdown = useMemo(() => buildCertaintyBreakdown(trip), [trip]);

  // If no visa details, don't show the bar
  if (!visaDetails) {
    return null;
  }

  // Check if we need to show verification banner
  const needsVerification = visaDetails.type === 'requires_verification' ||
    visaDetails.confidenceLevel === 'low' ||
    (!visaDetails.sources || visaDetails.sources.length === 0);

  return (
    <div className={`sticky top-[56px] z-40 ${className}`}>
      {/* Verification Banner - shown for unverified corridors */}
      {needsVerification && (
        <div className="max-w-7xl mx-auto px-4 md:px-6 pt-2">
          <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg px-4 py-2.5 mb-2">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-400 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-orange-200 font-medium">
                  Visa information requires verification
                </p>
                <p className="text-xs text-orange-200/70 mt-0.5">
                  This corridor is not in our verified database. Please confirm visa requirements with the{' '}
                  <a
                    href={`https://www.google.com/search?q=${encodeURIComponent(trip.destination || '')}+embassy+visa+requirements`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-orange-100"
                  >
                    official embassy
                  </a>{' '}
                  before booking.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Container matches content grid width */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-2">
        {/* Thin facts strip - lighter than content cards, same width as grid */}
        <div className="bg-slate-950/25 backdrop-blur-md border border-white/[0.04] rounded-lg px-4 py-2">
          <div className="flex items-center justify-between gap-4">
            {/* Left: Facts as inline text with separators */}
            <div className="flex items-center gap-1 text-xs text-white/50 overflow-x-auto scrollbar-hide">
              <span className="text-white/70 font-medium">Visa:</span>
              <span>{visaLabel}</span>
              {processingTime && (
                <>
                  <span className="text-white/30 mx-1">·</span>
                  <span>{processingTime}</span>
                </>
              )}
              {visaDetails.sources && visaDetails.sources.length > 0 && (
                <>
                  <span className="text-white/30 mx-1">·</span>
                  <span className="text-emerald-400/80 flex items-center gap-1">
                    <BadgeCheck className="w-3 h-3" />
                    {visaDetails.sources.length} sources
                  </span>
                </>
              )}
              {isVerified && !visaDetails.sources?.length && (
                <>
                  <span className="text-white/30 mx-1">·</span>
                  <span className="text-emerald-400/80">Verified</span>
                </>
              )}
            </div>

            {/* Right: Details button only */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-white/50 hover:text-white/70 hover:bg-white/5 h-7 px-2 text-xs"
              aria-expanded={isExpanded}
              aria-controls="certaintybar-expanded"
            >
              Details
              {isExpanded ? (
                <ChevronUp className="w-3.5 h-3.5 ml-1" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 ml-1" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Expanded visa details - matches facts strip styling */}
      <AnimatePresence>
        {isExpanded && visaDetails && (
          <motion.div
            id="certaintybar-expanded"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {/* Same container as facts strip */}
            <div className="max-w-7xl mx-auto px-4 md:px-6 pb-2">
              {/* Same glass styling as facts strip, continuous feel */}
              <div className="bg-slate-950/25 backdrop-blur-md border border-white/[0.04] border-t-0 rounded-b-lg px-4 py-4 -mt-1">
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

              {/* Sources - RAG Citations (top 3 by trust, hide Guide when Official exists) */}
              {visaDetails.sources && visaDetails.sources.length > 0 && (() => {
                // Sort sources by trust level (high > medium > low)
                const sourcesWithTrust = visaDetails.sources.map(source => ({
                  ...source,
                  trustLevel: inferTrustLevel(source.title)
                }));

                const trustOrder = { high: 0, medium: 1, low: 2 };
                sourcesWithTrust.sort((a, b) => trustOrder[a.trustLevel] - trustOrder[b.trustLevel]);

                // Check if we have official (high) sources
                const hasOfficialSources = sourcesWithTrust.some(s => s.trustLevel === 'high');

                // Filter: hide Guide (low) sources when Official (high) exists
                const filteredSources = hasOfficialSources
                  ? sourcesWithTrust.filter(s => s.trustLevel !== 'low')
                  : sourcesWithTrust;

                // Take top 3
                const displaySources = filteredSources.slice(0, 3);

                return (
                  <div className="mt-4 bg-white/5 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <BadgeCheck className="w-4 h-4 text-primary" />
                      <h4 className="text-sm font-medium text-white">Verified Sources</h4>
                      <span className="text-xs text-white/40 ml-auto">
                        {visaDetails.confidenceLevel === 'high' ? 'High confidence' :
                         visaDetails.confidenceLevel === 'medium' ? 'Medium confidence' : 'Check official sources'}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {displaySources.map((source, i) => {
                        const trustStyle = getTrustLevelStyle(source.trustLevel);
                        return (
                          <a
                            key={i}
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`flex items-start gap-2 p-2 rounded-md ${trustStyle.bg} hover:bg-white/10 transition-colors group`}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className={`text-[10px] font-medium uppercase tracking-wider ${trustStyle.text}`}>
                                  {trustStyle.label}
                                </span>
                              </div>
                              <div className="text-sm text-white/80 truncate group-hover:text-white">
                                {source.title}
                              </div>
                            </div>
                            <ExternalLink className="w-3.5 h-3.5 text-white/30 group-hover:text-white/60 shrink-0 mt-1" />
                          </a>
                        );
                      })}
                    </div>
                    {visaDetails.lastVerified && (
                      <div className="mt-3 flex items-center gap-1.5 text-xs text-white/40">
                        <Info className="w-3 h-3" />
                        <span>Last verified: {visaDetails.lastVerified}</span>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Confidence warning for low confidence lookups */}
              {visaDetails.confidenceLevel === 'low' && (
                <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                    <div className="text-sm text-amber-200">
                      <strong>Limited data available.</strong> Please verify visa requirements with the official embassy before making travel plans.
                    </div>
                  </div>
                </div>
              )}

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
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Memoize to prevent page-wide rerenders
export const CertaintyBar = React.memo(CertaintyBarComponent);
