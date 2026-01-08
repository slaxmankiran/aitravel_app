/**
 * analytics.ts
 *
 * Client-side analytics helper for trip page events.
 * Fire-and-forget, swallows errors, handles deduplication.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface TripEventContext {
  passport?: string;
  destination?: string;
  visaType?: string;
  certaintyScore?: number;
  isCurated?: boolean;
  travelStyle?: string;
  groupSize?: number;
}

export interface TripEventData {
  [key: string]: string | number | boolean | undefined;
}

// Canonical event names for V1 funnel
export type TripEventName =
  // Core funnel events
  | 'landing_viewed'              // Home page loaded
  | 'demo_opened'                 // Demo page opened
  | 'create_started'              // CreateTrip form started
  | 'feasibility_completed'       // Feasibility analysis done (with score + verdict)
  | 'itinerary_generate_started'  // Itinerary generation started
  | 'itinerary_generate_completed' // Itinerary ready
  | 'itinerary_viewed'            // Results page fully loaded with itinerary
  // Chat planning events
  | 'chat_plan_clicked'           // User clicked Plan My Trip from chat
  | 'chat_plan_success'           // Trip successfully created from chat
  | 'chat_plan_failed'            // Trip creation failed from chat (include errorType)
  // Engagement events
  | 'day_clicked'
  | 'activity_clicked'
  | 'map_marker_clicked'
  | 'chat_opened'
  | 'chat_change_applied'
  | 'chat_change_undone'
  | 'panel_toggled'
  | 'export_pdf_clicked'
  | 'export_json_clicked'
  | 'share_clicked'
  | 'booking_link_clicked';

// ============================================================================
// DEDUPLICATION
// ============================================================================

// One-shot events: only fire once per session
const oneShot = new Set<string>();

// Throttled events: limit frequency
const throttled = new Map<string, number>();
const THROTTLE_MS = 500; // 500ms between same events

function shouldFire(
  event: string,
  tripId: number,
  data?: TripEventData
): boolean {
  const key = `${tripId}:${event}:${JSON.stringify(data || {})}`;

  // One-shot events (generate_completed, generate_started per trip)
  if (event === 'itinerary_generate_completed' || event === 'itinerary_generate_started') {
    if (oneShot.has(key)) {
      return false;
    }
    oneShot.add(key);
    return true;
  }

  // Throttle hover-like events
  if (event === 'activity_clicked' || event === 'map_marker_clicked') {
    const lastFired = throttled.get(key);
    const now = Date.now();
    if (lastFired && now - lastFired < THROTTLE_MS) {
      return false;
    }
    throttled.set(key, now);
  }

  return true;
}

// ============================================================================
// MAIN HELPER
// ============================================================================

/**
 * Track a trip page event.
 * Fire-and-forget: errors are swallowed, does not block UI.
 *
 * @param tripId - Required trip identifier
 * @param event - Event name from canonical set
 * @param data - Free-form event-specific data
 * @param context - Stable trip identifiers for analysis
 * @param page - Page identifier (defaults to 'trip_results_v1')
 */
export function trackTripEvent(
  tripId: number,
  event: TripEventName | string,
  data?: TripEventData,
  context?: TripEventContext,
  page: string = 'trip_results_v1'
): void {
  // Client-side deduplication
  if (!shouldFire(event, tripId, data)) {
    return;
  }

  const payload = {
    event,
    ts: new Date().toISOString(),
    tripId,
    page,
    context: context || {},
    data: data || {},
  };

  // sendBeacon is ideal for unload events, use fetch as fallback
  const body = JSON.stringify(payload);

  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' });
      const ok = navigator.sendBeacon('/api/analytics/trip-events', blob);
      if (ok) return;
    }
  } catch {
    // Fall through to fetch
  }

  // Fire and forget fallback
  fetch('/api/analytics/trip-events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => {
    // Swallow errors - analytics should never break the app
  });
}

// ============================================================================
// CONTEXT BUILDER
// ============================================================================

/**
 * Build context object from trip data.
 * Call once when trip loads, pass to all events.
 */
export function buildTripContext(trip: {
  passport?: string | null;
  destination?: string | null;
  travelStyle?: string | null;
  feasibilityReport?: unknown;
  isCurated?: boolean;
  groupSize?: number | null;
}): TripEventContext {
  const report = trip.feasibilityReport as any;

  return {
    passport: trip.passport || undefined,
    destination: trip.destination || undefined,
    visaType: report?.visaDetails?.type || undefined,
    certaintyScore: report?.score || undefined,
    isCurated: trip.isCurated || undefined,
    travelStyle: trip.travelStyle || undefined,
    groupSize: trip.groupSize || undefined,
  };
}

// ============================================================================
// RESET (for testing)
// ============================================================================

export function resetAnalyticsState(): void {
  oneShot.clear();
  throttled.clear();
}
