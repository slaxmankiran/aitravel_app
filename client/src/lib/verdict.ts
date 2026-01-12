/**
 * verdict.ts
 *
 * Single source of truth for VoyageAI verdict computation.
 * Both CertaintyBar and VerdictCard consume this.
 */

export type Verdict = 'GO' | 'POSSIBLE' | 'DIFFICULT';

export type OverrideId =
  | 'VISA_TIMING_BLOCKER'
  | 'VISA_HIGH_RISK'
  | 'OVER_BUDGET_20'
  | 'OVER_BUDGET_50'
  | 'SAFETY_L3_PLUS'
  | 'UNDER_7_DAYS_VISA_REQUIRED';

export interface RiskFlags {
  visaTimingBlocker: boolean;
  visaHighRisk: boolean;
  safetyL3Plus: boolean;
  overBudget20: boolean;
  overBudget50: boolean;
  under7DaysVisaRequired: boolean;
}

export interface VerdictInput {
  certaintyScore: number;
  visaType: string;
  visaProcessingDays: { minimum: number; maximum: number };
  visaRisk: 'low' | 'medium' | 'high';
  safetyLevel: number; // 1-4, where 3+ is concerning
  totalCost: number;
  userBudget: number;
  daysUntilTravel: number;
}

export interface VerdictResult {
  verdict: Verdict;
  score: number;
  overridesApplied: OverrideId[];
  reasons: string[];
  riskFlags: RiskFlags;
  budgetDelta: number; // positive = over budget, negative = under
  budgetRatio: number; // totalCost / userBudget
}

/**
 * Compute verdict from input signals.
 * Rules are applied in priority order - earlier rules can override later ones.
 */
export function computeVerdict(input: VerdictInput): VerdictResult {
  const overridesApplied: OverrideId[] = [];
  const reasons: string[] = [];

  // Initialize risk flags
  const riskFlags: RiskFlags = {
    visaTimingBlocker: false,
    visaHighRisk: false,
    safetyL3Plus: false,
    overBudget20: false,
    overBudget50: false,
    under7DaysVisaRequired: false,
  };

  // Budget calculations
  const budgetDelta = input.totalCost - input.userBudget;
  const budgetRatio = input.userBudget > 0 ? input.totalCost / input.userBudget : 1;

  // Base verdict from certainty score
  let verdict: Verdict =
    input.certaintyScore >= 80 ? 'GO' :
    input.certaintyScore >= 50 ? 'POSSIBLE' : 'DIFFICULT';

  const isVisaRequired = input.visaType !== 'visa_free' && input.visaType !== 'visa-free';

  // ═══════════════════════════════════════════════════════════════════════════
  // OVERRIDE RULES (applied in priority order)
  // ═══════════════════════════════════════════════════════════════════════════

  // Rule 1: VISA TIMING BLOCKER (highest priority - instant DIFFICULT)
  if (isVisaRequired && input.visaProcessingDays.minimum > input.daysUntilTravel) {
    verdict = 'DIFFICULT';
    riskFlags.visaTimingBlocker = true;
    overridesApplied.push('VISA_TIMING_BLOCKER');
    const minDays = input.visaProcessingDays.minimum;
    const maxDays = input.visaProcessingDays.maximum;
    reasons.push(
      `Visa processing (${minDays}-${maxDays} days) exceeds your ${input.daysUntilTravel} days until travel`
    );
  }

  // Rule 2: VISA HIGH RISK (downgrades GO → POSSIBLE)
  if (input.visaRisk === 'high') {
    riskFlags.visaHighRisk = true;
    if (verdict === 'GO') {
      verdict = 'POSSIBLE';
      overridesApplied.push('VISA_HIGH_RISK');
    }
    reasons.push('Visa approval is uncertain for this route');
  }

  // Rule 3: SEVERE BUDGET BREACH (>50% over → DIFFICULT)
  if (budgetRatio > 1.5) {
    riskFlags.overBudget50 = true;
    riskFlags.overBudget20 = true; // 50% implies 20%
    verdict = 'DIFFICULT';
    overridesApplied.push('OVER_BUDGET_50');
    reasons.push(`Trip cost ($${input.totalCost.toLocaleString()}) exceeds budget by $${Math.round(budgetDelta).toLocaleString()}`);
  }
  // Rule 4: MODERATE BUDGET BREACH (>20% over → downgrade to POSSIBLE)
  else if (budgetRatio > 1.2) {
    riskFlags.overBudget20 = true;
    if (verdict === 'GO') {
      verdict = 'POSSIBLE';
      overridesApplied.push('OVER_BUDGET_20');
    }
    reasons.push(`Estimated cost is $${Math.round(budgetDelta).toLocaleString()} over budget`);
  }

  // Rule 5: SAFETY CONCERN (level 3+ → DIFFICULT)
  if (input.safetyLevel >= 3) {
    riskFlags.safetyL3Plus = true;
    verdict = 'DIFFICULT';
    overridesApplied.push('SAFETY_L3_PLUS');
    reasons.push(`Level ${input.safetyLevel} travel advisory in effect`);
  }

  // Rule 6: TIGHT TIMELINE (<7 days + visa required → downgrade to POSSIBLE)
  if (input.daysUntilTravel < 7 && isVisaRequired) {
    riskFlags.under7DaysVisaRequired = true;
    if (verdict === 'GO') {
      verdict = 'POSSIBLE';
      overridesApplied.push('UNDER_7_DAYS_VISA_REQUIRED');
    }
    // Only add reason if not already blocked by visa timing
    if (!riskFlags.visaTimingBlocker) {
      reasons.push(`Only ${input.daysUntilTravel} days until travel. Visa may not process in time.`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // POSITIVE SIGNALS (if no issues found)
  // ═══════════════════════════════════════════════════════════════════════════

  if (verdict === 'GO' && reasons.length === 0) {
    reasons.push('All checks passed. Safe to book.');
  }

  // Add context-specific positive reasons
  if (!riskFlags.visaTimingBlocker && !riskFlags.visaHighRisk) {
    if (input.visaType === 'visa_free' || input.visaType === 'visa-free') {
      if (!reasons.some(r => r.includes('Visa'))) {
        reasons.unshift('Visa-free entry available');
      }
    }
  }

  if (budgetDelta <= 0 && !riskFlags.overBudget20) {
    const remaining = Math.abs(budgetDelta);
    if (remaining > 0) {
      reasons.push(`$${remaining.toLocaleString()} remaining in budget`);
    }
  }

  return {
    verdict,
    score: input.certaintyScore,
    overridesApplied,
    reasons,
    riskFlags,
    budgetDelta,
    budgetRatio,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER: Build VerdictInput from TripResponse
// ═══════════════════════════════════════════════════════════════════════════

export interface TripDataForVerdict {
  feasibilityReport?: {
    certaintyScore?: { score: number };
    visaDetails?: {
      type: string;
      processingTime?: { minimum: number; maximum: number };
      risk?: 'low' | 'medium' | 'high';
    };
    safetyAssessment?: { level: number };
    costBreakdown?: { grandTotal: number };
  };
  budget?: number;
  dates?: string; // "Dec 15-22, 2025" or similar
}

/**
 * Extract VerdictInput from a trip response object.
 * Handles missing/optional fields with safe defaults.
 *
 * IMPORTANT: Uses report.score as the single source of truth for certainty.
 * This is the same field read by CertaintyBar.
 */
export function buildVerdictInput(trip: TripDataForVerdict, travelDate?: Date): VerdictInput {
  const report = trip.feasibilityReport as any; // Cast to allow flexible field access

  // Calculate days until travel
  let daysUntilTravel = 30; // default
  if (travelDate) {
    const now = new Date();
    const diffTime = travelDate.getTime() - now.getTime();
    daysUntilTravel = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  }

  // Single source of truth for certainty score:
  // Priority: report.score (what server returns) > report.certaintyScore.score > default 50
  const certaintyScore =
    Number(report?.score) ||
    Number(report?.certaintyScore?.score) ||
    50;

  return {
    certaintyScore,
    visaType: report?.visaDetails?.type ?? 'unknown',
    visaProcessingDays: report?.visaDetails?.processingTime ?? { minimum: 14, maximum: 21 },
    visaRisk: report?.visaDetails?.risk ?? 'medium',
    safetyLevel: report?.safetyAssessment?.level ?? 1,
    totalCost: report?.costBreakdown?.grandTotal ?? trip.budget ?? 0,
    userBudget: trip.budget ?? 1000,
    daysUntilTravel,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// UI HELPERS
// ═══════════════════════════════════════════════════════════════════════════

export interface VerdictDisplay {
  headline: string;
  subtext: string;
  color: 'emerald' | 'amber' | 'red';
  icon: '✓' | '⚠' | '✗';
  bgClass: string;
  borderClass: string;
  textClass: string;
}

export function getVerdictDisplay(verdict: Verdict): VerdictDisplay {
  switch (verdict) {
    case 'GO':
      return {
        headline: "You're good to go",
        subtext: 'All checks passed. Book with confidence.',
        color: 'emerald',
        icon: '✓',
        bgClass: 'bg-emerald-500/10',
        borderClass: 'border-emerald-500',
        textClass: 'text-emerald-400',
      };
    case 'POSSIBLE':
      return {
        headline: 'Possible with preparation',
        subtext: 'Review the action items below before booking.',
        color: 'amber',
        icon: '⚠',
        bgClass: 'bg-amber-500/10',
        borderClass: 'border-amber-500',
        textClass: 'text-amber-400',
      };
    case 'DIFFICULT':
      return {
        headline: 'Consider alternatives',
        subtext: 'This trip has significant blockers. See details.',
        color: 'red',
        icon: '✗',
        bgClass: 'bg-red-500/10',
        borderClass: 'border-red-500',
        textClass: 'text-red-400',
      };
  }
}
