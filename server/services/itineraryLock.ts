/**
 * Itinerary Generation Lock Service
 *
 * Prevents duplicate LLM generation when multiple tabs/sessions open the same trip.
 * This is the biggest cost protection feature for streaming generation.
 *
 * Lock algorithm:
 * 1. If status is 'generating' and lock is fresh (< LOCK_TIMEOUT_MS), don't start new generation
 * 2. If lock is stale (> LOCK_TIMEOUT_MS), take over the lock and continue
 * 3. On completion/error, release the lock
 */

import { db } from "../db";
import { trips } from "@shared/schema";
import { eq, and, or, lt, isNull } from "drizzle-orm";
import { randomUUID } from "crypto";

// ============================================================================
// CONFIGURATION
// ============================================================================

/** Lock timeout in milliseconds (10 minutes) - after this, lock is considered stale */
const LOCK_TIMEOUT_MS = 10 * 60 * 1000;

/** How often to refresh the lock while generating (prevents stale takeover during long generation) */
const LOCK_REFRESH_INTERVAL_MS = 60 * 1000; // 1 minute

// ============================================================================
// TYPES
// ============================================================================

export type ItineraryStatus = "idle" | "generating" | "complete" | "error";

export interface LockResult {
  acquired: boolean;
  lockOwner: string | null;
  status: ItineraryStatus;
  isStale: boolean;
  existingOwner?: string;
  message: string;
}

export interface LockContext {
  tripId: number;
  lockOwner: string;
  refreshInterval: NodeJS.Timeout | null;
}

// ============================================================================
// LOCK OPERATIONS
// ============================================================================

/**
 * Try to acquire the generation lock for a trip
 *
 * Returns:
 * - acquired: true if lock was acquired (either fresh or stale takeover)
 * - acquired: false if another process has a fresh lock
 */
export async function acquireItineraryLock(tripId: number): Promise<LockResult> {
  const lockOwner = randomUUID();
  const now = new Date();
  const staleThreshold = new Date(now.getTime() - LOCK_TIMEOUT_MS);

  // Get current lock status
  const [trip] = await db
    .select({
      itineraryStatus: trips.itineraryStatus,
      itineraryLockedAt: trips.itineraryLockedAt,
      itineraryLockOwner: trips.itineraryLockOwner,
    })
    .from(trips)
    .where(eq(trips.id, tripId))
    .limit(1);

  if (!trip) {
    return {
      acquired: false,
      lockOwner: null,
      status: "idle",
      isStale: false,
      message: "Trip not found",
    };
  }

  const currentStatus = (trip.itineraryStatus || "idle") as ItineraryStatus;
  const lockedAt = trip.itineraryLockedAt;
  const existingOwner = trip.itineraryLockOwner;

  // Case 1: Not currently generating - acquire fresh lock
  if (currentStatus !== "generating") {
    await db
      .update(trips)
      .set({
        itineraryStatus: "generating",
        itineraryLockedAt: now,
        itineraryLockOwner: lockOwner,
      })
      .where(eq(trips.id, tripId));

    console.log(`[ItineraryLock] Acquired fresh lock for trip ${tripId} (owner: ${lockOwner.slice(0, 8)})`);

    return {
      acquired: true,
      lockOwner,
      status: "generating",
      isStale: false,
      message: "Lock acquired (fresh)",
    };
  }

  // Case 2: Currently generating - check if lock is stale
  const isStale = !lockedAt || lockedAt < staleThreshold;

  if (isStale) {
    // Stale lock - take over
    await db
      .update(trips)
      .set({
        itineraryStatus: "generating",
        itineraryLockedAt: now,
        itineraryLockOwner: lockOwner,
      })
      .where(eq(trips.id, tripId));

    console.log(`[ItineraryLock] Took over stale lock for trip ${tripId} (old owner: ${existingOwner?.slice(0, 8)}, new: ${lockOwner.slice(0, 8)})`);

    return {
      acquired: true,
      lockOwner,
      status: "generating",
      isStale: true,
      existingOwner: existingOwner || undefined,
      message: "Lock acquired (stale takeover)",
    };
  }

  // Case 3: Fresh lock held by another process - don't acquire
  console.log(`[ItineraryLock] Lock denied for trip ${tripId} - active generation by ${existingOwner?.slice(0, 8)}`);

  return {
    acquired: false,
    lockOwner: null,
    status: currentStatus,
    isStale: false,
    existingOwner: existingOwner || undefined,
    message: "Lock held by another process",
  };
}

/**
 * Release the generation lock (on completion or error)
 */
export async function releaseItineraryLock(
  tripId: number,
  lockOwner: string,
  finalStatus: "complete" | "error" | "idle"
): Promise<boolean> {
  // Only release if we still own the lock
  const result = await db
    .update(trips)
    .set({
      itineraryStatus: finalStatus,
      itineraryLockedAt: null,
      itineraryLockOwner: null,
    })
    .where(
      and(
        eq(trips.id, tripId),
        eq(trips.itineraryLockOwner, lockOwner)
      )
    );

  const released = (result as any).rowCount > 0 || (result as any).changes > 0;

  if (released) {
    console.log(`[ItineraryLock] Released lock for trip ${tripId} (status: ${finalStatus})`);
  } else {
    console.log(`[ItineraryLock] Lock release skipped for trip ${tripId} - not owner`);
  }

  return released;
}

/**
 * Refresh the lock timestamp to prevent stale takeover during long generation
 */
export async function refreshItineraryLock(tripId: number, lockOwner: string): Promise<boolean> {
  const result = await db
    .update(trips)
    .set({
      itineraryLockedAt: new Date(),
    })
    .where(
      and(
        eq(trips.id, tripId),
        eq(trips.itineraryLockOwner, lockOwner)
      )
    );

  return (result as any).rowCount > 0 || (result as any).changes > 0;
}

/**
 * Create a lock context with automatic refresh
 * Call cleanup() when done to stop the refresh interval
 */
export function createLockContext(tripId: number, lockOwner: string): LockContext {
  const ctx: LockContext = {
    tripId,
    lockOwner,
    refreshInterval: null,
  };

  // Start refresh interval to keep lock alive during long generation
  ctx.refreshInterval = setInterval(async () => {
    const refreshed = await refreshItineraryLock(tripId, lockOwner);
    if (!refreshed) {
      console.log(`[ItineraryLock] Lock refresh failed for trip ${tripId} - lock may have been taken over`);
    }
  }, LOCK_REFRESH_INTERVAL_MS);

  return ctx;
}

/**
 * Cleanup lock context - stops refresh interval
 */
export function cleanupLockContext(ctx: LockContext): void {
  if (ctx.refreshInterval) {
    clearInterval(ctx.refreshInterval);
    ctx.refreshInterval = null;
  }
}

/**
 * Check if a trip is currently being generated (for polling clients)
 */
export async function getItineraryLockStatus(tripId: number): Promise<{
  status: ItineraryStatus;
  isLocked: boolean;
  lockedAt: Date | null;
  isFresh: boolean;
}> {
  const [trip] = await db
    .select({
      itineraryStatus: trips.itineraryStatus,
      itineraryLockedAt: trips.itineraryLockedAt,
    })
    .from(trips)
    .where(eq(trips.id, tripId))
    .limit(1);

  if (!trip) {
    return { status: "idle", isLocked: false, lockedAt: null, isFresh: false };
  }

  const status = (trip.itineraryStatus || "idle") as ItineraryStatus;
  const lockedAt = trip.itineraryLockedAt;
  const isLocked = status === "generating";
  const staleThreshold = new Date(Date.now() - LOCK_TIMEOUT_MS);
  const isFresh = isLocked && lockedAt !== null && lockedAt > staleThreshold;

  return { status, isLocked, lockedAt, isFresh };
}
