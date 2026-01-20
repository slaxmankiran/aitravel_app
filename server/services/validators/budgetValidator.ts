/**
 * Budget Validator (The Bursar)
 *
 * Deterministic validation of itinerary costs against user budget.
 * This is NOT an AI agent - it's pure math that catches AI hallucinations.
 *
 * Key responsibilities:
 * - Sum all activity costs per day
 * - Compare against daily budget allocation
 * - Flag over-budget days with specific amounts
 * - Generate actionable suggestions for refinement
 */

import type { ItineraryDay, ItineraryActivity } from "../streamingItinerary";

// ============================================================================
// TYPES
// ============================================================================

export type BudgetStatus = 'APPROVED' | 'OVER_BUDGET' | 'NEAR_LIMIT' | 'UNDER_BUDGET';

export interface DayBudgetBreakdown {
  day: number;
  date: string;
  allocated: number;
  actual: number;
  delta: number; // positive = over budget, negative = under budget
  status: BudgetStatus;
  breakdown: {
    activities: number;
    meals: number;
    transport: number;
    lodging: number;
  };
}

export interface BudgetValidationResult {
  status: BudgetStatus;
  totalBudget: number;
  totalEstimatedCost: number;
  delta: number; // positive = over budget
  deltaPercentage: number;
  dailyAllocation: number;
  perDayBreakdown: DayBudgetBreakdown[];
  flaggedDays: number[]; // Day numbers that are over budget
  suggestions: string[];
  logs: string[]; // Director-style logs for UI
}

export interface BudgetValidatorConfig {
  /** Percentage over budget before flagging (default: 10%) */
  warningThreshold?: number;
  /** Percentage over budget before rejecting (default: 20%) */
  rejectThreshold?: number;
  /** Include accommodation in daily budget? (default: true) */
  includeAccommodation?: boolean;
  /** Buffer percentage to leave for unexpected costs (default: 10%) */
  bufferPercentage?: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_CONFIG: Required<BudgetValidatorConfig> = {
  warningThreshold: 0.10,  // 10% over = warning
  rejectThreshold: 0.20,   // 20% over = reject
  includeAccommodation: true,
  bufferPercentage: 0.10,  // Leave 10% buffer
};

// Cost category mapping
const ACTIVITY_TYPE_TO_CATEGORY: Record<ItineraryActivity['type'], keyof DayBudgetBreakdown['breakdown']> = {
  activity: 'activities',
  meal: 'meals',
  transport: 'transport',
  lodging: 'lodging',
};

// ============================================================================
// MAIN VALIDATOR
// ============================================================================

/**
 * Validate itinerary costs against user budget
 *
 * @param itinerary - Array of itinerary days with activities
 * @param totalBudget - User's total budget for the trip
 * @param numDays - Number of days in the trip
 * @param config - Optional configuration overrides
 * @returns Detailed validation result with status, breakdown, and suggestions
 */
export function validateBudget(
  itinerary: ItineraryDay[],
  totalBudget: number,
  numDays: number,
  config: BudgetValidatorConfig = {}
): BudgetValidationResult {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const logs: string[] = [];

  logs.push(`[Bursar] Starting budget validation: $${totalBudget} for ${numDays} days`);

  // Calculate daily allocation (with buffer)
  const effectiveBudget = totalBudget * (1 - cfg.bufferPercentage);
  const dailyAllocation = effectiveBudget / numDays;

  logs.push(`[Bursar] Daily allocation: $${dailyAllocation.toFixed(2)} (with ${cfg.bufferPercentage * 100}% buffer)`);

  // Calculate per-day breakdown
  const perDayBreakdown: DayBudgetBreakdown[] = [];
  let totalEstimatedCost = 0;
  const flaggedDays: number[] = [];

  for (const day of itinerary) {
    const breakdown = calculateDayBreakdown(day, dailyAllocation, cfg);
    perDayBreakdown.push(breakdown);
    totalEstimatedCost += breakdown.actual;

    if (breakdown.status === 'OVER_BUDGET') {
      flaggedDays.push(day.day);
      logs.push(`[Bursar] Day ${day.day} REJECTED: $${breakdown.actual.toFixed(2)} exceeds allocation of $${dailyAllocation.toFixed(2)} by $${breakdown.delta.toFixed(2)}`);
    } else if (breakdown.status === 'NEAR_LIMIT') {
      logs.push(`[Bursar] Day ${day.day} WARNING: $${breakdown.actual.toFixed(2)} is near limit ($${dailyAllocation.toFixed(2)})`);
    } else {
      logs.push(`[Bursar] Day ${day.day} APPROVED: $${breakdown.actual.toFixed(2)} within budget`);
    }
  }

  // Calculate overall status
  const delta = totalEstimatedCost - totalBudget;
  const deltaPercentage = totalBudget > 0 ? delta / totalBudget : 0;

  let status: BudgetStatus;
  if (deltaPercentage > cfg.rejectThreshold) {
    status = 'OVER_BUDGET';
    logs.push(`[Bursar] FINAL VERDICT: REJECTED - Total $${totalEstimatedCost.toFixed(2)} exceeds budget by ${(deltaPercentage * 100).toFixed(1)}%`);
  } else if (deltaPercentage > cfg.warningThreshold) {
    status = 'NEAR_LIMIT';
    logs.push(`[Bursar] FINAL VERDICT: WARNING - Total $${totalEstimatedCost.toFixed(2)} is ${(deltaPercentage * 100).toFixed(1)}% over budget`);
  } else if (deltaPercentage < -0.3) {
    status = 'UNDER_BUDGET';
    logs.push(`[Bursar] FINAL VERDICT: UNDER BUDGET - Only using ${((totalEstimatedCost / totalBudget) * 100).toFixed(1)}% of budget`);
  } else {
    status = 'APPROVED';
    logs.push(`[Bursar] FINAL VERDICT: APPROVED - Total $${totalEstimatedCost.toFixed(2)} within budget`);
  }

  // Generate suggestions
  const suggestions = generateBudgetSuggestions(
    flaggedDays,
    perDayBreakdown,
    totalBudget,
    totalEstimatedCost,
    status
  );

  return {
    status,
    totalBudget,
    totalEstimatedCost,
    delta,
    deltaPercentage,
    dailyAllocation,
    perDayBreakdown,
    flaggedDays,
    suggestions,
    logs,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate cost breakdown for a single day
 */
function calculateDayBreakdown(
  day: ItineraryDay,
  dailyAllocation: number,
  config: Required<BudgetValidatorConfig>
): DayBudgetBreakdown {
  const breakdown = {
    activities: 0,
    meals: 0,
    transport: 0,
    lodging: 0,
  };

  // Sum activity costs by category
  for (const activity of day.activities) {
    const cost = activity.estimatedCost || 0;
    const category = ACTIVITY_TYPE_TO_CATEGORY[activity.type] || 'activities';
    breakdown[category] += cost;
  }

  // Add local food costs if present
  if (day.localFood) {
    for (const food of day.localFood) {
      breakdown.meals += food.estimatedCost || 0;
    }
  }

  // Calculate total (optionally excluding accommodation)
  let actual = breakdown.activities + breakdown.meals + breakdown.transport;
  if (config.includeAccommodation) {
    actual += breakdown.lodging;
  }

  const delta = actual - dailyAllocation;
  const deltaPercentage = dailyAllocation > 0 ? delta / dailyAllocation : 0;

  let status: BudgetStatus;
  if (deltaPercentage > config.rejectThreshold) {
    status = 'OVER_BUDGET';
  } else if (deltaPercentage > config.warningThreshold) {
    status = 'NEAR_LIMIT';
  } else if (deltaPercentage < -0.3) {
    status = 'UNDER_BUDGET';
  } else {
    status = 'APPROVED';
  }

  return {
    day: day.day,
    date: day.date,
    allocated: dailyAllocation,
    actual,
    delta,
    status,
    breakdown,
  };
}

/**
 * Generate actionable suggestions for budget issues
 */
function generateBudgetSuggestions(
  flaggedDays: number[],
  perDayBreakdown: DayBudgetBreakdown[],
  totalBudget: number,
  totalCost: number,
  status: BudgetStatus
): string[] {
  const suggestions: string[] = [];

  if (status === 'APPROVED') {
    return ['Budget looks good! No changes needed.'];
  }

  if (status === 'UNDER_BUDGET') {
    const unused = totalBudget - totalCost;
    suggestions.push(`You have $${unused.toFixed(0)} unused - consider adding premium experiences.`);
    return suggestions;
  }

  // Analyze which categories are driving costs
  const categoryTotals = {
    activities: 0,
    meals: 0,
    transport: 0,
    lodging: 0,
  };

  for (const day of perDayBreakdown) {
    categoryTotals.activities += day.breakdown.activities;
    categoryTotals.meals += day.breakdown.meals;
    categoryTotals.transport += day.breakdown.transport;
    categoryTotals.lodging += day.breakdown.lodging;
  }

  // Find the dominant cost category
  const sortedCategories = Object.entries(categoryTotals)
    .sort(([, a], [, b]) => b - a);

  const [topCategory, topAmount] = sortedCategories[0];
  const overAmount = totalCost - totalBudget;

  // Generate specific suggestions
  if (flaggedDays.length > 0) {
    suggestions.push(`Reduce costs on Day${flaggedDays.length > 1 ? 's' : ''} ${flaggedDays.join(', ')}.`);
  }

  if (topCategory === 'activities' && topAmount > overAmount) {
    suggestions.push(`Consider free alternatives for some activities (-$${Math.min(topAmount * 0.3, overAmount).toFixed(0)} potential savings).`);
  }

  if (topCategory === 'meals' && topAmount > overAmount * 0.5) {
    suggestions.push(`Switch some restaurant meals to local street food (-$${Math.min(topAmount * 0.4, overAmount).toFixed(0)} potential savings).`);
  }

  if (topCategory === 'lodging' && topAmount > overAmount) {
    suggestions.push(`Consider budget accommodations or hostels (-$${Math.min(topAmount * 0.5, overAmount).toFixed(0)} potential savings).`);
  }

  if (topCategory === 'transport' && topAmount > overAmount * 0.3) {
    suggestions.push(`Use public transit instead of taxis/rideshare (-$${Math.min(topAmount * 0.6, overAmount).toFixed(0)} potential savings).`);
  }

  // General suggestions
  if (overAmount > totalBudget * 0.3) {
    suggestions.push(`Consider reducing trip length by 1 day to stay within budget.`);
  }

  return suggestions;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Quick check if itinerary is within budget (no detailed breakdown)
 */
export function isWithinBudget(
  itinerary: ItineraryDay[],
  totalBudget: number,
  threshold: number = 0.2
): boolean {
  let total = 0;
  for (const day of itinerary) {
    for (const activity of day.activities) {
      total += activity.estimatedCost || 0;
    }
    if (day.localFood) {
      for (const food of day.localFood) {
        total += food.estimatedCost || 0;
      }
    }
  }
  return total <= totalBudget * (1 + threshold);
}

/**
 * Calculate total itinerary cost
 */
export function calculateTotalCost(itinerary: ItineraryDay[]): number {
  let total = 0;
  for (const day of itinerary) {
    for (const activity of day.activities) {
      total += activity.estimatedCost || 0;
    }
    if (day.localFood) {
      for (const food of day.localFood) {
        total += food.estimatedCost || 0;
      }
    }
  }
  return total;
}

/**
 * Format budget validation result for AI feedback prompt
 */
export function formatBudgetFeedback(result: BudgetValidationResult): string {
  if (result.status === 'APPROVED') {
    return '';
  }

  const lines: string[] = [
    `BUDGET VALIDATION FAILED:`,
    `- Total estimated cost: $${result.totalEstimatedCost.toFixed(2)}`,
    `- User budget: $${result.totalBudget.toFixed(2)}`,
    `- Over by: $${result.delta.toFixed(2)} (${(result.deltaPercentage * 100).toFixed(1)}%)`,
  ];

  if (result.flaggedDays.length > 0) {
    lines.push(`- Problem days: ${result.flaggedDays.join(', ')}`);

    for (const dayNum of result.flaggedDays) {
      const day = result.perDayBreakdown.find(d => d.day === dayNum);
      if (day) {
        lines.push(`  - Day ${dayNum}: $${day.actual.toFixed(2)} (should be ≤$${day.allocated.toFixed(2)})`);
      }
    }
  }

  lines.push(`REQUIRED: Reduce costs to stay within $${result.totalBudget.toFixed(2)} total.`);
  lines.push(`SUGGESTIONS: ${result.suggestions.join(' ')}`);

  return lines.join('\n');
}
