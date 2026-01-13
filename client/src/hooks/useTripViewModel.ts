/**
 * useTripViewModel.ts
 *
 * Separates server data (source of truth) from local working state.
 * Implements the workingTrip pattern for optimistic updates.
 *
 * Architecture:
 * - serverTrip: Raw trip from React Query (read-only)
 * - workingTrip: What UI renders, what chat edits modify
 * - lastAppliedChange: For undo capability
 *
 * Merge Rules:
 * - Initialize workingTrip once when trip loads
 * - Server updates merge only safe fields (progress, itinerary when missing)
 * - Chat updates go directly to workingTrip
 */

import { useState, useCallback, useMemo, useEffect } from "react";
import type { TripResponse } from "@shared/schema";

// ============================================================================
// TYPES
// ============================================================================

export interface DayViewModel {
  dayNumber: number;
  date: string;
  title: string;
  activities: ActivityViewModel[];
  totalCost: number;
}

export interface ActivityViewModel {
  id: string;           // Stable key for map sync
  activityKey: string;  // Deterministic key: `${day}-${time}-${location}`
  time: string;
  title: string;
  description?: string;
  location?: string;
  coordinates?: { lat: number; lng: number };
  cost?: number;
  duration?: string;
  type: 'activity' | 'meal' | 'transport' | 'lodging';
  tips?: string[];
  timeSlot: 'morning' | 'afternoon' | 'evening';
}

export type BudgetStatus = 'under' | 'near' | 'over20' | 'over50';

export interface CostViewModel {
  flights: number;
  accommodation: number;
  activities: number;
  food: number;
  transport: number;
  visa: number;
  insurance: number;
  miscellaneous: number;
  grandTotal: number;
  perPerson: number;
  currency: string;
  // Budget delta fields
  userBudget: number;
  overByAmount: number;
  overByPercent: number;
  budgetStatus: BudgetStatus;
  hasBudgetSet: boolean; // True only if user set a realistic budget (>= $100/person)
}

export interface ViewState {
  activeDayIndex: number;
  activeActivityKey: string | null;
  highlightedLocation: string | null;
  isMapExpanded: boolean;
}

export interface AppliedChange {
  type: 'itinerary' | 'budget' | 'activity';
  previousValue: any;
  newValue: any;
  timestamp: number;
}

export interface TripViewModel {
  // Core data
  trip: TripResponse;
  workingTrip: TripResponse;
  days: DayViewModel[];
  costs: CostViewModel | null;

  // Generation state
  isGenerating: boolean;

  // View state
  viewState: ViewState;

  // Actions
  setActiveDay: (index: number) => void;
  setActiveActivity: (key: string | null) => void;
  setHighlightedLocation: (id: string | null) => void;
  toggleMapExpanded: () => void;

  // Chat integration
  applyChange: (update: { itinerary?: any; budgetBreakdown?: any }) => void;
  undoLastChange: () => boolean;
  hasUndoableChange: boolean;

  // State flags
  hasLocalChanges: boolean;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Generate deterministic activity key for map sync
 */
function generateActivityKey(dayNumber: number, activity: any): string {
  const time = activity.time || 'unknown';
  const location = typeof activity.location === 'string'
    ? activity.location
    : activity.location?.address || activity.name || 'unknown';
  return `${dayNumber}-${time}-${location}`.replace(/\s+/g, '_').toLowerCase();
}

/**
 * Determine time slot from time string
 */
function getTimeSlot(time: string): 'morning' | 'afternoon' | 'evening' {
  if (!time) return 'morning';
  const hour = parseInt(time.split(':')[0], 10);
  if (isNaN(hour)) return 'morning';
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

// ============================================================================
// TRANSFORMERS
// ============================================================================

function transformDays(itinerary: any): DayViewModel[] {
  if (!itinerary?.days || !Array.isArray(itinerary.days)) {
    return [];
  }

  return itinerary.days.map((day: any, index: number) => {
    const dayNumber = index + 1;
    const activities: ActivityViewModel[] = [];

    // Transform activities
    if (day.activities && Array.isArray(day.activities)) {
      day.activities.forEach((activity: any, actIndex: number) => {
        const activityKey = generateActivityKey(dayNumber, activity);
        activities.push({
          id: `day${dayNumber}-act${actIndex}`,
          activityKey,
          time: activity.time || '',
          title: activity.name || activity.title || 'Activity',
          description: activity.description,
          location: typeof activity.location === 'string'
            ? activity.location
            : activity.location?.address,
          coordinates: activity.coordinates || activity.location?.lat
            ? {
                lat: activity.coordinates?.lat || activity.location?.lat,
                lng: activity.coordinates?.lng || activity.location?.lng
              }
            : undefined,
          cost: activity.cost,
          duration: activity.duration,
          type: activity.type || 'activity',
          tips: activity.tips,
          timeSlot: getTimeSlot(activity.time),
        });
      });
    }

    // Calculate day total
    const totalCost = activities.reduce((sum, act) => sum + (act.cost || 0), 0);

    return {
      dayNumber,
      date: day.date || '',
      title: day.title || `Day ${dayNumber}`,
      activities,
      totalCost,
    };
  });
}

function transformCosts(itinerary: any, trip: TripResponse): CostViewModel | null {
  const breakdown = itinerary?.costBreakdown;
  if (!breakdown) return null;

  const grandTotal = breakdown.grandTotal || breakdown.total || 0;
  // Robust budget parsing: handle strings like "2000", "$2,000", "2000.50"
  const userBudget = typeof trip.budget === 'number'
    ? trip.budget
    : Number(String(trip.budget || '').replace(/[^\d.]/g, '')) || 0;
  const overByAmount = grandTotal - userBudget;
  const overByPercent = userBudget > 0 ? (overByAmount / userBudget) * 100 : 0;

  // Determine budget status
  let budgetStatus: BudgetStatus = 'under';
  if (overByPercent >= 50) {
    budgetStatus = 'over50';
  } else if (overByPercent >= 20) {
    budgetStatus = 'over20';
  } else if (overByPercent > -10) {
    budgetStatus = 'near';
  }

  // Determine if user set a realistic budget (at least $100/person)
  const minBudgetPerPerson = 100;
  const travelers = trip.groupSize || 1;
  const hasBudgetSet = userBudget > 0 && (userBudget / travelers) >= minBudgetPerPerson;

  return {
    flights: breakdown.flights || 0,
    accommodation: breakdown.accommodation || 0,
    activities: breakdown.activities || 0,
    food: breakdown.food || 0,
    transport: breakdown.localTransport || breakdown.transport || 0,
    visa: breakdown.visa || 0,
    insurance: breakdown.insurance || 0,
    miscellaneous: breakdown.miscellaneous || breakdown.misc || 0,
    grandTotal,
    perPerson: breakdown.perPerson || (grandTotal / travelers),
    currency: trip.currency || 'USD',
    // Budget delta fields
    userBudget,
    overByAmount,
    overByPercent,
    budgetStatus,
    hasBudgetSet,
  };
}

// ============================================================================
// HOOK
// ============================================================================

export function useTripViewModel(serverTrip: TripResponse): TripViewModel {
  // Working trip state (what UI renders)
  const [workingTrip, setWorkingTrip] = useState<TripResponse>(serverTrip);

  // Last applied change for undo
  const [lastAppliedChange, setLastAppliedChange] = useState<AppliedChange | null>(null);

  // View state
  const [viewState, setViewState] = useState<ViewState>({
    activeDayIndex: 0,
    activeActivityKey: null,
    highlightedLocation: null,
    isMapExpanded: false,
  });

  // Merge server updates into workingTrip (safe merge strategy)
  useEffect(() => {
    setWorkingTrip(prev => {
      // First load - use server data directly
      if (prev.id !== serverTrip.id) {
        return serverTrip;
      }

      // Safe merge: keep local edits, allow server to fill missing outputs
      return {
        ...prev,
        // Always sync these from server
        feasibilityStatus: serverTrip.feasibilityStatus,
        updatedAt: serverTrip.updatedAt,
        // Only update if server has data and local doesn't
        feasibilityReport: serverTrip.feasibilityReport ?? prev.feasibilityReport,
        itinerary: prev.itinerary
          ? prev.itinerary  // Keep local edits
          : serverTrip.itinerary,  // Use server if no local
      };
    });
  }, [serverTrip]);

  // Compute isGenerating
  const isGenerating = useMemo(() => {
    return (
      workingTrip.feasibilityStatus === 'pending' ||
      ((workingTrip.feasibilityStatus === 'yes' || workingTrip.feasibilityStatus === 'warning') &&
        !(workingTrip.itinerary as any)?.days?.length)
    );
  }, [workingTrip.feasibilityStatus, workingTrip.itinerary]);

  // Transform to view models
  const days = useMemo(() => {
    return transformDays(workingTrip.itinerary);
  }, [workingTrip.itinerary]);

  const costs = useMemo(() => {
    return transformCosts(workingTrip.itinerary, workingTrip);
  }, [workingTrip.itinerary, workingTrip]);

  // Check if we have local changes
  const hasLocalChanges = useMemo(() => {
    return JSON.stringify(workingTrip.itinerary) !== JSON.stringify(serverTrip.itinerary);
  }, [workingTrip.itinerary, serverTrip.itinerary]);

  // Actions
  const setActiveDay = useCallback((index: number) => {
    setViewState(prev => ({ ...prev, activeDayIndex: index }));
  }, []);

  const setActiveActivity = useCallback((key: string | null) => {
    setViewState(prev => ({ ...prev, activeActivityKey: key }));
  }, []);

  const setHighlightedLocation = useCallback((id: string | null) => {
    setViewState(prev => ({ ...prev, highlightedLocation: id }));
  }, []);

  const toggleMapExpanded = useCallback(() => {
    setViewState(prev => ({ ...prev, isMapExpanded: !prev.isMapExpanded }));
  }, []);

  // Chat integration - apply change with undo support
  const applyChange = useCallback((update: { itinerary?: any; budgetBreakdown?: any }) => {
    setWorkingTrip(prev => {
      const prevItinerary = prev.itinerary as any;
      let newItinerary = prevItinerary;

      if (update.itinerary) {
        newItinerary = update.itinerary;
        // Store for undo
        setLastAppliedChange({
          type: 'itinerary',
          previousValue: prevItinerary,
          newValue: update.itinerary,
          timestamp: Date.now(),
        });
      }

      if (update.budgetBreakdown && newItinerary) {
        newItinerary = {
          ...newItinerary,
          costBreakdown: update.budgetBreakdown,
        };
        if (!update.itinerary) {
          setLastAppliedChange({
            type: 'budget',
            previousValue: prevItinerary?.costBreakdown,
            newValue: update.budgetBreakdown,
            timestamp: Date.now(),
          });
        }
      }

      return {
        ...prev,
        itinerary: newItinerary,
      };
    });
  }, []);

  // Undo last change
  const undoLastChange = useCallback(() => {
    if (!lastAppliedChange) return false;

    setWorkingTrip(prev => {
      const prevItinerary = prev.itinerary as any;

      if (lastAppliedChange.type === 'itinerary') {
        return {
          ...prev,
          itinerary: lastAppliedChange.previousValue,
        };
      }

      if (lastAppliedChange.type === 'budget' && prevItinerary) {
        return {
          ...prev,
          itinerary: {
            ...prevItinerary,
            costBreakdown: lastAppliedChange.previousValue,
          },
        };
      }

      return prev;
    });

    setLastAppliedChange(null);
    return true;
  }, [lastAppliedChange]);

  return {
    trip: serverTrip,
    workingTrip,
    days,
    costs,
    isGenerating,
    viewState,
    setActiveDay,
    setActiveActivity,
    setHighlightedLocation,
    toggleMapExpanded,
    applyChange,
    undoLastChange,
    hasUndoableChange: !!lastAppliedChange,
    hasLocalChanges,
  };
}
