import { motion } from "framer-motion";
import {
  DollarSign,
  Home,
  Utensils,
  Camera,
  Train,
  MapPin,
  ShoppingBag,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle,
  Lightbulb,
  ExternalLink,
  Plane,
  Sparkles,
  Smartphone,
  Bus,
  Wifi
} from "lucide-react";
import { type TripResponse } from "@shared/schema";
import { InlineBookingButtons } from "./BookNow";

interface CostBreakdownData {
  currency?: string;
  currencySymbol?: string;
  travelers?: {
    total: number;
    adults: number;
    children: number;
    infants: number;
    note: string;
  };
  flights?: {
    total: number;
    perPerson: number;
    note: string;
    airline?: string;
    duration?: string;
    stops?: number;
    bookingUrl?: string;
    source?: 'api' | 'estimate';
  };
  accommodation: {
    total: number;
    perNight: number;
    nights: number;
    type: string;
    hotelName?: string;
    rating?: number;
    bookingUrl?: string;
    source?: 'api' | 'estimate';
  };
  food: { total: number; perDay: number; note: string };
  activities: { total: number; note: string };
  localTransport: { total: number; note: string };
  intercityTransport: { total: number; note: string };
  misc: { total: number; note: string };
  grandTotal: number;
  perPerson: number;
  budgetStatus: "within_budget" | "tight" | "over_budget";
  savingsTips: string[];
  // AI-powered booking apps and mobile plans
  bookingApps?: { mode: string; apps: { name: string; url: string; note: string }[] }[];
  mobilePlans?: { provider: string; plan: string; price: string; data?: string; note: string }[];
  // Additional fields from chat format
  isOverBudget?: boolean;
  remaining?: number;
}

// Currency symbol mapping - supports all 28 currencies
const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', JPY: '¥', CNY: '¥', INR: '₹', AUD: 'A$', CAD: 'C$',
  CHF: 'CHF', KRW: '₩', SGD: 'S$', HKD: 'HK$', NZD: 'NZ$', SEK: 'kr', NOK: 'kr', DKK: 'kr',
  MXN: '$', BRL: 'R$', AED: 'د.إ', SAR: '﷼', THB: '฿', MYR: 'RM', IDR: 'Rp', PHP: '₱',
  ZAR: 'R', TRY: '₺', RUB: '₽', PLN: 'zł', CZK: 'Kč', HUF: 'Ft'
};

function getCurrencySymbol(currency?: string): string {
  return CURRENCY_SYMBOLS[currency || 'USD'] || currency || '$';
}

/**
 * Normalize budget breakdown data from different sources
 * Handles both:
 * 1. Itinerary's costBreakdown format (grandTotal, accommodation.total, food.total, etc.)
 * 2. Chat's budgetBreakdown format (totalSpent, breakdown.activities.amount, etc.)
 */
function normalizeBreakdownData(data: any, trip: any): CostBreakdownData {
  // If it already has grandTotal, it's the itinerary format - return as-is
  if (data.grandTotal !== undefined) {
    return data as CostBreakdownData;
  }

  // It's the chat format - normalize it to CostBreakdownData format
  const currency = data.currency || trip.currency || 'USD';
  const currencySymbol = data.symbol || getCurrencySymbol(currency);
  const travelers = trip.groupSize || 1;
  const days = trip.itinerary?.days?.length || 7;

  // Extract from chat's breakdown format
  const breakdown = data.breakdown || {};
  const activitiesAmount = breakdown.activities?.amount || 0;
  const accommodationAmount = breakdown.accommodation?.amount || 0;
  const transportAmount = breakdown.transport?.amount || 0;
  const foodAmount = breakdown.food?.amount || 0;

  const grandTotal = data.totalSpent || (activitiesAmount + accommodationAmount + transportAmount + foodAmount);
  const perPerson = Math.round(grandTotal / travelers);

  // Determine budget status
  let budgetStatus: "within_budget" | "tight" | "over_budget" = "within_budget";
  if (data.isOverBudget) {
    budgetStatus = "over_budget";
  } else if (data.remaining !== undefined && data.remaining < trip.budget * 0.1) {
    budgetStatus = "tight";
  }

  return {
    currency,
    currencySymbol,
    travelers: {
      total: travelers,
      adults: trip.adults || travelers,
      children: trip.children || 0,
      infants: trip.infants || 0,
      note: `For ${travelers} traveler${travelers > 1 ? 's' : ''}`,
    },
    accommodation: {
      total: accommodationAmount,
      perNight: Math.round(accommodationAmount / Math.max(days - 1, 1)),
      nights: days - 1,
      type: 'Various accommodations',
    },
    food: {
      total: foodAmount,
      perDay: Math.round(foodAmount / days),
      note: `${currencySymbol}${Math.round(foodAmount / days / travelers)}/person/day`,
    },
    activities: {
      total: activitiesAmount,
      note: 'Various activities and attractions',
    },
    localTransport: {
      total: Math.round(transportAmount * 0.3),
      note: 'Local transport within cities',
    },
    intercityTransport: {
      total: Math.round(transportAmount * 0.7),
      note: 'Flights and intercity travel',
    },
    misc: {
      total: 0,
      note: 'Tips, souvenirs, misc expenses',
    },
    grandTotal,
    perPerson,
    budgetStatus,
    savingsTips: data.savingsTips || [],
    // Pass through any additional fields from the chat format
    isOverBudget: data.isOverBudget,
    remaining: data.remaining,
  };
}

interface Props {
  trip: TripResponse;
  budgetOverride?: any; // Override from chat updates
}

// Check if trip uses custom budget (vs. predefined Budget/Comfort/Luxury styles)
function isCustomBudget(trip: TripResponse): boolean {
  return trip.travelStyle === 'custom';
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  flights: <Train className="w-5 h-5" />,  // Changed from Plane - "Travel" covers trains/buses/flights
  accommodation: <Home className="w-5 h-5" />,
  food: <Utensils className="w-5 h-5" />,
  activities: <Camera className="w-5 h-5" />,
  localTransport: <Train className="w-5 h-5" />,
  intercityTransport: <MapPin className="w-5 h-5" />,
  misc: <ShoppingBag className="w-5 h-5" />,
};

const CATEGORY_COLORS: Record<string, string> = {
  flights: "bg-sky-500",
  accommodation: "bg-blue-500",
  food: "bg-amber-500",
  activities: "bg-purple-500",
  localTransport: "bg-green-500",
  intercityTransport: "bg-indigo-500",
  misc: "bg-slate-500",
};

const CATEGORY_LABELS: Record<string, string> = {
  flights: "Travel",  // Changed from "Flights" - covers trains/buses/flights
  accommodation: "Accommodation",
  food: "Food & Dining",
  activities: "Activities & Attractions",
  localTransport: "Local Transport",
  intercityTransport: "Intercity Travel",
  misc: "Miscellaneous",
};

export function CostBreakdown({ trip, budgetOverride }: Props) {
  const itinerary = trip.itinerary as unknown as { days: any[]; costBreakdown?: CostBreakdownData };
  // Use budgetOverride from chat if provided, otherwise use itinerary's costBreakdown
  const rawCostData = budgetOverride || itinerary?.costBreakdown;

  if (!rawCostData) {
    return (
      <div className="text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
        <DollarSign className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <p className="text-muted-foreground">Cost breakdown not available for this itinerary.</p>
      </div>
    );
  }

  // Normalize the data format - handle both itinerary costBreakdown format and chat budgetBreakdown format
  const costBreakdown: CostBreakdownData = normalizeBreakdownData(rawCostData, trip);

  const budget = trip.budget;
  const budgetDiff = budget - costBreakdown.grandTotal;
  const budgetPercentUsed = (costBreakdown.grandTotal / budget) * 100;
  const currencySymbol = costBreakdown.currencySymbol || getCurrencySymbol(trip.currency ?? undefined);

  // Calculate category percentages for the bar chart
  const categories = ['flights', 'accommodation', 'food', 'activities', 'localTransport', 'intercityTransport', 'misc'] as const;
  const categoryData = categories
    .filter(cat => {
      const catData = costBreakdown[cat as keyof CostBreakdownData];
      return catData && typeof catData === 'object' && 'total' in catData && (catData as any).total > 0;
    })
    .map(cat => {
      const catData = costBreakdown[cat as keyof CostBreakdownData] as { total: number } | undefined;
      const total = catData?.total || 0;
      return {
        key: cat,
        label: CATEGORY_LABELS[cat],
        icon: CATEGORY_ICONS[cat],
        color: CATEGORY_COLORS[cat],
        total,
        details: costBreakdown[cat as keyof CostBreakdownData],
        percentage: (total / costBreakdown.grandTotal) * 100,
      };
    });

  const getBudgetStatusConfig = () => {
    // Determine status from budgetStatus field or calculate from remaining
    const status = costBreakdown.budgetStatus ||
      (costBreakdown.isOverBudget ? 'over_budget' :
        (costBreakdown.remaining !== undefined && costBreakdown.remaining < budget * 0.1) ? 'tight' : 'within_budget');

    switch (status) {
      case "within_budget":
        return {
          icon: <CheckCircle className="w-5 h-5 text-green-600" />,
          label: "Within Budget",
          color: "text-green-600",
          bgColor: "bg-green-50 border-green-200",
          barColor: "bg-green-500",
        };
      case "tight":
        return {
          icon: <AlertCircle className="w-5 h-5 text-amber-600" />,
          label: "Budget is Tight",
          color: "text-amber-600",
          bgColor: "bg-amber-50 border-amber-200",
          barColor: "bg-amber-500",
        };
      case "over_budget":
        return {
          icon: <TrendingUp className="w-5 h-5 text-red-600" />,
          label: "Over Budget",
          color: "text-red-600",
          bgColor: "bg-red-50 border-red-200",
          barColor: "bg-red-500",
        };
      default:
        // Default to green if unknown status
        return {
          icon: <CheckCircle className="w-5 h-5 text-green-600" />,
          label: "Budget Status",
          color: "text-green-600",
          bgColor: "bg-green-50 border-green-200",
          barColor: "bg-green-500",
        };
    }
  };

  const statusConfig = getBudgetStatusConfig();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-display font-bold">Estimated Total Costs</h3>
            <p className="text-slate-300 text-sm mt-1">
              {costBreakdown.travelers?.note || `For ${trip.groupSize} traveler${trip.groupSize > 1 ? 's' : ''}`}
            </p>
            <p className="text-slate-400 text-xs mt-0.5">AI-generated estimates • Prices may vary</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">{currencySymbol}{costBreakdown.grandTotal?.toLocaleString() || '0'}</div>
            {costBreakdown.perPerson && (
              <div className="text-slate-300 text-sm">
                {currencySymbol}{costBreakdown.perPerson.toLocaleString()} per person (avg)
              </div>
            )}
          </div>
        </div>

        {/* Budget Progress Bar - Only show for custom budget */}
        {isCustomBudget(trip) && (
          <div className="mt-6">
            <div className="flex justify-between text-sm mb-2">
              <span>Budget Usage</span>
              <span>{budgetPercentUsed.toFixed(0)}% of {currencySymbol}{budget.toLocaleString()}</span>
            </div>
            <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(budgetPercentUsed, 100)}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
                className={`h-full ${statusConfig.barColor} rounded-full`}
              />
            </div>
          </div>
        )}

        {/* Travel Style Badge - Show for non-custom styles */}
        {!isCustomBudget(trip) && (
          <div className="mt-6 flex items-center gap-2">
            <span className="text-sm text-slate-300">Travel Style:</span>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              trip.travelStyle === 'budget' ? 'bg-emerald-500/20 text-emerald-300' :
              trip.travelStyle === 'luxury' ? 'bg-amber-500/20 text-amber-300' :
              'bg-blue-500/20 text-blue-300'
            }`}>
              {trip.travelStyle === 'budget' ? '💰 Budget' :
               trip.travelStyle === 'luxury' ? '✨ Luxury' :
               trip.travelStyle === 'standard' ? '🎯 Comfort' : trip.travelStyle}
            </span>
          </div>
        )}
      </div>

      {/* Budget Status - Only show for custom budget */}
      {isCustomBudget(trip) && (
        <div className={`p-4 border-b ${statusConfig.bgColor}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {statusConfig.icon}
              <span className={`font-semibold ${statusConfig.color}`}>{statusConfig.label}</span>
            </div>
            <div className={`font-semibold ${budgetDiff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {budgetDiff >= 0 ? (
                <span className="flex items-center gap-1">
                  <TrendingDown className="w-4 h-4" />
                  {currencySymbol}{budgetDiff.toLocaleString()} under budget
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <TrendingUp className="w-4 h-4" />
                  {currencySymbol}{Math.abs(budgetDiff).toLocaleString()} over budget
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Cost Categories */}
      <div className="p-6">
        <h4 className="font-semibold text-slate-900 mb-4">Breakdown by Category</h4>

        {/* Visual Bar Chart */}
        <div className="flex h-8 rounded-lg overflow-hidden mb-6">
          {categoryData.map((cat, idx) => (
            <motion.div
              key={cat.key}
              initial={{ width: 0 }}
              animate={{ width: `${cat.percentage}%` }}
              transition={{ duration: 0.8, delay: idx * 0.1 }}
              className={`${cat.color} relative group cursor-pointer`}
              title={`${cat.label}: ${currencySymbol}${cat.total}`}
            >
              <div className="absolute inset-0 bg-white/0 hover:bg-white/20 transition-colors" />
            </motion.div>
          ))}
        </div>

        {/* Category Details */}
        <div className="space-y-3">
          {categoryData.map((cat) => (
            <div
              key={cat.key}
              className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${cat.color} text-white`}>
                  {cat.icon}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-900">{cat.label}</span>
                    {(cat.details as any)?.source === 'api' && (
                      <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-[10px] font-medium rounded">LIVE</span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {cat.key === 'flights' && (cat.details as any)?.perPerson && (
                      <div className="space-y-1">
                        <span>{currencySymbol}{(cat.details as any).perPerson}/person • {(cat.details as any).note}</span>
                        {(cat.details as any)?.airline && (cat.details as any).airline !== 'Multiple Airlines' && (
                          <div className="text-slate-600">{(cat.details as any).airline} • {(cat.details as any).duration || 'Duration varies'}</div>
                        )}
                        <InlineBookingButtons
                          trip={trip}
                          type="flights"
                          bookingApps={costBreakdown.bookingApps}
                          selectedMode={(cat.details as any)?.selectedMode}
                        />
                      </div>
                    )}
                    {cat.key === 'accommodation' && (cat.details as any)?.perNight && (
                      <div className="space-y-1">
                        <span>{currencySymbol}{(cat.details as any).perNight}/night × {(cat.details as any).nights} nights</span>
                        <div className="text-slate-600">
                          {(cat.details as any).hotelName && <span>{(cat.details as any).hotelName}</span>}
                          {(cat.details as any).rating && <span> • ★ {(cat.details as any).rating}</span>}
                        </div>
                        <div>{(cat.details as any).type}</div>
                        <InlineBookingButtons trip={trip} type="hotels" />
                      </div>
                    )}
                    {cat.key === 'food' && (cat.details as any)?.perDay && (
                      <span>{currencySymbol}{(cat.details as any).perDay}/day • {(cat.details as any).note}</span>
                    )}
                    {cat.key === 'activities' && (
                      <div className="space-y-1">
                        {(cat.details as any)?.note && <span>{(cat.details as any).note}</span>}
                        <InlineBookingButtons trip={trip} type="activities" />
                      </div>
                    )}
                    {cat.key !== 'flights' && cat.key !== 'accommodation' && cat.key !== 'food' && cat.key !== 'activities' && (cat.details as any)?.note && (
                      <span>{(cat.details as any).note}</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold text-slate-900">{currencySymbol}{cat.total.toLocaleString()}</div>
                <div className="text-xs text-slate-500">{cat.percentage.toFixed(0)}%</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Savings Tips */}
      {costBreakdown.savingsTips && costBreakdown.savingsTips.length > 0 && (
        <div className="p-6 bg-amber-50 border-t border-amber-100">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="w-5 h-5 text-amber-600" />
            <h4 className="font-semibold text-amber-900">Money-Saving Tips</h4>
          </div>
          <ul className="space-y-2">
            {costBreakdown.savingsTips.map((tip, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-amber-800">
                <span className="text-amber-500 mt-0.5">•</span>
                {tip}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Disclaimer */}
      <div className="p-4 bg-gradient-to-r from-primary/5 to-emerald-500/5 border-t border-slate-200">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-slate-700">Ready to book your trip?</span>
        </div>
        <p className="text-xs text-slate-500 text-center">
          Prices are AI-generated estimates. Click the booking buttons above to compare real-time prices.
          We may earn a commission at no extra cost to you.
        </p>
      </div>
    </motion.div>
  );
}
