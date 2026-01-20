/**
 * itinerary-adapters.ts
 *
 * Utility functions for DayCardList components.
 * Handles activity keying, time slot bucketing, and data normalization.
 */

// ============================================================================
// TYPES (matching ItineraryTimeline data shape)
// ============================================================================

/**
 * Cost verification metadata (Trust Badges - Phase 3)
 * Shows where cost estimate came from and confidence level
 */
export type CostVerificationSource = "rag_knowledge" | "api_estimate" | "ai_estimate" | "user_input";
export type CostConfidence = "high" | "medium" | "low";

export interface CostVerification {
  /** Where the cost estimate came from */
  source: CostVerificationSource;
  /** Confidence level in the estimate */
  confidence: CostConfidence;
  /** When the cost was last verified (ISO date) */
  lastVerified?: string;
  /** Citation/source name for RAG-verified costs */
  citation?: string;
  /** Original AI estimate if different from verified */
  originalEstimate?: number;
}

export interface Activity {
  time: string;
  description: string;
  type: "activity" | "meal" | "transport" | "lodging";
  location?: string | { lat: number; lng: number; address?: string };
  coordinates?: { lat: number; lng: number };
  estimatedCost?: number;
  costNote?: string;
  bookingTip?: string;
  name?: string;
  cost?: number;
  transportMode?: string;
  /** Cost verification metadata (Phase 3 - Trust Badges) */
  costVerification?: CostVerification;
}

export interface LocalFoodSpot {
  meal: "breakfast" | "lunch" | "dinner";
  name: string;
  cuisine?: string;
  priceRange?: "$" | "$$" | "$$$";
  note?: string;
  estimatedCost?: number;
  coordinates?: { lat: number; lng: number };
  selected?: boolean;
}

export interface DayPlan {
  day: number;
  date: string;
  title: string;
  activities: Activity[];
  localFood?: LocalFoodSpot[];
}

export interface Itinerary {
  days: DayPlan[];
  costBreakdown?: {
    currencySymbol?: string;
    currency?: string;
    total?: number;
    grandTotal?: number;
  };
}

export type TimeSlot = "morning" | "afternoon" | "evening";

export interface BucketedActivities {
  morning: Activity[];
  afternoon: Activity[];
  evening: Activity[];
}

// ============================================================================
// ACTIVITY KEY GENERATION
// ============================================================================

/**
 * Generate a deterministic, stable key for an activity.
 * Format: "{dayNum}-{time}-{locationOrDesc}"
 *
 * This key is used for:
 * - React keys
 * - Map marker syncing
 * - Analytics tracking
 */
export function getActivityKey(day: DayPlan, activity: Activity, index: number): string {
  const location = getLocationString(activity);
  const identifier = location || activity.name || activity.description || `idx-${index}`;
  // Sanitize to create stable key
  const sanitized = identifier.replace(/[^a-zA-Z0-9]/g, '-').substring(0, 30);
  return `${day.day}-${activity.time}-${sanitized}`;
}

/**
 * Simplified activity key using day and index (matches ItineraryTimeline format).
 * Format: "{dayNum}-{activityIndex+1}"
 */
export function getSimpleActivityKey(dayNum: number, activityIndex: number): string {
  return `${dayNum}-${activityIndex + 1}`;
}

// ============================================================================
// TIME SLOT UTILITIES
// ============================================================================

/**
 * Parse time string and return time slot.
 * Handles formats: "9:00 AM", "14:00", "2:30 PM", etc.
 */
export function getTimeSlot(time: string): TimeSlot {
  const hour = parseHour(time);

  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

/**
 * Parse hour from time string.
 * Returns 0-23 hour value.
 */
function parseHour(time: string): number {
  const normalized = time.toLowerCase().trim();

  // Try 24-hour format first (14:00)
  const match24 = normalized.match(/^(\d{1,2}):/);
  if (match24) {
    return parseInt(match24[1], 10);
  }

  // Try 12-hour format (9:00 AM, 2:30 PM)
  const match12 = normalized.match(/^(\d{1,2}):?\d*\s*(am|pm)?/i);
  if (match12) {
    let hour = parseInt(match12[1], 10);
    const isPM = match12[2]?.toLowerCase() === 'pm';
    const isAM = match12[2]?.toLowerCase() === 'am';

    if (isPM && hour !== 12) hour += 12;
    if (isAM && hour === 12) hour = 0;

    return hour;
  }

  // Default to morning if unparseable
  return 9;
}

/**
 * Generate a stable key for de-duplication.
 * Uses time + name/description + cost.
 */
function getDedupeKey(activity: Activity): string {
  const time = activity.time || '';
  const name = (activity.name || activity.description || '').toLowerCase().trim();
  const cost = activity.estimatedCost || activity.cost || 0;
  return `${time}|${name}|${cost}`;
}

/**
 * De-duplicate activities (removes entries with same time + name + cost).
 */
export function dedupeActivities(activities: Activity[]): Activity[] {
  const seen = new Set<string>();
  const result: Activity[] = [];

  for (const activity of activities) {
    const key = getDedupeKey(activity);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(activity);
    }
  }

  return result;
}

/**
 * Bucket activities into morning/afternoon/evening groups.
 * Also de-duplicates activities before bucketing.
 */
export function bucketActivities(activities: Activity[]): BucketedActivities {
  const buckets: BucketedActivities = {
    morning: [],
    afternoon: [],
    evening: [],
  };

  // De-duplicate before bucketing
  const dedupedActivities = dedupeActivities(activities);

  for (const activity of dedupedActivities) {
    const slot = getTimeSlot(activity.time);
    buckets[slot].push(activity);
  }

  return buckets;
}

// ============================================================================
// DATA HELPERS
// ============================================================================

/**
 * Get location as string from activity.
 */
export function getLocationString(activity: Activity): string | null {
  if (!activity.location) return null;
  if (typeof activity.location === 'string') return activity.location;
  if (typeof activity.location === 'object' && activity.location.address) {
    return activity.location.address;
  }
  return null;
}

/**
 * Get display name for activity.
 */
export function getActivityName(activity: Activity): string {
  return activity.name || activity.description || 'Activity';
}

/**
 * Get cost from activity (handles both estimatedCost and cost fields).
 */
export function getActivityCost(activity: Activity): number | null {
  if (typeof activity.estimatedCost === 'number') return activity.estimatedCost;
  if (typeof activity.cost === 'number') return activity.cost;
  return null;
}

/**
 * Check if activity has valid coordinates.
 */
export function hasCoordinates(activity: Activity): boolean {
  return !!(
    (activity.coordinates?.lat && activity.coordinates?.lng) ||
    (typeof activity.location === 'object' && activity.location?.lat && activity.location?.lng)
  );
}

/**
 * Get coordinates from activity.
 */
export function getCoordinates(activity: Activity): { lat: number; lng: number } | null {
  if (activity.coordinates?.lat && activity.coordinates?.lng) {
    return activity.coordinates;
  }
  if (typeof activity.location === 'object' && activity.location?.lat && activity.location?.lng) {
    return { lat: activity.location.lat, lng: activity.location.lng };
  }
  return null;
}

// ============================================================================
// CURRENCY HELPERS
// ============================================================================

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', INR: '₹', EUR: '€', GBP: '£', JPY: '¥', AUD: 'A$', CAD: 'C$',
  SGD: 'S$', AED: 'د.إ', THB: '฿', CNY: '¥', CHF: 'CHF', KRW: '₩',
  HKD: 'HK$', NZD: 'NZ$', MXN: '$', BRL: 'R$', MYR: 'RM', PHP: '₱',
  ZAR: 'R', TRY: '₺', RUB: '₽', PLN: 'zł',
};

export function getCurrencySymbol(currency?: string): string {
  return CURRENCY_SYMBOLS[currency || 'USD'] || currency || '$';
}

// ============================================================================
// TIME SLOT DISPLAY
// ============================================================================

export const TIME_SLOT_CONFIG: Record<TimeSlot, { label: string; icon: string; color: string }> = {
  morning: { label: 'Morning', icon: '🌅', color: 'text-amber-600' },
  afternoon: { label: 'Afternoon', icon: '☀️', color: 'text-orange-600' },
  evening: { label: 'Evening', icon: '🌙', color: 'text-indigo-600' },
};

// ============================================================================
// DISTANCE UTILITIES
// ============================================================================

/**
 * Calculate distance between two coordinates in kilometers (Haversine formula).
 */
export function calculateDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculate distance between two activities (if both have coordinates).
 */
export function getDistanceBetweenActivities(
  activity1: Activity,
  activity2: Activity
): number | null {
  const coord1 = getCoordinates(activity1);
  const coord2 = getCoordinates(activity2);

  if (!coord1 || !coord2) return null;

  return calculateDistance(coord1.lat, coord1.lng, coord2.lat, coord2.lng);
}

/**
 * Format distance for display.
 */
export function formatDistance(distanceKm: number): string {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)}m`;
  }
  return `${distanceKm.toFixed(1)}km`;
}

/**
 * Estimate walking time from distance (assuming 5 km/h).
 */
export function estimateWalkingTime(distanceKm: number): string {
  const minutes = Math.round((distanceKm / 5) * 60);
  if (minutes < 1) return '<1 min';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

// ============================================================================
// SMART TRANSPORT MODE
// ============================================================================

/**
 * Keywords that suggest user has luggage or special transport needs
 */
const LUGGAGE_KEYWORDS = [
  'airport', 'check out', 'checkout', 'check-out', 'depart', 'departure',
  'arrive', 'arrival', 'station', 'terminal', 'hotel', 'hostel', 'accommodation'
];

const LODGING_ACTIVITY_KEYWORDS = [
  'check in', 'checkin', 'check-in', 'check out', 'checkout', 'check-out'
];

/**
 * Determine if activity involves luggage (airport, hotel checkout, etc.)
 */
export function hasLuggageContext(activity: Activity, prevActivity?: Activity): boolean {
  const activityText = `${activity.description} ${activity.name || ''} ${getLocationString(activity) || ''}`.toLowerCase();
  const prevText = prevActivity
    ? `${prevActivity.description} ${prevActivity.name || ''} ${getLocationString(prevActivity) || ''}`.toLowerCase()
    : '';

  // Check for lodging type with checkout keywords
  if (activity.type === 'lodging' || activity.type === 'transport') {
    if (LODGING_ACTIVITY_KEYWORDS.some(kw => activityText.includes(kw) || prevText.includes(kw))) {
      return true;
    }
  }

  // Check for airport/station keywords
  if (LUGGAGE_KEYWORDS.some(kw => activityText.includes(kw) || prevText.includes(kw))) {
    return true;
  }

  return false;
}

/**
 * Get smart transport mode based on distance and activity context.
 * Returns: { mode: string, time: string, realistic: boolean }
 */
export function getSmartTransportMode(
  distanceKm: number | null,
  activity: Activity,
  prevActivity?: Activity
): { mode: string; time: string; icon: string } {
  // If no distance, return the activity's own transport mode or default
  if (distanceKm === null || distanceKm === undefined) {
    const mode = activity.transportMode || 'walk';
    return { mode, time: '', icon: getTransportIconName(mode) };
  }

  const hasLuggage = hasLuggageContext(activity, prevActivity);

  // Decision logic based on distance and context
  if (hasLuggage) {
    // Always suggest taxi/car when luggage is involved
    if (distanceKm < 0.3) {
      return { mode: 'walk', time: estimateWalkingTime(distanceKm), icon: 'walk' };
    }
    const taxiTime = Math.round((distanceKm / 30) * 60); // ~30 km/h avg in city
    return {
      mode: 'taxi',
      time: taxiTime < 60 ? `${Math.max(5, taxiTime)} min` : `${Math.floor(taxiTime/60)}h ${taxiTime%60}m`,
      icon: 'car'
    };
  }

  // No luggage - base on distance
  if (distanceKm < 1) {
    // < 1km: Walk
    return { mode: 'walk', time: estimateWalkingTime(distanceKm), icon: 'walk' };
  } else if (distanceKm < 3) {
    // 1-3km: Walk or metro
    return { mode: 'walk', time: estimateWalkingTime(distanceKm), icon: 'walk' };
  } else if (distanceKm < 10) {
    // 3-10km: Metro/bus
    const transitTime = Math.round((distanceKm / 25) * 60) + 10; // ~25km/h + wait time
    return { mode: 'metro', time: `${transitTime} min`, icon: 'train' };
  } else if (distanceKm < 50) {
    // 10-50km: Taxi or train
    const taxiTime = Math.round((distanceKm / 35) * 60);
    return {
      mode: 'taxi',
      time: taxiTime < 60 ? `${taxiTime} min` : `${Math.floor(taxiTime/60)}h ${taxiTime%60}m`,
      icon: 'car'
    };
  } else {
    // > 50km: Likely intercity - train, bus, or flight
    if (distanceKm > 300) {
      const flightTime = Math.round(distanceKm / 500 * 60) + 90; // flight time + airport overhead
      return { mode: 'flight', time: `${Math.floor(flightTime/60)}h`, icon: 'plane' };
    }
    const trainTime = Math.round((distanceKm / 80) * 60);
    return {
      mode: 'train',
      time: trainTime < 60 ? `${trainTime} min` : `${Math.floor(trainTime/60)}h ${trainTime%60}m`,
      icon: 'train'
    };
  }
}

/**
 * Get transport icon name for a mode string
 */
function getTransportIconName(mode: string): string {
  const m = mode.toLowerCase();
  if (m.includes('walk')) return 'walk';
  if (m.includes('metro') || m.includes('subway') || m.includes('mrt') || m.includes('bts')) return 'train';
  if (m.includes('train')) return 'train';
  if (m.includes('bus')) return 'bus';
  if (m.includes('flight') || m.includes('fly') || m.includes('plane')) return 'plane';
  if (m.includes('ferry') || m.includes('boat')) return 'boat';
  return 'car';
}

// ============================================================================
// CITY EXTRACTION
// ============================================================================

// Known city names for better extraction
const KNOWN_CITIES = [
  'Bangkok', 'Chiang Mai', 'Chiang Rai', 'Phuket', 'Krabi', 'Pattaya', 'Ayutthaya',
  'Koh Samui', 'Koh Phangan', 'Koh Tao', 'Hua Hin', 'Sukhothai', 'Pai',
  'Tokyo', 'Kyoto', 'Osaka', 'Nara', 'Hiroshima', 'Hakone', 'Nikko',
  'Singapore', 'Kuala Lumpur', 'Penang', 'Langkawi', 'Malacca',
  'Bali', 'Ubud', 'Seminyak', 'Jakarta', 'Yogyakarta',
  'Ho Chi Minh', 'Hanoi', 'Da Nang', 'Hoi An', 'Sapa', 'Halong',
  'Mumbai', 'Delhi', 'Jaipur', 'Agra', 'Goa', 'Udaipur', 'Varanasi',
  'Paris', 'London', 'Rome', 'Barcelona', 'Amsterdam', 'Berlin', 'Prague',
  'New York', 'Los Angeles', 'San Francisco', 'Miami', 'Las Vegas',
  'Sydney', 'Melbourne', 'Auckland', 'Queenstown',
  'Dubai', 'Abu Dhabi', 'Istanbul', 'Cairo',
];

/**
 * Extract city from day title - looks for known city names first.
 * Returns null if city cannot be determined (to avoid false positives).
 */
export function extractCityFromTitle(title: string): string | null {
  // First, check for known city names (case-insensitive)
  for (const city of KNOWN_CITIES) {
    if (title.toLowerCase().includes(city.toLowerCase())) {
      return city;
    }
  }

  // Fallback: Try "City - Theme" or "City: Theme" pattern
  const dashMatch = title.match(/^([^-–—:]+)[-–—:]/);
  if (dashMatch) {
    const candidate = dashMatch[1].trim();
    // Only return if it looks like a city name (not too long, starts with capital)
    if (candidate.length < 20 && /^[A-Z]/.test(candidate)) {
      return candidate;
    }
  }

  return null; // Can't determine city
}
