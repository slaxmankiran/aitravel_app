/**
 * uiEvents.ts
 *
 * Lightweight UI event bus for cross-component communication.
 * Avoids prop drilling while keeping components decoupled.
 *
 * Usage:
 *   // Subscribe
 *   useEffect(() => openFixBlockersEvent.on(handler), []);
 *
 *   // Emit
 *   openFixBlockersEvent.emit({ source: "certainty_drawer" });
 */

type Handler<T> = (payload: T) => void;

class SimpleEmitter<T> {
  private handlers = new Set<Handler<T>>();

  on(handler: Handler<T>): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  emit(payload: T): void {
    this.handlers.forEach((h) => h(payload));
  }
}

// ============================================================================
// Fix Blockers Event
// ============================================================================

export type OpenFixBlockersPayload = {
  source: "certainty_drawer" | "change_banner" | "action_items" | "other";
  reason?: "visa_timing" | "visa_required" | "unknown";
};

export const openFixBlockersEvent = new SimpleEmitter<OpenFixBlockersPayload>();

// ============================================================================
// Future events can be added here
// ============================================================================
