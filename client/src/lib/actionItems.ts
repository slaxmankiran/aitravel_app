/**
 * actionItems.ts
 *
 * Centralized logic for deriving action items from feasibility report.
 * Used by ActionItems.tsx for display and Change Planner for blocker counts.
 *
 * Key principle: Action items are DERIVED from feasibility data, not stored.
 * Completion state is UI-only (local storage or component state).
 */

import type { VisaDetails, FeasibilityReport } from "@shared/schema";

export type Priority = "urgent" | "soon" | "later";
export type Category = "required" | "recommended";

export interface ActionItemDefinition {
  id: string;
  label: string;
  description?: string;
  priority: Priority;
  category: Category;
  type: string;
  url?: string;
}

/**
 * Derive action items from a feasibility report.
 * Returns both required (blocking) and recommended (nice-to-have) items.
 *
 * Required items are derived from:
 * - visaDetails (if required && type !== 'visa_free')
 * - passportWarning (if present - future feature)
 * - vaccineRequirements (if present - future feature)
 * - entryRestrictions (if present - future feature)
 *
 * Recommended items are static (flights, accommodation, insurance, etc.)
 */
export function buildActionItemsFromFeasibility(
  feasibilityReport: FeasibilityReport | null | undefined
): ActionItemDefinition[] {
  const items: ActionItemDefinition[] = [];
  const report = feasibilityReport as any; // Allow access to optional fields

  // =============================================
  // REQUIRED ITEMS (blocking - affects eligibility)
  // =============================================

  // 1. Visa application (if required)
  const visaDetails = report?.visaDetails as VisaDetails | undefined;
  if (visaDetails?.required && visaDetails.type !== "visa_free") {
    const isUrgent =
      visaDetails.timing?.urgency === "tight" ||
      visaDetails.timing?.urgency === "risky";
    items.push({
      id: "visa",
      label: `Apply for ${visaDetails.name || "visa"}`,
      description: visaDetails.timing?.recommendation || "Required for entry",
      priority: isUrgent ? "urgent" : "soon",
      category: "required",
      type: "visa",
      url: visaDetails.applicationUrl,
    });
  }

  // 2. Passport validity (if warning present - future feature)
  const passportWarning =
    report?.passportWarning || report?.breakdown?.visa?.passportNote;
  if (passportWarning) {
    items.push({
      id: "passport",
      label: "Check passport validity",
      description: passportWarning || "Must be valid 6+ months after return",
      priority: "urgent",
      category: "required",
      type: "passport",
    });
  }

  // 3. Mandatory vaccinations (if required - future feature)
  const requiredVaccines =
    report?.healthRequirements?.requiredVaccinations ||
    report?.vaccineRequirements;
  if (requiredVaccines && requiredVaccines.length > 0) {
    items.push({
      id: "vaccines",
      label: "Get required vaccinations",
      description: `Required: ${
        Array.isArray(requiredVaccines)
          ? requiredVaccines.join(", ")
          : requiredVaccines
      }`,
      priority: "urgent",
      category: "required",
      type: "health",
    });
  }

  // 4. Entry restrictions (if present - future feature)
  const entryRestrictions =
    report?.entryRestrictions || report?.breakdown?.entry?.restrictions;
  if (entryRestrictions && entryRestrictions.length > 0) {
    items.push({
      id: "entry_requirements",
      label: "Review entry requirements",
      description: "Health declarations or testing may be required",
      priority: "urgent",
      category: "required",
      type: "entry",
    });
  }

  // =============================================
  // RECOMMENDED ITEMS (nice-to-have - improves trip)
  // =============================================

  items.push(
    {
      id: "flights",
      label: "Book flights",
      description: "Compare prices and book your tickets",
      priority: "soon",
      category: "recommended",
      type: "booking",
    },
    {
      id: "accommodation",
      label: "Reserve accommodation",
      description: "Book hotels or vacation rentals",
      priority: "soon",
      category: "recommended",
      type: "booking",
    },
    {
      id: "insurance",
      label: "Get travel insurance",
      description: "Protect your trip investment",
      priority: "later",
      category: "recommended",
      type: "insurance",
    },
    {
      id: "currency",
      label: "Prepare payment methods",
      description: "Notify bank, get travel card",
      priority: "later",
      category: "recommended",
      type: "finance",
    },
    {
      id: "mobile",
      label: "Arrange mobile data",
      description: "eSIM or local SIM card",
      priority: "later",
      category: "recommended",
      type: "connectivity",
    },
    {
      id: "packing",
      label: "Pack your bags",
      description: "Check weather and pack accordingly",
      priority: "later",
      category: "recommended",
      type: "preparation",
    }
  );

  return items;
}

/**
 * Count blockers (required items) from a feasibility report.
 * Used by Change Planner banner to match ActionItems display.
 */
export function countBlockersFromFeasibility(
  feasibilityReport: FeasibilityReport | null | undefined
): number {
  const items = buildActionItemsFromFeasibility(feasibilityReport);
  return items.filter((item) => item.category === "required").length;
}

/**
 * Get required items only (blocking items).
 */
export function getRequiredItems(
  feasibilityReport: FeasibilityReport | null | undefined
): ActionItemDefinition[] {
  return buildActionItemsFromFeasibility(feasibilityReport).filter(
    (item) => item.category === "required"
  );
}

/**
 * Get recommended items only (nice-to-have items).
 */
export function getRecommendedItems(
  feasibilityReport: FeasibilityReport | null | undefined
): ActionItemDefinition[] {
  return buildActionItemsFromFeasibility(feasibilityReport).filter(
    (item) => item.category === "recommended"
  );
}

/**
 * Check if a visa is required (blocking).
 * This is the primary blocker check used in production.
 */
export function hasVisaBlocker(
  feasibilityReport: FeasibilityReport | null | undefined
): boolean {
  const report = feasibilityReport as any;
  const visaDetails = report?.visaDetails as VisaDetails | undefined;
  return !!(visaDetails?.required && visaDetails.type !== "visa_free");
}

/**
 * Check if visa timing needs fixing.
 * Returns true when:
 * - Visa is required (not visa_free)
 * - Timing exists
 * - Urgency is "tight" or "risky" OR hasEnoughTime is false
 *
 * This is a pure function with no side effects.
 */
export function needsVisaTimingFix(
  feasibilityReport: FeasibilityReport | null | undefined
): boolean {
  const report = feasibilityReport as any;
  const visaDetails = report?.visaDetails as VisaDetails | undefined;

  // Must have visa requirement
  if (!visaDetails?.required || visaDetails.type === "visa_free") {
    return false;
  }

  // Must have timing info
  const timing = visaDetails.timing;
  if (!timing) {
    return false;
  }

  // Check urgency or hasEnoughTime
  const urgencyIsBad = timing.urgency === "tight" || timing.urgency === "risky";
  const notEnoughTime = timing.hasEnoughTime === false;

  return urgencyIsBad || notEnoughTime;
}

/**
 * Get visa timing details for display in Fix Blockers UI.
 * Returns null if no visa timing issue.
 */
export function getVisaTimingDetails(
  feasibilityReport: FeasibilityReport | null | undefined
): {
  urgency: "ok" | "tight" | "risky";
  recommendation: string;
  daysUntilTrip: number;
  processingDaysNeeded: number;
  hasEnoughTime: boolean;
  shortfall: number; // How many days short (positive = need more time)
} | null {
  const report = feasibilityReport as any;
  const visaDetails = report?.visaDetails as VisaDetails | undefined;

  if (!visaDetails?.timing) {
    return null;
  }

  const timing = visaDetails.timing;
  const processingDays = visaDetails.processingDays?.maximum || 15;

  // Calculate shortfall: how many more business days needed
  const businessDaysUntilTrip = timing.businessDaysUntilTrip || 0;
  const processingDaysNeeded = timing.processingDaysNeeded || processingDays;
  const shortfall = processingDaysNeeded - businessDaysUntilTrip;

  // Normalize urgency to expected values (handle potential "impossible" from server)
  const rawUrgency = timing.urgency || "ok";
  const urgency: "ok" | "tight" | "risky" =
    rawUrgency === "tight" || rawUrgency === "risky" ? rawUrgency : "ok";

  return {
    urgency,
    recommendation: timing.recommendation || "",
    daysUntilTrip: timing.daysUntilTrip || 0,
    processingDaysNeeded,
    hasEnoughTime: timing.hasEnoughTime !== false,
    shortfall: Math.max(0, shortfall),
  };
}
