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
  isDemo?: boolean;
}

export function RightRailPanels({
  trip,
  costs,
  onTripUpdate,
  onChatOpen,
  hasLocalChanges,
  hasUndoableChange,
  onUndo,
  isDemo = false
}: RightRailPanelsProps) {
  return (
    <div className="space-y-4">
      {/* True Cost Panel - Default OPEN */}
      <PanelAccordion
        title="True Cost"
        icon={<DollarSign className="w-4 h-4" />}
        defaultOpen={true}
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
        collapsedSummary={isDemo ? "Available on your own trip" : "Swap days, reduce cost, change pace"}
        onToggle={(isOpen) => isOpen && onChatOpen?.()}
      >
        {isDemo ? (
          <div className="py-8 text-center">
            <MessageSquare className="w-10 h-10 text-white/20 mx-auto mb-4" />
            <p className="text-white/60 text-sm mb-4">
              AI chat is available when you create your own trip.
            </p>
            <a
              href="/create"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm font-semibold hover:from-emerald-700 hover:to-teal-700 transition-colors"
            >
              Plan your trip
            </a>
          </div>
        ) : (
          <div className="h-[350px] -mx-4 -mb-4">
            <TripChat
              tripId={trip.id}
              destination={trip.destination}
              onTripUpdate={onTripUpdate}
            />
          </div>
        )}
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
