/**
 * fixOptions.ts
 *
 * Fix Options endpoint - mounted at /api by routes.ts
 * POST /api/fix-options
 *
 * Returns fix options for blockers (primarily visa timing issues).
 * Cheap and deterministic - doesn't recompute everything.
 *
 * MVP: Returns shift-dates option when visa timing is tight/risky.
 * Future: Add destination alternatives option.
 */

import type { Request, Response, Router } from "express";
import express from "express";
import type {
  FixOption,
  UserTripInput,
  FeasibilityReport,
  VisaDetails,
} from "@shared/schema";

const router: Router = express.Router();

// ---------------------------------------------------------------------------
// Date math helpers
// ---------------------------------------------------------------------------

/**
 * Calculate business days between two dates (excludes weekends).
 * Simple implementation - doesn't account for holidays.
 */
function getBusinessDaysBetween(startDate: Date, endDate: Date): number {
  let count = 0;
  const current = new Date(startDate);

  while (current < endDate) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
}

/**
 * Add calendar days to a date, ensuring we land on a weekday.
 * If result is weekend, push to next Monday.
 */
function addDaysToWeekday(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);

  // If weekend, push to Monday
  const dayOfWeek = result.getDay();
  if (dayOfWeek === 0) {
    result.setDate(result.getDate() + 1); // Sunday -> Monday
  } else if (dayOfWeek === 6) {
    result.setDate(result.getDate() + 2); // Saturday -> Monday
  }

  return result;
}

/**
 * Convert business days to approximate calendar days.
 * Assumes ~5 business days per 7 calendar days.
 */
function businessDaysToCalendarDays(businessDays: number): number {
  return Math.ceil(businessDays * 1.4); // 5 business days ≈ 7 calendar days
}

/**
 * Format date as ISO string (YYYY-MM-DD).
 */
function toIsoDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

/**
 * Format date range for display (e.g., "Feb 15 - Feb 22, 2026").
 */
function formatDateRange(start: Date, end: Date): string {
  const startMonth = start.toLocaleDateString("en-US", { month: "short" });
  const endMonth = end.toLocaleDateString("en-US", { month: "short" });
  const startDay = start.getDate();
  const endDay = end.getDate();
  const year = end.getFullYear();

  if (startMonth === endMonth) {
    return `${startMonth} ${startDay} - ${endDay}, ${year}`;
  }
  return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${year}`;
}

// ---------------------------------------------------------------------------
// Fix option generators
// ---------------------------------------------------------------------------

interface FixOptionsRequest {
  tripId: number;
  currentInput: UserTripInput;
  feasibilityReport: FeasibilityReport;
}

/**
 * Generate shift-dates fix option.
 * Calculates minimal date shift to allow visa processing time.
 */
function generateShiftDatesOption(
  currentInput: UserTripInput,
  visaDetails: VisaDetails
): FixOption | null {
  const timing = visaDetails.timing;
  if (!timing) return null;

  // Calculate how many more business days we need
  const processingDaysNeeded = timing.processingDaysNeeded ||
    visaDetails.processingDays?.maximum || 15;
  const businessDaysUntilTrip = timing.businessDaysUntilTrip || 0;

  // Buffer: add 2 business days for safety
  const bufferBusinessDays = 2;
  const shortfall = processingDaysNeeded - businessDaysUntilTrip + bufferBusinessDays;

  if (shortfall <= 0) {
    // No shift needed
    return null;
  }

  // Convert to calendar days (minimum 3 days shift)
  const shiftCalendarDays = Math.max(3, businessDaysToCalendarDays(shortfall));

  // Calculate new dates
  const currentStart = new Date(currentInput.dates.start + "T00:00:00");
  const currentEnd = new Date(currentInput.dates.end + "T00:00:00");

  const newStart = addDaysToWeekday(currentStart, shiftCalendarDays);
  const newEnd = new Date(newStart);
  newEnd.setDate(newEnd.getDate() + currentInput.dates.duration - 1);

  // Build the patch
  const changePatch: Partial<UserTripInput> = {
    dates: {
      start: toIsoDate(newStart),
      end: toIsoDate(newEnd),
      duration: currentInput.dates.duration,
    },
  };

  // Estimate outcome
  // After shifting dates, visa timing should be OK
  const expectedOutcome = {
    certaintyAfter: 85, // Rough estimate - timing issue resolved
    blockersAfter: 0, // Visa timing no longer a blocker
    costDelta: 0, // Dates shift usually doesn't change cost significantly
  };

  return {
    title: `Shift trip ${shiftCalendarDays} days later`,
    changePatch,
    expectedOutcome,
    confidence: "high",
  };
}

/**
 * Generate destination alternative option.
 * Only if we have alternatives data available.
 * TODO: Implement when alternatives payload is available.
 */
function generateDestinationAlternativeOption(
  _currentInput: UserTripInput,
  _feasibilityReport: FeasibilityReport
): FixOption | null {
  // Future implementation:
  // 1. Check if feasibilityReport has alternatives array
  // 2. Pick the best visa-free alternative
  // 3. Return option with destination change patch

  return null; // Not implemented yet
}

// ---------------------------------------------------------------------------
// POST /fix-options (mounted at /api)
// ---------------------------------------------------------------------------

router.post("/fix-options", async (req: Request, res: Response) => {
  try {
    const { tripId, currentInput, feasibilityReport } = req.body as FixOptionsRequest;

    if (!tripId || !currentInput || !feasibilityReport) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    console.log(`[FixOptions] Generating fix options for trip ${tripId}`);

    const options: FixOption[] = [];
    const report = feasibilityReport as any;
    const visaDetails = report?.visaDetails as VisaDetails | undefined;

    // Check if visa timing needs fixing
    if (visaDetails?.required && visaDetails.type !== "visa_free") {
      const timing = visaDetails.timing;
      const urgencyIsBad = timing?.urgency === "tight" || timing?.urgency === "risky";
      const notEnoughTime = timing?.hasEnoughTime === false;

      if (urgencyIsBad || notEnoughTime) {
        // Option 1: Shift dates
        const shiftOption = generateShiftDatesOption(currentInput, visaDetails);
        if (shiftOption) {
          options.push(shiftOption);
        }

        // Option 2: Destination alternative (future)
        const altOption = generateDestinationAlternativeOption(currentInput, feasibilityReport);
        if (altOption) {
          options.push(altOption);
        }
      }
    }

    console.log(`[FixOptions] Generated ${options.length} options for trip ${tripId}`);

    return res.json({
      tripId,
      options,
      generatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[FixOptions] Error:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
});

export default router;
