/**
 * certaintyBreakdown.ts
 *
 * Item 20: Certainty Breakdown
 * Normalizes existing feasibility data into display-ready factors.
 *
 * Design:
 * - Derived from existing data (no new APIs)
 * - Works in both UI and PDF contexts
 * - 4 factors: visa_timing, buffer_days, itinerary_density, cost_stability
 */

import type { TripResponse } from "@shared/schema";

// ============================================================================
// TYPES
// ============================================================================

export type CertaintyFactorId =
  | "visa_timing"
  | "buffer_days"
  | "itinerary_density"
  | "cost_stability";

export type CertaintyStatus = "good" | "warning" | "risk";

export interface CertaintyFactor {
  id: CertaintyFactorId;
  label: string;
  score: number;          // 0–100 (normalized for display)
  weight: number;         // 0–1, used to compute weighted total
  status: CertaintyStatus;
  explanation: string;
  icon?: string;          // Optional emoji for UI
}

export interface CertaintyBreakdownResult {
  factors: CertaintyFactor[];
  totalScore: number;     // Weighted average (0-100)
  verdict: "GO" | "POSSIBLE" | "DIFFICULT" | "NO";
  summary: string;
}

// ============================================================================
// FACTOR WEIGHTS (should sum to 1.0)
// ============================================================================

const WEIGHTS: Record<CertaintyFactorId, number> = {
  visa_timing: 0.35,       // Highest weight - visa is critical
  buffer_days: 0.25,       // Important for trip viability
  cost_stability: 0.25,    // Budget confidence matters
  itinerary_density: 0.15, // Nice to have, less critical
};

// ============================================================================
// STATUS HELPERS
// ============================================================================

function normalizeScore(score: number, maxScore: number): number {
  return Math.round((score / maxScore) * 100);
}

function getStatusFromScore(score: number): CertaintyStatus {
  if (score >= 70) return "good";
  if (score >= 40) return "warning";
  return "risk";
}

function getStatusFromUrgency(urgency: string): CertaintyStatus {
  switch (urgency) {
    case "ok": return "good";
    case "tight": return "warning";
    case "risky":
    case "impossible": return "risk";
    default: return "warning";
  }
}

function getStatusFromBudget(status: string): CertaintyStatus {
  switch (status) {
    case "ok": return "good";
    case "tight": return "warning";
    case "impossible": return "risk";
    default: return "warning";
  }
}

// ============================================================================
// FACTOR BUILDERS
// ============================================================================

/**
 * Build visa timing factor from visaDetails.timing
 */
function buildVisaTimingFactor(trip: TripResponse): CertaintyFactor {
  const feasibility = trip.feasibilityReport as any;
  const visaDetails = feasibility?.visaDetails;
  const timing = visaDetails?.timing;
  const visaType = visaDetails?.type || "unknown";

  // If visa-free or VOA, max score
  if (visaType === "visa_free" || visaType === "visa_on_arrival") {
    return {
      id: "visa_timing",
      label: "Visa Timing",
      score: 100,
      weight: WEIGHTS.visa_timing,
      status: "good",
      explanation: visaType === "visa_free"
        ? "No visa required - you can travel immediately"
        : "Visa available on arrival - no advance processing needed",
      icon: "🛂",
    };
  }

  // If no timing data available, estimate based on visa type
  if (!timing) {
    const processingDays = visaDetails?.processingDays?.maximum || 14;
    const score = processingDays <= 3 ? 90 : processingDays <= 7 ? 70 : processingDays <= 14 ? 50 : 30;
    return {
      id: "visa_timing",
      label: "Visa Timing",
      score,
      weight: WEIGHTS.visa_timing,
      status: getStatusFromScore(score),
      explanation: `Visa processing typically takes ${processingDays} days`,
      icon: "🛂",
    };
  }

  // Calculate score based on timing urgency
  const urgencyScores: Record<string, number> = {
    ok: 100,
    tight: 65,
    risky: 35,
    impossible: 10,
  };

  const score = urgencyScores[timing.urgency] || 50;

  return {
    id: "visa_timing",
    label: "Visa Timing",
    score,
    weight: WEIGHTS.visa_timing,
    status: getStatusFromUrgency(timing.urgency),
    explanation: timing.recommendation || `${timing.daysUntilTrip} days until trip, ${timing.processingDaysNeeded} days needed for processing`,
    icon: "🛂",
  };
}

/**
 * Build buffer days factor from timing data
 */
function buildBufferDaysFactor(trip: TripResponse): CertaintyFactor {
  const feasibility = trip.feasibilityReport as any;
  const timing = feasibility?.visaDetails?.timing;
  const visaType = feasibility?.visaDetails?.type;

  // If visa-free, buffer is irrelevant - max score
  if (visaType === "visa_free" || visaType === "visa_on_arrival") {
    return {
      id: "buffer_days",
      label: "Buffer Days",
      score: 100,
      weight: WEIGHTS.buffer_days,
      status: "good",
      explanation: "No processing buffer needed for this visa type",
      icon: "📅",
    };
  }

  if (!timing) {
    // Estimate from trip dates if available
    const tripStart = trip.dates ? new Date(trip.dates.split(" to ")[0] || trip.dates.split(" - ")[0]) : null;
    if (tripStart) {
      const daysUntil = Math.ceil((tripStart.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      const score = daysUntil > 30 ? 100 : daysUntil > 14 ? 75 : daysUntil > 7 ? 50 : 25;
      return {
        id: "buffer_days",
        label: "Buffer Days",
        score,
        weight: WEIGHTS.buffer_days,
        status: getStatusFromScore(score),
        explanation: `${daysUntil} days until your trip`,
        icon: "📅",
      };
    }

    return {
      id: "buffer_days",
      label: "Buffer Days",
      score: 50,
      weight: WEIGHTS.buffer_days,
      status: "warning",
      explanation: "Trip date information not available",
      icon: "📅",
    };
  }

  // Calculate buffer (days until trip - processing days needed)
  const buffer = timing.daysUntilTrip - timing.processingDaysNeeded;

  let score: number;
  let explanation: string;

  if (buffer >= 14) {
    score = 100;
    explanation = `${buffer} days buffer - plenty of time for processing`;
  } else if (buffer >= 7) {
    score = 80;
    explanation = `${buffer} days buffer - comfortable timeline`;
  } else if (buffer >= 3) {
    score = 55;
    explanation = `${buffer} days buffer - tight but possible`;
  } else if (buffer >= 0) {
    score = 30;
    explanation = `Only ${buffer} days buffer - consider expedited processing`;
  } else {
    score = 10;
    explanation = `${Math.abs(buffer)} days short - may need to postpone trip`;
  }

  return {
    id: "buffer_days",
    label: "Buffer Days",
    score,
    weight: WEIGHTS.buffer_days,
    status: getStatusFromScore(score),
    explanation,
    icon: "📅",
  };
}

/**
 * Build itinerary density factor from activity count
 */
function buildItineraryDensityFactor(trip: TripResponse): CertaintyFactor {
  const itinerary = trip.itinerary as any;

  if (!itinerary?.days || !Array.isArray(itinerary.days) || itinerary.days.length === 0) {
    return {
      id: "itinerary_density",
      label: "Itinerary Balance",
      score: 50,
      weight: WEIGHTS.itinerary_density,
      status: "warning",
      explanation: "Itinerary not yet generated",
      icon: "📋",
    };
  }

  const days = itinerary.days;
  const totalDays = days.length;

  // Count activities per day
  const activitiesPerDay = days.map((day: any) => {
    const activities = day.activities || [];
    return activities.length;
  });

  const avgActivities = activitiesPerDay.reduce((a: number, b: number) => a + b, 0) / totalDays;
  const maxActivities = Math.max(...activitiesPerDay);
  const minActivities = Math.min(...activitiesPerDay);

  // Ideal: 3-5 activities per day, well balanced
  let score: number;
  let explanation: string;

  if (avgActivities >= 3 && avgActivities <= 5 && maxActivities <= 6) {
    score = 95;
    explanation = `Well-balanced itinerary with ${avgActivities.toFixed(1)} activities per day`;
  } else if (avgActivities >= 2 && avgActivities <= 6) {
    score = 80;
    explanation = `Good pacing with ${avgActivities.toFixed(1)} activities per day`;
  } else if (avgActivities > 6) {
    score = 55;
    explanation = `Packed schedule - ${avgActivities.toFixed(1)} activities per day may be tiring`;
  } else if (avgActivities < 2) {
    score = 65;
    explanation = `Light schedule with ${avgActivities.toFixed(1)} activities per day`;
  } else {
    score = 70;
    explanation = `${totalDays} days planned`;
  }

  // Check for imbalance
  if (maxActivities - minActivities > 4) {
    score = Math.max(score - 15, 40);
    explanation += ". Some days are much busier than others";
  }

  return {
    id: "itinerary_density",
    label: "Itinerary Balance",
    score,
    weight: WEIGHTS.itinerary_density,
    status: getStatusFromScore(score),
    explanation,
    icon: "📋",
  };
}

/**
 * Build cost stability factor from budget status
 */
function buildCostStabilityFactor(trip: TripResponse): CertaintyFactor {
  const feasibility = trip.feasibilityReport as any;
  const budgetStatus = feasibility?.breakdown?.budget;

  if (!budgetStatus) {
    // Fallback: check if we have cost data from itinerary
    const itinerary = trip.itinerary as any;
    const costBreakdown = itinerary?.costBreakdown;
    const grandTotal = Number(costBreakdown?.total ?? costBreakdown?.grandTotal) || 0;
    const hasCosts = grandTotal > 0;
    return {
      id: "cost_stability",
      label: "Cost Confidence",
      score: hasCosts ? 60 : 40,
      weight: WEIGHTS.cost_stability,
      status: hasCosts ? "warning" : "risk",
      explanation: hasCosts
        ? `Estimated total: $${grandTotal.toLocaleString()}`
        : "Cost estimates not yet calculated",
      icon: "💰",
    };
  }

  // Map budget status to score
  const statusScores: Record<string, number> = {
    ok: 90,
    tight: 55,
    impossible: 15,
  };

  const score = statusScores[budgetStatus.status] || 50;

  let explanation = budgetStatus.reason || "";
  if (budgetStatus.estimatedCost) {
    explanation = `Estimated cost: $${budgetStatus.estimatedCost.toLocaleString()}. ${explanation}`;
  }

  return {
    id: "cost_stability",
    label: "Cost Confidence",
    score,
    weight: WEIGHTS.cost_stability,
    status: getStatusFromBudget(budgetStatus.status),
    explanation: explanation || "Budget assessment complete",
    icon: "💰",
  };
}

// ============================================================================
// MAIN BUILDER
// ============================================================================

/**
 * Build certainty breakdown from trip data
 * Derives all factors from existing feasibility report and itinerary
 * Scales factor scores to match the actual certainty score for consistency
 */
export function buildCertaintyBreakdown(trip: TripResponse): CertaintyBreakdownResult {
  // Get the actual certainty score from feasibility report
  const feasibility = trip.feasibilityReport as any;
  const actualCertainty = Number(feasibility?.score) || 0;

  // Build all factors with raw scores
  const rawFactors: CertaintyFactor[] = [
    buildVisaTimingFactor(trip),
    buildBufferDaysFactor(trip),
    buildItineraryDensityFactor(trip),
    buildCostStabilityFactor(trip),
  ];

  // Calculate raw weighted total
  const rawWeightedTotal = rawFactors.reduce(
    (sum, factor) => sum + (factor.score * factor.weight), 0
  );

  // Scale factor scores to match actual certainty score
  // This ensures the breakdown explains the real score, not a different one
  const scale = rawWeightedTotal > 0 ? actualCertainty / rawWeightedTotal : 1;

  const factors: CertaintyFactor[] = rawFactors.map(factor => ({
    ...factor,
    score: Math.round(Math.max(0, Math.min(100, factor.score * scale))),
  }));

  // Use actual certainty as the total score
  const totalScore = actualCertainty;

  // Determine verdict based on actual score
  let verdict: "GO" | "POSSIBLE" | "DIFFICULT" | "NO";
  const hasRisk = factors.some(f => f.status === "risk");
  const hasWarning = factors.some(f => f.status === "warning");

  if (totalScore >= 80 && !hasRisk) {
    verdict = "GO";
  } else if (totalScore >= 60 && !hasRisk) {
    verdict = "POSSIBLE";
  } else if (totalScore >= 40 || (hasWarning && !hasRisk)) {
    verdict = "DIFFICULT";
  } else {
    verdict = "NO";
  }

  // Generate summary
  const goodFactors = factors.filter(f => f.status === "good");
  const riskFactors = factors.filter(f => f.status === "risk");

  let summary: string;
  if (riskFactors.length > 0) {
    summary = `${riskFactors.length} area${riskFactors.length > 1 ? "s" : ""} need${riskFactors.length === 1 ? "s" : ""} attention: ${riskFactors.map(f => f.label).join(", ")}`;
  } else if (goodFactors.length === factors.length) {
    summary = "All factors look good for your trip";
  } else {
    summary = `${goodFactors.length} of ${factors.length} factors are optimal`;
  }

  return {
    factors,
    totalScore,
    verdict,
    summary,
  };
}

/**
 * Get display color for status
 */
export function getStatusColor(status: CertaintyStatus): string {
  switch (status) {
    case "good": return "emerald";
    case "warning": return "amber";
    case "risk": return "red";
    default: return "slate";
  }
}

/**
 * Get CSS classes for status indicator
 */
export function getStatusClasses(status: CertaintyStatus): { bg: string; text: string; border: string } {
  switch (status) {
    case "good":
      return { bg: "bg-emerald-500/20", text: "text-emerald-400", border: "border-emerald-500/30" };
    case "warning":
      return { bg: "bg-amber-500/20", text: "text-amber-400", border: "border-amber-500/30" };
    case "risk":
      return { bg: "bg-red-500/20", text: "text-red-400", border: "border-red-500/30" };
    default:
      return { bg: "bg-slate-500/20", text: "text-slate-400", border: "border-slate-500/30" };
  }
}
