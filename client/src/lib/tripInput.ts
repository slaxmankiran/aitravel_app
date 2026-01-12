/**
 * tripInput.ts
 *
 * Converters between flat TripResponse and nested UserTripInput.
 * Used by Change Planner and Fix Blockers to bridge data models.
 *
 * TripResponse (flat): { dates: "Feb 15 - Feb 22, 2026", budget: 2000, ... }
 * UserTripInput (nested): { dates: { start, end, duration }, budget: { total, currency }, ... }
 */

import type { TripResponse, UserTripInput } from "@shared/schema";

/**
 * Parse date string like "Feb 15 - Feb 22, 2026" or "Feb 15, 2026 - Feb 22, 2026"
 * Returns ISO date strings and duration in days.
 */
export function parseTripDates(dateStr: string): {
  start: string;
  end: string;
  duration: number;
} | null {
  if (!dateStr) return null;

  try {
    // Format 1: "Jan 15, 2026 - Jan 22, 2026" or "Feb 15 - Feb 22, 2026"
    const parts = dateStr.split(" - ");
    if (parts.length === 2) {
      let startStr = parts[0].trim();
      let endStr = parts[1].trim();

      // If start doesn't have year, borrow from end
      if (!/\d{4}/.test(startStr) && /\d{4}/.test(endStr)) {
        const yearMatch = endStr.match(/(\d{4})/);
        if (yearMatch) {
          startStr = `${startStr}, ${yearMatch[1]}`;
        }
      }

      const start = new Date(startStr);
      const end = new Date(endStr);

      if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
        const duration =
          Math.ceil(
            (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
          ) + 1; // +1 because we count both start and end days

        return {
          start: start.toISOString().split("T")[0],
          end: end.toISOString().split("T")[0],
          duration,
        };
      }
    }

    // Format 2: "June 15-22, 2026"
    const rangeMatch = dateStr.match(/(\w+)\s+(\d+)-(\d+),?\s+(\d{4})/);
    if (rangeMatch) {
      const [, month, startDay, endDay, year] = rangeMatch;
      const start = new Date(`${month} ${startDay}, ${year}`);
      const end = new Date(`${month} ${endDay}, ${year}`);

      if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
        const duration =
          Math.ceil(
            (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
          ) + 1;

        return {
          start: start.toISOString().split("T")[0],
          end: end.toISOString().split("T")[0],
          duration,
        };
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Format ISO dates back to display string like "Feb 15 - Feb 22, 2026"
 */
export function formatTripDates(start: string, end: string): string {
  try {
    const startDate = new Date(start + "T00:00:00");
    const endDate = new Date(end + "T00:00:00");

    const startMonth = startDate.toLocaleDateString("en-US", { month: "short" });
    const endMonth = endDate.toLocaleDateString("en-US", { month: "short" });
    const startDay = startDate.getDate();
    const endDay = endDate.getDate();
    const year = endDate.getFullYear();

    if (startMonth === endMonth) {
      return `${startMonth} ${startDay} - ${endDay}, ${year}`;
    }
    return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${year}`;
  } catch {
    return `${start} - ${end}`;
  }
}

/**
 * Convert flat TripResponse to nested UserTripInput.
 * Used as prevInput for Change Planner.
 */
export function tripToUserTripInput(trip: TripResponse): UserTripInput {
  const dates = parseTripDates(trip.dates);
  const itinerary = trip.itinerary as any;

  // Duration: prefer itinerary day count, fallback to parsed dates
  const itineraryDays = itinerary?.days?.length || 0;
  const duration = itineraryDays > 0 ? itineraryDays : (dates?.duration || 1);

  // Currency: prefer trip currency, then itinerary, then USD
  const currency =
    trip.currency ||
    itinerary?.costBreakdown?.currency ||
    "USD";

  // Group size and travelers
  const groupSize = trip.groupSize || 1;
  const adults = trip.adults || groupSize;
  const children = trip.children || 0;
  const infants = trip.infants || 0;

  // Map travelStyle to hotelClass
  const hotelClassMap: Record<string, "budget" | "mid" | "luxury"> = {
    budget: "budget",
    standard: "mid",
    comfort: "mid",
    luxury: "luxury",
  };
  const hotelClass = hotelClassMap[trip.travelStyle || "standard"] || "mid";

  // Map pacePreference
  const paceMap: Record<string, "relaxed" | "moderate" | "packed"> = {
    relaxed: "relaxed",
    moderate: "moderate",
    packed: "packed",
  };
  const pace = paceMap[trip.pacePreference || "moderate"] || "moderate";

  // Budget: prefer explicit budget, then itinerary's estimated total cost
  // This ensures the AI sees a realistic budget even for:
  //   - Chat-created trips (budget may be undefined)
  //   - Budget/Standard/Luxury style trips (budget = $1 placeholder)
  // The $1 placeholder is set by CreateTrip.tsx when user selects a predefined style
  const explicitBudget = trip.budget;
  const itineraryCost =
    itinerary?.costBreakdown?.grandTotal ||
    itinerary?.costBreakdown?.total ||
    0;

  // Use explicit budget if meaningful (> $100 threshold), otherwise use itinerary cost estimate
  // $1 is the placeholder for Budget/Standard/Luxury styles - treat it as "no budget set"
  const MIN_MEANINGFUL_BUDGET = 100;
  const effectiveBudget = (explicitBudget && explicitBudget >= MIN_MEANINGFUL_BUDGET)
    ? explicitBudget
    : itineraryCost;

  return {
    dates: {
      start: dates?.start || "",
      end: dates?.end || "",
      duration,
    },
    budget: {
      total: effectiveBudget,
      perPerson: groupSize > 0 ? Math.round(effectiveBudget / groupSize) : 0,
      currency,
    },
    origin: {
      city: trip.origin || "",
      country: "", // Not stored separately in TripResponse
    },
    destination: {
      city: trip.destination || "",
      country: "", // Not stored separately in TripResponse
    },
    passport: trip.passport || "",
    travelers: {
      total: groupSize,
      adults,
      children,
      infants,
    },
    preferences: {
      pace,
      interests: trip.interests || [],
      hotelClass,
    },
    constraints: [], // Not used in current TripResponse
  };
}

/**
 * Convert UserTripInput patch back to flat TripResponse fields.
 * Only returns fields that were actually in the patch (partial).
 * Used when applying fix options.
 */
export function userTripInputToTripPatch(
  input: Partial<UserTripInput>
): Partial<TripResponse> {
  const patch: Partial<TripResponse> = {};

  // Dates: convert back to display string
  if (input.dates) {
    if (input.dates.start && input.dates.end) {
      patch.dates = formatTripDates(input.dates.start, input.dates.end);
    }
  }

  // Budget
  if (input.budget) {
    if (input.budget.total !== undefined) {
      patch.budget = input.budget.total;
    }
    if (input.budget.currency) {
      patch.currency = input.budget.currency;
    }
  }

  // Origin
  if (input.origin?.city) {
    patch.origin = input.origin.city;
  }

  // Destination
  if (input.destination?.city) {
    patch.destination = input.destination.city;
  }

  // Passport
  if (input.passport) {
    patch.passport = input.passport;
  }

  // Travelers
  if (input.travelers) {
    if (input.travelers.total !== undefined) {
      patch.groupSize = input.travelers.total;
    }
    if (input.travelers.adults !== undefined) {
      patch.adults = input.travelers.adults;
    }
    if (input.travelers.children !== undefined) {
      patch.children = input.travelers.children;
    }
    if (input.travelers.infants !== undefined) {
      patch.infants = input.travelers.infants;
    }
  }

  // Preferences - map back from UserTripInput schema to TripResponse flat fields
  if (input.preferences) {
    // Map hotelClass back to travelStyle
    if (input.preferences.hotelClass) {
      const styleMap: Record<string, string> = {
        budget: "budget",
        mid: "standard",
        luxury: "luxury",
      };
      patch.travelStyle = styleMap[input.preferences.hotelClass] || "standard";
    }
    // Map pace back to pacePreference
    if (input.preferences.pace) {
      patch.pacePreference = input.preferences.pace;
    }
    if (input.preferences.interests) {
      patch.interests = input.preferences.interests;
    }
  }

  return patch;
}

/**
 * Deep merge two UserTripInput objects.
 * Used to apply fix patches to prevInput.
 */
export function mergeUserTripInput(
  base: UserTripInput,
  patch: Partial<UserTripInput>
): UserTripInput {
  return {
    dates: patch.dates
      ? { ...base.dates, ...patch.dates }
      : base.dates,
    budget: patch.budget
      ? { ...base.budget, ...patch.budget }
      : base.budget,
    origin: patch.origin
      ? { ...base.origin, ...patch.origin }
      : base.origin,
    destination: patch.destination
      ? { ...base.destination, ...patch.destination }
      : base.destination,
    passport: patch.passport ?? base.passport,
    travelers: patch.travelers
      ? { ...base.travelers, ...patch.travelers }
      : base.travelers,
    preferences: patch.preferences
      ? { ...base.preferences, ...patch.preferences }
      : base.preferences,
    constraints: patch.constraints
      ? { ...base.constraints, ...patch.constraints }
      : base.constraints,
  };
}

/**
 * Shift dates by a number of days.
 * Returns new start/end ISO strings and formatted display string.
 */
export function shiftDates(
  startIso: string,
  endIso: string,
  shiftDays: number
): { start: string; end: string; display: string } {
  const startDate = new Date(startIso + "T00:00:00");
  const endDate = new Date(endIso + "T00:00:00");

  startDate.setDate(startDate.getDate() + shiftDays);
  endDate.setDate(endDate.getDate() + shiftDays);

  const newStart = startDate.toISOString().split("T")[0];
  const newEnd = endDate.toISOString().split("T")[0];

  return {
    start: newStart,
    end: newEnd,
    display: formatTripDates(newStart, newEnd),
  };
}
