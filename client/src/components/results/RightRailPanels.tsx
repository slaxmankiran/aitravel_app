/**
 * RightRailPanels.tsx
 *
 * Right column panels for Trip Results V1.
 * Contains: True Cost, Action Items, Modify with AI (Chat)
 *
 * Performance: TripChat is lazy loaded, component is memoized.
 */

import React, { lazy, Suspense, useState, useRef } from "react";
import { DollarSign, CheckCircle, MessageSquare, Undo2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PanelAccordion } from "./PanelAccordion";
import { ActionItems } from "./ActionItems";
import { VersionsPanel } from "./VersionsPanel";

// Use existing CostBreakdown component
import { CostBreakdown } from "@/components/CostBreakdown";

// Lazy load TripChat - only loads when user opens the panel
const TripChat = lazy(() =>
  import("@/components/TripChat").then(mod => ({ default: mod.TripChat }))
);

import type { TripResponse } from "@shared/schema";
import type { CostViewModel, BudgetStatus } from "@/hooks/useTripViewModel";
import type { BlockerDeltaUI } from "@/lib/blockerDeltas";
import type { VerdictResult } from "@/lib/verdict";
import { getBudgetSuggestions } from "@/lib/budgetSuggestions";
import { DecisionStack } from "./DecisionStack";

// ============================================================================
// BUDGET ALERT COMPONENT
// ============================================================================

interface BudgetAlertProps {
  costs: CostViewModel;
  /** Callback when a suggestion chip is clicked */
  onSuggestion?: (prompt: string) => void;
}

/**
 * Prominent alert when trip is over budget.
 * Shows amount over and data-driven suggestion chips based on cost breakdown.
 */
function BudgetAlert({ costs, onSuggestion }: BudgetAlertProps) {
  const { budgetStatus, overByAmount, overByPercent, currency } = costs;

  if (budgetStatus !== 'over20' && budgetStatus !== 'over50') {
    return null;
  }

  const isSevere = budgetStatus === 'over50';
  const bgClass = isSevere ? 'bg-red-500/15' : 'bg-amber-500/15';
  const borderClass = isSevere ? 'border-red-500/30' : 'border-amber-500/30';
  const textClass = isSevere ? 'text-red-400' : 'text-amber-400';
  const iconClass = isSevere ? 'text-red-400' : 'text-amber-400';

  // Get data-driven suggestions based on cost breakdown
  const suggestions = getBudgetSuggestions(costs, budgetStatus);

  return (
    <div className={`${bgClass} ${borderClass} border rounded-xl p-4 mb-4`}>
      <div className="flex items-start gap-3">
        <AlertTriangle className={`w-5 h-5 ${iconClass} shrink-0 mt-0.5`} />
        <div className="flex-1 min-w-0">
          <p className={`font-semibold ${textClass}`}>
            {isSevere ? 'Significantly over budget' : 'Over budget'}
          </p>
          <p className="text-sm text-white/60 mt-0.5">
            {currency}{Math.abs(Math.round(overByAmount)).toLocaleString()} over ({Math.min(Math.round(overByPercent), 999)}%{overByPercent > 999 ? '+' : ''})
          </p>

          {/* Data-driven suggestion chips */}
          <div className="flex flex-wrap gap-2 mt-3">
            {suggestions.map((s) => (
              <button
                key={s.label}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-white/10 text-white/70 hover:bg-white/20 hover:text-white transition-colors"
                onClick={() => onSuggestion?.(s.prompt)}
                title={s.percentOfTotal > 0 ? `${s.percentOfTotal}% of trip cost` : undefined}
              >
                <span>{s.icon}</span>
                {s.label}
                {/* Show percentage badge for major drivers */}
                {s.percentOfTotal >= 25 && (
                  <span className="ml-0.5 text-[10px] text-white/40">
                    ({s.percentOfTotal}%)
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

interface RightRailPanelsProps {
  trip: TripResponse;
  costs: CostViewModel | null;
  verdictResult?: VerdictResult | null;
  onTripUpdate: (data: { itinerary?: any; budgetBreakdown?: any }) => void;
  onChatOpen?: () => void;
  onShowDetails?: () => void;
  onFixBlockers?: () => void;
  hasLocalChanges: boolean;
  hasUndoableChange: boolean;
  onUndo: () => void;
  isDemo?: boolean;
  blockerDelta?: BlockerDeltaUI | null;
  onVersionRestore?: () => void;
  onVersionExport?: (versionId: number) => void;
}

function RightRailPanelsComponent({
  trip,
  costs,
  verdictResult,
  onTripUpdate,
  onChatOpen,
  onShowDetails,
  onFixBlockers,
  hasLocalChanges,
  hasUndoableChange,
  onUndo,
  isDemo = false,
  blockerDelta,
  onVersionRestore,
  onVersionExport,
}: RightRailPanelsProps) {
  // State for chip-to-chat flow
  const [chatPrefill, setChatPrefill] = useState<string>('');
  const [forceChatOpen, setForceChatOpen] = useState(false);

  // Track if we've consumed the forceOpen to prevent reopening on every render
  const forceOpenConsumedRef = useRef(false);

  // Handle budget suggestion chip click
  const handleBudgetSuggestion = (prompt: string) => {
    setChatPrefill(prompt);
    setForceChatOpen(true);
    forceOpenConsumedRef.current = false;
    onChatOpen?.(); // Notify parent
  };

  // Reset forceOpen after it's been consumed
  const handleChatPanelToggle = (isOpen: boolean) => {
    if (isOpen && forceChatOpen && !forceOpenConsumedRef.current) {
      forceOpenConsumedRef.current = true;
      // Reset forceChatOpen after a short delay so it can be triggered again
      setTimeout(() => setForceChatOpen(false), 100);
    }
    if (isOpen) {
      onChatOpen?.();
    }
  };

  return (
    <div className="space-y-4">
      {/* Decision Stack - Combined verdict + budget + visa + safety */}
      {verdictResult && costs && (
        <DecisionStack
          trip={trip}
          verdictResult={verdictResult}
          budgetStatus={costs.budgetStatus}
          budgetOverBy={costs.overByAmount}
          currency={costs.currency}
          onFixBlockers={onFixBlockers}
          onShowDetails={onShowDetails}
        />
      )}

      {/* Budget Alert - Show only if no DecisionStack (fallback) */}
      {!verdictResult && costs && (costs.budgetStatus === 'over20' || costs.budgetStatus === 'over50') && (
        <BudgetAlert
          costs={costs}
          onSuggestion={isDemo ? undefined : handleBudgetSuggestion}
        />
      )}

      {/* True Cost Panel - Default OPEN */}
      <div data-section="cost-breakdown">
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
      </div>

      {/* Action Items Panel - Default OPEN */}
      <div data-section="action-items">
        <PanelAccordion
          title="Action Items"
          icon={<CheckCircle className="w-4 h-4" />}
          defaultOpen={true}
          collapsedSummary="Checklist for your trip"
        >
          <ActionItems trip={trip} blockerDelta={blockerDelta} />
        </PanelAccordion>
      </div>

      {/* Version History Panel - Default CLOSED */}
      {!isDemo && (
        <VersionsPanel
          tripId={trip.id}
          onRestore={onVersionRestore}
          onExport={onVersionExport}
        />
      )}

      {/* Modify with AI Panel - Default CLOSED */}
      <PanelAccordion
        title="Modify with AI"
        icon={<MessageSquare className="w-4 h-4" />}
        defaultOpen={false}
        forceOpen={forceChatOpen}
        collapsedSummary={isDemo ? "Available on your own trip" : "Swap days, reduce cost, change pace"}
        onToggle={handleChatPanelToggle}
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
            <Suspense
              fallback={
                <div className="h-full flex items-center justify-center text-white/40 text-sm">
                  Loading assistant…
                </div>
              }
            >
              <TripChat
                tripId={trip.id}
                destination={trip.destination}
                onTripUpdate={onTripUpdate}
                prefillMessage={chatPrefill}
              />
            </Suspense>
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

// Memoize to prevent rerenders when left column state changes
export const RightRailPanels = React.memo(RightRailPanelsComponent);
