/**
 * comparePlans.ts
 *
 * Comparison logic for Item 15: Compare Plans.
 * Generates structured diffs between two trip states for decision support.
 *
 * MVP Scope:
 * - Certainty & visa timeline comparison
 * - Total cost breakdown comparison
 * - Key itinerary changes
 * - Recommendation generation
 */

import type { TripResponse, FeasibilityReport, DeltaSummary } from "@shared/schema";

// ============================================================================
// TYPES
// ============================================================================

// Money type: number or null (null = unavailable/missing)
type Money = number | null;

export interface PlanSnapshot {
  label: "original" | "updated";

  // Core inputs
  inputs: {
    passport: string;
    destination: string;
    dates: string;
    budget: number;
    travelers: number;
    travelStyle?: string;
  };

  // Certainty metrics
  certainty: {
    score: number | null; // null if missing
    visaRisk: "low" | "medium" | "high";
    visaType: string;
    bufferDays: number;
    accessibilityStatus?: string;
    safetyStatus?: string;
  };

  // Cost breakdown (null = unavailable)
  costs: {
    flights: Money;
    stay: Money;
    activities: Money;
    visa: Money;
    insurance: Money;
    food: Money;
    transport: Money;
    misc: Money;
    total: Money;
  };

  // Itinerary summary
  itinerary: {
    dayCount: number;
    highlights: string[];
    activities: number;
  };
}

export interface CostDelta {
  category: string;
  before: Money;
  after: Money;
  delta: Money; // null if either value is unavailable
  direction: "up" | "down" | "same" | "unavailable";
}

export interface DayChange {
  day: number;
  before: string;
  after: string;
}

export interface PlanComparison {
  planA: PlanSnapshot;
  planB: PlanSnapshot;

  // Comparability check
  isComparable: boolean;
  incomparableReason?: string;

  // Deltas
  certaintyDelta: {
    scoreBefore: number | null;
    scoreAfter: number | null;
    delta: number | null; // null if either score missing
    direction: "improved" | "worsened" | "same" | "unavailable";
    visaRiskBefore: string;
    visaRiskAfter: string;
    bufferDaysBefore: number;
    bufferDaysAfter: number;
    bufferDelta: number;
  };

  costDeltas: CostDelta[];
  totalCostDelta: {
    before: Money;
    after: Money;
    delta: Money;
    percentChange: number | null;
    direction: "up" | "down" | "same" | "unavailable";
  };

  itineraryChanges: {
    dayCountBefore: number;
    dayCountAfter: number;
    changedDays: DayChange[];
    addedHighlights: string[];
    removedHighlights: string[];
  };

  // Recommendation
  recommendation: {
    preferred: "A" | "B" | "neutral";
    confidence: "high" | "medium" | "low";
    reason: string;
    tradeoffSummary: string;
  };
}

// ============================================================================
// SNAPSHOT EXTRACTION
// ============================================================================

/**
 * Safely extract a number, returns null if not a valid finite number
 */
function numOrNull(v: unknown): Money {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Calculate delta between two Money values, returns null if either is unavailable
 */
function safeDelta(before: Money, after: Money): Money {
  if (before === null || after === null) return null;
  return after - before;
}

/**
 * Extract a normalized snapshot from a TripResponse
 */
export function extractSnapshot(trip: TripResponse, label: "original" | "updated"): PlanSnapshot {
  const feasibility = trip.feasibilityReport as FeasibilityReport | undefined;
  const itinerary = trip.itinerary as any;
  const costBreakdown = itinerary?.costBreakdown || feasibility?.breakdown?.budget || {};

  // Calculate buffer days from dates
  const bufferDays = calculateBufferDays(trip.dates);

  // Determine visa risk from feasibility
  const visaRisk = getVisaRisk(feasibility);
  const visaType = feasibility?.visaDetails?.type || "unknown";

  // Extract costs with proper null handling
  const flights = numOrNull(costBreakdown.flights ?? costBreakdown.flight);
  const stay = numOrNull(costBreakdown.accommodation ?? costBreakdown.stay ?? costBreakdown.hotels);
  const activities = numOrNull(costBreakdown.activities ?? costBreakdown.experiences);
  const visa = numOrNull(costBreakdown.visa);
  const insurance = numOrNull(costBreakdown.insurance);
  const food = numOrNull(costBreakdown.food ?? costBreakdown.meals);
  const transport = numOrNull(costBreakdown.transport ?? costBreakdown.localTransport);
  const misc = numOrNull(costBreakdown.misc ?? costBreakdown.miscellaneous);

  // Calculate total from breakdown if not provided, only if we have some cost data
  const rawTotal = numOrNull(costBreakdown.total);
  const calculatedTotal = calculateTotalFromParts([flights, stay, activities, visa, insurance, food, transport, misc]);
  const total = rawTotal ?? calculatedTotal;

  return {
    label,
    inputs: {
      passport: trip.passport,
      destination: trip.destination,
      dates: trip.dates,
      budget: trip.budget,
      travelers: trip.groupSize,
      travelStyle: trip.travelStyle || undefined,
    },
    certainty: {
      score: feasibility?.score ?? null,
      visaRisk,
      visaType,
      bufferDays,
      accessibilityStatus: feasibility?.breakdown?.accessibility?.status,
      safetyStatus: feasibility?.breakdown?.safety?.status,
    },
    costs: {
      flights,
      stay,
      activities,
      visa,
      insurance,
      food,
      transport,
      misc,
      total,
    },
    itinerary: {
      dayCount: itinerary?.days?.length || 0,
      highlights: extractHighlights(itinerary),
      activities: countActivities(itinerary),
    },
  };
}

function calculateBufferDays(dates: string): number {
  // Parse "2026-03-04 to 2026-03-09" or similar
  try {
    const parts = dates.split(/\s+to\s+|\s+-\s+/);
    if (parts.length !== 2) return 0;
    const start = new Date(parts[0].trim());
    const end = new Date(parts[1].trim());
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    // Buffer = days beyond minimum (assume 3-day minimum trip)
    return Math.max(0, days - 3);
  } catch {
    return 0;
  }
}

function getVisaRisk(feasibility?: FeasibilityReport): "low" | "medium" | "high" {
  if (!feasibility) return "medium";
  const visaStatus = feasibility.breakdown?.visa?.status;
  const score = feasibility.score;

  if (visaStatus === "issue" || (score !== undefined && score < 50)) return "high";
  if (score !== undefined && score < 70) return "medium";
  return "low";
}

/**
 * Calculate total from parts, returns null if all parts are null
 */
function calculateTotalFromParts(parts: Money[]): Money {
  const validParts = parts.filter((p): p is number => p !== null);
  if (validParts.length === 0) return null;
  return validParts.reduce((sum, val) => sum + val, 0);
}

function extractHighlights(itinerary: any): string[] {
  if (!itinerary?.days) return [];
  const highlights: string[] = [];

  for (const day of itinerary.days) {
    if (day.highlight) highlights.push(day.highlight);
    // Also extract key activities
    for (const activity of day.activities || []) {
      if (activity.type === "landmark" || activity.type === "experience") {
        highlights.push(activity.name || activity.title || "");
      }
    }
  }

  return highlights.filter(Boolean).slice(0, 10); // Limit to top 10
}

function countActivities(itinerary: any): number {
  if (!itinerary?.days) return 0;
  return itinerary.days.reduce((sum: number, day: any) => sum + (day.activities?.length || 0), 0);
}

// ============================================================================
// COMPARISON ENGINE
// ============================================================================

/**
 * Compare two trip snapshots and generate structured diff
 */
export function comparePlans(
  tripA: TripResponse,
  tripB: TripResponse
): PlanComparison {
  const planA = extractSnapshot(tripA, "original");
  const planB = extractSnapshot(tripB, "updated");

  // Check comparability - plans must have same destination and passport
  const incomparableReasons: string[] = [];
  if (planA.inputs.destination.toLowerCase() !== planB.inputs.destination.toLowerCase()) {
    incomparableReasons.push("destinations differ");
  }
  if (planA.inputs.passport.toLowerCase() !== planB.inputs.passport.toLowerCase()) {
    incomparableReasons.push("passport countries differ");
  }
  if (planA.inputs.travelers !== planB.inputs.travelers) {
    incomparableReasons.push("traveler count differs");
  }

  const isComparable = incomparableReasons.length === 0;
  const incomparableReason = incomparableReasons.length > 0
    ? `Plans not comparable: ${incomparableReasons.join(", ")}`
    : undefined;

  // Certainty delta (null-safe)
  const certDelta = safeDelta(planA.certainty.score, planB.certainty.score);
  const certDirection: "improved" | "worsened" | "same" | "unavailable" =
    certDelta === null ? "unavailable" :
    certDelta > 0 ? "improved" :
    certDelta < 0 ? "worsened" : "same";

  const certaintyDelta = {
    scoreBefore: planA.certainty.score,
    scoreAfter: planB.certainty.score,
    delta: certDelta,
    direction: certDirection,
    visaRiskBefore: planA.certainty.visaRisk,
    visaRiskAfter: planB.certainty.visaRisk,
    bufferDaysBefore: planA.certainty.bufferDays,
    bufferDaysAfter: planB.certainty.bufferDays,
    bufferDelta: planB.certainty.bufferDays - planA.certainty.bufferDays,
  };

  // Cost deltas (null-safe)
  const costCategories = ["flights", "stay", "activities", "visa", "insurance", "food", "transport", "misc"] as const;
  const costDeltas: CostDelta[] = costCategories.map((cat) => {
    const before = planA.costs[cat];
    const after = planB.costs[cat];
    const delta = safeDelta(before, after);
    const direction: "up" | "down" | "same" | "unavailable" =
      delta === null ? "unavailable" :
      delta > 0 ? "up" :
      delta < 0 ? "down" : "same";
    return {
      category: formatCategoryName(cat),
      before,
      after,
      delta,
      direction,
    };
  }).filter(d => d.before !== null || d.after !== null); // Show if either value exists

  const totalDelta = safeDelta(planA.costs.total, planB.costs.total);
  const totalCostDelta = {
    before: planA.costs.total,
    after: planB.costs.total,
    delta: totalDelta,
    percentChange: (planA.costs.total !== null && planA.costs.total > 0 && totalDelta !== null)
      ? Math.round((totalDelta / planA.costs.total) * 100)
      : null,
    direction: (totalDelta === null ? "unavailable" :
      totalDelta > 0 ? "up" :
      totalDelta < 0 ? "down" : "same") as "up" | "down" | "same" | "unavailable",
  };

  // Itinerary changes
  const addedHighlights = planB.itinerary.highlights.filter(h => !planA.itinerary.highlights.includes(h));
  const removedHighlights = planA.itinerary.highlights.filter(h => !planB.itinerary.highlights.includes(h));

  const itineraryChanges = {
    dayCountBefore: planA.itinerary.dayCount,
    dayCountAfter: planB.itinerary.dayCount,
    changedDays: [], // Would need detailed day comparison - skipped for MVP
    addedHighlights,
    removedHighlights,
  };

  // Generate recommendation (skip if not comparable)
  const recommendation = isComparable
    ? generateRecommendation(planA, planB, certaintyDelta, totalCostDelta)
    : {
        preferred: "neutral" as const,
        confidence: "low" as const,
        reason: incomparableReason || "Plans cannot be compared.",
        tradeoffSummary: "N/A",
      };

  return {
    planA,
    planB,
    isComparable,
    incomparableReason,
    certaintyDelta,
    costDeltas,
    totalCostDelta,
    itineraryChanges,
    recommendation,
  };
}

function formatCategoryName(cat: string): string {
  const names: Record<string, string> = {
    flights: "Flights",
    stay: "Accommodation",
    activities: "Activities",
    visa: "Visa",
    insurance: "Insurance",
    food: "Food & Dining",
    transport: "Local Transport",
    misc: "Miscellaneous",
  };
  return names[cat] || cat;
}

// ============================================================================
// RECOMMENDATION ENGINE
// ============================================================================

interface RecommendationInput {
  certDelta: number | null;
  costDelta: number | null;
  costPercent: number | null;
  visaImproved: boolean;
  bufferImproved: boolean;
  // Track what data is available for renormalization
  hasCertainty: boolean;
  hasCost: boolean;
}

function generateRecommendation(
  planA: PlanSnapshot,
  planB: PlanSnapshot,
  certaintyDelta: PlanComparison["certaintyDelta"],
  costDelta: PlanComparison["totalCostDelta"]
): PlanComparison["recommendation"] {
  const hasCertainty = certaintyDelta.delta !== null;
  const hasCost = costDelta.delta !== null;

  const input: RecommendationInput = {
    certDelta: certaintyDelta.delta,
    costDelta: costDelta.delta,
    costPercent: costDelta.percentChange,
    visaImproved: getVisaRiskScore(certaintyDelta.visaRiskAfter) < getVisaRiskScore(certaintyDelta.visaRiskBefore),
    bufferImproved: certaintyDelta.bufferDelta > 0,
    hasCertainty,
    hasCost,
  };

  // Base weights (will be renormalized if data missing)
  let certaintyWeight = 0.5;
  let costWeight = 0.3;
  const visaWeight = 0.15;
  const bufferWeight = 0.05;

  // Renormalize weights if data is missing
  // Skip categories with missing data, redistribute weight to available categories
  if (!hasCertainty && !hasCost) {
    // Only visa and buffer available - adjust weights
    // visaWeight stays 0.15, bufferWeight stays 0.05, total = 0.2
    // Scale up: visa = 0.75, buffer = 0.25
    certaintyWeight = 0;
    costWeight = 0;
  } else if (!hasCertainty) {
    // Cost available, certainty missing - give certainty weight to cost
    costWeight = 0.5;
    certaintyWeight = 0;
  } else if (!hasCost) {
    // Certainty available, cost missing - give cost weight to certainty
    certaintyWeight = 0.6;
    costWeight = 0;
  }

  let score = 0;

  // Certainty: +1 per 5 points improvement (if available)
  if (hasCertainty && input.certDelta !== null) {
    score += (input.certDelta / 5) * certaintyWeight;
  }

  // Cost: -1 per 10% increase, +1 per 10% decrease (if available)
  if (hasCost && input.costPercent !== null) {
    score += (-input.costPercent / 10) * costWeight;
  }

  // Visa improvement: +0.5
  if (input.visaImproved) score += 0.5 * visaWeight;

  // Buffer improvement: +0.3
  if (input.bufferImproved) score += 0.3 * bufferWeight;

  // Determine preference
  let preferred: "A" | "B" | "neutral";
  let confidence: "high" | "medium" | "low";

  // Lower confidence if major data is missing
  const dataQuality = hasCertainty && hasCost ? "full" : (hasCertainty || hasCost) ? "partial" : "minimal";

  if (score > 0.3) {
    preferred = "B";
    confidence = dataQuality === "full" ? (score > 0.6 ? "high" : "medium") : "low";
  } else if (score < -0.3) {
    preferred = "A";
    confidence = dataQuality === "full" ? (score < -0.6 ? "high" : "medium") : "low";
  } else {
    preferred = "neutral";
    confidence = "low";
  }

  // Generate reason and tradeoff summary
  const reason = generateReasonText(preferred, input, certaintyDelta, costDelta);
  const tradeoffSummary = generateTradeoffText(input, costDelta);

  return {
    preferred,
    confidence,
    reason,
    tradeoffSummary,
  };
}

function getVisaRiskScore(risk: string): number {
  if (risk === "high") return 3;
  if (risk === "medium") return 2;
  return 1;
}

function generateReasonText(
  preferred: "A" | "B" | "neutral",
  input: RecommendationInput,
  certaintyDelta: PlanComparison["certaintyDelta"],
  costDelta: PlanComparison["totalCostDelta"]
): string {
  // Add data quality warning if needed
  const missingParts: string[] = [];
  if (!input.hasCertainty) missingParts.push("certainty");
  if (!input.hasCost) missingParts.push("cost");
  const dataWarning = missingParts.length > 0
    ? ` (${missingParts.join(" and ")} data unavailable)`
    : "";

  if (preferred === "B") {
    const improvements: string[] = [];
    if (input.certDelta !== null && input.certDelta > 0) {
      improvements.push(`+${input.certDelta}% certainty`);
    }
    if (input.visaImproved) improvements.push("lower visa risk");
    if (input.bufferImproved) improvements.push("more buffer days");

    if (improvements.length === 0) {
      return `Updated plan is recommended based on overall improvements${dataWarning}.`;
    }

    let costNote = "";
    if (input.costDelta !== null) {
      costNote = input.costDelta > 0
        ? ` (costs $${Math.abs(input.costDelta).toLocaleString()} more)`
        : input.costDelta < 0
          ? ` (saves $${Math.abs(input.costDelta).toLocaleString()})`
          : "";
    }

    return `Updated plan offers ${improvements.join(", ")}${costNote}${dataWarning}.`;
  }

  if (preferred === "A") {
    const reasons: string[] = [];
    if (input.certDelta !== null && input.certDelta < 0) {
      reasons.push(`maintains ${Math.abs(input.certDelta)}% higher certainty`);
    }
    if (input.costDelta !== null && input.costDelta > 0) {
      reasons.push(`saves $${input.costDelta.toLocaleString()}`);
    }

    return `Original plan ${reasons.join(" and ") || "is recommended"}${dataWarning}.`;
  }

  return `Both plans are comparable. Choose based on your priorities${dataWarning}.`;
}

function generateTradeoffText(
  input: RecommendationInput,
  costDelta: PlanComparison["totalCostDelta"]
): string {
  const parts: string[] = [];

  if (input.certDelta !== null && input.certDelta !== 0) {
    const dir = input.certDelta > 0 ? "improves" : "reduces";
    parts.push(`${dir} certainty by ${Math.abs(input.certDelta)}%`);
  } else if (!input.hasCertainty) {
    parts.push("certainty data unavailable");
  }

  if (costDelta.delta !== null && costDelta.delta !== 0) {
    const dir = costDelta.delta > 0 ? "costs" : "saves";
    parts.push(`${dir} $${Math.abs(costDelta.delta).toLocaleString()}`);
  } else if (!input.hasCost) {
    parts.push("cost data unavailable");
  }

  if (input.visaImproved) {
    parts.push("lowers visa risk");
  }

  if (parts.length === 0) return "No significant tradeoffs.";

  return `Updated plan ${parts.join(", ")}.`;
}

// ============================================================================
// QUICK COMPARE FROM DELTA SUMMARY
// ============================================================================

/**
 * Generate a quick comparison from an existing DeltaSummary
 * (for use with ChangePlannerResponse without needing full trip data)
 */
export function compareFromDelta(
  deltaSummary: DeltaSummary,
  originalTrip: TripResponse
): Partial<PlanComparison> {
  const certDelta = deltaSummary.certainty.after - deltaSummary.certainty.before;
  const costDelta = deltaSummary.totalCost.delta;

  return {
    certaintyDelta: {
      scoreBefore: deltaSummary.certainty.before,
      scoreAfter: deltaSummary.certainty.after,
      delta: certDelta,
      direction: certDelta > 0 ? "improved" : certDelta < 0 ? "worsened" : "same",
      visaRiskBefore: "medium", // Not available in delta
      visaRiskAfter: "medium",
      bufferDaysBefore: 0,
      bufferDaysAfter: 0,
      bufferDelta: 0,
    },
    totalCostDelta: {
      before: deltaSummary.totalCost.before,
      after: deltaSummary.totalCost.after,
      delta: costDelta,
      percentChange: deltaSummary.totalCost.before > 0
        ? Math.round((costDelta / deltaSummary.totalCost.before) * 100)
        : 0,
      direction: costDelta > 0 ? "up" : costDelta < 0 ? "down" : "same",
    },
    recommendation: {
      preferred: certDelta > 5 ? "B" : certDelta < -5 ? "A" : "neutral",
      confidence: Math.abs(certDelta) > 10 ? "high" : "medium",
      reason: deltaSummary.certainty.reason,
      tradeoffSummary: `Certainty ${certDelta >= 0 ? "+" : ""}${certDelta}%, Cost ${costDelta >= 0 ? "+" : ""}$${costDelta.toLocaleString()}`,
    },
  };
}
