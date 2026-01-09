/**
 * usePlanningMode.ts
 *
 * Hook for managing user's preferred planning mode (Chat vs Form).
 * Persists to localStorage for cross-session preference.
 */

import { useEffect, useState, useCallback } from "react";

export type PlanningMode = "chat" | "form";

const STORAGE_KEY = "voyageai_planning_mode";

/**
 * Hook to manage planning mode preference.
 * - Reads from localStorage on mount
 * - Persists changes to localStorage
 * - Analytics tracked at call site for better context (source, destination)
 *
 * @param defaultMode - Initial mode if no preference saved (default: "form")
 */
export function usePlanningMode(defaultMode: PlanningMode = "form") {
  const [mode, setModeState] = useState<PlanningMode>(defaultMode);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY) as PlanningMode | null;
      if (saved === "chat" || saved === "form") {
        setModeState(saved);
      }
    } catch {
      // localStorage not available, use default
    }
    setIsLoaded(true);
  }, []);

  // Set mode with persistence (analytics tracked at call site for context)
  const setMode = useCallback((next: PlanningMode) => {
    setModeState(next);

    // Persist to localStorage
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // localStorage not available
    }
  }, []);

  return {
    mode,
    setMode,
    isLoaded, // Use to prevent flash of wrong mode
    isChat: mode === "chat",
    isForm: mode === "form",
  };
}

/**
 * Get the route path based on planning mode.
 * Supports optional destination prefill for /chat route.
 */
export function getPlanningRoute(
  mode: PlanningMode,
  destination?: string
): string {
  if (mode === "chat") {
    return destination
      ? `/chat?destination=${encodeURIComponent(destination)}`
      : "/chat";
  }
  return destination
    ? `/create?destination=${encodeURIComponent(destination)}`
    : "/create";
}
