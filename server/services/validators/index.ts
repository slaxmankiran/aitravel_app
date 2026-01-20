/**
 * Validators Index
 *
 * Export all deterministic validators for the Director pattern.
 * These validators replace AI agents for budget and logistics checking.
 *
 * Usage:
 *   import { validateItinerary, validateBudget, validateLogistics } from './validators';
 *
 *   const result = validateItinerary(itinerary, budget, numDays, groupProfile);
 *   if (result.status === 'REJECTED') {
 *     // Pass result.feedback to AI for refinement
 *   }
 */

// Budget Validator (The Bursar)
export {
  validateBudget,
  isWithinBudget,
  calculateTotalCost,
  formatBudgetFeedback,
  type BudgetStatus,
  type BudgetValidationResult,
  type BudgetValidatorConfig,
  type DayBudgetBreakdown,
} from './budgetValidator';

// Logistics Validator (The Logistician)
export {
  validateLogistics,
  isLogisticallyFeasible,
  formatLogisticsFeedback,
  getTimeSlot,
  type LogisticsStatus,
  type LogisticsValidationResult,
  type LogisticsValidatorConfig,
  type LogisticsConflict,
  type ConflictType,
  type DayLogistics,
  type GroupProfile,
} from './logisticsValidator';

// ============================================================================
// COMBINED VALIDATION
// ============================================================================

import type { ItineraryDay } from '../streamingItinerary';
import { validateBudget, formatBudgetFeedback, type BudgetValidationResult } from './budgetValidator';
import { validateLogistics, formatLogisticsFeedback, type LogisticsValidationResult, type GroupProfile } from './logisticsValidator';

export type OverallValidationStatus = 'APPROVED' | 'REJECTED' | 'WARNING';

export interface CombinedValidationResult {
  status: OverallValidationStatus;
  budget: BudgetValidationResult;
  logistics: LogisticsValidationResult;
  flaggedDays: number[];
  feedback: string;
  logs: string[];
  metadata: {
    budgetVerified: boolean;
    logisticsVerified: boolean;
    totalIssues: number;
    refinementRequired: boolean;
  };
}

export interface ValidationInput {
  itinerary: ItineraryDay[];
  totalBudget: number;
  numDays: number;
  groupProfile?: GroupProfile;
}

/**
 * Combined validation function - runs both budget and logistics validators
 *
 * This is the main entry point for the Director pattern validation loop.
 *
 * @param input - Itinerary and constraints to validate
 * @returns Combined validation result with feedback for AI refinement
 */
export async function validateItinerary(input: ValidationInput): Promise<CombinedValidationResult> {
  const {
    itinerary,
    totalBudget,
    numDays,
    groupProfile = { hasToddler: false, hasElderly: false, hasMobilityIssues: false, groupSize: 2 },
  } = input;

  const logs: string[] = [];
  logs.push(`[Director] Starting combined validation for ${itinerary.length} days`);

  // Run validators in parallel (they're independent)
  const [budgetResult, logisticsResult] = await Promise.all([
    Promise.resolve(validateBudget(itinerary, totalBudget, numDays)),
    Promise.resolve(validateLogistics(itinerary, groupProfile)),
  ]);

  // Merge logs
  logs.push(...budgetResult.logs);
  logs.push(...logisticsResult.logs);

  // Determine overall status
  let status: OverallValidationStatus;
  const budgetOk = budgetResult.status === 'APPROVED' || budgetResult.status === 'UNDER_BUDGET';
  const logisticsOk = logisticsResult.status === 'APPROVED' || logisticsResult.status === 'RELAXED';

  if (budgetOk && logisticsOk) {
    status = 'APPROVED';
    logs.push(`[Director] FINAL: APPROVED - Both budget and logistics validated`);
  } else if (budgetResult.status === 'OVER_BUDGET' || logisticsResult.status === 'IMPOSSIBLE') {
    status = 'REJECTED';
    logs.push(`[Director] FINAL: REJECTED - Critical validation failures detected`);
  } else {
    status = 'WARNING';
    logs.push(`[Director] FINAL: WARNING - Minor issues detected, may need refinement`);
  }

  // Combine flagged days (deduplicated)
  const flaggedDaysSet = new Set<number>();
  budgetResult.flaggedDays.forEach(d => flaggedDaysSet.add(d));
  logisticsResult.flaggedDays.forEach(d => flaggedDaysSet.add(d));
  const flaggedDays = Array.from(flaggedDaysSet).sort((a, b) => a - b);

  // Build feedback for AI refinement
  const feedbackParts: string[] = [];

  const budgetFeedback = formatBudgetFeedback(budgetResult);
  if (budgetFeedback) {
    feedbackParts.push(budgetFeedback);
  }

  const logisticsFeedback = formatLogisticsFeedback(logisticsResult);
  if (logisticsFeedback) {
    feedbackParts.push(logisticsFeedback);
  }

  const feedback = feedbackParts.length > 0
    ? `VALIDATION FEEDBACK:\n\n${feedbackParts.join('\n\n')}`
    : '';

  return {
    status,
    budget: budgetResult,
    logistics: logisticsResult,
    flaggedDays,
    feedback,
    logs,
    metadata: {
      budgetVerified: budgetOk,
      logisticsVerified: logisticsOk,
      totalIssues: budgetResult.flaggedDays.length + logisticsResult.totalConflicts,
      refinementRequired: status !== 'APPROVED',
    },
  };
}

/**
 * Quick combined check (no detailed breakdown)
 */
export function isItineraryValid(
  itinerary: ItineraryDay[],
  totalBudget: number,
  groupProfile?: GroupProfile
): boolean {
  const budgetOk = validateBudget(itinerary, totalBudget, itinerary.length);
  const logisticsOk = validateLogistics(itinerary, groupProfile);

  return (
    (budgetOk.status === 'APPROVED' || budgetOk.status === 'UNDER_BUDGET') &&
    (logisticsOk.status === 'APPROVED' || logisticsOk.status === 'RELAXED')
  );
}

/**
 * Build a refinement prompt for the AI based on validation failures
 */
export function buildRefinementPrompt(
  validationResult: CombinedValidationResult,
  iteration: number
): string {
  if (validationResult.status === 'APPROVED') {
    return '';
  }

  const lines: string[] = [
    `--- REFINEMENT REQUIRED (Attempt ${iteration}) ---`,
    '',
    validationResult.feedback,
    '',
    `Days requiring changes: ${validationResult.flaggedDays.join(', ')}`,
    '',
    'INSTRUCTIONS:',
    '1. Fix the issues identified above for the flagged days ONLY.',
    '2. Keep all other days unchanged.',
    '3. Ensure costs are realistic and times are feasible.',
    '4. Return the corrected JSON for the flagged days.',
  ];

  return lines.join('\n');
}
