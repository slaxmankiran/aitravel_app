/**
 * DayCard.tsx
 *
 * Premium day card component for Trip Results V1.
 * Shows day header + collapsible activity list.
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  MapPin,
  Clock,
  DollarSign,
  Utensils,
  Camera,
  Bus,
  Bed,
  Footprints
} from "lucide-react";
import type { DayViewModel, ActivityViewModel } from "@/hooks/useTripViewModel";

// ============================================================================
// ACTIVITY ICON
// ============================================================================

function getActivityIcon(type: ActivityViewModel['type']) {
  switch (type) {
    case 'meal':
      return <Utensils className="w-4 h-4" />;
    case 'transport':
      return <Bus className="w-4 h-4" />;
    case 'lodging':
      return <Bed className="w-4 h-4" />;
    case 'activity':
    default:
      return <Camera className="w-4 h-4" />;
  }
}

function getActivityTypeColor(type: ActivityViewModel['type']) {
  switch (type) {
    case 'meal':
      return 'text-orange-400 bg-orange-500/10';
    case 'transport':
      return 'text-blue-400 bg-blue-500/10';
    case 'lodging':
      return 'text-purple-400 bg-purple-500/10';
    case 'activity':
    default:
      return 'text-emerald-400 bg-emerald-500/10';
  }
}

// ============================================================================
// ACTIVITY ITEM
// ============================================================================

interface ActivityItemProps {
  activity: ActivityViewModel;
  isHighlighted: boolean;
  onSelect: (activityKey: string) => void;
}

function ActivityItem({ activity, isHighlighted, onSelect }: ActivityItemProps) {
  const iconColor = getActivityTypeColor(activity.type);

  return (
    <motion.div
      layout
      onClick={() => onSelect(activity.activityKey)}
      className={`
        group flex gap-3 p-3 rounded-lg cursor-pointer transition-all
        ${isHighlighted
          ? 'bg-primary/20 ring-1 ring-primary/50'
          : 'hover:bg-white/5'
        }
      `}
    >
      {/* Icon */}
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${iconColor}`}>
        {getActivityIcon(activity.type)}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-sm font-medium text-white truncate">
            {activity.title}
          </h4>
          {activity.cost !== undefined && activity.cost > 0 && (
            <span className="text-xs text-white/50 shrink-0">
              ${activity.cost}
            </span>
          )}
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-3 mt-1 text-xs text-white/50">
          {activity.time && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {activity.time}
            </span>
          )}
          {activity.duration && (
            <span>{activity.duration}</span>
          )}
          {activity.location && (
            <span className="flex items-center gap-1 truncate">
              <MapPin className="w-3 h-3 shrink-0" />
              <span className="truncate">{activity.location}</span>
            </span>
          )}
        </div>

        {/* Description (if highlighted) */}
        <AnimatePresence>
          {isHighlighted && activity.description && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="text-xs text-white/60 mt-2 line-clamp-2"
            >
              {activity.description}
            </motion.p>
          )}
        </AnimatePresence>

        {/* Tips (if highlighted) */}
        <AnimatePresence>
          {isHighlighted && activity.tips && activity.tips.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-2 text-xs text-amber-400/80 bg-amber-500/10 px-2 py-1 rounded"
            >
              {activity.tips[0]}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ============================================================================
// DAY CARD
// ============================================================================

interface DayCardProps {
  day: DayViewModel;
  isActive: boolean;
  highlightedActivityId: string | null;
  onDaySelect: (dayNumber: number) => void;
  onActivitySelect: (activityId: string) => void;
}

export function DayCard({
  day,
  isActive,
  highlightedActivityId,
  onDaySelect,
  onActivitySelect
}: DayCardProps) {
  const [isExpanded, setIsExpanded] = useState(isActive);

  const handleToggle = () => {
    setIsExpanded(!isExpanded);
    if (!isExpanded) {
      onDaySelect(day.dayNumber - 1);
    }
  };

  return (
    <motion.div
      layout
      className={`
        bg-white/5 border rounded-xl overflow-hidden transition-colors
        ${isActive ? 'border-primary/50' : 'border-white/10'}
      `}
    >
      {/* Header */}
      <button
        onClick={handleToggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          {/* Day number badge */}
          <div className={`
            w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm
            ${isActive
              ? 'bg-primary text-white'
              : 'bg-white/10 text-white/70'
            }
          `}>
            {day.dayNumber}
          </div>

          <div className="text-left">
            <h3 className="text-sm font-medium text-white">{day.title}</h3>
            {day.date && (
              <p className="text-xs text-white/50">{day.date}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Day cost */}
          {day.totalCost > 0 && (
            <span className="text-xs text-white/50 hidden sm:block">
              ${day.totalCost.toLocaleString()}
            </span>
          )}

          {/* Activity count */}
          <span className="text-xs text-white/40 bg-white/5 px-2 py-1 rounded">
            {day.activities.length} activities
          </span>

          {/* Chevron */}
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="w-4 h-4 text-white/40" />
          </motion.div>
        </div>
      </button>

      {/* Activities */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="px-4 pb-4 border-t border-white/5">
              <div className="pt-3 space-y-1">
                {day.activities.map((activity) => (
                  <ActivityItem
                    key={activity.activityKey}
                    activity={activity}
                    isHighlighted={highlightedActivityId === activity.activityKey}
                    onSelect={onActivitySelect}
                  />
                ))}

                {day.activities.length === 0 && (
                  <p className="text-sm text-white/40 text-center py-4">
                    No activities planned for this day
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ============================================================================
// DAY CARDS LIST
// ============================================================================

interface DayCardsListProps {
  days: DayViewModel[];
  activeDayIndex: number;
  highlightedActivityId: string | null;
  onDaySelect: (index: number) => void;
  onActivitySelect: (activityId: string) => void;
}

export function DayCardsList({
  days,
  activeDayIndex,
  highlightedActivityId,
  onDaySelect,
  onActivitySelect
}: DayCardsListProps) {
  if (days.length === 0) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-xl p-12 text-center">
        <Footprints className="w-12 h-12 text-white/20 mx-auto mb-4" />
        <p className="text-white/50">Your itinerary will appear here once generated</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {days.map((day, index) => (
        <DayCard
          key={day.dayNumber}
          day={day}
          isActive={index === activeDayIndex}
          highlightedActivityId={highlightedActivityId}
          onDaySelect={onDaySelect}
          onActivitySelect={onActivitySelect}
        />
      ))}
    </div>
  );
}
