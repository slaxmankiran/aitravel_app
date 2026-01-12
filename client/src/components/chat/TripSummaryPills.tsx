/**
 * TripSummaryPills.tsx
 *
 * Mindtrip-style top summary bar showing trip state at a glance.
 * Each pill is clickable to open its respective modal.
 *
 * States:
 * - Missing (required): Amber pulse
 * - Complete: Checkmark icon, solid fill
 * - Default: Muted, dashed border
 */

import { MapPin, Calendar, Users, Sparkles, Flag, Check } from "lucide-react";

interface TripSummaryPillsProps {
  destination?: string;
  dateType: 'specific' | 'flexible';
  dateDisplay?: string; // e.g., "Feb 15-22" or "Flexible"
  travelers: { adults: number; children: number; infants: number };
  travelStyle: 'budget' | 'comfort' | 'luxury' | 'custom';
  passport?: string;
  currency?: string;
  onDestinationClick: () => void;
  onDateClick: () => void;
  onTravelersClick: () => void;
  onStyleClick: () => void;
  onPassportClick: () => void;
}

export function TripSummaryPills({
  destination,
  dateType,
  dateDisplay,
  travelers,
  travelStyle,
  passport,
  currency,
  onDestinationClick,
  onDateClick,
  onTravelersClick,
  onStyleClick,
  onPassportClick,
}: TripSummaryPillsProps) {
  const totalTravelers = travelers.adults + travelers.children + travelers.infants;

  const formatTravelers = () => {
    if (totalTravelers === 1) return "1 traveler";
    return `${totalTravelers} travelers`;
  };

  const formatStyle = () => {
    const currencySuffix = currency && currency !== 'USD' ? ` (${currency})` : '';
    switch (travelStyle) {
      case 'budget': return `Budget${currencySuffix}`;
      case 'luxury': return `Luxury${currencySuffix}`;
      case 'custom': return `Custom${currencySuffix}`;
      default: return `Comfort${currencySuffix}`;
    }
  };

  const formatDate = () => {
    if (dateDisplay) return dateDisplay;
    return dateType === 'flexible' ? 'Flexible' : 'When';
  };

  return (
    <div className="flex items-center justify-center gap-2 py-3 px-4 border-b border-slate-200 bg-white/80 backdrop-blur-sm">
      {/* Where - REQUIRED, pulses when missing */}
      <Pill
        icon={<MapPin className="w-3.5 h-3.5" />}
        label={destination || "Where"}
        complete={!!destination}
        onClick={onDestinationClick}
        urgent={!destination}
      />

      {/* When - has sensible default, so not urgent */}
      <Pill
        icon={<Calendar className="w-3.5 h-3.5" />}
        label={formatDate()}
        complete={!!dateDisplay}
        onClick={onDateClick}
      />

      {/* Travelers - always has default value */}
      <Pill
        icon={<Users className="w-3.5 h-3.5" />}
        label={formatTravelers()}
        complete={true}
        onClick={onTravelersClick}
      />

      {/* Style - always has default value */}
      <Pill
        icon={<Sparkles className="w-3.5 h-3.5" />}
        label={formatStyle()}
        complete={true}
        onClick={onStyleClick}
      />

      {/* Passport (VoyageAI-specific) - REQUIRED for visa intelligence */}
      <Pill
        icon={<Flag className="w-3.5 h-3.5" />}
        label={passport || "Passport"}
        complete={!!passport}
        onClick={onPassportClick}
        urgent={!passport}
        highlight={!!passport}
      />
    </div>
  );
}

interface PillProps {
  icon: React.ReactNode;
  label: string;
  complete: boolean;
  onClick: () => void;
  highlight?: boolean;
  urgent?: boolean;
}

function Pill({ icon, label, complete, onClick, highlight, urgent }: PillProps) {
  // State hierarchy:
  // 1. Urgent (missing required) - amber pulse
  // 2. Highlight (special emphasis) - emerald
  // 3. Complete - slate solid
  // 4. Default - dashed outline

  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium
        transition-all duration-200 hover:scale-105
        ${urgent
          ? 'bg-amber-50 text-amber-700 border border-amber-300 animate-pulse'
          : highlight
            ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
            : complete
              ? 'bg-slate-100 text-slate-700 border border-slate-200'
              : 'bg-transparent text-slate-400 border border-dashed border-slate-300 hover:border-slate-400'
        }
      `}
    >
      {/* Show checkmark for complete items, original icon otherwise */}
      {complete && !urgent ? (
        <Check className="w-3.5 h-3.5 text-emerald-600" />
      ) : (
        icon
      )}
      <span className="max-w-[120px] truncate">{label}</span>
    </button>
  );
}
