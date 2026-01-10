/**
 * voyageUid.ts
 *
 * Item 21: Account-lite
 * Anonymous user identification for trip ownership.
 *
 * - Generates a UUID on first visit
 * - Stores in localStorage (persists across sessions)
 * - Provides header for API requests
 */

const STORAGE_KEY = "voyage_uid";

/**
 * Generate a UUID v4
 */
function generateUid(): string {
  // Use crypto.randomUUID if available (modern browsers)
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback for older browsers
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Get or create the voyage_uid
 * Called once on app initialization
 */
export function getVoyageUid(): string {
  if (typeof window === "undefined") {
    // SSR fallback - shouldn't happen in Vite SPA
    return "server-side";
  }

  let uid = localStorage.getItem(STORAGE_KEY);

  if (!uid) {
    uid = generateUid();
    localStorage.setItem(STORAGE_KEY, uid);
  }

  return uid;
}

/**
 * Get headers object with voyage_uid for fetch requests
 */
export function getVoyageHeaders(): Record<string, string> {
  return {
    "x-voyage-uid": getVoyageUid(),
  };
}

/**
 * Clear the voyage_uid (for testing/logout scenarios)
 */
export function clearVoyageUid(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(STORAGE_KEY);
  }
}
