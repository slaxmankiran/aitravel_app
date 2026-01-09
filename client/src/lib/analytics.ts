/**
 * analytics.ts
 *
 * Client-side analytics helper for trip page events.
 * Fire-and-forget, swallows errors, handles deduplication.
 */

// ============================================================================
// SESSION & FLOW TRACKING
// ============================================================================

// Generate UUID v4
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Session ID - persists for browser session
function getSessionId(): string {
  const key = 'voyageai_session_id';
  let sessionId = sessionStorage.getItem(key);
  if (!sessionId) {
    sessionId = generateUUID();
    sessionStorage.setItem(key, sessionId);
  }
  return sessionId;
}

// Flow ID - persists for a single trip attempt (reset on new flow)
let currentFlowId: string | null = null;
let flowTripId: number | null = null; // Maps flow to tripId once created

export function startNewFlow(): string {
  currentFlowId = generateUUID();
  flowTripId = null;
  sessionStorage.setItem('voyageai_flow_id', currentFlowId);
  sessionStorage.setItem('voyageai_flow_start', Date.now().toString());
  return currentFlowId;
}

export function getFlowId(): string {
  if (!currentFlowId) {
    currentFlowId = sessionStorage.getItem('voyageai_flow_id') || startNewFlow();
  }
  return currentFlowId;
}

export function mapFlowToTrip(tripId: number): void {
  flowTripId = tripId;
  sessionStorage.setItem('voyageai_flow_trip_id', tripId.toString());
}

export function getFlowTripId(): number | null {
  if (flowTripId) return flowTripId;
  const stored = sessionStorage.getItem('voyageai_flow_trip_id');
  return stored ? parseInt(stored, 10) : null;
}

// ============================================================================
// ENTRY METADATA
// ============================================================================

export interface EntryMetadata {
  referrer: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  entryPoint: 'landing' | 'demo' | 'chat' | 'create' | 'direct' | 'results';
  device: 'mobile' | 'tablet' | 'desktop';
  locale: string;
  timezone: string;
}

function getDevice(): 'mobile' | 'tablet' | 'desktop' {
  const width = window.innerWidth;
  if (width < 768) return 'mobile';
  if (width < 1024) return 'tablet';
  return 'desktop';
}

function getUTMParams(): { utmSource?: string; utmMedium?: string; utmCampaign?: string } {
  const params = new URLSearchParams(window.location.search);
  return {
    utmSource: params.get('utm_source') || undefined,
    utmMedium: params.get('utm_medium') || undefined,
    utmCampaign: params.get('utm_campaign') || undefined,
  };
}

function detectEntryPoint(): EntryMetadata['entryPoint'] {
  const path = window.location.pathname;
  if (path === '/' || path === '') return 'landing';
  if (path.includes('/demo')) return 'demo';
  if (path.includes('/chat')) return 'chat';
  if (path.includes('/create')) return 'create';
  if (path.includes('/results') || path.includes('/trips')) return 'results';
  return 'direct';
}

// Cached entry metadata (set once per session)
let cachedEntryMetadata: EntryMetadata | null = null;

export function getEntryMetadata(): EntryMetadata {
  if (cachedEntryMetadata) return cachedEntryMetadata;

  const stored = sessionStorage.getItem('voyageai_entry_metadata');
  if (stored) {
    cachedEntryMetadata = JSON.parse(stored);
    return cachedEntryMetadata!;
  }

  const utm = getUTMParams();
  cachedEntryMetadata = {
    referrer: document.referrer || 'direct',
    ...utm,
    entryPoint: detectEntryPoint(),
    device: getDevice(),
    locale: navigator.language || 'en-US',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  };

  sessionStorage.setItem('voyageai_entry_metadata', JSON.stringify(cachedEntryMetadata));
  return cachedEntryMetadata;
}

// ============================================================================
// PAGE VALUES (explicit per route)
// ============================================================================

export type PageName =
  | 'landing'
  | 'demo'
  | 'chat'
  | 'create'
  | 'feasibility'
  | 'results_v1'
  | 'results_legacy'
  | 'unknown';

export function getCurrentPage(): PageName {
  const path = window.location.pathname;
  if (path === '/' || path === '') return 'landing';
  if (path.includes('/demo')) return 'demo';
  if (path.includes('/chat')) return 'chat';
  if (path.includes('/create')) return 'create';
  if (path.includes('/feasibility')) return 'feasibility';
  if (path.includes('/results-v1')) return 'results_v1';
  if (path.includes('/results') || path.includes('/trips')) return 'results_legacy';
  return 'unknown';
}

// ============================================================================
// VERDICT ENUM (standardized)
// ============================================================================

export type FeasibilityVerdict = 'go' | 'possible' | 'difficult' | 'no';

export function normalizeVerdict(rawVerdict: string): FeasibilityVerdict {
  const lower = rawVerdict.toLowerCase();
  if (lower.includes('yes') || lower.includes('go') || lower.includes('feasible')) return 'go';
  if (lower.includes('possible') || lower.includes('maybe') || lower.includes('conditional')) return 'possible';
  if (lower.includes('difficult') || lower.includes('challenging') || lower.includes('risky')) return 'difficult';
  return 'no';
}

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

// Full event payload shape
export interface TripEventPayload {
  // Identifiers
  event: TripEventName | string;
  ts: string;
  tripId: number;
  sessionId: string;
  flowId: string;

  // Location
  page: PageName;

  // Attribution
  entry: EntryMetadata;

  // Trip context
  context: TripEventContext;

  // Event-specific data
  data: TripEventData;
}

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
 * @param tripId - Trip identifier (0 for pre-creation, will be linked via flowId)
 * @param event - Event name from canonical set
 * @param data - Free-form event-specific data
 * @param context - Stable trip identifiers for analysis
 * @param page - Page identifier (auto-detected if not provided)
 */
export function trackTripEvent(
  tripId: number,
  event: TripEventName | string,
  data?: TripEventData,
  context?: TripEventContext,
  page?: PageName
): void {
  // Client-side deduplication
  if (!shouldFire(event, tripId, data)) {
    return;
  }

  // Map flow to trip if we have a tripId
  if (tripId > 0) {
    mapFlowToTrip(tripId);
  }

  const payload: TripEventPayload = {
    // Identifiers
    event,
    ts: new Date().toISOString(),
    tripId: tripId || getFlowTripId() || 0,
    sessionId: getSessionId(),
    flowId: getFlowId(),

    // Location (explicit, not defaulted)
    page: page || getCurrentPage(),

    // Attribution
    entry: getEntryMetadata(),

    // Trip context
    context: context || {},

    // Event-specific data
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
// TIME TO VALUE HELPERS
// ============================================================================

export function getFlowStartTime(): number | null {
  const stored = sessionStorage.getItem('voyageai_flow_start');
  return stored ? parseInt(stored, 10) : null;
}

export function getTimeInFlow(): number | null {
  const start = getFlowStartTime();
  if (!start) return null;
  return Date.now() - start;
}

// ============================================================================
// RESET (for testing)
// ============================================================================

export function resetAnalyticsState(): void {
  oneShot.clear();
  throttled.clear();
  currentFlowId = null;
  flowTripId = null;
  cachedEntryMetadata = null;
  sessionStorage.removeItem('voyageai_session_id');
  sessionStorage.removeItem('voyageai_flow_id');
  sessionStorage.removeItem('voyageai_flow_start');
  sessionStorage.removeItem('voyageai_flow_trip_id');
  sessionStorage.removeItem('voyageai_entry_metadata');
}
