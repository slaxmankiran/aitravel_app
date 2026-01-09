/**
 * nextFix.ts
 *
 * Item 16: Auto-suggest next fix
 * Deterministic rule engine that suggests the next improvement action
 * based on comparison signals (certainty, cost, visa risk, buffer days).
 *
 * No AI calls - uses pre-computed comparison data from comparePlans.ts
 */

import type { PlanComparison } from "./comparePlans";
import type { TripResponse } from "@shared/schema";

// ============================================================================
// TYPES
// ============================================================================

export type FixId =
  | "ADD_BUFFER_DAYS"
  | "REDUCE_COST"
  | "LOWER_VISA_RISK"
  | "SIMPLIFY_ITINERARY"
  | "IMPROVE_CERTAINTY"
  | "REFRESH_PRICING"
  | "SAVE_VERSION"
  | "REVERT_CHANGE";

export type ActionType = "OPEN_EDITOR" | "APPLY_PATCH" | "TRIGGER_FLOW";

export type EditorTarget =
  | "dates"
  | "budget"
  | "hotels"
  | "flights"
  | "itinerary"
  | "visa_docs"
  | "save";

export interface NextFixSuggestion {
  id: FixId;
  title: string;
  reason: string;
  impact: {
    certaintyPoints?: number;
    costDelta?: number;
    bufferDays?: number;
  };
  ctaLabel: string;
  action: {
    type: ActionType;
    payload: {
      editor?: EditorTarget;
      patch?: Record<string, unknown>;
      flow?: string;
    };
  };
  confidence: "high" | "medium" | "low";
}

export interface NextFixContext {
  trip: TripResponse;
}

// ============================================================================
// THRESHOLDS (tunable)
// ============================================================================

const THRESHOLDS = {
  // Buffer days considered too low
  MIN_SAFE_BUFFER_DAYS: 5,
  // Buffer days considered critical (high confidence)
  CRITICAL_BUFFER_DAYS: 3,

  // Cost increase that warrants a suggestion (in dollars)
  MATERIAL_COST_INCREASE: 150,
  // Cost increase that warrants high confidence
  HIGH_COST_INCREASE: 300,

  // Certainty drop that warrants a suggestion (in points)
  MATERIAL_CERTAINTY_DROP: 5,
  // Certainty drop that warrants high confidence
  HIGH_CERTAINTY_DROP: 10,

  // Cost category delta to be considered dominant (percentage of total delta)
  DOMINANT_CATEGORY_RATIO: 0.4,
};

/**
 * Determine confidence level based on severity of the issue
 *
 * High: visa risk high, bufferDays < 3, cost increase > $300, certainty drop > 10%
 * Medium: moderate thresholds
 * Low: neutral suggestion, missing data, or generic fixes
 */
function determineConfidence(
  visaRisk: "low" | "medium" | "high",
  bufferDays: number,
  costDelta: number | null,
  certaintyDelta: number | null
): "high" | "medium" | "low" {
  // High confidence triggers
  if (visaRisk === "high") return "high";
  if (bufferDays < THRESHOLDS.CRITICAL_BUFFER_DAYS) return "high";
  if (costDelta !== null && costDelta > THRESHOLDS.HIGH_COST_INCREASE) return "high";
  if (certaintyDelta !== null && certaintyDelta < -THRESHOLDS.HIGH_CERTAINTY_DROP) return "high";

  // Medium confidence triggers
  if (visaRisk === "medium") return "medium";
  if (bufferDays < THRESHOLDS.MIN_SAFE_BUFFER_DAYS) return "medium";
  if (costDelta !== null && costDelta > THRESHOLDS.MATERIAL_COST_INCREASE) return "medium";
  if (certaintyDelta !== null && certaintyDelta < -THRESHOLDS.MATERIAL_CERTAINTY_DROP) return "medium";

  // Low confidence for everything else
  return "low";
}

// ============================================================================
// RULE ENGINE
// ============================================================================

/**
 * Suggest the next fix based on comparison signals.
 * Returns null if no actionable suggestion.
 *
 * Priority order (first match wins):
 * 1. Visa risk high or buffer days low
 * 2. Total cost increased materially
 * 3. Certainty dropped
 * 4. Missing cost data
 * 5. Neutral (save version)
 */
export function suggestNextFix(
  comparison: PlanComparison | null,
  context: NextFixContext
): NextFixSuggestion | null {
  // Guard: no comparison data
  if (!comparison) {
    return null;
  }

  // Guard: plans not comparable - suggest revert
  if (!comparison.isComparable) {
    return createRevertSuggestion(comparison.incomparableReason);
  }

  const { certaintyDelta, totalCostDelta, costDeltas, planB } = comparison;

  // Rule 1: Visa risk high or buffer days low
  const bufferSuggestion = checkBufferDaysRule(certaintyDelta, planB);
  if (bufferSuggestion) return bufferSuggestion;

  // Rule 2: Total cost increased materially
  const costSuggestion = checkCostIncreaseRule(totalCostDelta, costDeltas);
  if (costSuggestion) return costSuggestion;

  // Rule 3: Certainty dropped
  const certaintySuggestion = checkCertaintyDropRule(certaintyDelta);
  if (certaintySuggestion) return certaintySuggestion;

  // Rule 4: Missing cost data
  const missingDataSuggestion = checkMissingDataRule(totalCostDelta);
  if (missingDataSuggestion) return missingDataSuggestion;

  // Rule 5: Neutral - everything is stable
  return createSaveVersionSuggestion();
}

// ============================================================================
// RULE IMPLEMENTATIONS
// ============================================================================

/**
 * Rule 1: Check if buffer days are low or visa risk is high
 */
function checkBufferDaysRule(
  certaintyDelta: PlanComparison["certaintyDelta"],
  planB: PlanComparison["planB"]
): NextFixSuggestion | null {
  const currentBuffer = certaintyDelta.bufferDaysAfter;
  const visaRisk = certaintyDelta.visaRiskAfter;

  // High visa risk
  if (visaRisk === "high") {
    const suggestedDays = Math.max(3, THRESHOLDS.MIN_SAFE_BUFFER_DAYS - currentBuffer);
    return {
      id: "ADD_BUFFER_DAYS",
      title: `Add ${suggestedDays} buffer days to reduce visa risk`,
      reason: "High visa risk detected. Adding buffer days improves approval chances and reduces stress.",
      impact: {
        bufferDays: suggestedDays,
        certaintyPoints: 5 + suggestedDays, // Rough estimate
      },
      ctaLabel: "Extend trip",
      action: {
        type: "OPEN_EDITOR",
        payload: { editor: "dates" },
      },
      confidence: determineConfidence(visaRisk, currentBuffer, null, certaintyDelta.delta),
    };
  }

  // Low buffer days
  if (currentBuffer < THRESHOLDS.MIN_SAFE_BUFFER_DAYS) {
    const suggestedDays = THRESHOLDS.MIN_SAFE_BUFFER_DAYS - currentBuffer;
    return {
      id: "ADD_BUFFER_DAYS",
      title: `Add ${suggestedDays} more days for safety buffer`,
      reason: `Only ${currentBuffer} buffer days. Adding more time reduces risk if plans change.`,
      impact: {
        bufferDays: suggestedDays,
        certaintyPoints: suggestedDays * 2,
      },
      ctaLabel: "Adjust dates",
      action: {
        type: "OPEN_EDITOR",
        payload: { editor: "dates" },
      },
      confidence: "medium",
    };
  }

  return null;
}

/**
 * Rule 2: Check if total cost increased materially
 */
function checkCostIncreaseRule(
  totalCostDelta: PlanComparison["totalCostDelta"],
  costDeltas: PlanComparison["costDeltas"]
): NextFixSuggestion | null {
  const delta = totalCostDelta.delta;

  // Skip if delta unavailable or not a material increase
  if (delta === null || delta <= THRESHOLDS.MATERIAL_COST_INCREASE) {
    return null;
  }

  // Find the dominant cost category
  const dominantCategory = findDominantCostCategory(costDeltas, delta);

  // Determine confidence based on cost delta
  const costConfidence = determineConfidence("low", 10, delta, null);

  if (dominantCategory) {
    const { category, delta: catDelta } = dominantCategory;
    const editorTarget = mapCategoryToEditor(category);

    return {
      id: "REDUCE_COST",
      title: `Reduce ${category.toLowerCase()} cost`,
      reason: `${category} increased by $${catDelta?.toLocaleString() ?? "N/A"}, driving up total cost.`,
      impact: {
        costDelta: catDelta ? -catDelta : undefined,
      },
      ctaLabel: `Review ${category.toLowerCase()}`,
      action: {
        type: "OPEN_EDITOR",
        payload: { editor: editorTarget },
      },
      confidence: costConfidence,
    };
  }

  // Generic cost reduction
  return {
    id: "REDUCE_COST",
    title: "Review budget to reduce costs",
    reason: `Total cost increased by $${delta.toLocaleString()}. Review options to stay within budget.`,
    impact: {
      costDelta: -delta,
    },
    ctaLabel: "Review budget",
    action: {
      type: "OPEN_EDITOR",
      payload: { editor: "budget" },
    },
    confidence: costConfidence === "high" ? "medium" : "low", // Downgrade generic suggestions
  };
}

/**
 * Find the cost category that dominates the total delta
 */
function findDominantCostCategory(
  costDeltas: PlanComparison["costDeltas"],
  totalDelta: number
): { category: string; delta: number | null } | null {
  if (totalDelta === 0) return null;

  for (const cd of costDeltas) {
    if (cd.delta !== null && cd.delta > 0) {
      const ratio = cd.delta / totalDelta;
      if (ratio >= THRESHOLDS.DOMINANT_CATEGORY_RATIO) {
        return { category: cd.category, delta: cd.delta };
      }
    }
  }

  return null;
}

/**
 * Map cost category name to editor target
 */
function mapCategoryToEditor(category: string): EditorTarget {
  const map: Record<string, EditorTarget> = {
    "Flights": "flights",
    "Accommodation": "hotels",
    "Activities": "itinerary",
    "Food & Dining": "budget",
    "Local Transport": "budget",
    "Visa": "visa_docs",
    "Insurance": "budget",
    "Miscellaneous": "budget",
  };
  return map[category] || "budget";
}

/**
 * Rule 3: Check if certainty dropped
 */
function checkCertaintyDropRule(
  certaintyDelta: PlanComparison["certaintyDelta"]
): NextFixSuggestion | null {
  const delta = certaintyDelta.delta;

  // Skip if unavailable or not a material drop
  if (delta === null || delta >= -THRESHOLDS.MATERIAL_CERTAINTY_DROP) {
    return null;
  }

  const absDelta = Math.abs(delta);
  const visaRisk = certaintyDelta.visaRiskAfter as "low" | "medium" | "high";
  const bufferDays = certaintyDelta.bufferDaysAfter;

  // Determine base confidence from severity
  const baseConfidence = determineConfidence(visaRisk, bufferDays, null, delta);

  // Check if visa risk worsened
  if (certaintyDelta.visaRiskAfter === "high" && certaintyDelta.visaRiskBefore !== "high") {
    return {
      id: "LOWER_VISA_RISK",
      title: "Address increased visa risk",
      reason: `Certainty dropped ${absDelta}% due to higher visa risk.`,
      impact: {
        certaintyPoints: absDelta,
      },
      ctaLabel: "Review visa",
      action: {
        type: "OPEN_EDITOR",
        payload: { editor: "visa_docs" },
      },
      confidence: baseConfidence,
    };
  }

  // Check if buffer days reduced
  if (certaintyDelta.bufferDelta < 0) {
    return {
      id: "ADD_BUFFER_DAYS",
      title: "Restore buffer days",
      reason: `Certainty dropped ${absDelta}% partly due to fewer buffer days.`,
      impact: {
        certaintyPoints: absDelta,
        bufferDays: Math.abs(certaintyDelta.bufferDelta),
      },
      ctaLabel: "Adjust dates",
      action: {
        type: "OPEN_EDITOR",
        payload: { editor: "dates" },
      },
      confidence: baseConfidence === "high" ? "high" : "medium",
    };
  }

  // Generic certainty improvement
  return {
    id: "IMPROVE_CERTAINTY",
    title: "Simplify itinerary to improve certainty",
    reason: `Certainty dropped ${absDelta}%. A simpler plan may be more reliable.`,
    impact: {
      certaintyPoints: Math.round(absDelta * 0.7),
    },
    ctaLabel: "Review itinerary",
    action: {
      type: "OPEN_EDITOR",
      payload: { editor: "itinerary" },
    },
    confidence: "low",
  };
}

/**
 * Rule 4: Check if cost data is missing
 */
function checkMissingDataRule(
  totalCostDelta: PlanComparison["totalCostDelta"]
): NextFixSuggestion | null {
  if (totalCostDelta.direction !== "unavailable") {
    return null;
  }

  return {
    id: "REFRESH_PRICING",
    title: "Refresh pricing for accurate comparison",
    reason: "Cost data is unavailable. Refresh to see accurate cost comparison.",
    impact: {},
    ctaLabel: "Refresh prices",
    action: {
      type: "TRIGGER_FLOW",
      payload: { flow: "refresh_pricing" },
    },
    confidence: "medium",
  };
}

/**
 * Rule 5: Create neutral save suggestion
 */
function createSaveVersionSuggestion(): NextFixSuggestion {
  return {
    id: "SAVE_VERSION",
    title: "Looking good! Save this version",
    reason: "No major issues detected. Save to preserve this plan.",
    impact: {},
    ctaLabel: "Save trip",
    action: {
      type: "TRIGGER_FLOW",
      payload: { flow: "save_trip" },
    },
    confidence: "low",
  };
}

/**
 * Create suggestion to revert incompatible change
 */
function createRevertSuggestion(reason?: string): NextFixSuggestion {
  return {
    id: "REVERT_CHANGE",
    title: "Revert to compare accurately",
    reason: reason || "Plans cannot be compared due to fundamental differences.",
    impact: {},
    ctaLabel: "Undo change",
    action: {
      type: "TRIGGER_FLOW",
      payload: { flow: "undo_change" },
    },
    confidence: "medium",
  };
}

// ============================================================================
// UTILITY EXPORTS
// ============================================================================

/**
 * Get a short description for analytics
 */
export function getSuggestionAnalyticsData(suggestion: NextFixSuggestion | null): Record<string, unknown> {
  if (!suggestion) {
    return { suggestionId: null, suggestionShown: false };
  }

  return {
    suggestionId: suggestion.id,
    suggestionShown: true,
    suggestionTitle: suggestion.title,
    suggestionConfidence: suggestion.confidence,
    actionType: suggestion.action.type,
  };
}
