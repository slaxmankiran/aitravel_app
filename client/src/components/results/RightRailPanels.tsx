/**
 * RightRailPanels.tsx
 *
 * Premium right column with 2 visible cards + progressive disclosure drawers.
 *
 * Visible Cards:
 * 1. Decision Summary (verdict, budget, visa, safety + quick links)
 * 2. Modify with AI (chips only, chat opens on demand)
 *
 * Drawers (on-demand):
 * - Costs drawer (True Cost breakdown)
 * - Checklist drawer (Action Items)
 * - History drawer (Version History)
 * - Chat drawer (Full AI chat)
 *
 * This is the "premium calm" pattern used by Linear, Notion, etc.
 */

import React, { lazy, Suspense, useState, useRef, memo } from "react";
import { MessageSquare } from "lucide-react";

// Components
import { DecisionStack } from "./DecisionStack";
import { ModifyChips } from "./ModifyChips";
import { RightDrawer, DrawerSection } from "./RightDrawer";
import { ActionItems } from "./ActionItems";
import { VersionsPanel } from "./VersionsPanel";
import { CostBreakdown } from "@/components/CostBreakdown";

// Lazy load TripChat - only loads when user opens chat drawer
const TripChat = lazy(() =>
  import("@/components/TripChat").then(mod => ({ default: mod.TripChat }))
);

// Types
import type { TripResponse } from "@shared/schema";
import type { CostViewModel } from "@/hooks/useTripViewModel";
import type { BlockerDeltaUI } from "@/lib/blockerDeltas";
import type { VerdictResult } from "@/lib/verdict";

// ============================================================================
// TYPES
// ============================================================================

type DrawerType = 'costs' | 'checklist' | 'history' | 'chat' | null;

interface RightRailPanelsProps {
  trip: TripResponse;
  costs: CostViewModel | null;
  verdictResult?: VerdictResult | null;
  onTripUpdate: (data: { itinerary?: any; budgetBreakdown?: any }) => void;
  onChatOpen?: () => void;
  onShowDetails?: () => void;
  onFixBlockers?: () => void;
  onViewMap?: () => void;
  hasLocalChanges: boolean;
  hasUndoableChange: boolean;
  onUndo: () => void;
  isDemo?: boolean;
  blockerDelta?: BlockerDeltaUI | null;
  onVersionRestore?: () => void;
  onVersionExport?: (versionId: number) => void;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

function RightRailPanelsComponent({
  trip,
  costs,
  verdictResult,
  onTripUpdate,
  onChatOpen,
  onShowDetails,
  onFixBlockers,
  onViewMap,
  hasLocalChanges,
  hasUndoableChange,
  onUndo,
  isDemo = false,
  blockerDelta,
  onVersionRestore,
  onVersionExport,
}: RightRailPanelsProps) {
  // Drawer state - only one drawer open at a time
  const [activeDrawer, setActiveDrawer] = useState<DrawerType>(null);

  // Chat prefill for chip-to-chat flow
  const [chatPrefill, setChatPrefill] = useState<string>('');

  // Track consumed force open
  const forceOpenConsumedRef = useRef(false);

  // Handlers
  const openDrawer = (drawer: DrawerType) => {
    setActiveDrawer(drawer);
    if (drawer === 'chat') {
      onChatOpen?.();
    }
  };

  const closeDrawer = () => {
    setActiveDrawer(null);
  };

  // Handle modify chip click - opens chat drawer with prefill
  const handleChipClick = (prompt: string) => {
    setChatPrefill(prompt);
    openDrawer('chat');
  };

  // Handle custom request click - opens chat drawer without prefill
  const handleCustomClick = () => {
    setChatPrefill('');
    openDrawer('chat');
  };

  return (
    <>
      {/* Main content - 2 visible cards */}
      <div className="space-y-4">
        {/* Card 1: Decision Summary */}
        {verdictResult && costs && (
          <DecisionStack
            trip={trip}
            verdictResult={verdictResult}
            budgetStatus={costs.budgetStatus}
            budgetOverBy={costs.overByAmount}
            currency={costs.currency}
            grandTotal={costs.grandTotal}
            hasBudgetSet={costs.hasBudgetSet}
            onFixBlockers={onFixBlockers}
            onShowDetails={onShowDetails}
            onViewCosts={() => openDrawer('costs')}
            onViewChecklist={() => openDrawer('checklist')}
            onViewHistory={isDemo ? undefined : () => openDrawer('history')}
            onViewMap={onViewMap}
          />
        )}

        {/* Card 2: Modify with AI (chips only) */}
        <ModifyChips
          onChipClick={handleChipClick}
          onCustomClick={handleCustomClick}
          disabled={isDemo}
        />

        {/* Local changes indicator - inline, subtle */}
        {hasLocalChanges && (
          <div className="flex items-center justify-between bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
            <span className="text-xs text-amber-400">
              Unsaved changes
            </span>
            {hasUndoableChange && (
              <button
                onClick={onUndo}
                className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
              >
                Undo
              </button>
            )}
          </div>
        )}
      </div>

      {/* Drawers - Progressive disclosure */}

      {/* Costs Drawer */}
      <RightDrawer
        isOpen={activeDrawer === 'costs'}
        onClose={closeDrawer}
        title="True Cost"
        subtitle={costs ? `Est. ${costs.currency}${costs.grandTotal?.toLocaleString()}` : undefined}
      >
        <CostBreakdown trip={trip} />
      </RightDrawer>

      {/* Checklist Drawer */}
      <RightDrawer
        isOpen={activeDrawer === 'checklist'}
        onClose={closeDrawer}
        title="Action Items"
        subtitle="Checklist for your trip"
      >
        <DrawerSection>
          <ActionItems trip={trip} blockerDelta={blockerDelta} />
        </DrawerSection>
      </RightDrawer>

      {/* History Drawer */}
      <RightDrawer
        isOpen={activeDrawer === 'history'}
        onClose={closeDrawer}
        title="Version History"
        subtitle="Previous versions of your trip"
      >
        <DrawerSection>
          <VersionsPanel
            tripId={trip.id}
            onRestore={onVersionRestore}
            onExport={onVersionExport}
            compact
          />
        </DrawerSection>
      </RightDrawer>

      {/* Chat Drawer */}
      <RightDrawer
        isOpen={activeDrawer === 'chat'}
        onClose={closeDrawer}
        title="Modify with AI"
        subtitle="Chat to customize your itinerary"
        size="xl"
      >
        {isDemo ? (
          <div className="py-12 text-center">
            <MessageSquare className="w-12 h-12 text-white/20 mx-auto mb-4" />
            <p className="text-white/60 text-sm mb-6">
              AI chat is available when you create your own trip.
            </p>
            <a
              href="/create"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm font-semibold hover:from-emerald-700 hover:to-teal-700 transition-colors"
            >
              Plan your trip
            </a>
          </div>
        ) : (
          <div className="h-[calc(100vh-120px)]">
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
                mode="inline"
              />
            </Suspense>
          </div>
        )}
      </RightDrawer>
    </>
  );
}

// Memoize to prevent rerenders when left column state changes
export const RightRailPanels = memo(RightRailPanelsComponent);
