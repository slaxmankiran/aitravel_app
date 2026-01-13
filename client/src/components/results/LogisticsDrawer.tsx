/**
 * LogisticsDrawer Component
 *
 * Bottom-right floating trigger button that opens a Sheet
 * containing RightRailPanels (Cost, Actions, Chat).
 *
 * Shows total cost on the trigger for decision-grade UX.
 */

import React, { useState, lazy, Suspense, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DollarSign,
  ChevronUp,
  ClipboardList,
  MessageSquare,
  History,
  X,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { DecisionStack } from './DecisionStack';
import { AICoPilotConsole } from './AICoPilotConsole';
import { RightDrawer } from './RightDrawer';
import { ActionItems } from './ActionItems';
import { VersionsPanel } from './VersionsPanel';
import { CostBreakdown } from '@/components/CostBreakdown';
import { springTransition } from '@/components/transitions';

// Lazy load TripChat
const TripChat = lazy(() =>
  import('@/components/TripChat').then(mod => ({ default: mod.TripChat }))
);

// Types
import type { TripResponse } from '@shared/schema';
import type { CostViewModel } from '@/hooks/useTripViewModel';
import type { BlockerDeltaUI } from '@/lib/blockerDeltas';
import type { VerdictResult } from '@/lib/verdict';

// ============================================================================
// TYPES
// ============================================================================

type DrawerSection = 'costs' | 'checklist' | 'history' | 'chat' | null;

interface LogisticsDrawerProps {
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
  className?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

function LogisticsDrawerComponent({
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
  className = '',
}: LogisticsDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<DrawerSection>(null);
  const [chatPrefill, setChatPrefill] = useState('');
  const forceOpenConsumedRef = useRef(false);

  // Format total cost for trigger button
  const totalCost = costs?.grandTotal ?? 0;
  const currency = costs?.currency ?? 'USD';
  const currencySymbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : currency;

  // Budget status for color
  const userBudget = typeof trip.budget === 'number'
    ? trip.budget
    : Number(String(trip.budget || '').replace(/[^\d.]/g, '')) || 0;

  const budgetRatio = userBudget > 0 ? totalCost / userBudget : 0;
  const isOverBudget = budgetRatio > 1;
  const isNearBudget = budgetRatio > 0.85 && budgetRatio <= 1;

  const triggerColor = isOverBudget
    ? 'bg-red-500 hover:bg-red-600'
    : isNearBudget
    ? 'bg-amber-500 hover:bg-amber-600'
    : 'bg-emerald-500 hover:bg-emerald-600';

  // Open section within drawer
  const openSection = (section: DrawerSection) => {
    setActiveSection(section);
    if (section === 'chat') {
      onChatOpen?.();
    }
  };

  const closeSection = () => {
    setActiveSection(null);
    setChatPrefill('');
  };

  // Co-Pilot submit handler
  const handleCoPilotSubmit = (prompt: string) => {
    setChatPrefill(prompt);
    setActiveSection('chat');
    onChatOpen?.();
  };

  return (
    <>
      {/* Floating Trigger Button - positioned above bottom sheet on mobile */}
      <motion.button
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ ...springTransition, delay: 0.3 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-[48vh] md:bottom-6 right-4 md:right-6 z-40 ${triggerColor} text-white rounded-full px-4 md:px-5 py-2.5 md:py-3 shadow-lg flex items-center gap-2 transition-colors ${className}`}
      >
        <span className="font-semibold text-sm md:text-base">
          {currencySymbol}{totalCost.toLocaleString()}
        </span>
        <ChevronUp className="w-4 h-4" />
      </motion.button>

      {/* Sheet Drawer */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent
          side="right"
          className="w-[420px] max-w-[90vw] bg-slate-900/95 backdrop-blur-2xl border-l border-white/10 p-0 overflow-hidden"
        >
          {/* Custom close button */}
          <button
            onClick={() => setIsOpen(false)}
            className="absolute right-4 top-4 z-10 p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-white/80 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Main content */}
          <div className="h-full flex flex-col">
            {/* Header */}
            <div className="px-6 pt-6 pb-4 border-b border-white/[0.06]">
              <h2 className="text-lg font-semibold text-white">Trip Details</h2>
              <p className="text-sm text-white/50 mt-1">
                Cost breakdown, actions, and AI assistance
              </p>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {/* Decision Stack */}
              <DecisionStack
                trip={trip}
                verdictResult={verdictResult ?? null}
                budgetStatus={costs?.budgetStatus ?? 'under'}
                budgetOverBy={costs?.overByAmount}
                currency={costs?.currency}
                grandTotal={costs?.grandTotal}
                hasBudgetSet={costs?.hasBudgetSet}
                onShowDetails={onShowDetails}
                onFixBlockers={onFixBlockers}
                hideQuickLinks
              />

              {/* AI Co-Pilot Console */}
              {!isDemo && (
                <div className="bg-white/[0.03] rounded-xl p-4">
                  <AICoPilotConsole
                    onSubmit={handleCoPilotSubmit}
                    disabled={false}
                  />
                </div>
              )}

              {/* Section Buttons */}
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="ghost"
                  onClick={() => openSection('costs')}
                  className="h-auto py-3 px-4 bg-white/[0.03] hover:bg-white/[0.06] flex flex-col items-start gap-1 rounded-xl"
                >
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm font-medium text-white">Cost Breakdown</span>
                  <span className="text-xs text-white/50">View all costs</span>
                </Button>

                <Button
                  variant="ghost"
                  onClick={() => openSection('checklist')}
                  className="h-auto py-3 px-4 bg-white/[0.03] hover:bg-white/[0.06] flex flex-col items-start gap-1 rounded-xl"
                >
                  <ClipboardList className="w-4 h-4 text-blue-400" />
                  <span className="text-sm font-medium text-white">Action Items</span>
                  <span className="text-xs text-white/50">Things to do</span>
                </Button>

                {!isDemo && (
                  <>
                    <Button
                      variant="ghost"
                      onClick={() => openSection('history')}
                      className="h-auto py-3 px-4 bg-white/[0.03] hover:bg-white/[0.06] flex flex-col items-start gap-1 rounded-xl"
                    >
                      <History className="w-4 h-4 text-purple-400" />
                      <span className="text-sm font-medium text-white">Version History</span>
                      <span className="text-xs text-white/50">Past changes</span>
                    </Button>

                    <Button
                      variant="ghost"
                      onClick={() => openSection('chat')}
                      className="h-auto py-3 px-4 bg-white/[0.03] hover:bg-white/[0.06] flex flex-col items-start gap-1 rounded-xl"
                    >
                      <MessageSquare className="w-4 h-4 text-amber-400" />
                      <span className="text-sm font-medium text-white">AI Chat</span>
                      <span className="text-xs text-white/50">Modify with AI</span>
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Undo bar (if applicable) */}
            {hasUndoableChange && (
              <div className="px-6 py-3 border-t border-white/[0.06] bg-white/[0.02]">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onUndo}
                  className="w-full border-white/10 text-white/70 hover:text-white hover:bg-white/5"
                >
                  Undo Last Change
                </Button>
              </div>
            )}
          </div>

          {/* Nested Drawers */}
          {activeSection === 'costs' && (
            <RightDrawer
              isOpen={true}
              onClose={closeSection}
              title="True Cost Breakdown"
              size="xl"
            >
              <CostBreakdown trip={trip} />
            </RightDrawer>
          )}

          {activeSection === 'checklist' && (
            <RightDrawer
              isOpen={true}
              onClose={closeSection}
              title="Action Items"
            >
              <ActionItems trip={trip} blockerDelta={blockerDelta} />
            </RightDrawer>
          )}

          {activeSection === 'history' && (
            <RightDrawer
              isOpen={true}
              onClose={closeSection}
              title="Version History"
            >
              <VersionsPanel
                tripId={trip.id}
                onRestore={onVersionRestore}
                onExport={onVersionExport}
              />
            </RightDrawer>
          )}

          {activeSection === 'chat' && (
            <RightDrawer
              isOpen={true}
              onClose={closeSection}
              title="AI Assistant"
              size="xl"
            >
              <Suspense
                fallback={
                  <div className="flex items-center justify-center h-48">
                    <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                }
              >
                <TripChat
                  tripId={trip.id}
                  destination={trip.destination || 'Your Trip'}
                  onTripUpdate={onTripUpdate}
                  prefillMessage={chatPrefill}
                  mode="inline"
                />
              </Suspense>
            </RightDrawer>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

export const LogisticsDrawer = React.memo(LogisticsDrawerComponent);
