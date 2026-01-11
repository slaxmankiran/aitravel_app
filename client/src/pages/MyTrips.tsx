import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Sidebar } from "@/components/Sidebar";
import {
  Plus,
  MapPin,
  Calendar,
  Users,
  ArrowRight,
  Search,
  Filter,
  Grid,
  List,
  DollarSign,
  Clock,
  Star,
  MoreHorizontal,
  Trash2,
  Copy,
  Share2,
  ShieldCheck,
  ShieldAlert,
  ShieldX
} from "lucide-react";
import { useState } from "react";
import { getVoyageHeaders } from "@/lib/voyageUid";

// Trip summary from /api/my-trips
interface TripSummary {
  id: number;
  destination: string;
  dates: string;
  certaintyScore: number | null;
  certaintyLabel: 'high' | 'medium' | 'low' | null;
  estimatedCost: number | null;
  currency: string;
  travelers: number;
  travelStyle: string | null;
  status: string | null;
  feasibilityStatus: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export default function MyTrips() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');

  const { data: tripsResponse, isLoading } = useQuery<{ trips: TripSummary[] }>({
    queryKey: ['/api/my-trips'],
    queryFn: async () => {
      const res = await fetch('/api/my-trips', {
        headers: getVoyageHeaders(),
      });
      if (!res.ok) return { trips: [] };
      return res.json();
    }
  });

  const trips = tripsResponse?.trips || [];
  const filteredTrips = trips.filter(trip =>
    trip.destination.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <Sidebar />

      <main className="flex-1 md:ml-[240px]">
        {/* Header */}
        <header className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-slate-200 z-30">
          <div className="px-8 py-4 flex items-center justify-between">
            <h1 className="text-2xl font-display font-bold text-slate-900">My Trips</h1>
            <div className="flex items-center gap-4">
              <Link href="/create">
                <Button className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl">
                  <Plus className="w-4 h-4 mr-2" />
                  New Trip
                </Button>
              </Link>
            </div>
          </div>

          {/* Search & Filters */}
          <div className="px-8 pb-4 flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search trips..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-100 border-0 rounded-xl text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <Button variant="outline" className="rounded-xl border-slate-200">
              <Filter className="w-4 h-4 mr-2" />
              Filters
            </Button>
            <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2.5 ${viewMode === 'grid' ? 'bg-slate-100 text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2.5 ${viewMode === 'list' ? 'bg-slate-100 text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="p-8">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-72 bg-slate-100 rounded-3xl animate-pulse" />
              ))}
            </div>
          ) : filteredTrips.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-20"
            >
              <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-amber-100 flex items-center justify-center">
                <MapPin className="w-10 h-10 text-amber-600" />
              </div>
              <h2 className="text-2xl font-display font-bold text-slate-900 mb-3">
                No trips yet
              </h2>
              <p className="text-slate-500 mb-6 max-w-md mx-auto">
                Start planning your first adventure! Tell us where you want to go and we'll create the perfect itinerary.
              </p>
              <Link href="/chat">
                <Button className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl px-8">
                  <Plus className="w-4 h-4 mr-2" />
                  Plan Your First Trip
                </Button>
              </Link>

              {/* Device/storage reset notice */}
              <div className="mt-12 p-4 bg-slate-100 rounded-xl max-w-lg mx-auto">
                <p className="text-sm text-slate-600">
                  <span className="font-medium">On a new device or cleared your browser?</span>
                  {' '}Your trips are stored locally. If you have a trip link saved, you can still access it directly.
                </p>
              </div>
            </motion.div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTrips.map((trip, index) => (
                <TripCard key={trip.id} trip={trip} index={index} />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredTrips.map((trip, index) => (
                <TripListItem key={trip.id} trip={trip} index={index} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// Curated destination images
const DESTINATION_IMAGES: Record<string, string> = {
  'tokyo': 'https://images.pexels.com/photos/2506923/pexels-photo-2506923.jpeg?auto=compress&cs=tinysrgb&w=1200',
  'japan': 'https://images.pexels.com/photos/1440476/pexels-photo-1440476.jpeg?auto=compress&cs=tinysrgb&w=1200',
  'paris': 'https://images.pexels.com/photos/338515/pexels-photo-338515.jpeg?auto=compress&cs=tinysrgb&w=1200',
  'bali': 'https://images.pexels.com/photos/2166559/pexels-photo-2166559.jpeg?auto=compress&cs=tinysrgb&w=1200',
  'new york': 'https://images.pexels.com/photos/802024/pexels-photo-802024.jpeg?auto=compress&cs=tinysrgb&w=1200',
  'london': 'https://images.pexels.com/photos/460672/pexels-photo-460672.jpeg?auto=compress&cs=tinysrgb&w=1200',
  'dubai': 'https://images.pexels.com/photos/1707310/pexels-photo-1707310.jpeg?auto=compress&cs=tinysrgb&w=1200',
  'singapore': 'https://images.pexels.com/photos/777059/pexels-photo-777059.jpeg?auto=compress&cs=tinysrgb&w=1200',
  'thailand': 'https://images.pexels.com/photos/1682748/pexels-photo-1682748.jpeg?auto=compress&cs=tinysrgb&w=1200',
  'maldives': 'https://images.pexels.com/photos/1287460/pexels-photo-1287460.jpeg?auto=compress&cs=tinysrgb&w=1200',
  'default': 'https://images.pexels.com/photos/3155666/pexels-photo-3155666.jpeg?auto=compress&cs=tinysrgb&w=1200',
};

function getDestinationImage(destination: string): string {
  const destLower = destination.toLowerCase();
  for (const [key, url] of Object.entries(DESTINATION_IMAGES)) {
    if (key !== 'default' && destLower.includes(key)) return url;
  }
  return DESTINATION_IMAGES['default'];
}

// Parse dates string like "May 15, 2026 - May 31, 2026" or "May 15-31, 2026"
function parseDatesString(dates: string): { startDate: Date | null; endDate: Date | null; duration: number } {
  if (!dates) return { startDate: null, endDate: null, duration: 0 };

  // Try parsing "May 15, 2026 - May 31, 2026" format
  const parts = dates.split(/\s*[-–to]\s*/);
  if (parts.length >= 2) {
    const start = new Date(parts[0].trim());
    const end = new Date(parts[parts.length - 1].trim());
    if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
      const duration = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      return { startDate: start, endDate: end, duration };
    }
  }

  // Fallback: try parsing the whole string
  const singleDate = new Date(dates);
  if (!isNaN(singleDate.getTime())) {
    return { startDate: singleDate, endDate: singleDate, duration: 1 };
  }

  return { startDate: null, endDate: null, duration: 0 };
}

// Get certainty badge color and icon
function getCertaintyBadge(label: string | null, score: number | null) {
  if (!label) return { color: 'bg-slate-500/20 text-slate-300', icon: null };
  if (label === 'high') return { color: 'bg-emerald-500/30 text-emerald-300', icon: ShieldCheck };
  if (label === 'medium') return { color: 'bg-amber-500/30 text-amber-300', icon: ShieldAlert };
  return { color: 'bg-red-500/30 text-red-300', icon: ShieldX };
}

function TripCard({ trip, index }: { trip: TripSummary; index: number }) {
  const [showMenu, setShowMenu] = useState(false);
  const imageUrl = getDestinationImage(trip.destination);
  const { startDate, endDate, duration } = parseDatesString(trip.dates);
  const certainty = getCertaintyBadge(trip.certaintyLabel, trip.certaintyScore);
  const CertaintyIcon = certainty.icon;

  // Format date range nicely
  const dateRange = startDate && endDate
    ? (startDate.getMonth() === endDate.getMonth()
      ? `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.getDate()}`
      : `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`)
    : trip.dates;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="relative"
    >
      <Link href={`/trips/${trip.id}`}>
        <div className="group relative h-80 rounded-3xl overflow-hidden cursor-pointer bg-white shadow-lg shadow-slate-200/50 hover:shadow-2xl hover:shadow-slate-300/50 transition-all duration-300">
          {/* Background Image with Parallax Effect */}
          <div
            className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110"
            style={{ backgroundImage: `url(${imageUrl})` }}
          />

          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/10" />

          {/* Top Badge Row */}
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/90 backdrop-blur-sm rounded-full text-xs font-medium text-slate-700 shadow-lg">
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              {duration} days
            </span>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              className="w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center text-slate-600 hover:bg-white transition-colors shadow-lg"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </div>

          {/* Menu Dropdown */}
          <AnimatePresence>
            {showMenu && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                className="absolute top-14 right-4 bg-white rounded-xl shadow-xl py-2 min-w-[140px] z-10"
                onClick={(e) => e.stopPropagation()}
              >
                <button className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                  <Share2 className="w-4 h-4" /> Share
                </button>
                <button className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                  <Copy className="w-4 h-4" /> Duplicate
                </button>
                <button className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2">
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Content */}
          <div className="absolute inset-0 p-6 flex flex-col justify-end">
            {/* Trip Status Badge */}
            {trip.status === 'completed' && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-500/20 text-emerald-300 rounded-full text-xs font-medium mb-3 w-fit">
                <Star className="w-3 h-3" /> Completed
              </span>
            )}

            {/* Destination */}
            <h3 className="text-2xl font-display font-bold text-white mb-2 group-hover:text-amber-300 transition-colors">
              {trip.destination}
            </h3>

            {/* Date Row */}
            <div className="flex items-center gap-2 text-white/80 text-sm mb-3">
              <Calendar className="w-4 h-4" />
              <span>{dateRange}</span>
            </div>

            {/* Info Pills */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/20 backdrop-blur-sm rounded-full text-xs font-medium text-white">
                <Users className="w-3.5 h-3.5" />
                {trip.travelers} traveler{trip.travelers !== 1 ? 's' : ''}
              </span>
              {trip.estimatedCost && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/20 backdrop-blur-sm rounded-full text-xs font-medium text-white">
                  <DollarSign className="w-3.5 h-3.5" />
                  {trip.currency === 'USD' ? '$' : trip.currency}{trip.estimatedCost.toLocaleString()}
                </span>
              )}
              {CertaintyIcon && trip.certaintyScore !== null && (
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 backdrop-blur-sm rounded-full text-xs font-medium ${certainty.color}`}>
                  <CertaintyIcon className="w-3.5 h-3.5" />
                  {trip.certaintyScore}%
                </span>
              )}
            </div>

            {/* Hover Action */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 0 }}
              whileHover={{ opacity: 1, y: 0 }}
              className="mt-4 flex items-center gap-2 text-amber-300 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <span className="text-sm font-medium">View full itinerary</span>
              <ArrowRight className="w-4 h-4" />
            </motion.div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

function TripListItem({ trip, index }: { trip: TripSummary; index: number }) {
  const imageUrl = getDestinationImage(trip.destination);
  const { startDate, endDate, duration } = parseDatesString(trip.dates);
  const certainty = getCertaintyBadge(trip.certaintyLabel, trip.certaintyScore);
  const CertaintyIcon = certainty.icon;

  // Format date range nicely
  const dateRange = startDate && endDate
    ? `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    : trip.dates;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Link href={`/trips/${trip.id}`}>
        <div className="group flex items-center gap-5 p-4 bg-white rounded-2xl shadow-sm hover:shadow-lg transition-all cursor-pointer border border-slate-100 hover:border-amber-200">
          {/* Image */}
          <div
            className="w-24 h-24 rounded-xl bg-cover bg-center flex-shrink-0 shadow-md"
            style={{ backgroundImage: `url(${imageUrl})` }}
          />

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-display font-semibold text-lg text-slate-900 truncate group-hover:text-amber-600 transition-colors">
                {trip.destination}
              </h3>
              {trip.status === 'completed' && (
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded-full font-medium">
                  Completed
                </span>
              )}
              {CertaintyIcon && trip.certaintyScore !== null && (
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                  trip.certaintyLabel === 'high' ? 'bg-emerald-100 text-emerald-700' :
                  trip.certaintyLabel === 'medium' ? 'bg-amber-100 text-amber-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  <CertaintyIcon className="w-3 h-3" />
                  {trip.certaintyScore}%
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 text-slate-500 text-sm flex-wrap">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-slate-400" />
                {dateRange}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-slate-400" />
                {duration} days
              </span>
              <span className="flex items-center gap-1.5">
                <Users className="w-4 h-4 text-slate-400" />
                {trip.travelers}
              </span>
              {trip.estimatedCost && (
                <span className="flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-slate-400" />
                  {trip.currency === 'USD' ? '$' : trip.currency}{trip.estimatedCost.toLocaleString()}
                </span>
              )}
            </div>
          </div>

          {/* Arrow */}
          <div className="flex items-center gap-2 text-slate-400 group-hover:text-amber-500 transition-colors">
            <span className="text-sm font-medium hidden sm:inline opacity-0 group-hover:opacity-100 transition-opacity">View</span>
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
