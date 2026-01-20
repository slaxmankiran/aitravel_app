/**
 * Trip Service
 *
 * Centralized business logic for trip CRUD operations.
 * Routes.ts should only call these functions - no inline logic.
 */

import { storage } from "../storage";
import type { Trip } from "@shared/schema";

// ============================================================================
// TYPES
// ============================================================================

export interface TripOwnershipResult {
  trip: Trip | null;
  authorized: boolean;
  adopted: boolean;
  error?: string;
}

export interface TripSummary {
  id: number;
  destination: string;
  dates: string;
  certaintyScore: number | null;
  certaintyLabel: 'high' | 'medium' | 'low' | null;
  estimatedCost: number | null;
  currency: string;
  travelers: number;
  travelStyle: string | null;
  status: string | null;
  feasibilityStatus: string | null;
  destinationImageUrl: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface ShareableTrip {
  id: number;
  destination: string;
  origin: string | null;
  dates: string;
  groupSize: number | null;
  adults: number | null;
  children: number | null;
  infants: number | null;
  travelStyle: string | null;
  budget: number | null;
  currency: string | null;
  passport: string | null;
  residence: string | null;
  feasibilityReport: unknown;
  itinerary: unknown;
  status: string | null;
  feasibilityStatus: string | null;
  createdAt: string | null;
}

export interface CreateTripInput {
  passport: string;
  destination: string;
  dates: string;
  budget: number;
  groupSize?: number | null;
  adults?: number | null;
  children?: number | null;
  infants?: number | null;
  travelStyle?: string | null;
  origin?: string | null;
  residence?: string | null;
  currency?: string | null;
  interests?: string[] | null;
  createdFrom?: string | null;
}

export interface TripValidationResult {
  valid: boolean;
  error?: string;
  field?: string;
}

export interface CreateTripResult {
  trip: Trip | null;
  error?: string;
  field?: string;
}

export interface UpdateTripResult {
  trip: Trip | null;
  error?: string;
  field?: string;
}

export interface DeleteResult {
  success: boolean;
  error?: string;
}

// ============================================================================
// DATE HELPERS
// ============================================================================

/**
 * Parse date string like "February 2026, 5 days" or "2026-02-15 to 2026-02-22"
 */
export function parseDateRange(dateStr: string): { startDate: string; endDate: string } | null {
  if (!dateStr) return null;

  // Try "YYYY-MM-DD to YYYY-MM-DD" format
  const rangeMatch = dateStr.match(/(\d{4}-\d{2}-\d{2})\s*to\s*(\d{4}-\d{2}-\d{2})/);
  if (rangeMatch) {
    return { startDate: rangeMatch[1], endDate: rangeMatch[2] };
  }

  // Try "Month Year, N days" format
  const monthMatch = dateStr.match(/(\w+)\s+(\d{4}),?\s*(\d+)\s*days?/i);
  if (monthMatch) {
    const [, month, year, days] = monthMatch;
    const monthNum = new Date(`${month} 1, ${year}`).getMonth();
    if (!isNaN(monthNum)) {
      const startDate = new Date(parseInt(year), monthNum, 15);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + parseInt(days) - 1);
      return {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
      };
    }
  }

  return null;
}

/**
 * Get number of days from date range
 */
export function getNumDays(dates: { startDate: string; endDate: string } | null, fallback: number = 7): number {
  if (!dates) return fallback;
  const start = new Date(dates.startDate);
  const end = new Date(dates.endDate);
  return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate trip input for create/update operations.
 */
export function validateTripInput(input: CreateTripInput): TripValidationResult {
  // Validate dates are not in the past
  const dates = parseDateRange(input.dates);
  if (dates) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = new Date(dates.startDate);
    if (startDate < today) {
      return {
        valid: false,
        error: "Travel dates must be in the future. Please select upcoming dates.",
        field: "dates",
      };
    }
  }

  // Validate minimum budget - ONLY for custom travel style
  const isCustomBudget = input.travelStyle === 'custom';
  if (isCustomBudget) {
    const numDays = getNumDays(dates);
    const groupSize = input.groupSize || 1;
    const minBudget = groupSize * numDays * 50; // $50/person/day absolute minimum
    if (input.budget < minBudget) {
      return {
        valid: false,
        error: `Budget too low. Minimum budget for ${groupSize} traveler(s) for ${numDays} days is approximately $${minBudget.toLocaleString()}`,
        field: "budget",
      };
    }
  }

  return { valid: true };
}

// ============================================================================
// TRIP CRUD OPERATIONS
// ============================================================================

/**
 * Create a new trip with validation.
 */
export async function createTrip(
  input: CreateTripInput,
  voyageUid?: string
): Promise<CreateTripResult> {
  try {
    // Validate input
    const validation = validateTripInput(input);
    if (!validation.valid) {
      return { trip: null, error: validation.error, field: validation.field };
    }

    // Create trip with voyageUid for anonymous user tracking
    const trip = await storage.createTrip({ ...input, voyageUid } as any);
    console.log(`[TripService] Created trip ${trip.id} for uid ${voyageUid?.slice(0, 8) || 'anonymous'}`);

    return { trip };
  } catch (error) {
    console.error('[TripService] createTrip error:', error);
    return { trip: null, error: 'Failed to create trip' };
  }
}

/**
 * Update an existing trip with ownership verification.
 */
export async function updateTrip(
  tripId: number,
  input: CreateTripInput,
  voyageUid?: string
): Promise<UpdateTripResult> {
  try {
    // Check if trip exists
    const existingTrip = await storage.getTrip(tripId);
    if (!existingTrip) {
      return { trip: null, error: 'Trip not found' };
    }

    // Verify ownership
    if (existingTrip.voyageUid && voyageUid && existingTrip.voyageUid !== voyageUid) {
      return { trip: null, error: 'Not authorized to edit this trip' };
    }

    // Validate input
    const validation = validateTripInput(input);
    if (!validation.valid) {
      return { trip: null, error: validation.error, field: validation.field };
    }

    // Update the trip (storage.updateTrip resets feasibility/itinerary)
    const updatedTrip = await storage.updateTrip(tripId, input as any);
    if (!updatedTrip) {
      return { trip: null, error: 'Failed to update trip' };
    }

    console.log(`[TripService] Updated trip ${tripId}`);
    return { trip: updatedTrip };
  } catch (error) {
    console.error('[TripService] updateTrip error:', error);
    return { trip: null, error: 'Failed to update trip' };
  }
}

/**
 * Get a trip by ID with ownership verification and soft-backfill.
 */
export async function getTripWithOwnership(
  tripId: number,
  voyageUid?: string
): Promise<TripOwnershipResult> {
  try {
    let trip = await storage.getTrip(tripId);

    if (!trip) {
      return { trip: null, authorized: false, adopted: false, error: 'Trip not found' };
    }

    // Ownership check: if trip has voyageUid and it doesn't match, deny access
    if (trip.voyageUid && voyageUid && trip.voyageUid !== voyageUid) {
      return { trip: null, authorized: false, adopted: false, error: 'Trip not found' };
    }

    // Soft backfill: adopt orphan trips
    let adopted = false;
    if (!trip.voyageUid && voyageUid) {
      const adoptedTrip = await storage.adoptTrip(tripId, voyageUid);
      if (adoptedTrip) {
        trip = adoptedTrip;
        adopted = true;
        console.log(`[TripService] Trip ${tripId} adopted by uid ${voyageUid.slice(0, 8)}...`);
      }
    }

    return { trip, authorized: true, adopted };
  } catch (error) {
    console.error('[TripService] getTripWithOwnership error:', error);
    return { trip: null, authorized: false, adopted: false, error: 'Internal error' };
  }
}

/**
 * Get a trip for public sharing (no ownership check).
 */
export async function getTripForShare(tripId: number): Promise<ShareableTrip | null> {
  try {
    const trip = await storage.getTrip(tripId);
    if (!trip) return null;

    return {
      id: trip.id,
      destination: trip.destination,
      origin: trip.origin,
      dates: trip.dates,
      groupSize: trip.groupSize,
      adults: trip.adults,
      children: trip.children,
      infants: trip.infants,
      travelStyle: trip.travelStyle,
      budget: trip.budget,
      currency: trip.currency,
      passport: trip.passport,
      residence: trip.residence,
      feasibilityReport: trip.feasibilityReport,
      itinerary: trip.itinerary,
      status: trip.status,
      feasibilityStatus: trip.feasibilityStatus,
      createdAt: trip.createdAt?.toISOString() ?? null,
    };
  } catch (error) {
    console.error('[TripService] getTripForShare error:', error);
    return null;
  }
}

/**
 * Delete a trip with ownership verification.
 */
export async function deleteTripWithOwnership(
  tripId: number,
  voyageUid?: string
): Promise<DeleteResult> {
  try {
    const trip = await storage.getTrip(tripId);

    if (!trip) {
      return { success: false, error: 'Trip not found' };
    }

    if (trip.voyageUid && voyageUid && trip.voyageUid !== voyageUid) {
      return { success: false, error: 'Not authorized to delete this trip' };
    }

    await storage.deleteTrip(tripId);
    console.log(`[TripService] Trip ${tripId} deleted`);

    return { success: true };
  } catch (error) {
    console.error('[TripService] deleteTripWithOwnership error:', error);
    return { success: false, error: 'Failed to delete trip' };
  }
}

// ============================================================================
// LIST TRIPS
// ============================================================================

/**
 * List trips for a user by voyage_uid.
 */
export async function listMyTrips(
  voyageUid: string,
  limit: number = 20
): Promise<TripSummary[]> {
  const safeLimit = Math.min(limit, 50);
  const trips = await storage.listTripsByUid(voyageUid, safeLimit);

  return trips.map(trip => {
    const feasibility = trip.feasibilityReport as any;
    const itinerary = trip.itinerary as any;
    const costBreakdown = itinerary?.costBreakdown;

    return {
      id: trip.id,
      destination: trip.destination,
      dates: trip.dates,
      certaintyScore: feasibility?.score ?? null,
      certaintyLabel: feasibility?.score
        ? (feasibility.score >= 70 ? 'high' : feasibility.score >= 40 ? 'medium' : 'low')
        : null,
      estimatedCost: costBreakdown?.grandTotal ?? costBreakdown?.total ?? null,
      currency: costBreakdown?.currency || trip.currency || 'USD',
      travelers: trip.groupSize || 1,
      travelStyle: trip.travelStyle,
      status: trip.status,
      feasibilityStatus: trip.feasibilityStatus,
      destinationImageUrl: (trip as any).destinationImageUrl ?? null,
      createdAt: trip.createdAt?.toISOString() ?? null,
      updatedAt: trip.updatedAt?.toISOString() ?? null,
    };
  });
}

// ============================================================================
// PROGRESS TRACKING
// ============================================================================

// In-memory progress store for trip processing
const tripProgressStore = new Map<number, {
  step: number;
  message: string;
  details?: string;
  timestamp: number;
}>();

/**
 * Update trip processing progress.
 */
export function updateTripProgress(tripId: number, step: number, message: string, details?: string): void {
  tripProgressStore.set(tripId, {
    step,
    message,
    details,
    timestamp: Date.now(),
  });
}

/**
 * Get trip processing progress.
 */
export function getTripProgress(tripId: number): {
  step: number;
  message: string;
  details?: string;
  timestamp: number;
} | null {
  return tripProgressStore.get(tripId) ?? null;
}

/**
 * Clear trip processing progress.
 */
export function clearTripProgress(tripId: number): void {
  tripProgressStore.delete(tripId);
}

// ============================================================================
// DATA HELPERS
// ============================================================================

/**
 * Extract cost breakdown from trip data.
 */
export function extractCostBreakdown(trip: Trip): {
  total: number;
  perPerson: number;
  currency: string;
  breakdown: Record<string, number>;
} | null {
  const itinerary = trip.itinerary as any;
  const costBreakdown = itinerary?.costBreakdown;

  if (!costBreakdown) return null;

  return {
    total: costBreakdown.grandTotal ?? costBreakdown.total ?? 0,
    perPerson: costBreakdown.perPerson ?? 0,
    currency: costBreakdown.currency || trip.currency || 'USD',
    breakdown: {
      flights: costBreakdown.flights ?? 0,
      accommodation: costBreakdown.accommodation ?? 0,
      activities: costBreakdown.activities ?? 0,
      food: costBreakdown.food ?? 0,
      localTransport: costBreakdown.localTransport ?? 0,
    },
  };
}

/**
 * Extract certainty score from feasibility report.
 */
export function extractCertaintyScore(trip: Trip): {
  score: number;
  label: 'high' | 'medium' | 'low';
  verdict: string;
} | null {
  const feasibility = trip.feasibilityReport as any;
  if (!feasibility?.score) return null;

  const score = feasibility.score;
  return {
    score,
    label: score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low',
    verdict: feasibility.overall || (score >= 80 ? 'yes' : score >= 60 ? 'maybe' : 'no'),
  };
}

/**
 * Get all activity coordinates from a trip's itinerary.
 */
export function extractActivityCoordinates(trip: Trip): Array<{
  id: string;
  lat: number;
  lng: number;
  name: string;
  day: number;
  time: string;
  type: string;
}> {
  const itinerary = trip.itinerary as any;
  if (!itinerary?.days) return [];

  const coordinates: Array<{
    id: string;
    lat: number;
    lng: number;
    name: string;
    day: number;
    time: string;
    type: string;
  }> = [];

  itinerary.days.forEach((day: any) => {
    let activityIndex = 0;
    day.activities?.forEach((activity: any) => {
      activityIndex++;

      let lat: number | undefined;
      let lng: number | undefined;

      if (activity.coordinates?.lat && activity.coordinates?.lng) {
        lat = activity.coordinates.lat;
        lng = activity.coordinates.lng;
      } else if (typeof activity.location === 'object' && activity.location?.lat && activity.location?.lng) {
        lat = activity.location.lat;
        lng = activity.location.lng;
      }

      if (lat && lng) {
        coordinates.push({
          id: `${day.day}-${activityIndex}`,
          lat,
          lng,
          name: activity.name || activity.description || 'Unknown',
          day: day.day,
          time: activity.time || '',
          type: activity.type || 'activity',
        });
      }
    });
  });

  return coordinates;
}
