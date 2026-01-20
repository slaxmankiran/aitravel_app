/**
 * Logistics Validator (The Logistician)
 *
 * Deterministic validation of itinerary feasibility from a time/space perspective.
 * This is NOT an AI agent - it's pure logic that catches impossible schedules.
 *
 * Key responsibilities:
 * - Validate time ordering (morning before evening)
 * - Check transit time between activities
 * - Ensure adequate buffer time (especially for families)
 * - Validate activity density per day
 * - Check for scheduling conflicts
 */

import type { ItineraryDay, ItineraryActivity } from "../streamingItinerary";

// ============================================================================
// TYPES
// ============================================================================

export type LogisticsStatus = 'APPROVED' | 'IMPOSSIBLE' | 'TIGHT' | 'RELAXED';

export type ConflictType =
  | 'timing'           // Activities overlap or wrong order
  | 'transit'          // Not enough time to travel between locations
  | 'buffer'           // Insufficient rest/buffer time
  | 'density'          // Too many activities in one day
  | 'opening_hours'    // Activity scheduled outside operating hours
  | 'duration';        // Activity duration exceeds available time

export interface LogisticsConflict {
  day: number;
  type: ConflictType;
  severity: 'error' | 'warning';
  activity1: string;
  activity2?: string;
  issue: string;
  suggestion: string;
}

export interface DayLogistics {
  day: number;
  date: string;
  status: LogisticsStatus;
  activityCount: number;
  totalDurationMinutes: number;
  totalTransitMinutes: number;
  bufferMinutes: number;
  conflicts: LogisticsConflict[];
}

export interface LogisticsValidationResult {
  status: LogisticsStatus;
  totalConflicts: number;
  errorCount: number;
  warningCount: number;
  perDayLogistics: DayLogistics[];
  conflicts: LogisticsConflict[];
  flaggedDays: number[];
  suggestions: string[];
  logs: string[];
}

export interface GroupProfile {
  hasToddler: boolean;
  hasElderly: boolean;
  hasMobilityIssues: boolean;
  groupSize: number;
}

export interface LogisticsValidatorConfig {
  /** Maximum activities per day (default: 5) */
  maxActivitiesPerDay?: number;
  /** Minimum buffer between activities in minutes (default: 15) */
  minBufferMinutes?: number;
  /** Extra buffer for families with toddlers in minutes (default: 30) */
  toddlerBufferMinutes?: number;
  /** Extra buffer for elderly travelers in minutes (default: 20) */
  elderlyBufferMinutes?: number;
  /** Maximum total activity hours per day (default: 10) */
  maxActivityHoursPerDay?: number;
  /** Average walking speed in km/h (default: 4) */
  walkingSpeedKmh?: number;
  /** Threshold distance for walking in km (default: 2) */
  walkingThresholdKm?: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_CONFIG: Required<LogisticsValidatorConfig> = {
  maxActivitiesPerDay: 5,
  minBufferMinutes: 15,
  toddlerBufferMinutes: 30,
  elderlyBufferMinutes: 20,
  maxActivityHoursPerDay: 10,
  walkingSpeedKmh: 4,
  walkingThresholdKm: 2,
};

// Time slot definitions (for ordering validation)
const TIME_SLOTS = {
  morning: { start: 6, end: 12 },
  afternoon: { start: 12, end: 17 },
  evening: { start: 17, end: 23 },
};

// Average transit times by mode (minutes per km)
const TRANSIT_TIMES_PER_KM: Record<string, number> = {
  walk: 15,      // ~4 km/h
  metro: 3,      // ~20 km/h with stops
  bus: 4,        // ~15 km/h with stops
  taxi: 2.5,     // ~24 km/h in city
  car: 2.5,      // ~24 km/h in city
  train: 1.5,    // ~40 km/h
};

// ============================================================================
// MAIN VALIDATOR
// ============================================================================

/**
 * Validate itinerary logistics (time, space, feasibility)
 *
 * @param itinerary - Array of itinerary days with activities
 * @param groupProfile - Information about the travel group
 * @param config - Optional configuration overrides
 * @returns Detailed validation result with conflicts and suggestions
 */
export function validateLogistics(
  itinerary: ItineraryDay[],
  groupProfile: GroupProfile = { hasToddler: false, hasElderly: false, hasMobilityIssues: false, groupSize: 2 },
  config: LogisticsValidatorConfig = {}
): LogisticsValidationResult {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const logs: string[] = [];
  const allConflicts: LogisticsConflict[] = [];
  const perDayLogistics: DayLogistics[] = [];
  const flaggedDays: number[] = [];

  logs.push(`[Logistician] Starting logistics validation for ${itinerary.length} days`);
  logs.push(`[Logistician] Group profile: ${groupProfile.groupSize} travelers, toddler: ${groupProfile.hasToddler}, elderly: ${groupProfile.hasElderly}`);

  // Calculate required buffer based on group
  const requiredBuffer = calculateRequiredBuffer(groupProfile, cfg);
  logs.push(`[Logistician] Required buffer between activities: ${requiredBuffer} minutes`);

  for (const day of itinerary) {
    const dayResult = validateDay(day, requiredBuffer, cfg, groupProfile);
    perDayLogistics.push(dayResult);
    allConflicts.push(...dayResult.conflicts);

    if (dayResult.status === 'IMPOSSIBLE') {
      flaggedDays.push(day.day);
      logs.push(`[Logistician] Day ${day.day} REJECTED: ${dayResult.conflicts.filter(c => c.severity === 'error').length} impossible conflicts`);
    } else if (dayResult.status === 'TIGHT') {
      logs.push(`[Logistician] Day ${day.day} WARNING: Schedule is tight with ${dayResult.conflicts.filter(c => c.severity === 'warning').length} warnings`);
    } else {
      logs.push(`[Logistician] Day ${day.day} APPROVED: ${dayResult.activityCount} activities, ${dayResult.bufferMinutes}min buffer`);
    }
  }

  // Calculate overall status
  const errorCount = allConflicts.filter(c => c.severity === 'error').length;
  const warningCount = allConflicts.filter(c => c.severity === 'warning').length;

  let status: LogisticsStatus;
  if (errorCount > 0) {
    status = 'IMPOSSIBLE';
    logs.push(`[Logistician] FINAL VERDICT: IMPOSSIBLE - ${errorCount} blocking conflicts found`);
  } else if (warningCount > 2) {
    status = 'TIGHT';
    logs.push(`[Logistician] FINAL VERDICT: TIGHT - ${warningCount} warnings, schedule may be stressful`);
  } else if (allConflicts.length === 0 && itinerary.every(d => d.activities.length <= 3)) {
    status = 'RELAXED';
    logs.push(`[Logistician] FINAL VERDICT: RELAXED - Comfortable schedule with good buffer time`);
  } else {
    status = 'APPROVED';
    logs.push(`[Logistician] FINAL VERDICT: APPROVED - Schedule is feasible`);
  }

  // Generate suggestions
  const suggestions = generateLogisticsSuggestions(allConflicts, flaggedDays, groupProfile);

  return {
    status,
    totalConflicts: allConflicts.length,
    errorCount,
    warningCount,
    perDayLogistics,
    conflicts: allConflicts,
    flaggedDays,
    suggestions,
    logs,
  };
}

// ============================================================================
// DAY VALIDATION
// ============================================================================

/**
 * Validate a single day's logistics
 */
function validateDay(
  day: ItineraryDay,
  requiredBuffer: number,
  config: Required<LogisticsValidatorConfig>,
  groupProfile: GroupProfile
): DayLogistics {
  const conflicts: LogisticsConflict[] = [];
  let totalDurationMinutes = 0;
  let totalTransitMinutes = 0;

  const activities = day.activities;

  // Check 1: Activity density
  if (activities.length > config.maxActivitiesPerDay) {
    conflicts.push({
      day: day.day,
      type: 'density',
      severity: 'error',
      activity1: `${activities.length} activities`,
      issue: `Too many activities (${activities.length}) for one day. Maximum recommended: ${config.maxActivitiesPerDay}`,
      suggestion: `Remove ${activities.length - config.maxActivitiesPerDay} activities from Day ${day.day}`,
    });
  } else if (activities.length > config.maxActivitiesPerDay - 1 && groupProfile.hasToddler) {
    conflicts.push({
      day: day.day,
      type: 'density',
      severity: 'warning',
      activity1: `${activities.length} activities`,
      issue: `${activities.length} activities may be too many for a family with young children`,
      suggestion: `Consider reducing to ${config.maxActivitiesPerDay - 2} activities for Day ${day.day}`,
    });
  }

  // Check 2: Time ordering and transit between consecutive activities
  for (let i = 0; i < activities.length; i++) {
    const current = activities[i];
    const durationMinutes = parseDurationToMinutes(current.duration);
    totalDurationMinutes += durationMinutes;

    if (i < activities.length - 1) {
      const next = activities[i + 1];

      // Check time ordering
      const currentTime = parseTimeToMinutes(current.time);
      const nextTime = parseTimeToMinutes(next.time);
      const currentEndTime = currentTime + durationMinutes;

      if (currentEndTime > nextTime) {
        conflicts.push({
          day: day.day,
          type: 'timing',
          severity: 'error',
          activity1: current.name,
          activity2: next.name,
          issue: `"${current.name}" ends at ${formatMinutesToTime(currentEndTime)} but "${next.name}" starts at ${formatMinutesToTime(nextTime)}`,
          suggestion: `Move "${next.name}" to start after ${formatMinutesToTime(currentEndTime + requiredBuffer)}`,
        });
      } else {
        // Check transit time
        const transitMinutes = calculateTransitTime(
          current.coordinates,
          next.coordinates,
          current.transportMode || 'walk',
          config
        );
        totalTransitMinutes += transitMinutes;

        const availableTime = nextTime - currentEndTime;
        const requiredTime = transitMinutes + requiredBuffer;

        if (availableTime < transitMinutes) {
          conflicts.push({
            day: day.day,
            type: 'transit',
            severity: 'error',
            activity1: current.name,
            activity2: next.name,
            issue: `Only ${availableTime}min between activities, but transit takes ~${transitMinutes}min`,
            suggestion: `Add ${transitMinutes - availableTime + requiredBuffer}min gap or choose closer locations`,
          });
        } else if (availableTime < requiredTime) {
          conflicts.push({
            day: day.day,
            type: 'buffer',
            severity: 'warning',
            activity1: current.name,
            activity2: next.name,
            issue: `Only ${availableTime - transitMinutes}min buffer after transit (need ${requiredBuffer}min)`,
            suggestion: `Consider ${requiredBuffer}min buffer for comfort, especially with ${groupProfile.hasToddler ? 'children' : 'the group'}`,
          });
        }
      }
    }
  }

  // Check 3: Total active hours
  const totalActiveMinutes = totalDurationMinutes + totalTransitMinutes;
  const maxMinutes = config.maxActivityHoursPerDay * 60;

  if (totalActiveMinutes > maxMinutes) {
    conflicts.push({
      day: day.day,
      type: 'duration',
      severity: 'warning',
      activity1: `${Math.round(totalActiveMinutes / 60)}h total`,
      issue: `Day has ${Math.round(totalActiveMinutes / 60)}h of activities/transit (max recommended: ${config.maxActivityHoursPerDay}h)`,
      suggestion: `Reduce total activity time by ${Math.round((totalActiveMinutes - maxMinutes) / 60)}h`,
    });
  }

  // Calculate available buffer
  const dayStartMinutes = 8 * 60; // Assume 8 AM start
  const dayEndMinutes = 22 * 60;  // Assume 10 PM end
  const totalDayMinutes = dayEndMinutes - dayStartMinutes;
  const bufferMinutes = Math.max(0, totalDayMinutes - totalActiveMinutes);

  // Determine day status
  let status: LogisticsStatus;
  const errorConflicts = conflicts.filter(c => c.severity === 'error');
  const warningConflicts = conflicts.filter(c => c.severity === 'warning');

  if (errorConflicts.length > 0) {
    status = 'IMPOSSIBLE';
  } else if (warningConflicts.length > 1) {
    status = 'TIGHT';
  } else if (bufferMinutes > 180 && activities.length <= 3) {
    status = 'RELAXED';
  } else {
    status = 'APPROVED';
  }

  return {
    day: day.day,
    date: day.date,
    status,
    activityCount: activities.length,
    totalDurationMinutes,
    totalTransitMinutes,
    bufferMinutes,
    conflicts,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate required buffer based on group profile
 */
function calculateRequiredBuffer(
  profile: GroupProfile,
  config: Required<LogisticsValidatorConfig>
): number {
  let buffer = config.minBufferMinutes;

  if (profile.hasToddler) {
    buffer = Math.max(buffer, config.toddlerBufferMinutes);
  }

  if (profile.hasElderly || profile.hasMobilityIssues) {
    buffer = Math.max(buffer, config.elderlyBufferMinutes);
  }

  if (profile.groupSize > 4) {
    buffer += 10; // Larger groups need more coordination time
  }

  return buffer;
}

/**
 * Calculate transit time between two coordinates
 */
function calculateTransitTime(
  from: { lat: number; lng: number } | undefined,
  to: { lat: number; lng: number } | undefined,
  mode: string,
  config: Required<LogisticsValidatorConfig>
): number {
  if (!from || !to) {
    return 15; // Default assumption if no coordinates
  }

  const distance = haversineDistance(from.lat, from.lng, to.lat, to.lng);

  // Determine transport mode
  const normalizedMode = mode.toLowerCase();
  let transitMode = 'walk';

  if (distance > config.walkingThresholdKm) {
    // Auto-select based on distance
    if (distance < 5) {
      transitMode = normalizedMode.includes('metro') || normalizedMode.includes('subway') ? 'metro' : 'taxi';
    } else if (distance < 20) {
      transitMode = normalizedMode.includes('train') ? 'train' : 'metro';
    } else {
      transitMode = 'train';
    }
  }

  const minutesPerKm = TRANSIT_TIMES_PER_KM[transitMode] || TRANSIT_TIMES_PER_KM.walk;
  const transitMinutes = Math.ceil(distance * minutesPerKm);

  // Add fixed overhead (waiting, walking to/from station)
  const overhead = transitMode === 'walk' ? 0 : 10;

  return transitMinutes + overhead;
}

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Parse time string (e.g., "9:00 AM", "14:30") to minutes from midnight
 */
function parseTimeToMinutes(time: string): number {
  if (!time) return 9 * 60; // Default to 9 AM

  // Handle "9:00 AM" format
  const ampmMatch = time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (ampmMatch) {
    let hours = parseInt(ampmMatch[1], 10);
    const minutes = parseInt(ampmMatch[2], 10);
    const period = ampmMatch[3]?.toUpperCase();

    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;

    return hours * 60 + minutes;
  }

  // Handle "14:30" format
  const militaryMatch = time.match(/(\d{1,2}):(\d{2})/);
  if (militaryMatch) {
    return parseInt(militaryMatch[1], 10) * 60 + parseInt(militaryMatch[2], 10);
  }

  return 9 * 60; // Default
}

/**
 * Parse duration string (e.g., "2 hours", "1.5h", "90 minutes") to minutes
 */
function parseDurationToMinutes(duration: string): number {
  if (!duration) return 60; // Default to 1 hour

  const normalized = duration.toLowerCase();

  // Handle "2 hours" or "2h"
  const hoursMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(?:hours?|h)/);
  if (hoursMatch) {
    return Math.round(parseFloat(hoursMatch[1]) * 60);
  }

  // Handle "90 minutes" or "90min"
  const minutesMatch = normalized.match(/(\d+)\s*(?:minutes?|min)/);
  if (minutesMatch) {
    return parseInt(minutesMatch[1], 10);
  }

  // Handle "1h 30m" or "1:30"
  const combinedMatch = normalized.match(/(\d+)\s*(?:h|:)\s*(\d+)/);
  if (combinedMatch) {
    return parseInt(combinedMatch[1], 10) * 60 + parseInt(combinedMatch[2], 10);
  }

  return 60; // Default
}

/**
 * Format minutes from midnight back to time string
 */
function formatMinutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
  return `${displayHours}:${mins.toString().padStart(2, '0')} ${period}`;
}

/**
 * Generate actionable suggestions for logistics issues
 */
function generateLogisticsSuggestions(
  conflicts: LogisticsConflict[],
  flaggedDays: number[],
  groupProfile: GroupProfile
): string[] {
  const suggestions: string[] = [];

  if (conflicts.length === 0) {
    suggestions.push('Schedule looks good! All logistics validated.');
    return suggestions;
  }

  // Group conflicts by type
  const byType: Record<ConflictType, LogisticsConflict[]> = {
    timing: [],
    transit: [],
    buffer: [],
    density: [],
    opening_hours: [],
    duration: [],
  };

  for (const conflict of conflicts) {
    byType[conflict.type].push(conflict);
  }

  // Generate type-specific suggestions
  if (byType.timing.length > 0) {
    const timingDays = Array.from(new Set(byType.timing.map(c => c.day)));
    suggestions.push(`Fix time ordering on Day${flaggedDays.length > 1 ? 's' : ''} ${timingDays.join(', ')}.`);
  }

  if (byType.transit.length > 0) {
    suggestions.push(`Allow more travel time between activities or choose closer locations.`);
  }

  if (byType.buffer.length > 0 && groupProfile.hasToddler) {
    suggestions.push(`Add rest breaks for the family - toddlers need downtime between activities.`);
  }

  if (byType.density.length > 0) {
    const avgActivities = byType.density[0]?.activity1;
    suggestions.push(`Reduce activities per day (currently ${avgActivities}).`);
  }

  if (byType.duration.length > 0) {
    suggestions.push(`Shorten overall day length - the schedule is too packed.`);
  }

  return suggestions;
}

// ============================================================================
// UTILITY EXPORTS
// ============================================================================

/**
 * Quick feasibility check (no detailed breakdown)
 */
export function isLogisticallyFeasible(
  itinerary: ItineraryDay[],
  groupProfile?: GroupProfile
): boolean {
  const result = validateLogistics(itinerary, groupProfile);
  return result.status !== 'IMPOSSIBLE';
}

/**
 * Format logistics validation result for AI feedback prompt
 */
export function formatLogisticsFeedback(result: LogisticsValidationResult): string {
  if (result.status === 'APPROVED' || result.status === 'RELAXED') {
    return '';
  }

  const lines: string[] = [
    `LOGISTICS VALIDATION ${result.status === 'IMPOSSIBLE' ? 'FAILED' : 'WARNING'}:`,
    `- Total conflicts: ${result.totalConflicts} (${result.errorCount} errors, ${result.warningCount} warnings)`,
  ];

  if (result.flaggedDays.length > 0) {
    lines.push(`- Problem days: ${result.flaggedDays.join(', ')}`);
  }

  // List top 3 errors
  const errors = result.conflicts.filter(c => c.severity === 'error').slice(0, 3);
  for (const error of errors) {
    lines.push(`  - Day ${error.day}: ${error.issue}`);
  }

  if (result.status === 'IMPOSSIBLE') {
    lines.push(`REQUIRED: Fix the ${result.errorCount} impossible conflicts before proceeding.`);
  }

  lines.push(`SUGGESTIONS: ${result.suggestions.join(' ')}`);

  return lines.join('\n');
}

/**
 * Get time slot from time string
 */
export function getTimeSlot(time: string): 'morning' | 'afternoon' | 'evening' {
  const minutes = parseTimeToMinutes(time);
  const hours = minutes / 60;

  if (hours < TIME_SLOTS.morning.end) return 'morning';
  if (hours < TIME_SLOTS.afternoon.end) return 'afternoon';
  return 'evening';
}
