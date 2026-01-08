/**
 * ActionItems.tsx
 *
 * Smart checklist that generates action items based on trip data.
 * Prioritized by urgency and trip requirements.
 */

import { useMemo } from "react";
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
  Clock
} from "lucide-react";
import type { TripResponse, VisaDetails } from "@shared/schema";

type Priority = 'urgent' | 'soon' | 'later';

interface ActionItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  priority: Priority;
  completed: boolean;
  url?: string;
}

interface ActionItemRowProps {
  item: ActionItem;
  onToggle: (id: string) => void;
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

function ActionItemRow({ item, onToggle }: ActionItemRowProps) {
  const priorityStyle = getPriorityStyles(item.priority);

  return (
    <div
      className={`
        flex items-start gap-3 p-2 rounded-lg transition-colors cursor-pointer
        ${item.completed ? 'opacity-50' : 'hover:bg-white/5'}
      `}
      onClick={() => onToggle(item.id)}
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
}

export function ActionItems({ trip, completedItems = [], onToggle }: ActionItemsProps) {
  const items = useMemo(() => {
    const result: ActionItem[] = [];
    const feasibility = trip.feasibilityReport as any;
    const visaDetails = feasibility?.visaDetails as VisaDetails | undefined;

    // 1. Visa application (if required)
    if (visaDetails && visaDetails.required && visaDetails.type !== 'visa_free') {
      const isUrgent = visaDetails.timing?.urgency === 'tight' || visaDetails.timing?.urgency === 'risky';
      result.push({
        id: 'visa',
        label: `Apply for ${visaDetails.name || 'visa'}`,
        description: visaDetails.timing?.recommendation,
        icon: <FileText className="w-4 h-4" />,
        priority: isUrgent ? 'urgent' : 'soon',
        completed: completedItems.includes('visa'),
        url: visaDetails.applicationUrl,
      });
    }

    // 2. Book flights
    result.push({
      id: 'flights',
      label: 'Book flights',
      description: 'Compare prices and book your tickets',
      icon: <Plane className="w-4 h-4" />,
      priority: 'soon',
      completed: completedItems.includes('flights'),
    });

    // 3. Book accommodation
    result.push({
      id: 'accommodation',
      label: 'Reserve accommodation',
      description: 'Book hotels or vacation rentals',
      icon: <Home className="w-4 h-4" />,
      priority: 'soon',
      completed: completedItems.includes('accommodation'),
    });

    // 4. Travel insurance
    result.push({
      id: 'insurance',
      label: 'Get travel insurance',
      description: 'Protect your trip investment',
      icon: <Shield className="w-4 h-4" />,
      priority: 'later',
      completed: completedItems.includes('insurance'),
    });

    // 5. Currency/cards
    result.push({
      id: 'currency',
      label: 'Prepare payment methods',
      description: 'Notify bank, get travel card',
      icon: <CreditCard className="w-4 h-4" />,
      priority: 'later',
      completed: completedItems.includes('currency'),
    });

    // 6. Mobile data
    result.push({
      id: 'mobile',
      label: 'Arrange mobile data',
      description: 'eSIM or local SIM card',
      icon: <Smartphone className="w-4 h-4" />,
      priority: 'later',
      completed: completedItems.includes('mobile'),
    });

    // 7. Packing
    result.push({
      id: 'packing',
      label: 'Pack your bags',
      description: 'Check weather and pack accordingly',
      icon: <Luggage className="w-4 h-4" />,
      priority: 'later',
      completed: completedItems.includes('packing'),
    });

    // Sort by priority then completion
    const priorityOrder: Record<Priority, number> = { urgent: 0, soon: 1, later: 2 };
    return result.sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }, [trip, completedItems]);

  const completedCount = items.filter(i => i.completed).length;

  const handleToggle = (id: string) => {
    onToggle?.(id);
  };

  return (
    <div className="space-y-2">
      {/* Progress */}
      <div className="flex items-center justify-between text-xs mb-3">
        <span className="text-white/50">{completedCount} of {items.length} completed</span>
        <div className="flex-1 mx-3 h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500/70 rounded-full transition-all"
            style={{ width: `${(completedCount / items.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Items */}
      <div className="space-y-1">
        {items.map(item => (
          <ActionItemRow key={item.id} item={item} onToggle={handleToggle} />
        ))}
      </div>
    </div>
  );
}
