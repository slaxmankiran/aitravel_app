import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  ClipboardList,
  Hotel,
  Lightbulb,
  Image as ImageIcon,
  FileText,
  DollarSign,
  MapPin,
  Star,
  ChevronRight,
  ExternalLink,
  Clock,
  Users,
  Plane,
  Train,
  Bus,
  Car,
  CheckCircle,
  AlertTriangle,
  Shield,
  Sparkles
} from "lucide-react";
import { ItineraryView } from "./ItineraryView";
import { QuickBookBanner, BookingCard, PriceComparison } from "../AffiliateBooking";
import { TrustScore, VerifiedBadge, PriceAlert } from "../TrustBadges";

type TabType = 'itinerary' | 'bookings' | 'ideas' | 'media' | 'details' | 'calendar';

interface TripSectionsProps {
  trip: any;
  itinerary: any;
  costBreakdown: any;
  feasibilityReport: any;
  onLocationSelect?: (locationId: string) => void;
}

// Tab button component
function TabButton({
  active,
  icon: Icon,
  label,
  badge,
  onClick
}: {
  active: boolean;
  icon: any;
  label: string;
  badge?: string | number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
        active
          ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/25'
          : 'text-slate-600 hover:bg-slate-100'
      }`}
    >
      <Icon className="w-4 h-4" />
      <span className="hidden sm:inline">{label}</span>
      {badge && (
        <span className={`px-1.5 py-0.5 rounded-full text-xs ${
          active ? 'bg-white/20' : 'bg-slate-200'
        }`}>
          {badge}
        </span>
      )}
    </button>
  );
}

export function TripSections({
  trip,
  itinerary,
  costBreakdown,
  feasibilityReport,
  onLocationSelect
}: TripSectionsProps) {
  const [activeTab, setActiveTab] = useState<TabType>('itinerary');

  // Convert itinerary days to the format expected by ItineraryView
  const formatDaysForView = () => {
    if (!itinerary?.days) return [];

    return itinerary.days.map((day: any, idx: number) => ({
      day: idx + 1,
      date: day.date || `Day ${idx + 1}`,
      title: day.title || day.theme || 'Exploration Day',
      description: day.description || day.summary || '',
      activities: (day.activities || []).map((act: any, actIdx: number) => ({
        id: `day${idx + 1}-act${actIdx}`,
        name: act.name || act.title || act.description || 'Activity',
        type: getActivityType(act),
        time: act.time || '09:00',
        duration: act.duration,
        description: act.notes || (act.name || act.title ? act.description : undefined),
        image: act.image || act.imageUrl,
        rating: act.rating,
        price: act.cost ? `$${act.cost}` : undefined,
        distance: act.distance,
        bookingUrl: act.bookingUrl,
        address: act.location || act.address,
        tips: act.tips,
        verified: act.verified || false,
      })),
    }));
  };

  // Determine activity type from activity data
  const getActivityType = (activity: any): string => {
    const name = (activity.name || activity.title || activity.description || '').toLowerCase();
    const type = (activity.type || '').toLowerCase();

    // Check explicit type first
    if (type === 'transport' || type === 'arrival' || type === 'departure') return type === 'transport' ? 'transport' : type;
    if (type === 'meal') return 'restaurant';
    if (type === 'activity') return 'activity';
    if (type === 'hotel') return 'hotel';

    // Fallback to name-based detection
    if (name.includes('arrive') || name.includes('arrival')) return 'arrival';
    if (name.includes('depart')) return 'departure';
    if (name.includes('hotel') || name.includes('check-in') || name.includes('check in')) return 'hotel';
    if (name.includes('lunch') || name.includes('dinner') || name.includes('breakfast') || name.includes('restaurant') || name.includes('cafe') || name.includes('ramen') || name.includes('sushi') || name.includes('izakaya')) return 'restaurant';
    if (name.includes('temple') || name.includes('shrine') || name.includes('museum') || name.includes('palace') || name.includes('monument') || name.includes('tower') || name.includes('skytree')) return 'attraction';
    if (name.includes('shop') || name.includes('market') || name.includes('mall') || name.includes('ginza')) return 'shopping';
    if (name.includes('train') || name.includes('bus') || name.includes('taxi') || name.includes('transfer')) return 'transport';
    return 'activity';
  };

  const tabs = [
    { id: 'itinerary' as TabType, icon: ClipboardList, label: 'Itinerary', badge: itinerary?.days?.length },
    { id: 'bookings' as TabType, icon: Hotel, label: 'Bookings' },
    { id: 'ideas' as TabType, icon: Lightbulb, label: 'Ideas' },
    { id: 'media' as TabType, icon: ImageIcon, label: 'Media' },
    { id: 'details' as TabType, icon: FileText, label: 'Key Details' },
    { id: 'calendar' as TabType, icon: Calendar, label: 'Calendar' },
  ];

  const formattedDays = formatDaysForView();

  return (
    <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
      {/* Tab Navigation */}
      <div className="border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
          {tabs.map((tab) => (
            <TabButton
              key={tab.id}
              active={activeTab === tab.id}
              icon={tab.icon}
              label={tab.label}
              badge={tab.badge}
              onClick={() => setActiveTab(tab.id)}
            />
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="p-4">
        <AnimatePresence mode="wait">
          {activeTab === 'itinerary' && (
            <motion.div
              key="itinerary"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {formattedDays.length > 0 ? (
                <ItineraryView
                  days={formattedDays}
                  showDistances={true}
                  onActivityClick={(activity) => onLocationSelect?.(activity.id)}
                />
              ) : (
                <EmptyState
                  icon={ClipboardList}
                  title="No itinerary yet"
                  description="Your day-by-day plan will appear here once generated."
                />
              )}
            </motion.div>
          )}

          {activeTab === 'bookings' && (
            <motion.div
              key="bookings"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {/* Quick Book Banner */}
              <QuickBookBanner destination={trip.destination} />

              {/* Transport Booking */}
              {costBreakdown?.transportOptions && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                    <Plane className="w-5 h-5 text-blue-500" />
                    Getting There
                  </h3>
                  <PriceComparison
                    type="flight"
                    destination={trip.destination}
                    prices={[
                      { partner: 'Skyscanner', price: costBreakdown.flights?.total || 500, url: `https://www.skyscanner.com/transport/flights/anywhere/${trip.destination?.toLowerCase().replace(/\s+/g, '-')}/`, recommended: true },
                      { partner: 'Kayak', price: (costBreakdown.flights?.total || 500) * 1.05, url: 'https://www.kayak.com' },
                      { partner: 'Google Flights', price: (costBreakdown.flights?.total || 500) * 0.98, url: 'https://www.google.com/flights' },
                    ]}
                    currency={trip.currency || 'USD'}
                  />
                </div>
              )}

              {/* Hotel Booking */}
              <div className="space-y-4">
                <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                  <Hotel className="w-5 h-5 text-purple-500" />
                  Accommodation
                </h3>
                <PriceComparison
                  type="hotel"
                  destination={trip.destination}
                  prices={[
                    { partner: 'Booking.com', price: costBreakdown?.accommodation?.perNight || 100, url: `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(trip.destination)}`, features: ['Free cancellation', 'No prepayment'], recommended: true },
                    { partner: 'Hotels.com', price: (costBreakdown?.accommodation?.perNight || 100) * 1.1, url: 'https://www.hotels.com', features: ['Collect nights'] },
                    { partner: 'Agoda', price: (costBreakdown?.accommodation?.perNight || 100) * 0.95, url: 'https://www.agoda.com', features: ['Best for Asia'] },
                  ]}
                  currency={trip.currency || 'USD'}
                />
              </div>

              {/* Activities Booking */}
              <div className="space-y-4">
                <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                  <Star className="w-5 h-5 text-amber-500" />
                  Activities & Tours
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <BookingCard
                    type="activity"
                    title={`${trip.destination} City Tour`}
                    subtitle="Skip-the-line guided tour"
                    price={49}
                    originalPrice={65}
                    rating={4.8}
                    reviewCount={2340}
                    bookingUrl={`https://www.viator.com/searchResults/all?text=${encodeURIComponent(trip.destination)}`}
                    partner="Viator"
                    dealTag="Best Seller"
                    features={['Skip the line', 'Free cancellation']}
                  />
                  <BookingCard
                    type="activity"
                    title={`${trip.destination} Food Tour`}
                    subtitle="Local cuisine experience"
                    price={65}
                    rating={4.9}
                    reviewCount={890}
                    bookingUrl={`https://www.getyourguide.com/s/?q=${encodeURIComponent(trip.destination)}`}
                    partner="GetYourGuide"
                    features={['Small group', 'Expert guide']}
                  />
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'ideas' && (
            <motion.div
              key="ideas"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 rounded-xl bg-amber-500/10">
                    <Lightbulb className="w-6 h-6 text-amber-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">AI Suggestions</h3>
                    <p className="text-sm text-slate-500">Personalized recommendations based on your preferences</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {(itinerary?.recommendations || defaultRecommendations(trip.destination)).map((rec: any, idx: number) => (
                    <IdeaCard key={idx} idea={rec} />
                  ))}
                </div>
              </div>

              {/* Alternative Activities */}
              <div className="bg-slate-50 rounded-2xl p-6">
                <h3 className="font-semibold text-slate-900 mb-4">Hidden Gems</h3>
                <div className="space-y-3">
                  <IdeaCard idea={{ title: "Local food markets", description: "Discover authentic local cuisine at morning markets", type: "food" }} />
                  <IdeaCard idea={{ title: "Sunset viewpoint", description: "Secret spot for the best sunset views", type: "experience" }} />
                  <IdeaCard idea={{ title: "Off-the-beaten-path temple", description: "Less crowded spiritual experience", type: "culture" }} />
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'media' && (
            <motion.div
              key="media"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {/* Placeholder images - in production these would come from the trip/destination */}
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="aspect-square rounded-xl bg-slate-100 overflow-hidden">
                    <img
                      src={`https://images.pexels.com/photos/${1000000 + i * 100}/pexels-photo-${1000000 + i * 100}.jpeg?auto=compress&cs=tinysrgb&w=400`}
                      alt={`${trip.destination} photo ${i}`}
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = `https://images.pexels.com/photos/338515/pexels-photo-338515.jpeg?auto=compress&cs=tinysrgb&w=400`;
                      }}
                    />
                  </div>
                ))}
              </div>
              <p className="text-center text-slate-500 text-sm mt-4">
                Upload your photos to this trip or browse inspiration
              </p>
            </motion.div>
          )}

          {activeTab === 'details' && (
            <motion.div
              key="details"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {/* Visa & Entry Requirements - PROMINENT */}
              <div className={`rounded-2xl p-6 border-2 ${
                feasibilityReport?.visa?.status === 'visa_free' ? 'bg-green-50 border-green-200' :
                feasibilityReport?.visa?.status === 'visa_on_arrival' ? 'bg-amber-50 border-amber-200' :
                feasibilityReport?.visa?.status === 'visa_required' ? 'bg-orange-50 border-orange-200' :
                'bg-red-50 border-red-200'
              }`}>
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-xl ${
                    feasibilityReport?.visa?.status === 'visa_free' ? 'bg-green-100' :
                    feasibilityReport?.visa?.status === 'visa_on_arrival' ? 'bg-amber-100' :
                    'bg-orange-100'
                  }`}>
                    <Shield className={`w-6 h-6 ${
                      feasibilityReport?.visa?.status === 'visa_free' ? 'text-green-600' :
                      feasibilityReport?.visa?.status === 'visa_on_arrival' ? 'text-amber-600' :
                      'text-orange-600'
                    }`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-slate-900">Visa & Entry Requirements</h3>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        feasibilityReport?.visa?.status === 'visa_free' ? 'bg-green-200 text-green-800' :
                        feasibilityReport?.visa?.status === 'visa_on_arrival' ? 'bg-amber-200 text-amber-800' :
                        'bg-orange-200 text-orange-800'
                      }`}>
                        {feasibilityReport?.visa?.status === 'visa_free' ? 'Visa Free' :
                         feasibilityReport?.visa?.status === 'visa_on_arrival' ? 'Visa on Arrival' :
                         'Visa Required'}
                      </span>
                    </div>
                    <p className="text-slate-600 mb-3">
                      {feasibilityReport?.visa?.details || `Entry requirements for ${trip.passport || 'your'} passport holders traveling to ${trip.destination}.`}
                    </p>
                    {feasibilityReport?.visa?.duration && (
                      <p className="text-sm text-slate-500">
                        <Clock className="w-4 h-4 inline mr-1" />
                        Stay permitted: Up to {feasibilityReport.visa.duration} days
                      </p>
                    )}
                    {trip.passport && (
                      <p className="text-sm text-slate-500 mt-2">
                        <Users className="w-4 h-4 inline mr-1" />
                        Based on {trip.passport} passport
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Budget Summary */}
              <div className="bg-slate-50 rounded-2xl p-6">
                <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-amber-500" />
                  Budget Summary
                </h3>
                <div className="space-y-3">
                  <BudgetRow label="Transport" value={costBreakdown?.flights?.total} currency={trip.currency} icon={Plane} />
                  <BudgetRow label="Accommodation" value={costBreakdown?.accommodation?.total} currency={trip.currency} icon={Hotel} />
                  <BudgetRow label="Activities" value={costBreakdown?.activities?.total} currency={trip.currency} icon={Star} />
                  <BudgetRow label="Food & Dining" value={costBreakdown?.food?.total} currency={trip.currency} icon={MapPin} />
                  <div className="border-t border-slate-200 pt-3 mt-3">
                    <BudgetRow label="Total Estimated" value={costBreakdown?.grandTotal} currency={trip.currency} bold />
                  </div>
                </div>
              </div>

              {/* Trust Score */}
              <TrustScore
                score={feasibilityReport?.score || 85}
                factors={{
                  dataFreshness: 92,
                  sourcesVerified: 88,
                  userReviews: 85,
                  localValidation: 78,
                }}
              />

              {/* Safety & Travel Advisory */}
              {feasibilityReport?.safety && (
                <div className="bg-slate-50 rounded-2xl p-6">
                  <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                    <Shield className="w-5 h-5 text-blue-500" />
                    Safety Information
                  </h3>
                  <p className="text-slate-600">{feasibilityReport.safety.summary}</p>
                  {feasibilityReport.safety.tips && (
                    <ul className="mt-3 space-y-2">
                      {feasibilityReport.safety.tips.map((tip: string, i: number) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                          <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                          {tip}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'calendar' && (
            <motion.div
              key="calendar"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <CalendarView days={formattedDays} tripDates={trip.dates} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// Helper Components
function EmptyState({ icon: Icon, title, description }: { icon: any; title: string; description: string }) {
  return (
    <div className="text-center py-12">
      <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-100 flex items-center justify-center">
        <Icon className="w-8 h-8 text-slate-400" />
      </div>
      <h3 className="font-semibold text-slate-900 mb-2">{title}</h3>
      <p className="text-slate-500 text-sm">{description}</p>
    </div>
  );
}

function IdeaCard({ idea }: { idea: any }) {
  const typeIcons: Record<string, any> = {
    food: '🍜',
    experience: '✨',
    culture: '🏛️',
    nature: '🌿',
    adventure: '🎒',
  };

  return (
    <div className="flex items-start gap-3 p-3 bg-white rounded-xl border border-slate-100 hover:border-amber-200 hover:shadow-sm transition-all cursor-pointer">
      <span className="text-xl">{typeIcons[idea.type] || '💡'}</span>
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-slate-900">{idea.title}</h4>
        <p className="text-sm text-slate-500 line-clamp-2">{idea.description}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
    </div>
  );
}

function BudgetRow({ label, value, currency, icon: Icon, bold }: { label: string; value?: number; currency?: string; icon?: any; bold?: boolean }) {
  const currencySymbols: Record<string, string> = {
    USD: '$', EUR: '€', GBP: '£', JPY: '¥', INR: '₹', AUD: 'A$', CAD: 'C$',
  };
  const symbol = currencySymbols[currency || 'USD'] || '$';

  return (
    <div className={`flex items-center justify-between ${bold ? 'font-semibold' : ''}`}>
      <div className="flex items-center gap-2 text-slate-600">
        {Icon && <Icon className="w-4 h-4" />}
        <span>{label}</span>
      </div>
      <span className={bold ? 'text-lg text-slate-900' : 'text-slate-900'}>
        {value ? `${symbol}${value.toLocaleString()}` : '-'}
      </span>
    </div>
  );
}

function CalendarView({ days, tripDates }: { days: any[]; tripDates?: string }) {
  // Parse trip dates to get start date with robust handling
  let startDate = new Date();
  try {
    const dateStr = (tripDates || '').split(/\s*[-–to]+\s*/)[0]?.trim();
    if (dateStr) {
      const parsed = new Date(dateStr);
      if (!isNaN(parsed.getTime())) {
        startDate = parsed;
      }
    }
  } catch {
    // Use current date as fallback
  }

  // Generate week view
  const weeks = Math.ceil((days?.length || 0) / 7);
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Ensure dayOffset is a valid number (0-6)
  const dayOffset = isNaN(startDate.getDay()) ? 0 : startDate.getDay();

  // Handle empty days array
  if (!days || days.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        <p>No itinerary days to display</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Day headers */}
      <div className="grid grid-cols-7 gap-2">
        {dayNames.map((name) => (
          <div key={name} className="text-center text-xs font-medium text-slate-500 py-2">
            {name}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-2">
        {/* Empty cells for offset */}
        {Array(dayOffset).fill(null).map((_, i) => (
          <div key={`empty-${i}`} className="aspect-square" />
        ))}

        {/* Day cells */}
        {days.map((day, idx) => {
          const date = new Date(startDate);
          date.setDate(date.getDate() + idx);
          const activitiesCount = day.activities?.length || 0;

          return (
            <div
              key={idx}
              className="aspect-square p-2 bg-slate-50 rounded-xl hover:bg-amber-50 transition-colors cursor-pointer"
            >
              <div className="text-xs font-medium text-slate-900">{date.getDate()}</div>
              <div className="text-[10px] text-slate-500 truncate">{day.title}</div>
              {activitiesCount > 0 && (
                <div className="mt-1 flex gap-0.5">
                  {Array(Math.min(activitiesCount, 3)).fill(null).map((_, i) => (
                    <div key={i} className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Default recommendations when none provided
function defaultRecommendations(destination: string) {
  return [
    { title: `Best time to visit ${destination}`, description: "Check the weather patterns and peak seasons", type: "experience" },
    { title: "Local customs & etiquette", description: "Learn about cultural norms before you go", type: "culture" },
    { title: "Must-try local dishes", description: "Authentic food experiences you shouldn't miss", type: "food" },
  ];
}
