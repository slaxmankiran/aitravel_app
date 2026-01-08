/**
 * RightRailPanels.tsx
 *
 * Right column panels for Trip Results V1.
 * Contains: True Cost, Action Items, Modify with AI (Chat)
 */

import { DollarSign, CheckCircle, MessageSquare, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PanelAccordion } from "./PanelAccordion";
import { ActionItems } from "./ActionItems";

// Use existing CostBreakdown component
import { CostBreakdown } from "@/components/CostBreakdown";
import { TripChat } from "@/components/TripChat";

import type { TripResponse } from "@shared/schema";
import type { CostViewModel } from "@/hooks/useTripViewModel";

interface RightRailPanelsProps {
  trip: TripResponse;
  costs: CostViewModel | null;
  onTripUpdate: (data: { itinerary?: any; budgetBreakdown?: any }) => void;
  onChatOpen?: () => void;
  hasLocalChanges: boolean;
  hasUndoableChange: boolean;
  onUndo: () => void;
}

export function RightRailPanels({
  trip,
  costs,
  onTripUpdate,
  onChatOpen,
  hasLocalChanges,
  hasUndoableChange,
  onUndo
}: RightRailPanelsProps) {
  return (
    <div className="space-y-4">
      {/* True Cost Panel - Default OPEN */}
      <PanelAccordion
        title="True Cost"
        icon={<DollarSign className="w-4 h-4" />}
        defaultOpen={true}
        badge={
          costs?.grandTotal ? (
            <span className="text-xs text-emerald-400 font-medium">
              ${costs.grandTotal.toLocaleString()}
            </span>
          ) : null
        }
        collapsedSummary={
          costs?.grandTotal
            ? `Est. ${costs.currency || 'USD'} ${costs.grandTotal.toLocaleString()}`
            : undefined
        }
      >
        {/* Use existing CostBreakdown component */}
        <div className="-mx-4 -mb-4">
          <CostBreakdown trip={trip} />
        </div>
      </PanelAccordion>

      {/* Action Items Panel - Default OPEN */}
      <PanelAccordion
        title="Action Items"
        icon={<CheckCircle className="w-4 h-4" />}
        defaultOpen={true}
        collapsedSummary="Checklist for your trip"
      >
        <ActionItems trip={trip} />
      </PanelAccordion>

      {/* Modify with AI Panel - Default CLOSED */}
      <PanelAccordion
        title="Modify with AI"
        icon={<MessageSquare className="w-4 h-4" />}
        defaultOpen={false}
        collapsedSummary="Swap days, reduce cost, change pace"
        onToggle={(isOpen) => isOpen && onChatOpen?.()}
      >
        <div className="h-[350px] -mx-4 -mb-4">
          <TripChat
            tripId={trip.id}
            destination={trip.destination}
            onTripUpdate={onTripUpdate}
          />
        </div>
      </PanelAccordion>

      {/* Local changes indicator with undo */}
      {hasLocalChanges && (
        <div className="flex items-center justify-between bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
          <span className="text-xs text-amber-400">
            You have unsaved changes
          </span>
          {hasUndoableChange && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onUndo}
              className="h-6 px-2 text-xs text-amber-400 hover:text-amber-300 hover:bg-amber-500/20"
            >
              <Undo2 className="w-3 h-3 mr-1" />
              Undo
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
