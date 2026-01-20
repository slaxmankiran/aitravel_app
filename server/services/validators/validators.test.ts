/**
 * Unit Tests for Budget and Logistics Validators
 *
 * Run with: npx vitest run server/services/validators/validators.test.ts
 */

import { describe, it, expect } from 'vitest';
import {
  validateBudget,
  isWithinBudget,
  calculateTotalCost,
  formatBudgetFeedback,
} from './budgetValidator';
import {
  validateLogistics,
  isLogisticallyFeasible,
  formatLogisticsFeedback,
  getTimeSlot,
} from './logisticsValidator';
import {
  validateItinerary,
  isItineraryValid,
  buildRefinementPrompt,
} from './index';
import type { ItineraryDay } from '../streamingItinerary';

// ============================================================================
// TEST DATA
// ============================================================================

const createActivity = (overrides: Partial<{
  time: string;
  name: string;
  estimatedCost: number;
  duration: string;
  type: 'activity' | 'meal' | 'transport' | 'lodging';
  coordinates: { lat: number; lng: number };
}> = {}) => ({
  time: '9:00 AM',
  name: 'Test Activity',
  description: 'A test activity',
  type: 'activity' as const,
  estimatedCost: 50,
  duration: '2 hours',
  location: 'Test Location',
  coordinates: { lat: 0, lng: 0 },
  ...overrides,
});

const createDay = (day: number, activities: ReturnType<typeof createActivity>[]): ItineraryDay => ({
  day,
  date: `2026-01-${day.toString().padStart(2, '0')}`,
  title: `Day ${day}`,
  activities,
});

// ============================================================================
// BUDGET VALIDATOR TESTS
// ============================================================================

describe('Budget Validator', () => {
  describe('validateBudget', () => {
    it('should approve itinerary within budget', () => {
      const itinerary: ItineraryDay[] = [
        createDay(1, [
          createActivity({ time: '9:00 AM', estimatedCost: 50 }),
          createActivity({ time: '2:00 PM', estimatedCost: 30 }),
        ]),
        createDay(2, [
          createActivity({ time: '10:00 AM', estimatedCost: 40 }),
          createActivity({ time: '3:00 PM', estimatedCost: 20 }),
        ]),
      ];

      const result = validateBudget(itinerary, 500, 2);

      expect(result.status).toBe('APPROVED');
      expect(result.totalEstimatedCost).toBe(140);
      expect(result.flaggedDays).toHaveLength(0);
    });

    it('should reject itinerary significantly over budget', () => {
      const itinerary: ItineraryDay[] = [
        createDay(1, [
          createActivity({ time: '9:00 AM', estimatedCost: 200 }),
          createActivity({ time: '2:00 PM', estimatedCost: 150 }),
        ]),
      ];

      const result = validateBudget(itinerary, 200, 1);

      expect(result.status).toBe('OVER_BUDGET');
      expect(result.flaggedDays).toContain(1);
      expect(result.delta).toBeGreaterThan(0);
    });

    it('should warn when near budget limit', () => {
      const itinerary: ItineraryDay[] = [
        createDay(1, [
          createActivity({ time: '9:00 AM', estimatedCost: 100 }),
          createActivity({ time: '2:00 PM', estimatedCost: 80 }),
        ]),
      ];

      // Budget is 150, cost is 180, which is 20% over (near limit)
      const result = validateBudget(itinerary, 165, 1);

      expect(result.status).toBe('NEAR_LIMIT');
    });

    it('should identify under-budget itineraries', () => {
      const itinerary: ItineraryDay[] = [
        createDay(1, [
          createActivity({ time: '9:00 AM', estimatedCost: 20 }),
        ]),
      ];

      const result = validateBudget(itinerary, 500, 1);

      expect(result.status).toBe('UNDER_BUDGET');
      expect(result.suggestions).toContain(expect.stringContaining('unused'));
    });

    it('should break down costs by category', () => {
      const itinerary: ItineraryDay[] = [
        createDay(1, [
          createActivity({ type: 'activity', estimatedCost: 50 }),
          createActivity({ type: 'meal', estimatedCost: 30 }),
          createActivity({ type: 'transport', estimatedCost: 20 }),
        ]),
      ];

      const result = validateBudget(itinerary, 500, 1);

      expect(result.perDayBreakdown[0].breakdown.activities).toBe(50);
      expect(result.perDayBreakdown[0].breakdown.meals).toBe(30);
      expect(result.perDayBreakdown[0].breakdown.transport).toBe(20);
    });

    it('should generate meaningful logs', () => {
      const itinerary: ItineraryDay[] = [
        createDay(1, [createActivity({ estimatedCost: 50 })]),
      ];

      const result = validateBudget(itinerary, 500, 1);

      expect(result.logs).toContain(expect.stringContaining('[Bursar]'));
      expect(result.logs.some(l => l.includes('FINAL VERDICT'))).toBe(true);
    });
  });

  describe('isWithinBudget', () => {
    it('should return true for itinerary within budget', () => {
      const itinerary: ItineraryDay[] = [
        createDay(1, [createActivity({ estimatedCost: 100 })]),
      ];

      expect(isWithinBudget(itinerary, 150)).toBe(true);
    });

    it('should return false for itinerary over budget', () => {
      const itinerary: ItineraryDay[] = [
        createDay(1, [createActivity({ estimatedCost: 200 })]),
      ];

      expect(isWithinBudget(itinerary, 100)).toBe(false);
    });
  });

  describe('calculateTotalCost', () => {
    it('should sum all activity costs', () => {
      const itinerary: ItineraryDay[] = [
        createDay(1, [
          createActivity({ estimatedCost: 50 }),
          createActivity({ estimatedCost: 30 }),
        ]),
        createDay(2, [
          createActivity({ estimatedCost: 40 }),
        ]),
      ];

      expect(calculateTotalCost(itinerary)).toBe(120);
    });
  });

  describe('formatBudgetFeedback', () => {
    it('should return empty string for approved budget', () => {
      const itinerary: ItineraryDay[] = [
        createDay(1, [createActivity({ estimatedCost: 50 })]),
      ];
      const result = validateBudget(itinerary, 500, 1);

      expect(formatBudgetFeedback(result)).toBe('');
    });

    it('should format feedback for over-budget', () => {
      const itinerary: ItineraryDay[] = [
        createDay(1, [createActivity({ estimatedCost: 500 })]),
      ];
      const result = validateBudget(itinerary, 200, 1);
      const feedback = formatBudgetFeedback(result);

      expect(feedback).toContain('BUDGET VALIDATION FAILED');
      expect(feedback).toContain('REQUIRED');
    });
  });
});

// ============================================================================
// LOGISTICS VALIDATOR TESTS
// ============================================================================

describe('Logistics Validator', () => {
  describe('validateLogistics', () => {
    it('should approve well-spaced activities', () => {
      const itinerary: ItineraryDay[] = [
        createDay(1, [
          createActivity({ time: '9:00 AM', duration: '2 hours', coordinates: { lat: 0, lng: 0 } }),
          createActivity({ time: '12:00 PM', duration: '1 hour', coordinates: { lat: 0.01, lng: 0.01 } }),
          createActivity({ time: '3:00 PM', duration: '2 hours', coordinates: { lat: 0.02, lng: 0.02 } }),
        ]),
      ];

      const result = validateLogistics(itinerary);

      expect(result.status).toBe('APPROVED');
      expect(result.errorCount).toBe(0);
    });

    it('should reject overlapping activities', () => {
      const itinerary: ItineraryDay[] = [
        createDay(1, [
          createActivity({ time: '9:00 AM', duration: '3 hours' }),
          createActivity({ time: '10:00 AM', duration: '2 hours' }), // Overlaps!
        ]),
      ];

      const result = validateLogistics(itinerary);

      expect(result.status).toBe('IMPOSSIBLE');
      expect(result.conflicts.some(c => c.type === 'timing')).toBe(true);
    });

    it('should detect insufficient transit time', () => {
      const itinerary: ItineraryDay[] = [
        createDay(1, [
          createActivity({
            time: '9:00 AM',
            duration: '2 hours',
            coordinates: { lat: 0, lng: 0 },
          }),
          createActivity({
            time: '11:05 AM', // Only 5 min gap
            duration: '2 hours',
            coordinates: { lat: 0.1, lng: 0.1 }, // ~15km away
          }),
        ]),
      ];

      const result = validateLogistics(itinerary);

      expect(result.conflicts.some(c => c.type === 'transit')).toBe(true);
    });

    it('should flag too many activities', () => {
      const itinerary: ItineraryDay[] = [
        createDay(1, [
          createActivity({ time: '8:00 AM', duration: '1 hour' }),
          createActivity({ time: '10:00 AM', duration: '1 hour' }),
          createActivity({ time: '12:00 PM', duration: '1 hour' }),
          createActivity({ time: '2:00 PM', duration: '1 hour' }),
          createActivity({ time: '4:00 PM', duration: '1 hour' }),
          createActivity({ time: '6:00 PM', duration: '1 hour' }), // 6th activity
        ]),
      ];

      const result = validateLogistics(itinerary);

      expect(result.conflicts.some(c => c.type === 'density')).toBe(true);
    });

    it('should require more buffer for families with toddlers', () => {
      const itinerary: ItineraryDay[] = [
        createDay(1, [
          createActivity({
            time: '9:00 AM',
            duration: '2 hours',
            coordinates: { lat: 0, lng: 0 },
          }),
          createActivity({
            time: '11:20 AM', // 20 min gap - ok for adults, tight for toddlers
            duration: '2 hours',
            coordinates: { lat: 0.005, lng: 0.005 }, // Close by
          }),
        ]),
      ];

      const resultAdults = validateLogistics(itinerary, {
        hasToddler: false,
        hasElderly: false,
        hasMobilityIssues: false,
        groupSize: 2,
      });

      const resultFamily = validateLogistics(itinerary, {
        hasToddler: true,
        hasElderly: false,
        hasMobilityIssues: false,
        groupSize: 3,
      });

      // Adults should be fine, family should have warning
      expect(resultFamily.warningCount).toBeGreaterThanOrEqual(resultAdults.warningCount);
    });

    it('should generate meaningful logs', () => {
      const itinerary: ItineraryDay[] = [
        createDay(1, [createActivity({ time: '9:00 AM' })]),
      ];

      const result = validateLogistics(itinerary);

      expect(result.logs).toContain(expect.stringContaining('[Logistician]'));
      expect(result.logs.some(l => l.includes('FINAL VERDICT'))).toBe(true);
    });
  });

  describe('getTimeSlot', () => {
    it('should identify morning times', () => {
      expect(getTimeSlot('9:00 AM')).toBe('morning');
      expect(getTimeSlot('11:30 AM')).toBe('morning');
    });

    it('should identify afternoon times', () => {
      expect(getTimeSlot('12:00 PM')).toBe('afternoon');
      expect(getTimeSlot('2:30 PM')).toBe('afternoon');
      expect(getTimeSlot('4:00 PM')).toBe('afternoon');
    });

    it('should identify evening times', () => {
      expect(getTimeSlot('5:00 PM')).toBe('evening');
      expect(getTimeSlot('8:00 PM')).toBe('evening');
    });
  });

  describe('isLogisticallyFeasible', () => {
    it('should return true for feasible itinerary', () => {
      const itinerary: ItineraryDay[] = [
        createDay(1, [
          createActivity({ time: '9:00 AM', duration: '2 hours' }),
          createActivity({ time: '1:00 PM', duration: '2 hours' }),
        ]),
      ];

      expect(isLogisticallyFeasible(itinerary)).toBe(true);
    });

    it('should return false for impossible itinerary', () => {
      const itinerary: ItineraryDay[] = [
        createDay(1, [
          createActivity({ time: '9:00 AM', duration: '5 hours' }),
          createActivity({ time: '10:00 AM', duration: '3 hours' }), // Overlaps
        ]),
      ];

      expect(isLogisticallyFeasible(itinerary)).toBe(false);
    });
  });
});

// ============================================================================
// COMBINED VALIDATION TESTS
// ============================================================================

describe('Combined Validation', () => {
  describe('validateItinerary', () => {
    it('should approve valid itinerary', async () => {
      const itinerary: ItineraryDay[] = [
        createDay(1, [
          createActivity({ time: '9:00 AM', duration: '2 hours', estimatedCost: 50 }),
          createActivity({ time: '2:00 PM', duration: '2 hours', estimatedCost: 30 }),
        ]),
      ];

      const result = await validateItinerary({
        itinerary,
        totalBudget: 500,
        numDays: 1,
      });

      expect(result.status).toBe('APPROVED');
      expect(result.metadata.budgetVerified).toBe(true);
      expect(result.metadata.logisticsVerified).toBe(true);
      expect(result.metadata.refinementRequired).toBe(false);
    });

    it('should reject itinerary with both budget and logistics issues', async () => {
      const itinerary: ItineraryDay[] = [
        createDay(1, [
          createActivity({ time: '9:00 AM', duration: '5 hours', estimatedCost: 500 }),
          createActivity({ time: '10:00 AM', duration: '3 hours', estimatedCost: 300 }), // Overlaps + expensive
        ]),
      ];

      const result = await validateItinerary({
        itinerary,
        totalBudget: 200,
        numDays: 1,
      });

      expect(result.status).toBe('REJECTED');
      expect(result.metadata.budgetVerified).toBe(false);
      expect(result.metadata.logisticsVerified).toBe(false);
      expect(result.feedback).toContain('VALIDATION FEEDBACK');
    });

    it('should combine flagged days from both validators', async () => {
      const itinerary: ItineraryDay[] = [
        createDay(1, [
          createActivity({ time: '9:00 AM', estimatedCost: 500 }), // Over budget
        ]),
        createDay(2, [
          createActivity({ time: '9:00 AM', duration: '5 hours' }),
          createActivity({ time: '10:00 AM', duration: '3 hours' }), // Timing conflict
        ]),
      ];

      const result = await validateItinerary({
        itinerary,
        totalBudget: 200,
        numDays: 2,
      });

      expect(result.flaggedDays).toContain(1); // Budget issue
      expect(result.flaggedDays).toContain(2); // Logistics issue
    });
  });

  describe('buildRefinementPrompt', () => {
    it('should return empty string for approved validation', async () => {
      const itinerary: ItineraryDay[] = [
        createDay(1, [createActivity({ estimatedCost: 50 })]),
      ];

      const result = await validateItinerary({
        itinerary,
        totalBudget: 500,
        numDays: 1,
      });

      const prompt = buildRefinementPrompt(result, 1);
      expect(prompt).toBe('');
    });

    it('should generate refinement prompt for rejected validation', async () => {
      const itinerary: ItineraryDay[] = [
        createDay(1, [createActivity({ estimatedCost: 500 })]),
      ];

      const result = await validateItinerary({
        itinerary,
        totalBudget: 100,
        numDays: 1,
      });

      const prompt = buildRefinementPrompt(result, 1);

      expect(prompt).toContain('REFINEMENT REQUIRED');
      expect(prompt).toContain('Attempt 1');
      expect(prompt).toContain('Days requiring changes');
    });
  });

  describe('isItineraryValid', () => {
    it('should return true for valid itinerary', () => {
      const itinerary: ItineraryDay[] = [
        createDay(1, [
          createActivity({ time: '9:00 AM', duration: '2 hours', estimatedCost: 50 }),
        ]),
      ];

      expect(isItineraryValid(itinerary, 500)).toBe(true);
    });

    it('should return false for invalid itinerary', () => {
      const itinerary: ItineraryDay[] = [
        createDay(1, [
          createActivity({ time: '9:00 AM', duration: '5 hours', estimatedCost: 500 }),
          createActivity({ time: '10:00 AM', duration: '3 hours', estimatedCost: 300 }),
        ]),
      ];

      expect(isItineraryValid(itinerary, 100)).toBe(false);
    });
  });
});
