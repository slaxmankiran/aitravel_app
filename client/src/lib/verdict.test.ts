/**
 * verdict.test.ts
 *
 * Unit tests for computeVerdict() function.
 * Run with: npx vitest run verdict.test.ts
 */

import { describe, it, expect } from 'vitest';
import { computeVerdict, VerdictInput } from './verdict';

// Helper to create base input with sensible defaults
function createInput(overrides: Partial<VerdictInput> = {}): VerdictInput {
  return {
    certaintyScore: 85,
    visaType: 'visa_free',
    visaProcessingDays: { minimum: 5, maximum: 10 },
    visaRisk: 'low',
    safetyLevel: 1,
    totalCost: 1500,
    userBudget: 2000,
    daysUntilTravel: 30,
    ...overrides,
  };
}

describe('computeVerdict', () => {
  // ═══════════════════════════════════════════════════════════════════════════
  // BASE SCORE TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Base verdict from certainty score', () => {
    it('Score 90, no overrides → GO', () => {
      const input = createInput({ certaintyScore: 90 });
      const result = computeVerdict(input);

      expect(result.verdict).toBe('GO');
      expect(result.score).toBe(90);
      expect(result.overridesApplied).toHaveLength(0);
    });

    it('Score 80 (boundary) → GO', () => {
      const input = createInput({ certaintyScore: 80 });
      const result = computeVerdict(input);

      expect(result.verdict).toBe('GO');
    });

    it('Score 79 → POSSIBLE', () => {
      const input = createInput({ certaintyScore: 79 });
      const result = computeVerdict(input);

      expect(result.verdict).toBe('POSSIBLE');
    });

    it('Score 50 (boundary) → POSSIBLE', () => {
      const input = createInput({ certaintyScore: 50 });
      const result = computeVerdict(input);

      expect(result.verdict).toBe('POSSIBLE');
    });

    it('Score 49 → DIFFICULT', () => {
      const input = createInput({ certaintyScore: 49 });
      const result = computeVerdict(input);

      expect(result.verdict).toBe('DIFFICULT');
    });

    it('Score 0 → DIFFICULT', () => {
      const input = createInput({ certaintyScore: 0 });
      const result = computeVerdict(input);

      expect(result.verdict).toBe('DIFFICULT');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // OVERRIDE RULE TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Override rules', () => {
    it('Score 90 + visaHighRisk → POSSIBLE', () => {
      const input = createInput({
        certaintyScore: 90,
        visaRisk: 'high',
        visaType: 'visa_required',
      });
      const result = computeVerdict(input);

      expect(result.verdict).toBe('POSSIBLE');
      expect(result.overridesApplied).toContain('VISA_HIGH_RISK');
      expect(result.riskFlags.visaHighRisk).toBe(true);
    });

    it('Score 70 + overBudget25% → POSSIBLE', () => {
      const input = createInput({
        certaintyScore: 70, // Base: POSSIBLE
        totalCost: 2500,
        userBudget: 2000, // 25% over
      });
      const result = computeVerdict(input);

      expect(result.verdict).toBe('POSSIBLE');
      expect(result.riskFlags.overBudget20).toBe(true);
      expect(result.budgetRatio).toBe(1.25);
    });

    it('Score 70 + overBudget55% → DIFFICULT', () => {
      const input = createInput({
        certaintyScore: 70,
        totalCost: 3100,
        userBudget: 2000, // 55% over
      });
      const result = computeVerdict(input);

      expect(result.verdict).toBe('DIFFICULT');
      expect(result.overridesApplied).toContain('OVER_BUDGET_50');
      expect(result.riskFlags.overBudget50).toBe(true);
    });

    it('Score 85 + visaTimingExceedsTravelDate → DIFFICULT', () => {
      const input = createInput({
        certaintyScore: 85,
        visaType: 'visa_required',
        visaProcessingDays: { minimum: 15, maximum: 21 },
        daysUntilTravel: 10, // Less than minimum processing time
      });
      const result = computeVerdict(input);

      expect(result.verdict).toBe('DIFFICULT');
      expect(result.overridesApplied).toContain('VISA_TIMING_BLOCKER');
      expect(result.riskFlags.visaTimingBlocker).toBe(true);
    });

    it('Score 85 + safetyLevel3 → DIFFICULT', () => {
      const input = createInput({
        certaintyScore: 85,
        safetyLevel: 3,
      });
      const result = computeVerdict(input);

      expect(result.verdict).toBe('DIFFICULT');
      expect(result.overridesApplied).toContain('SAFETY_L3_PLUS');
      expect(result.riskFlags.safetyL3Plus).toBe(true);
    });

    it('Score 85 + <7 days + visa required → POSSIBLE', () => {
      const input = createInput({
        certaintyScore: 85,
        visaType: 'visa_required',
        visaProcessingDays: { minimum: 3, maximum: 5 }, // Fast enough
        daysUntilTravel: 5,
      });
      const result = computeVerdict(input);

      expect(result.verdict).toBe('POSSIBLE');
      expect(result.overridesApplied).toContain('UNDER_7_DAYS_VISA_REQUIRED');
      expect(result.riskFlags.under7DaysVisaRequired).toBe(true);
    });

    it('Visa-free + <7 days → no downgrade (remains GO)', () => {
      const input = createInput({
        certaintyScore: 85,
        visaType: 'visa_free',
        daysUntilTravel: 3,
      });
      const result = computeVerdict(input);

      expect(result.verdict).toBe('GO');
      expect(result.riskFlags.under7DaysVisaRequired).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // COMBINED OVERRIDE TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Combined overrides', () => {
    it('Multiple overrides apply in order', () => {
      const input = createInput({
        certaintyScore: 90,
        visaRisk: 'high',
        visaType: 'visa_required',
        totalCost: 2500,
        userBudget: 2000, // 25% over
      });
      const result = computeVerdict(input);

      expect(result.verdict).toBe('POSSIBLE');
      expect(result.overridesApplied).toContain('VISA_HIGH_RISK');
      expect(result.riskFlags.visaHighRisk).toBe(true);
      expect(result.riskFlags.overBudget20).toBe(true);
    });

    it('Visa timing blocker takes precedence even with high score', () => {
      const input = createInput({
        certaintyScore: 100,
        visaType: 'visa_required',
        visaProcessingDays: { minimum: 30, maximum: 45 },
        daysUntilTravel: 7,
      });
      const result = computeVerdict(input);

      expect(result.verdict).toBe('DIFFICULT');
      expect(result.overridesApplied[0]).toBe('VISA_TIMING_BLOCKER');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // BUDGET CALCULATION TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Budget calculations', () => {
    it('Under budget shows positive remaining', () => {
      const input = createInput({
        totalCost: 1500,
        userBudget: 2000,
      });
      const result = computeVerdict(input);

      expect(result.budgetDelta).toBe(-500);
      expect(result.budgetRatio).toBe(0.75);
      expect(result.reasons.some(r => r.includes('remaining'))).toBe(true);
    });

    it('Exactly on budget → no warning', () => {
      const input = createInput({
        certaintyScore: 85,
        totalCost: 2000,
        userBudget: 2000,
      });
      const result = computeVerdict(input);

      expect(result.verdict).toBe('GO');
      expect(result.budgetDelta).toBe(0);
      expect(result.riskFlags.overBudget20).toBe(false);
    });

    it('19% over budget → no downgrade', () => {
      const input = createInput({
        certaintyScore: 85,
        totalCost: 2380,
        userBudget: 2000, // 19% over
      });
      const result = computeVerdict(input);

      expect(result.verdict).toBe('GO');
      expect(result.riskFlags.overBudget20).toBe(false);
    });

    it('21% over budget → downgrade to POSSIBLE', () => {
      const input = createInput({
        certaintyScore: 85,
        totalCost: 2420,
        userBudget: 2000, // 21% over
      });
      const result = computeVerdict(input);

      expect(result.verdict).toBe('POSSIBLE');
      expect(result.riskFlags.overBudget20).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // REASONS AND DISPLAY TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Reasons generation', () => {
    it('GO with no issues has positive reason', () => {
      const input = createInput({ certaintyScore: 90 });
      const result = computeVerdict(input);

      expect(result.reasons.some(r => r.includes('All checks passed'))).toBe(true);
    });

    it('Visa-free is mentioned in reasons', () => {
      const input = createInput({
        certaintyScore: 90,
        visaType: 'visa_free',
      });
      const result = computeVerdict(input);

      expect(result.reasons.some(r => r.includes('Visa-free'))).toBe(true);
    });

    it('Multiple issues generate multiple reasons', () => {
      const input = createInput({
        certaintyScore: 60,
        visaRisk: 'high',
        visaType: 'visa_required',
        totalCost: 3500,
        userBudget: 2000,
      });
      const result = computeVerdict(input);

      expect(result.reasons.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EDGE CASES
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Edge cases', () => {
    it('Zero budget handled gracefully', () => {
      const input = createInput({
        userBudget: 0,
        totalCost: 1000,
      });
      const result = computeVerdict(input);

      expect(result.budgetRatio).toBe(1); // fallback
      expect(result.verdict).toBeDefined();
    });

    it('Same-day travel with visa required → DIFFICULT', () => {
      const input = createInput({
        certaintyScore: 90,
        visaType: 'visa_required',
        visaProcessingDays: { minimum: 1, maximum: 3 },
        daysUntilTravel: 0,
      });
      const result = computeVerdict(input);

      expect(result.verdict).toBe('DIFFICULT');
    });

    it('Same-day travel visa-free → can be GO', () => {
      const input = createInput({
        certaintyScore: 90,
        visaType: 'visa_free',
        daysUntilTravel: 0,
      });
      const result = computeVerdict(input);

      expect(result.verdict).toBe('GO');
    });
  });
});
