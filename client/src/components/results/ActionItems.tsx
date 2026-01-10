/**
 * ActionItems.tsx
 *
 * Smart checklist that generates action items based on trip data.
 * Split into Required (blocking) vs Recommended (nice-to-have).
 *
 * Required: visa, passport validity, vaccines, entry restrictions
 * Recommended: flights, accommodation, insurance, currency, mobile, packing
 */

import { useMemo, useCallback, useRef, useEffect } from "react";
import {
  Plane,
  Home,
  FileText,
  Shield,
  CreditCard,
  Smartphone,
  Luggage,
  Stethoscope,
  Check,
  AlertCircle,
  Clock,
  CheckCircle2,
  Syringe,
  AlertTriangle,
  IdCard,
} from "lucide-react";
import type { TripResponse, VisaDetails, FeasibilityReport } from "@shared/schema";
import { trackTripEvent } from "@/lib/analytics";
import { needsVisaTimingFix } from "@/lib/actionItems";
import { FixBlockersCTA } from "./FixBlockersCTA";
import type { BlockerDeltaUI } from "@/lib/blockerDeltas";

type Priority = 'urgent' | 'soon' | 'later';
type Category = 'required' | 'recommended';

interface ActionItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  priority: Priority;
  category: Category;
  completed: boolean;
  url?: string;
}

interface ActionItemRowProps {
  item: ActionItem;
  onToggle: (id: string) => void;
  onItemClick?: (item: ActionItem) => void;
}

function getPriorityStyles(priority: Priority) {
  switch (priority) {
    case 'urgent':
      return {
        badge: 'bg-red-500/20 text-red-400 border-red-500/30',
        icon: <AlertCircle className="w-3 h-3" />,
        label: 'Urgent',
      };
    case 'soon':
      return {
        badge: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
        icon: <Clock className="w-3 h-3" />,
        label: 'Soon',
      };
    case 'later':
    default:
      return {
        badge: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
        icon: null,
        label: 'Later',
      };
  }
}

function ActionItemRow({ item, onToggle, onItemClick }: ActionItemRowProps) {
  const priorityStyle = getPriorityStyles(item.priority);

  const handleClick = () => {
    onToggle(item.id);
    onItemClick?.(item);
  };

  return (
    <div
      className={`
        flex items-start gap-3 p-2 rounded-lg transition-colors cursor-pointer
        ${item.completed ? 'opacity-50' : 'hover:bg-white/5'}
      `}
      onClick={handleClick}
    >
      {/* Checkbox */}
      <div className={`
        w-5 h-5 rounded border flex items-center justify-center shrink-0 mt-0.5
        ${item.completed
          ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
          : 'border-white/20 hover:border-white/40'
        }
      `}>
        {item.completed && <Check className="w-3 h-3" />}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-sm ${item.completed ? 'line-through text-white/50' : 'text-white/90'}`}>
            {item.label}
          </span>
          {item.priority !== 'later' && !item.completed && (
            <span className={`
              flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border
              ${priorityStyle.badge}
            `}>
              {priorityStyle.icon}
              {priorityStyle.label}
            </span>
          )}
        </div>
        {item.description && !item.completed && (
          <p className="text-xs text-white/40 mt-0.5">{item.description}</p>
        )}
      </div>

      {/* Icon */}
      <div className="text-white/30 shrink-0">
        {item.icon}
      </div>
    </div>
  );
}

interface ActionItemsProps {
  trip: TripResponse;
  completedItems?: string[];
  onToggle?: (id: string) => void;
  blockerDelta?: BlockerDeltaUI | null;
}

export function ActionItems({ trip, completedItems = [], onToggle, blockerDelta }: ActionItemsProps) {
  // Track if we've fired the "viewed" analytics event
  const hasTrackedView = useRef(false);

  // Extract feasibility once - used as memo dependency to avoid recomputes
  // when other trip fields (itinerary, costs) change
  const feasibility = trip.feasibilityReport as any;

  const items = useMemo(() => {
    const result: ActionItem[] = [];
    const visaDetails = feasibility?.visaDetails as VisaDetails | undefined;
    const safetyInfo = feasibility?.breakdown?.safety;
    const healthInfo = feasibility?.healthRequirements;

    // =============================================
    // REQUIRED ITEMS (blocking - affects eligibility)
    // =============================================

    // 1. Visa application (if required)
    if (visaDetails && visaDetails.required && visaDetails.type !== 'visa_free') {
      const isUrgent = visaDetails.timing?.urgency === 'tight' || visaDetails.timing?.urgency === 'risky';
      result.push({
        id: 'visa',
        label: `Apply for ${visaDetails.name || 'visa'}`,
        description: visaDetails.timing?.recommendation || 'Required for entry',
        icon: <FileText className="w-4 h-4" />,
        priority: isUrgent ? 'urgent' : 'soon',
        category: 'required',
        completed: completedItems.includes('visa'),
        url: visaDetails.applicationUrl,
      });
    }

    // 2. Passport validity (if expiring within 6 months of trip)
    // Check if passport needs renewal based on destination requirements
    const passportWarning = feasibility?.passportWarning || feasibility?.breakdown?.visa?.passportNote;
    if (passportWarning) {
      result.push({
        id: 'passport',
        label: 'Check passport validity',
        description: passportWarning || 'Must be valid 6+ months after return',
        icon: <IdCard className="w-4 h-4" />,
        priority: 'urgent',
        category: 'required',
        completed: completedItems.includes('passport'),
      });
    }

    // 3. Mandatory vaccinations (if required for entry)
    const requiredVaccines = healthInfo?.requiredVaccinations || feasibility?.vaccineRequirements;
    if (requiredVaccines && requiredVaccines.length > 0) {
      result.push({
        id: 'vaccines',
        label: 'Get required vaccinations',
        description: `Required: ${Array.isArray(requiredVaccines) ? requiredVaccines.join(', ') : requiredVaccines}`,
        icon: <Syringe className="w-4 h-4" />,
        priority: 'urgent',
        category: 'required',
        completed: completedItems.includes('vaccines'),
      });
    }

    // 4. Entry restrictions/requirements (COVID, health declarations, etc.)
    const entryRestrictions = feasibility?.entryRestrictions || feasibility?.breakdown?.entry?.restrictions;
    if (entryRestrictions && entryRestrictions.length > 0) {
      result.push({
        id: 'entry_requirements',
        label: 'Review entry requirements',
        description: 'Health declarations or testing may be required',
        icon: <AlertTriangle className="w-4 h-4" />,
        priority: 'urgent',
        category: 'required',
        completed: completedItems.includes('entry_requirements'),
      });
    }

    // =============================================
    // RECOMMENDED ITEMS (nice-to-have - improves trip)
    // =============================================

    // 5. Book flights
    result.push({
      id: 'flights',
      label: 'Book flights',
      description: 'Compare prices and book your tickets',
      icon: <Plane className="w-4 h-4" />,
      priority: 'soon',
      category: 'recommended',
      completed: completedItems.includes('flights'),
    });

    // 6. Book accommodation
    result.push({
      id: 'accommodation',
      label: 'Reserve accommodation',
      description: 'Book hotels or vacation rentals',
      icon: <Home className="w-4 h-4" />,
      priority: 'soon',
      category: 'recommended',
      completed: completedItems.includes('accommodation'),
    });

    // 7. Travel insurance
    result.push({
      id: 'insurance',
      label: 'Get travel insurance',
      description: 'Protect your trip investment',
      icon: <Shield className="w-4 h-4" />,
      priority: 'later',
      category: 'recommended',
      completed: completedItems.includes('insurance'),
    });

    // 8. Currency/cards
    result.push({
      id: 'currency',
      label: 'Prepare payment methods',
      description: 'Notify bank, get travel card',
      icon: <CreditCard className="w-4 h-4" />,
      priority: 'later',
      category: 'recommended',
      completed: completedItems.includes('currency'),
    });

    // 9. Mobile data
    result.push({
      id: 'mobile',
      label: 'Arrange mobile data',
      description: 'eSIM or local SIM card',
      icon: <Smartphone className="w-4 h-4" />,
      priority: 'later',
      category: 'recommended',
      completed: completedItems.includes('mobile'),
    });

    // 10. Packing
    result.push({
      id: 'packing',
      label: 'Pack your bags',
      description: 'Check weather and pack accordingly',
      icon: <Luggage className="w-4 h-4" />,
      priority: 'later',
      category: 'recommended',
      completed: completedItems.includes('packing'),
    });

    // Sort: required first, then by priority, then by completion
    const categoryOrder: Record<Category, number> = { required: 0, recommended: 1 };
    const priorityOrder: Record<Priority, number> = { urgent: 0, soon: 1, later: 2 };
    return result.sort((a, b) => {
      // Completed items go to bottom of their category
      if (a.category === b.category && a.completed !== b.completed) {
        return a.completed ? 1 : -1;
      }
      // Sort by category first
      if (a.category !== b.category) {
        return categoryOrder[a.category] - categoryOrder[b.category];
      }
      // Then by priority
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }, [feasibility, completedItems]);

  // Split by category (not priority)
  const requiredItems = useMemo(() => items.filter(i => i.category === 'required'), [items]);
  const recommendedItems = useMemo(() => items.filter(i => i.category === 'recommended'), [items]);

  const completedCount = items.filter(i => i.completed).length;
  const requiredCompletedCount = requiredItems.filter(i => i.completed).length;
  const recommendedCompletedCount = recommendedItems.filter(i => i.completed).length;

  // Progress percentage (guarded against division by zero)
  const progressPct = items.length > 0
    ? Math.round((completedCount / items.length) * 100)
    : 0;

  // Check if any required items are incomplete (blocking)
  const hasBlockers = requiredItems.length > 0 && requiredItems.some(i => !i.completed);

  // Analytics: track view (once per mount)
  useEffect(() => {
    if (!hasTrackedView.current && trip.id) {
      hasTrackedView.current = true;
      trackTripEvent(trip.id, 'action_items_viewed', {
        requiredCount: requiredItems.length,
        recommendedCount: recommendedItems.length,
        hasBlockers,
      });
    }
  }, [trip.id, requiredItems.length, recommendedItems.length, hasBlockers]);

  // Handler for item click (toggle + analytics)
  const handleItemClick = useCallback((item: ActionItem) => {
    trackTripEvent(trip.id, 'action_item_clicked', {
      key: item.id,
      type: item.category,
      wasCompleted: item.completed,
    });
  }, [trip.id]);

  const handleToggle = useCallback((id: string) => {
    onToggle?.(id);
  }, [onToggle]);

  return (
    <div className="space-y-4">
      {/* Status message - contextual based on blockers */}
      <div className={`flex items-start gap-2 p-2.5 rounded-lg border ${
        hasBlockers
          ? 'bg-amber-500/10 border-amber-500/20'
          : 'bg-emerald-500/10 border-emerald-500/20'
      }`}>
        {hasBlockers ? (
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        ) : (
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        )}
        <p className={`text-xs leading-relaxed ${
          hasBlockers ? 'text-amber-300/90' : 'text-emerald-300/90'
        }`}>
          {hasBlockers
            ? `${requiredItems.length - requiredCompletedCount} item${requiredItems.length - requiredCompletedCount !== 1 ? 's' : ''} need attention before your trip.`
            : "No blockers found. You're all set for planning!"
          }
        </p>
      </div>

      {/* Progress bar */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-white/50">{completedCount} of {items.length} completed</span>
        <div className="flex-1 mx-3 h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500/70 rounded-full transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Blocker delta chips - show when we have meaningful changes */}
      {blockerDelta && (blockerDelta.resolved.length > 0 || blockerDelta.added.length > 0) && (
        <div className="flex flex-wrap gap-2">
          {blockerDelta.resolved.length > 0 && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/25 text-emerald-200">
              Resolved: {blockerDelta.resolved.length}
            </span>
          )}
          {blockerDelta.added.length > 0 && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-500/15 border border-red-500/25 text-red-200">
              New: {blockerDelta.added.length}
            </span>
          )}
        </div>
      )}

      {/* Required section (blocking items) */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className={`text-[10px] font-semibold uppercase tracking-wide ${
            requiredItems.length > 0 ? 'text-red-400' : 'text-emerald-400'
          }`}>
            Required ({requiredItems.length})
          </span>
          <div className={`flex-1 h-px ${
            requiredItems.length > 0 ? 'bg-red-500/20' : 'bg-emerald-500/20'
          }`} />
        </div>
        {requiredItems.length > 0 ? (
          <div className="space-y-1">
            {requiredItems.map(item => (
              <ActionItemRow
                key={item.id}
                item={item}
                onToggle={handleToggle}
                onItemClick={handleItemClick}
              />
            ))}

            {/* Fix visa timing CTA - show under visa item when timing is tight/risky */}
            {requiredItems.some(i => i.id === 'visa' && !i.completed) &&
              needsVisaTimingFix(feasibility) && (
              <div className="ml-8 mt-1 mb-2">
                <FixBlockersCTA source="action_items" reason="visa_timing" />
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 p-2 text-emerald-400/70">
            <CheckCircle2 className="w-4 h-4" />
            <span className="text-xs">No blockers found</span>
          </div>
        )}
      </div>

      {/* Recommended section (nice-to-have items) */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Recommended ({recommendedItems.length})
          </span>
          <div className="flex-1 h-px bg-slate-500/20" />
        </div>
        <div className="space-y-1">
          {recommendedItems.map(item => (
            <ActionItemRow
              key={item.id}
              item={item}
              onToggle={handleToggle}
              onItemClick={handleItemClick}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
