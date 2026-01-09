/**
 * FixBlockersCTA.tsx
 *
 * Simple CTA button that emits an event to open the Fix Blockers modal.
 * The actual modal is managed by FixBlockersController.tsx.
 *
 * This button is rendered inline in ActionItems when visa timing needs fixing.
 */

import { Calendar } from "lucide-react";
import { openFixBlockersEvent } from "@/lib/uiEvents";

interface FixBlockersCTAProps {
  source?: "action_items" | "other";
  reason?: "visa_timing" | "visa_required" | "unknown";
}

export function FixBlockersCTA({
  source = "action_items",
  reason = "visa_timing",
}: FixBlockersCTAProps) {
  const handleClick = () => {
    openFixBlockersEvent.emit({ source, reason });
  };

  return (
    <button
      onClick={handleClick}
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium
                 bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors
                 border border-amber-500/30"
    >
      <Calendar className="w-3 h-3" />
      Fix visa timing
    </button>
  );
}
