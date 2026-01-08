import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  ChevronDown,
  ChevronRight,
  MapPin,
  Clock,
  Navigation,
  Hotel,
  Utensils,
  Camera,
  ShoppingBag,
  Plane,
  Train,
  Car,
  ExternalLink,
  Star,
  CheckCircle,
  MoreHorizontal,
  Image as ImageIcon
} from "lucide-react";

interface Activity {
  id: string;
  name: string;
  type: 'arrival' | 'hotel' | 'restaurant' | 'attraction' | 'activity' | 'shopping' | 'transport' | 'departure';
  time: string;
  duration?: string;
  description?: string;
  image?: string;
  rating?: number;
  price?: string;
  distance?: string;
  bookingUrl?: string;
  address?: string;
  tips?: string;
  verified?: boolean;
  coordinates?: { lat: number; lng: number };
}

interface DayItinerary {
  day: number;
  date: string;
  title: string;
  description: string;
  activities: Activity[];
}

interface ItineraryViewProps {
  days: DayItinerary[];
  showDistances?: boolean;
  onActivityClick?: (activity: Activity) => void;
  onDistancesToggle?: (show: boolean) => void;
}

// Curated Unsplash images for common activity types/keywords
const ACTIVITY_IMAGES: Record<string, string> = {
  // Airports & Transport
  'airport': 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=400&h=300&fit=crop',
  'narita': 'https://images.unsplash.com/photo-1542296332-2e4473faf563?w=400&h=300&fit=crop',
  'haneda': 'https://images.unsplash.com/photo-1542296332-2e4473faf563?w=400&h=300&fit=crop',
  'station': 'https://images.unsplash.com/photo-1565620731358-e8c038abc8d1?w=400&h=300&fit=crop',
  'train': 'https://images.unsplash.com/photo-1474487548417-781cb71495f3?w=400&h=300&fit=crop',

  // Tokyo specific
  'shinjuku': 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=400&h=300&fit=crop',
  'shibuya': 'https://images.unsplash.com/photo-1542051841857-5f90071e7989?w=400&h=300&fit=crop',
  'harajuku': 'https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=400&h=300&fit=crop',
  'akihabara': 'https://images.unsplash.com/photo-1542931287-023b922fa89b?w=400&h=300&fit=crop',
  'asakusa': 'https://images.unsplash.com/photo-1545569341-9eb8b30979d9?w=400&h=300&fit=crop',
  'senso-ji': 'https://images.unsplash.com/photo-1545569341-9eb8b30979d9?w=400&h=300&fit=crop',
  'sensoji': 'https://images.unsplash.com/photo-1545569341-9eb8b30979d9?w=400&h=300&fit=crop',
  'meiji': 'https://images.unsplash.com/photo-1478436127897-769e1b3f0f36?w=400&h=300&fit=crop',
  'tokyo tower': 'https://images.unsplash.com/photo-1536098561742-ca998e48cbcc?w=400&h=300&fit=crop',
  'skytree': 'https://images.unsplash.com/photo-1513407030348-c983a97b98d8?w=400&h=300&fit=crop',
  'ginza': 'https://images.unsplash.com/photo-1554797589-7241bb691973?w=400&h=300&fit=crop',
  'roppongi': 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=400&h=300&fit=crop',
  'ueno': 'https://images.unsplash.com/photo-1490806843957-31f4c9a91c65?w=400&h=300&fit=crop',
  'tsukiji': 'https://images.unsplash.com/photo-1553621042-f6e147245754?w=400&h=300&fit=crop',
  'teamlab': 'https://images.unsplash.com/photo-1549451371-64aa98a6f660?w=400&h=300&fit=crop',
  'odaiba': 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=400&h=300&fit=crop',

  // General types
  'temple': 'https://images.unsplash.com/photo-1545569341-9eb8b30979d9?w=400&h=300&fit=crop',
  'shrine': 'https://images.unsplash.com/photo-1478436127897-769e1b3f0f36?w=400&h=300&fit=crop',
  'museum': 'https://images.unsplash.com/photo-1565060169194-19fabf63012c?w=400&h=300&fit=crop',
  'park': 'https://images.unsplash.com/photo-1490806843957-31f4c9a91c65?w=400&h=300&fit=crop',
  'garden': 'https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=400&h=300&fit=crop',
  'market': 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=400&h=300&fit=crop',
  'shopping': 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400&h=300&fit=crop',
  'mall': 'https://images.unsplash.com/photo-1519567241046-7f570eee3ce6?w=400&h=300&fit=crop',

  // Food
  'restaurant': 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400&h=300&fit=crop',
  'ramen': 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=400&h=300&fit=crop',
  'sushi': 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=400&h=300&fit=crop',
  'izakaya': 'https://images.unsplash.com/photo-1554502078-ef0fc409efce?w=400&h=300&fit=crop',
  'dinner': 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400&h=300&fit=crop',
  'lunch': 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&h=300&fit=crop',
  'breakfast': 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=400&h=300&fit=crop',
  'cafe': 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=400&h=300&fit=crop',
  'coffee': 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=300&fit=crop',

  // Hotels
  'hotel': 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400&h=300&fit=crop',
  'check-in': 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400&h=300&fit=crop',
  'check in': 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400&h=300&fit=crop',
  'ryokan': 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=400&h=300&fit=crop',

  // Activities
  'explore': 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=400&h=300&fit=crop',
  'exploration': 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=400&h=300&fit=crop',
  'walking': 'https://images.unsplash.com/photo-1480796927426-f609979314bd?w=400&h=300&fit=crop',
  'tour': 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=400&h=300&fit=crop',

  // Default
  'default': 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=400&h=300&fit=crop',
};

// Get image URL for an activity based on its name
function getActivityImage(name: string | undefined | null, existingImage?: string): string {
  if (existingImage && existingImage.startsWith('http')) return existingImage;
  if (!name) return ACTIVITY_IMAGES['default'];

  const nameLower = name.toLowerCase();

  // Check each keyword
  for (const [keyword, url] of Object.entries(ACTIVITY_IMAGES)) {
    if (keyword !== 'default' && nameLower.includes(keyword)) {
      return url;
    }
  }

  return ACTIVITY_IMAGES['default'];
}

// Time period helpers
function getTimeEmoji(time: string): string {
  const hour = parseInt(time.split(':')[0]) || 12;
  if (hour >= 5 && hour < 12) return '☀️';
  if (hour >= 12 && hour < 17) return '🌤️';
  if (hour >= 17 && hour < 21) return '🌙';
  return '🌃';
}

function getTimePeriod(time: string): string {
  const hour = parseInt(time.split(':')[0]) || 12;
  if (hour >= 5 && hour < 12) return 'Morning';
  if (hour >= 12 && hour < 17) return 'Afternoon';
  if (hour >= 17 && hour < 21) return 'Evening';
  return 'Night';
}

function getDayEmoji(title: string): string {
  const lower = title.toLowerCase();
  if (lower.includes('arrival')) return '🛬';
  if (lower.includes('departure')) return '🛫';
  if (lower.includes('beach')) return '🏖️';
  if (lower.includes('temple') || lower.includes('shrine')) return '⛩️';
  if (lower.includes('city') || lower.includes('explore')) return '🏙️';
  if (lower.includes('mountain') || lower.includes('hike')) return '🏔️';
  if (lower.includes('museum') || lower.includes('art')) return '🏛️';
  if (lower.includes('food') || lower.includes('culinary')) return '🍜';
  if (lower.includes('shopping')) return '🛍️';
  if (lower.includes('adventure')) return '🎢';
  return '📍';
}

export function ItineraryView({
  days,
  showDistances: initialShowDistances = true,
  onActivityClick,
  onDistancesToggle
}: ItineraryViewProps) {
  const [expandedDays, setExpandedDays] = useState<number[]>([1]);
  const [showDistances, setShowDistances] = useState(initialShowDistances);

  const toggleDay = (day: number) => {
    setExpandedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const handleDistancesToggle = () => {
    const newValue = !showDistances;
    setShowDistances(newValue);
    onDistancesToggle?.(newValue);
  };

  // Group activities by time period
  const groupByTimePeriod = (activities: Activity[]) => {
    const groups: Record<string, Activity[]> = {
      'Morning': [],
      'Afternoon': [],
      'Evening': [],
      'Night': [],
    };

    activities.forEach(activity => {
      const period = getTimePeriod(activity.time);
      groups[period].push(activity);
    });

    return Object.entries(groups).filter(([_, acts]) => acts.length > 0);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-slate-900">Itinerary</h3>
          <span className="px-2 py-0.5 bg-slate-100 rounded-full text-sm text-slate-600">{days.length} days</span>
        </div>
        <div className="flex items-center gap-3">
          {/* Distances Toggle - Fixed styling */}
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-sm text-slate-600">Distances</span>
            <button
              onClick={handleDistancesToggle}
              className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
                showDistances ? 'bg-amber-500' : 'bg-slate-300'
              }`}
            >
              <motion.div
                className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-md"
                animate={{ left: showDistances ? '24px' : '4px' }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            </button>
          </label>
          <button className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <MoreHorizontal className="w-5 h-5 text-slate-400" />
          </button>
        </div>
      </div>

      {/* Days */}
      <div className="divide-y divide-slate-100">
        {days.map((day) => {
          const isExpanded = expandedDays.includes(day.day);
          const timePeriods = groupByTimePeriod(day.activities);

          return (
            <div key={day.day}>
              {/* Day Header */}
              <button
                onClick={() => toggleDay(day.day)}
                className="w-full px-4 py-4 flex items-center gap-3 hover:bg-slate-50 transition-colors"
              >
                <motion.div
                  animate={{ rotate: isExpanded ? 90 : 0 }}
                  transition={{ duration: 0.2 }}
                  className="text-slate-400"
                >
                  <ChevronRight className="w-5 h-5" />
                </motion.div>
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900">
                      Day {day.day} – {getDayEmoji(day.title)} {day.title}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 mt-0.5">{day.date}</p>
                </div>
                <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded-full">
                  {day.activities.length} activities
                </span>
              </button>

              {/* Day Content */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    {/* Activities grouped by time period */}
                    {timePeriods.map(([period, activities]) => (
                      <div key={period} className="px-4 pb-4 pl-12">
                        {/* Time Period Header */}
                        <div className="flex items-center gap-2 mb-3 mt-2">
                          <span className="text-lg">{getTimeEmoji(activities[0].time)}</span>
                          <span className="font-medium text-slate-700">{period}:</span>
                        </div>

                        {/* Activities */}
                        <div className="space-y-3 ml-2">
                          {activities.map((activity, idx) => (
                            <ActivityCard
                              key={activity.id}
                              activity={activity}
                              showDistance={showDistances && idx > 0}
                              onClick={() => onActivityClick?.(activity)}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Activity Card Component with Images
function ActivityCard({
  activity,
  showDistance,
  onClick,
}: {
  activity: Activity;
  showDistance?: boolean;
  onClick?: () => void;
}) {
  const imageUrl = getActivityImage(activity.name, activity.image);

  return (
    <div>
      {/* Distance indicator */}
      {showDistance && activity.distance && (
        <div className="flex items-center gap-2 py-2 text-xs text-slate-400 ml-4">
          <div className="flex-1 border-t border-dashed border-slate-200" />
          <Navigation className="w-3 h-3" />
          <span>{activity.distance}</span>
          <div className="flex-1 border-t border-dashed border-slate-200" />
        </div>
      )}

      {/* Activity Card - MindTrip Style with Image */}
      <motion.div
        onClick={onClick}
        whileHover={{ scale: 1.01 }}
        className="flex gap-4 p-3 bg-slate-50 rounded-xl hover:bg-slate-100 hover:shadow-md transition-all cursor-pointer border border-transparent hover:border-slate-200"
      >
        {/* Image - Always show */}
        <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-slate-200 shadow-sm">
          <img
            src={imageUrl}
            alt={activity.name || 'Activity'}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLImageElement).src = ACTIVITY_IMAGES['default'];
            }}
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <h4 className="font-medium text-slate-900 line-clamp-1">{activity.name || 'Activity'}</h4>
              <div className="flex items-center gap-2 mt-1 text-sm text-slate-500">
                <Clock className="w-3.5 h-3.5" />
                <span>{activity.time}</span>
                {activity.duration && (
                  <>
                    <span className="text-slate-300">•</span>
                    <span>{activity.duration}</span>
                  </>
                )}
              </div>
            </div>

            {/* Rating */}
            {activity.rating && (
              <div className="flex items-center gap-1 px-2 py-1 bg-amber-100 rounded-lg">
                <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                <span className="text-sm font-medium text-amber-700">{activity.rating}</span>
              </div>
            )}
          </div>

          {/* Description */}
          {activity.description && (
            <p className="text-sm text-slate-500 mt-1 line-clamp-1">{activity.description}</p>
          )}

          {/* Address */}
          {activity.address && (
            <div className="flex items-center gap-1 mt-1 text-xs text-slate-400">
              <MapPin className="w-3 h-3" />
              <span className="line-clamp-1">{activity.address}</span>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
