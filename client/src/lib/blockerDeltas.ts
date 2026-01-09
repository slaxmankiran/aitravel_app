/**
 * blockerDeltas.ts
 *
 * Helper to normalize blocker delta data from ChangePlannerResponse
 * for UI display in ChangePlanBanner and ActionItems.
 */

import type { ChangePlannerResponse } from "@shared/schema";

export type BlockerDeltaUI = {
  before: number;
  after: number;
  resolved: string[];
  added: string[];
  computedAt: string; // ISO timestamp
};

/**
 * Extract and normalize blocker delta from a ChangePlannerResponse.
 * Returns null if no delta data available.
 */
export function getBlockerDeltaUI(
  plan: ChangePlannerResponse | null | undefined
): BlockerDeltaUI | null {
  const b = plan?.deltaSummary?.blockers;
  if (!b) return null;

  return {
    before: Number(b.before ?? 0) || 0,
    after: Number(b.after ?? 0) || 0,
    resolved: Array.isArray(b.resolved) ? b.resolved : [],
    added: Array.isArray(b.new) ? b.new : [],
    computedAt: new Date().toISOString(),
  };
}

/**
 * Check if delta has any meaningful changes to display.
 */
export function hasBlockerChanges(delta: BlockerDeltaUI | null): boolean {
  if (!delta) return false;
  return delta.resolved.length > 0 || delta.added.length > 0;
}
