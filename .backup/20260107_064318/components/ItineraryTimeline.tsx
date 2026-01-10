import { motion } from "framer-motion";
import { Calendar, MapPin, Coffee, Utensils, BedDouble, Camera, Navigation, Clock, Info, Coins, ArrowDown, Car, Bus, Train, Footprints, ChevronDown, Plus, Check } from "lucide-react";
import { type TripResponse } from "@shared/schema";
import { useEffect, useRef, useState } from "react";

// Get transport info based on mode
function getTransportInfo(transportMode?: string): { mode: string; icon: any; color: string; bgColor: string } {
  const mode = (transportMode || '').toLowerCase();

  if (mode.includes('walk')) {
    return { mode: 'Walk', icon: Footprints, color: 'text-green-600', bgColor: 'bg-green-100' };
  }
  if (mode.includes('metro') || mode.includes('subway')) {
    return { mode: 'Metro', icon: Train, color: 'text-blue-600', bgColor: 'bg-blue-100' };
  }
  if (mode.includes('train')) {
    return { mode: 'Train', icon: Train, color: 'text-purple-600', bgColor: 'bg-purple-100' };
  }
  if (mode.includes('bus')) {
    return { mode: 'Bus', icon: Bus, color: 'text-orange-600', bgColor: 'bg-orange-100' };
  }
  if (mode.includes('auto') || mode.includes('rickshaw')) {
    return { mode: 'Auto', icon: Car, color: 'text-yellow-600', bgColor: 'bg-yellow-100' };
  }
  // Default to cab/taxi
  return { mode: 'Cab', icon: Car, color: 'text-slate-600', bgColor: 'bg-slate-100' };
}

// Improved transport connector - clear, visible design
function TransportConnector({ transportMode }: { transportMode?: string }) {
  const transport = getTransportInfo(transportMode);
  const TransportIcon = transport.icon;

  return (
    <div className="flex items-center py-2 ml-[72px]">
      {/* Vertical line with arrow */}
      <div className="flex flex-col items-center mr-3">
        <div className="w-0.5 h-3 bg-slate-200" />
        <ChevronDown className="w-4 h-4 text-slate-400 -my-1" />
        <div className="w-0.5 h-3 bg-slate-200" />
      </div>

      {/* Transport badge */}
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${transport.bgColor} border border-slate-200 shadow-sm`}>
        <TransportIcon className={`w-4 h-4 ${transport.color}`} />
        <span className={`text-xs font-medium ${transport.color}`}>{transport.mode}</span>
      </div>
    </div>
  );
}

interface Activity {
  time: string;
  description: string;
  type: "activity" | "meal" | "transport" | "lodging";
  location?: string | { lat: number; lng: number; address?: string };
  coordinates?: { lat: number; lng: number };
  estimatedCost?: number;
  costNote?: string;
  bookingTip?: string;
  name?: string;
  cost?: number;
  transportMode?: string; // How to reach this activity (walk, metro, taxi, etc.)
}

interface LocalFoodSpot {
  meal: "breakfast" | "lunch" | "dinner";
  name: string;
  cuisine?: string;
  priceRange?: "$" | "$$" | "$$$";
  note?: string;
  estimatedCost?: number;
  coordinates?: { lat: number; lng: number };
  selected?: boolean;
}

// Helper to get location string from activity
function getLocationString(activity: Activity): string | null {
  if (!activity.location) return null;
  if (typeof activity.location === 'string') return activity.location;
  if (typeof activity.location === 'object' && activity.location.address) {
    return activity.location.address;
  }
  return null;
}

// Helper to get display name
function getActivityName(activity: Activity): string {
  return activity.name || activity.description || 'Activity';
}

interface DayPlan {
  day: number;
  date: string;
  title: string;
  activities: Activity[];
  localFood?: LocalFoodSpot[];
}

interface Props {
  trip: TripResponse;
  highlightedLocation?: string | null;
  onActivityClick?: (activityId: string) => void;
  onFoodSelect?: (day: number, food: LocalFoodSpot) => void;
  selectedFoods?: Map<string, LocalFoodSpot>; // key: "day-meal" e.g., "1-lunch"
}

const TYPE_COLORS: Record<string, string> = {
  activity: "bg-blue-500",
  meal: "bg-amber-500",
  transport: "bg-purple-500",
  lodging: "bg-green-500",
};

const TYPE_BG_COLORS: Record<string, string> = {
  activity: "bg-blue-50 border-blue-200 hover:bg-blue-100",
  meal: "bg-amber-50 border-amber-200 hover:bg-amber-100",
  transport: "bg-purple-50 border-purple-200 hover:bg-purple-100",
  lodging: "bg-green-50 border-green-200 hover:bg-green-100",
};

const TYPE_HIGHLIGHT_COLORS: Record<string, string> = {
  activity: "bg-blue-100 border-blue-400 ring-2 ring-blue-300",
  meal: "bg-amber-100 border-amber-400 ring-2 ring-amber-300",
  transport: "bg-purple-100 border-purple-400 ring-2 ring-purple-300",
  lodging: "bg-green-100 border-green-400 ring-2 ring-green-300",
};

// Currency symbol mapping
const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', INR: '₹', EUR: '€', GBP: '£', JPY: '¥', AUD: 'A$', CAD: 'C$', SGD: 'S$', AED: 'د.إ', THB: '฿',
  CNY: '¥', CHF: 'CHF', KRW: '₩', HKD: 'HK$', NZD: 'NZ$', SEK: 'kr', NOK: 'kr', DKK: 'kr', MXN: '$',
  BRL: 'R$', SAR: '﷼', MYR: 'RM', IDR: 'Rp', PHP: '₱', ZAR: 'R', TRY: '₺', RUB: '₽', PLN: 'zł', CZK: 'Kč', HUF: 'Ft'
};

function getCurrencySymbol(currency?: string): string {
  return CURRENCY_SYMBOLS[currency || 'USD'] || currency || '$';
}

export function ItineraryTimeline({ trip, highlightedLocation, onActivityClick, onFoodSelect, selectedFoods }: Props) {
  const itinerary = trip.itinerary as unknown as { days: DayPlan[]; costBreakdown?: { currencySymbol?: string; currency?: string } };
  const activityRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Get currency symbol from trip data - use costBreakdown first, then trip.currency, then fallback
  const currencySymbol = itinerary?.costBreakdown?.currencySymbol || getCurrencySymbol(trip.currency ?? undefined);

  // Generate day-based activity ID (e.g., "1-1", "1-2", "2-1")
  const getActivityId = (dayNum: number, activityIdx: number): string => {
    return `${dayNum}-${activityIdx + 1}`;
  };

  // Scroll to highlighted activity (highlightedLocation is now a string like "1-2")
  useEffect(() => {
    if (highlightedLocation) {
      const element = activityRefs.current.get(String(highlightedLocation));
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightedLocation]);

  if (!itinerary || !itinerary.days) {
    return (
      <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
        <p className="text-muted-foreground">Itinerary details are not available yet.</p>
      </div>
    );
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "meal": return <Utensils className="w-4 h-4" />;
      case "lodging": return <BedDouble className="w-4 h-4" />;
      case "transport": return <Navigation className="w-4 h-4" />;
      default: return <Camera className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-8 relative">
      <div className="absolute left-[19px] top-4 bottom-4 w-0.5 bg-gradient-to-b from-primary via-primary/50 to-transparent hidden md:block" />

      {itinerary.days.map((day, dayIndex) => (
        <motion.div
          key={day.day}
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ delay: dayIndex * 0.1 }}
          className="relative pl-0 md:pl-12"
        >
          {/* Day Marker */}
          <div className="hidden md:flex absolute left-0 top-0 w-10 h-10 rounded-full bg-white border-4 border-primary items-center justify-center z-10 shadow-sm">
            <span className="text-xs font-bold text-primary">{day.day}</span>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-xl font-display font-bold text-slate-900">Day {day.day}: {day.title}</h3>
                <div className="flex items-center text-slate-500 text-sm mt-1">
                  <Calendar className="w-4 h-4 mr-2" />
                  {new Date(day.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </div>
              </div>
              <div className="mt-3 md:mt-0 flex items-center gap-2 text-xs text-slate-500">
                <Clock className="w-4 h-4" />
                {day.activities.length} activities
              </div>
            </div>

            <div className="space-y-1">
              {day.activities.map((activity, idx) => {
                const hasCoordinates = !!(
                  (activity.coordinates?.lat && activity.coordinates?.lng) ||
                  (typeof activity.location === 'object' && activity.location?.lat && activity.location?.lng)
                );
                const activityId = getActivityId(day.day, idx);
                const isHighlighted = String(highlightedLocation) === activityId;
                const isLastActivity = idx === day.activities.length - 1;
                const nextActivity = day.activities[idx + 1];

                return (
                  <div key={idx}>
                    {/* Activity Card */}
                    <div
                      ref={(el) => {
                        if (el) {
                          activityRefs.current.set(activityId, el);
                        }
                      }}
                      className={`flex gap-4 group cursor-pointer transition-all duration-200 rounded-xl p-2 -mx-2 ${
                        isHighlighted
                          ? TYPE_HIGHLIGHT_COLORS[activity.type]
                          : hasCoordinates
                          ? "hover:bg-slate-50"
                          : ""
                      }`}
                      onClick={() => {
                        if (onActivityClick) {
                          onActivityClick(activityId);
                        }
                      }}
                    >
                      <div className="w-16 pt-1 text-right flex-shrink-0">
                        <span className="text-sm font-medium text-slate-500">{activity.time}</span>
                      </div>
                      <div className="relative flex-grow pl-4">
                        <div className={`absolute -left-[7px] top-2 w-3 h-3 rounded-full ring-4 ring-white transition-all z-10 ${
                          isHighlighted
                            ? TYPE_COLORS[activity.type] + " scale-125"
                            : TYPE_COLORS[activity.type] + " group-hover:scale-110"
                        }`} />
                        {/* Vertical line connector */}
                        {!isLastActivity && (
                          <div className="absolute left-[-1px] top-5 bottom-[-40px] w-0.5 bg-slate-200" />
                        )}

                        <div className={`rounded-xl p-4 border transition-all ${
                          isHighlighted
                            ? TYPE_HIGHLIGHT_COLORS[activity.type]
                            : TYPE_BG_COLORS[activity.type]
                        }`}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-grow">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-white text-xs font-bold ${TYPE_COLORS[activity.type] || 'bg-slate-500'}`}>
                                  {idx + 1}
                                </span>
                                <p className="text-slate-800 font-medium">{getActivityName(activity)}</p>
                              </div>
                              {getLocationString(activity) && (
                                <div className="flex items-center text-xs text-slate-500 mt-2">
                                  <MapPin className="w-3 h-3 mr-1 flex-shrink-0" />
                                  <span className="truncate">{getLocationString(activity)}</span>
                                  {hasCoordinates && (
                                    <a
                                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(getLocationString(activity) || activity.description)}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="ml-2 text-blue-500 hover:text-blue-600 hover:underline"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      View →
                                    </a>
                                  )}
                                </div>
                              )}
                              {/* Price - prominently displayed */}
                              <div className="flex flex-wrap items-center gap-2 mt-2">
                                {(typeof activity.estimatedCost === 'number' || typeof activity.cost === 'number') && (
                                  <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${
                                    (activity.estimatedCost || activity.cost || 0) === 0
                                      ? 'bg-green-100 text-green-700 border border-green-200'
                                      : 'bg-blue-50 text-blue-700 border border-blue-200'
                                  }`}>
                                    <Coins className="w-3 h-3" />
                                    {(activity.estimatedCost || activity.cost || 0) === 0 ? 'Free' : `${currencySymbol}${Math.round(activity.estimatedCost || activity.cost || 0).toLocaleString()}`}
                                  </span>
                                )}
                                {activity.costNote && (
                                  <span className="text-xs text-slate-400">{activity.costNote}</span>
                                )}
                              </div>
                              {activity.bookingTip && (
                                <div className="flex items-start gap-1.5 mt-2 p-2 bg-amber-50 rounded-lg text-xs text-amber-700">
                                  <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                  <span>{activity.bookingTip}</span>
                                </div>
                              )}
                            </div>
                            <div className={`p-2 rounded-lg ${TYPE_COLORS[activity.type]} text-white opacity-80`}>
                              {getActivityIcon(activity.type)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Transport Connector - show between activities */}
                    {!isLastActivity && nextActivity && (
                      <TransportConnector transportMode={nextActivity.transportMode} />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Local Food Recommendations - Interactive Selection */}
            {day.localFood && day.localFood.length > 0 && (
              <div className="mt-6 pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Utensils className="w-4 h-4 text-amber-500" />
                    <h4 className="text-sm font-semibold text-slate-700">Where to Eat</h4>
                  </div>
                  {onFoodSelect && (
                    <span className="text-xs text-slate-400">Click to add to itinerary</span>
                  )}
                </div>

                {/* Group by meal type */}
                {(['breakfast', 'lunch', 'dinner'] as const).map((mealType) => {
                  const mealOptions = day.localFood?.filter(f => f.meal === mealType) || [];
                  if (mealOptions.length === 0) return null;

                  const selectedKey = `${day.day}-${mealType}`;
                  const isSelected = selectedFoods?.has(selectedKey);
                  const selectedFood = selectedFoods?.get(selectedKey);

                  return (
                    <div key={mealType} className="mb-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-semibold text-amber-600 uppercase tracking-wide">
                          {mealType}
                        </span>
                        {isSelected && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full flex items-center gap-0.5">
                            <Check className="w-2.5 h-2.5" /> Added
                          </span>
                        )}
                      </div>

                      {/* Horizontal scrollable list */}
                      <div className="flex gap-2 overflow-x-auto pb-2 -mx-2 px-2 scrollbar-thin scrollbar-thumb-amber-200 scrollbar-track-transparent">
                        {mealOptions.map((food, foodIdx) => {
                          const isThisSelected = selectedFood?.name === food.name;

                          return (
                            <button
                              key={foodIdx}
                              onClick={() => onFoodSelect?.(day.day, food)}
                              className={`flex-shrink-0 w-48 text-left rounded-lg p-3 transition-all border-2 ${
                                isThisSelected
                                  ? 'bg-amber-100 border-amber-400 ring-2 ring-amber-200'
                                  : 'bg-amber-50/50 border-amber-100 hover:bg-amber-50 hover:border-amber-200'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-1">
                                <div className="flex-grow min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    {food.priceRange && (
                                      <span className="text-xs text-slate-400">{food.priceRange}</span>
                                    )}
                                    {food.estimatedCost && (
                                      <span className="text-xs font-medium text-emerald-600">
                                        {currencySymbol}{food.estimatedCost}
                                      </span>
                                    )}
                                  </div>
                                  <p className="font-medium text-slate-800 mt-0.5 truncate text-sm" title={food.name}>
                                    {food.name}
                                  </p>
                                  {food.cuisine && (
                                    <p className="text-xs text-slate-500">{food.cuisine}</p>
                                  )}
                                  {food.note && (
                                    <p className="text-[10px] text-slate-400 mt-1 line-clamp-2">{food.note}</p>
                                  )}
                                </div>
                                {isThisSelected ? (
                                  <div className="flex-shrink-0 p-1 bg-amber-500 rounded-full">
                                    <Check className="w-3 h-3 text-white" />
                                  </div>
                                ) : (
                                  <div className="flex-shrink-0 p-1 bg-slate-200 rounded-full opacity-50 group-hover:opacity-100">
                                    <Plus className="w-3 h-3 text-slate-500" />
                                  </div>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>
      ))}

      {/* Trip Summary */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-2xl p-6 border border-primary/20"
      >
        <h4 className="font-display font-bold text-slate-900 mb-3">Trip Summary</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="bg-white rounded-lg p-3 shadow-sm">
            <div className="text-2xl font-bold text-primary">{itinerary.days.length}</div>
            <div className="text-slate-500">Days</div>
          </div>
          <div className="bg-white rounded-lg p-3 shadow-sm">
            <div className="text-2xl font-bold text-blue-500">
              {itinerary.days.reduce((sum, d) => sum + d.activities.filter(a => a.type === 'activity').length, 0)}
            </div>
            <div className="text-slate-500">Activities</div>
          </div>
          <div className="bg-white rounded-lg p-3 shadow-sm">
            <div className="text-2xl font-bold text-amber-500">
              {itinerary.days.reduce((sum, d) => sum + (d.localFood?.length || d.activities.filter(a => a.type === 'meal').length), 0)}
            </div>
            <div className="text-slate-500">Food Spots</div>
          </div>
          <div className="bg-white rounded-lg p-3 shadow-sm">
            <div className="text-2xl font-bold text-green-500">
              {itinerary.days.reduce((sum, d) => sum + d.activities.filter(a => a.type === 'lodging').length, 0)}
            </div>
            <div className="text-slate-500">Stays</div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
