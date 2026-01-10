/**
 * useTripVersions.ts
 *
 * Client hook for trip version history (Item 18).
 * - Fetches and caches version list
 * - Creates new versions
 * - Restores previous versions
 * - Tracks analytics events
 */

import { useCallback, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { trackTripEvent } from "@/lib/analytics";
import type {
  TripResponse,
  VersionSnapshot,
  VersionSummary,
  VersionSource,
  TripVersionResponse,
} from "@shared/schema";

// Re-export types for convenience
export type { VersionSnapshot, VersionSummary, VersionSource, TripVersionResponse };

// ---------------------------------------------------------------------------
// API Types
// ---------------------------------------------------------------------------

interface ListVersionsResponse {
  ok: boolean;
  tripId: number;
  count: number;
  versions: TripVersionResponse[];
  error?: string;
}

interface CreateVersionResponse {
  ok: boolean;
  versionId: number;
  tripId: number;
  changeId: string | null;
  error?: string;
}

interface RestoreVersionResponse {
  ok: boolean;
  message: string;
  tripId: number;
  restoredFromVersionId: number;
  newVersionId: number;
  changeId: string;
  trip: TripResponse;
  error?: string;
}

interface GetVersionResponse {
  ok: boolean;
  version: TripVersionResponse;
  error?: string;
}

// ---------------------------------------------------------------------------
// Helper: Build snapshot from trip
// ---------------------------------------------------------------------------

/**
 * Builds a VersionSnapshot from a TripResponse.
 * This is called when creating a new version.
 */
export function buildSnapshotFromTrip(trip: TripResponse): VersionSnapshot {
  const itinerary = trip.itinerary as any;
  const costBreakdown = itinerary?.costBreakdown || {};
  const feasibility = trip.feasibilityReport as any;

  // Build cost rows from breakdown
  const costRows: VersionSnapshot["costs"]["rows"] = [];
  if (costBreakdown.flights?.total != null) {
    costRows.push({ category: "Flights", amount: costBreakdown.flights.total, note: costBreakdown.flights.note });
  }
  if (costBreakdown.accommodation?.total != null) {
    costRows.push({ category: "Accommodation", amount: costBreakdown.accommodation.total, note: costBreakdown.accommodation.note });
  }
  if (costBreakdown.activities?.total != null) {
    costRows.push({ category: "Activities", amount: costBreakdown.activities.total, note: costBreakdown.activities.note });
  }
  if (costBreakdown.food?.total != null) {
    costRows.push({ category: "Food", amount: costBreakdown.food.total, note: costBreakdown.food.note });
  }
  if (costBreakdown.localTransport?.total != null) {
    costRows.push({ category: "Local Transport", amount: costBreakdown.localTransport.total, note: costBreakdown.localTransport.note });
  }

  // Build itinerary summary
  const days = itinerary?.days || [];
  const dayHeadings = days.map((d: any, idx: number) => `Day ${d.day || idx + 1}: ${d.title || "Untitled"}`);
  const totalActivities = days.reduce((sum: number, d: any) => sum + (d.activities?.length || 0), 0);

  // Determine visa risk
  let visaRisk: "low" | "medium" | "high" = "low";
  const visaType = feasibility?.visaDetails?.type;
  if (visaType === "embassy_visa") visaRisk = "high";
  else if (visaType === "e_visa" || visaType === "voa") visaRisk = "medium";

  return {
    inputs: {
      passport: trip.passport,
      destination: trip.destination,
      dates: trip.dates,
      budget: trip.budget,
      currency: trip.currency || "USD",
      groupSize: trip.groupSize,
      adults: trip.adults,
      children: trip.children,
      infants: trip.infants,
      travelStyle: trip.travelStyle || undefined,
      origin: trip.origin || undefined,
    },
    costs: {
      grandTotal: costBreakdown.grandTotal ?? null,
      perPerson: costBreakdown.perPerson ?? null,
      currency: costBreakdown.currency || trip.currency || "USD",
      rows: costRows,
    },
    certainty: {
      score: feasibility?.score ?? 0,
      visaRisk,
      bufferDays: feasibility?.visaDetails?.timing?.daysUntilTrip,
      verdict: feasibility?.overall || "warning",
    },
    itinerarySummary: {
      totalDays: days.length,
      dayHeadings,
      totalActivities,
    },
    // Include full itinerary for restore capability
    itinerary: trip.itinerary,
  };
}

/**
 * Builds a VersionSummary with change chips
 */
export function buildVersionSummary(
  snapshot: VersionSnapshot,
  chips: string[] = [],
  source?: string
): VersionSummary {
  return {
    chips: chips.length > 0 ? chips : ["Version saved"],
    certaintyAfter: snapshot.certainty.score,
    totalAfter: snapshot.costs.grandTotal,
    source,
  };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useTripVersions(tripId: number | null) {
  const queryClient = useQueryClient();
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  // Query key for versions
  const versionsKey = ["trip-versions", tripId];

  // Fetch versions list
  const {
    data: versionsData,
    isLoading,
    error,
    refetch,
  } = useQuery<ListVersionsResponse>({
    queryKey: versionsKey,
    queryFn: async () => {
      if (!tripId) throw new Error("No tripId");
      const res = await fetch(`/api/trips/${tripId}/versions`);
      if (!res.ok) throw new Error("Failed to fetch versions");
      return res.json();
    },
    enabled: !!tripId,
    staleTime: 30_000, // 30 seconds
  });

  const versions = versionsData?.versions || [];

  // Create version mutation
  const createMutation = useMutation({
    mutationFn: async (args: {
      source: VersionSource;
      changeId?: string;
      label?: string;
      snapshot: VersionSnapshot;
      summary: VersionSummary;
    }) => {
      if (!tripId) throw new Error("No tripId");

      const res = await fetch(`/api/trips/${tripId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create version");
      }

      return res.json() as Promise<CreateVersionResponse>;
    },
    onSuccess: (data) => {
      // Invalidate versions list
      queryClient.invalidateQueries({ queryKey: versionsKey });

      // Track analytics
      if (tripId) {
        trackTripEvent(tripId, "version_created", {
          versionId: data.versionId,
          changeId: data.changeId || undefined,
        });
      }
    },
  });

  // Restore version mutation
  const restoreMutation = useMutation({
    mutationFn: async (versionId: number) => {
      if (!tripId) throw new Error("No tripId");

      const res = await fetch(`/api/trips/${tripId}/versions/${versionId}/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to restore version");
      }

      return res.json() as Promise<RestoreVersionResponse>;
    },
    onSuccess: (data) => {
      // Invalidate trip data
      queryClient.invalidateQueries({ queryKey: ["api.trips.get.path", tripId] });
      queryClient.invalidateQueries({ queryKey: versionsKey });

      // Track analytics
      if (tripId) {
        trackTripEvent(tripId, "version_restored", {
          restoredFromVersionId: data.restoredFromVersionId,
          newVersionId: data.newVersionId,
        });
      }
    },
  });

  // Get single version with full snapshot
  const getVersion = useCallback(
    async (versionId: number): Promise<TripVersionResponse | null> => {
      if (!tripId) return null;

      try {
        const res = await fetch(`/api/trips/${tripId}/versions/${versionId}`);
        if (!res.ok) return null;

        const data: GetVersionResponse = await res.json();
        return data.version;
      } catch {
        return null;
      }
    },
    [tripId]
  );

  // Create version helper
  const createVersion = useCallback(
    async (args: {
      source: VersionSource;
      changeId?: string;
      label?: string;
      snapshot: VersionSnapshot;
      summary: VersionSummary;
    }) => {
      return createMutation.mutateAsync(args);
    },
    [createMutation]
  );

  // Create version from trip helper
  const createVersionFromTrip = useCallback(
    async (
      trip: TripResponse,
      source: VersionSource,
      changeId?: string,
      chips: string[] = []
    ) => {
      const snapshot = buildSnapshotFromTrip(trip);
      const summary = buildVersionSummary(snapshot, chips, source);

      return createVersion({
        source,
        changeId,
        snapshot,
        summary,
      });
    },
    [createVersion]
  );

  // Restore version helper
  const restoreVersion = useCallback(
    async (versionId: number) => {
      return restoreMutation.mutateAsync(versionId);
    },
    [restoreMutation]
  );

  // Track panel open
  useEffect(() => {
    if (isPanelOpen && tripId) {
      trackTripEvent(tripId, "versions_opened", { count: versions.length });
    }
  }, [isPanelOpen, tripId, versions.length]);

  return {
    // Data
    versions,
    isLoading,
    error: error as Error | null,

    // Actions
    createVersion,
    createVersionFromTrip,
    restoreVersion,
    getVersion,
    refetch,

    // Mutation states
    isCreating: createMutation.isPending,
    isRestoring: restoreMutation.isPending,
    createError: createMutation.error as Error | null,
    restoreError: restoreMutation.error as Error | null,

    // Panel state
    isPanelOpen,
    openPanel: () => setIsPanelOpen(true),
    closePanel: () => setIsPanelOpen(false),
    togglePanel: () => setIsPanelOpen((p) => !p),
  };
}
