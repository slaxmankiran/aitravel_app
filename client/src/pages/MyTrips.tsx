import { Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  Clock,
  Star,
  MoreHorizontal,
  Trash2,
  Share2,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  ExternalLink,
  Pencil,
  AlertTriangle
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { getVoyageHeaders } from "@/lib/voyageUid";
import { useDestinationImage, getDestinationGradient } from "@/hooks/useDestinationImage";

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
  destinationImageUrl: string | null; // AI-fetched image URL (stored in DB)
  createdAt: string | null;
  updatedAt: string | null;
}

// Filter state type
interface FilterState {
  certainty: 'all' | 'high' | 'medium' | 'low';
  travelStyle: 'all' | 'budget' | 'standard' | 'luxury' | 'adventure';
  timeframe: 'all' | 'upcoming' | 'past';
  travelers: 'all' | 'solo' | 'couple' | 'group';
}

const defaultFilters: FilterState = {
  certainty: 'all',
  travelStyle: 'all',
  timeframe: 'all',
  travelers: 'all',
};

export default function MyTrips() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const filterRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // Close filters when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setShowFilters(false);
      }
    };
    if (showFilters) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showFilters]);

  // Count active filters
  const activeFilterCount = Object.values(filters).filter(v => v !== 'all').length;

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

  // Delete trip mutation
  const deleteMutation = useMutation({
    mutationFn: async (tripId: number) => {
      const res = await fetch(`/api/trips/${tripId}`, {
        method: 'DELETE',
        headers: getVoyageHeaders(),
      });
      if (!res.ok) {
        const error = await res.text().catch(() => 'Delete failed');
        throw new Error(error);
      }
      return tripId;
    },
    onSuccess: (deletedId) => {
      // Optimistically update the cache
      queryClient.setQueryData<{ trips: TripSummary[] }>(['/api/my-trips'], (old) => {
        if (!old) return { trips: [] };
        return { trips: old.trips.filter(t => t.id !== deletedId) };
      });
    },
    onError: (error) => {
      console.error('[MyTrips] Delete failed:', error);
      alert('Failed to delete trip. Please try again.');
    }
  });

  const handleDeleteTrip = (tripId: number) => {
    deleteMutation.mutate(tripId);
  };

  const trips = tripsResponse?.trips || [];

  // Apply all filters
  const filteredTrips = trips.filter(trip => {
    // Search filter
    if (searchQuery && !trip.destination.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }

    // Certainty filter
    if (filters.certainty !== 'all' && trip.certaintyLabel !== filters.certainty) {
      return false;
    }

    // Travel style filter
    if (filters.travelStyle !== 'all') {
      const tripStyle = trip.travelStyle?.toLowerCase();
      if (tripStyle !== filters.travelStyle) {
        return false;
      }
    }

    // Timeframe filter (upcoming vs past)
    if (filters.timeframe !== 'all') {
      const { startDate } = parseDatesString(trip.dates);
      const now = new Date();
      if (filters.timeframe === 'upcoming' && startDate && startDate < now) {
        return false;
      }
      if (filters.timeframe === 'past' && startDate && startDate >= now) {
        return false;
      }
    }

    // Travelers filter
    if (filters.travelers !== 'all') {
      if (filters.travelers === 'solo' && trip.travelers !== 1) return false;
      if (filters.travelers === 'couple' && trip.travelers !== 2) return false;
      if (filters.travelers === 'group' && trip.travelers < 3) return false;
    }

    return true;
  });

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
            <div className="relative" ref={filterRef}>
              <Button
                variant="outline"
                className={`rounded-xl border-slate-200 ${activeFilterCount > 0 ? 'border-amber-400 bg-amber-50' : ''}`}
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="w-4 h-4 mr-2" />
                Filters
                {activeFilterCount > 0 && (
                  <span className="ml-2 w-5 h-5 rounded-full bg-amber-500 text-white text-xs flex items-center justify-center">
                    {activeFilterCount}
                  </span>
                )}
              </Button>

              {/* Filters Dropdown */}
              <AnimatePresence>
                {showFilters && (
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    className="absolute top-full mt-2 right-0 bg-white rounded-2xl shadow-xl border border-slate-200 p-4 min-w-[280px] z-30"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-slate-900">Filters</h3>
                      {activeFilterCount > 0 && (
                        <button
                          onClick={() => setFilters(defaultFilters)}
                          className="text-xs text-amber-600 hover:text-amber-700 font-medium"
                        >
                          Clear all
                        </button>
                      )}
                    </div>

                    {/* Certainty Filter */}
                    <div className="mb-4">
                      <label className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2 block">
                        Certainty Level
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { value: 'all', label: 'All' },
                          { value: 'high', label: 'High', color: 'emerald' },
                          { value: 'medium', label: 'Medium', color: 'amber' },
                          { value: 'low', label: 'Low', color: 'red' },
                        ].map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() => setFilters(f => ({ ...f, certainty: opt.value as FilterState['certainty'] }))}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                              filters.certainty === opt.value
                                ? opt.value === 'all'
                                  ? 'bg-slate-900 text-white'
                                  : opt.color === 'emerald'
                                    ? 'bg-emerald-500 text-white'
                                    : opt.color === 'amber'
                                      ? 'bg-amber-500 text-white'
                                      : 'bg-red-500 text-white'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Travel Style Filter */}
                    <div className="mb-4">
                      <label className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2 block">
                        Travel Style
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { value: 'all', label: 'All' },
                          { value: 'budget', label: 'Budget' },
                          { value: 'standard', label: 'Standard' },
                          { value: 'luxury', label: 'Luxury' },
                          { value: 'adventure', label: 'Adventure' },
                        ].map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() => setFilters(f => ({ ...f, travelStyle: opt.value as FilterState['travelStyle'] }))}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                              filters.travelStyle === opt.value
                                ? 'bg-slate-900 text-white'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Timeframe Filter */}
                    <div className="mb-4">
                      <label className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2 block">
                        Timeframe
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { value: 'all', label: 'All' },
                          { value: 'upcoming', label: 'Upcoming' },
                          { value: 'past', label: 'Past' },
                        ].map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() => setFilters(f => ({ ...f, timeframe: opt.value as FilterState['timeframe'] }))}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                              filters.timeframe === opt.value
                                ? 'bg-slate-900 text-white'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Travelers Filter */}
                    <div>
                      <label className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2 block">
                        Travelers
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { value: 'all', label: 'All' },
                          { value: 'solo', label: 'Solo (1)' },
                          { value: 'couple', label: 'Couple (2)' },
                          { value: 'group', label: 'Group (3+)' },
                        ].map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() => setFilters(f => ({ ...f, travelers: opt.value as FilterState['travelers'] }))}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                              filters.travelers === opt.value
                                ? 'bg-slate-900 text-white'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Results count */}
                    <div className="mt-4 pt-4 border-t border-slate-100">
                      <p className="text-sm text-slate-500">
                        Showing <span className="font-medium text-slate-900">{filteredTrips.length}</span> of{' '}
                        <span className="font-medium text-slate-900">{trips.length}</span> trips
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
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
                <TripCard key={trip.id} trip={trip} index={index} onDelete={handleDeleteTrip} />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredTrips.map((trip, index) => (
                <TripListItem key={trip.id} trip={trip} index={index} onDelete={handleDeleteTrip} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// Parse dates string - handles multiple formats:
// 1. "May 15, 2026 - May 31, 2026" (form flow)
// 2. "6/1/2026 - 6/5/2026" (chat specific dates)
// 3. "June 2026, 5 days" (chat flexible dates)
// 4. "2026-04-01 to 2026-04-15" (ISO format)
function parseDatesString(dates: string): { startDate: Date | null; endDate: Date | null; duration: number } {
  if (!dates) return { startDate: null, endDate: null, duration: 0 };

  // Format 3: Flexible dates "June 2026, 5 days" or "July 2026, 7 days"
  const flexibleMatch = dates.match(/^(\w+)\s+(\d{4}),?\s*(\d+)\s*days?$/i);
  if (flexibleMatch) {
    const [, month, year, days] = flexibleMatch;
    const duration = parseInt(days, 10);
    // Create approximate start date (1st of month)
    const startDate = new Date(`${month} 1, ${year}`);
    if (!isNaN(startDate.getTime())) {
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + duration - 1);
      return { startDate, endDate, duration };
    }
  }

  // Format 1 & 2: Date ranges with separator
  // Priority: " to " first, then " - " (with spaces to avoid splitting ISO dates)
  let parts: string[] = [];
  if (dates.includes(' to ')) {
    parts = dates.split(/\s+to\s+/i);
  } else if (dates.includes(' - ')) {
    parts = dates.split(/\s+-\s+/);
  } else if (dates.includes(' – ')) {
    parts = dates.split(/\s+–\s+/);
  }

  if (parts.length >= 2) {
    const startStr = parts[0].trim();
    const endStr = parts[parts.length - 1].trim();

    // Validate both parts look like dates (not just single numbers)
    const looksLikeDate = (s: string) => {
      // Contains month name OR has ISO format OR US format
      return /[a-zA-Z]/.test(s) || /\d{4}-\d{2}-\d{2}/.test(s) || /\d{1,2}\/\d{1,2}\/\d{4}/.test(s);
    };

    if (looksLikeDate(startStr) && looksLikeDate(endStr)) {
      const start = new Date(startStr);
      const end = new Date(endStr);
      if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
        const duration = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        // Only return if duration is positive and reasonable (< 365 days)
        if (duration > 0 && duration < 365) {
          return { startDate: start, endDate: end, duration };
        }
      }
    }
  }

  // Fallback: try parsing the whole string as a single date
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

// Format currency with proper symbols and spacing
function formatCurrency(amount: number, currencyCode: string): string {
  const symbols: Record<string, string> = {
    'USD': '$',
    'CAD': 'C$',
    'AUD': 'A$',
    'NZD': 'NZ$',
    'EUR': '€',
    'GBP': '£',
    'JPY': '¥',
    'CNY': '¥',
    'INR': '₹',
    'SGD': 'S$',
    'HKD': 'HK$',
    'THB': '฿',
    'VND': '₫',
    'KRW': '₩',
    'MYR': 'RM',
    'PHP': '₱',
    'IDR': 'Rp',
    'TWD': 'NT$',
    'CHF': 'CHF',
    'SEK': 'kr',
    'NOK': 'kr',
    'DKK': 'kr',
    'MXN': 'MX$',
    'BRL': 'R$',
    'ZAR': 'R',
    'AED': 'AED',
  };

  const symbol = symbols[currencyCode.toUpperCase()] || currencyCode;
  return `${symbol} ${amount.toLocaleString()}`;
}

function TripCard({ trip, index, onDelete }: { trip: TripSummary; index: number; onDelete?: (id: number) => void }) {
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [, navigate] = useLocation();
  const menuRef = useRef<HTMLDivElement>(null);

  // Dynamic image fetching with caching
  const { imageUrl } = useDestinationImage(trip.destination, trip.destinationImageUrl);
  const gradientFallback = getDestinationGradient(trip.destination);
  const { startDate, endDate, duration } = parseDatesString(trip.dates);
  const certainty = getCertaintyBadge(trip.certaintyLabel, trip.certaintyScore);
  const CertaintyIcon = certainty.icon;

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showMenu]);

  // Format date range nicely
  const dateRange = startDate && endDate
    ? (startDate.getMonth() === endDate.getMonth()
      ? `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.getDate()}`
      : `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`)
    : trip.dates;

  // Menu handlers
  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const url = `${window.location.origin}/trips/${trip.id}/results-v1`;
    try {
      await navigator.clipboard.writeText(url);
      alert('Trip link copied to clipboard!');
    } catch {
      // Fallback for browsers that don't support clipboard
      window.open(url, '_blank');
    }
    setShowMenu(false);
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigate(`/create?editTripId=${trip.id}&returnTo=/trips`);
    setShowMenu(false);
  };

  const handleOpenInNewTab = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    window.open(`/trips/${trip.id}/results-v1`, '_blank');
    setShowMenu(false);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowDeleteConfirm(true);
    setShowMenu(false);
  };

  const handleConfirmDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDelete?.(trip.id);
    setShowDeleteConfirm(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="relative"
    >
      {/* Menu Button - OUTSIDE the Link to prevent navigation */}
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setShowMenu(!showMenu);
        }}
        className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center text-slate-600 hover:bg-white transition-colors shadow-lg"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>

      {/* Menu Dropdown - OUTSIDE the Link */}
      <AnimatePresence>
        {showMenu && (
          <motion.div
            ref={menuRef}
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            className="absolute top-14 right-4 bg-white rounded-xl shadow-xl py-2 min-w-[160px] z-20"
          >
            <button
              onClick={handleOpenInNewTab}
              className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
            >
              <ExternalLink className="w-4 h-4" /> Open in new tab
            </button>
            <button
              onClick={handleEdit}
              className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
            >
              <Pencil className="w-4 h-4" /> Edit trip
            </button>
            <button
              onClick={handleShare}
              className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
            >
              <Share2 className="w-4 h-4" /> Copy link
            </button>
            <div className="h-px bg-slate-100 my-1" />
            <button
              onClick={handleDeleteClick}
              className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" /> Delete trip
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal - OUTSIDE the Link */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm z-30 flex items-center justify-center p-4 rounded-3xl"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowDeleteConfirm(false);
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl p-5 max-w-[280px] shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <h4 className="font-semibold text-slate-900">Delete trip?</h4>
              </div>
              <p className="text-sm text-slate-600 mb-4">
                This will permanently delete your trip to <strong>{trip.destination}</strong>. This action cannot be undone.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowDeleteConfirm(false);
                  }}
                  className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDelete}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Link href={`/trips/${trip.id}/results-v1`}>
        <div className="group relative h-80 rounded-3xl overflow-hidden cursor-pointer bg-white shadow-lg shadow-slate-200/50 hover:shadow-2xl hover:shadow-slate-300/50 transition-all duration-300">
          {/* Background Image with Parallax Effect - or gradient fallback */}
          <div
            className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110"
            style={imageUrl
              ? { backgroundImage: `url(${imageUrl})` }
              : { background: gradientFallback }
            }
          />

          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/10" />

          {/* Top Badge - Duration only (menu button is now outside) */}
          <div className="absolute top-4 left-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/90 backdrop-blur-sm rounded-full text-xs font-medium text-slate-700 shadow-lg">
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              {duration > 0 ? `${duration} days` : 'TBD'}
            </span>
          </div>

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
                  {formatCurrency(trip.estimatedCost, trip.currency)}
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

function TripListItem({ trip, index, onDelete }: { trip: TripSummary; index: number; onDelete?: (id: number) => void }) {
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [, navigate] = useLocation();
  const menuRef = useRef<HTMLDivElement>(null);

  // Dynamic image fetching with caching
  const { imageUrl } = useDestinationImage(trip.destination, trip.destinationImageUrl);
  const gradientFallback = getDestinationGradient(trip.destination);
  const { startDate, endDate, duration } = parseDatesString(trip.dates);
  const certainty = getCertaintyBadge(trip.certaintyLabel, trip.certaintyScore);
  const CertaintyIcon = certainty.icon;

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showMenu]);

  // Format date range nicely
  const dateRange = startDate && endDate
    ? `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    : trip.dates;

  // Menu handlers
  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const url = `${window.location.origin}/trips/${trip.id}/results-v1`;
    try {
      await navigator.clipboard.writeText(url);
      alert('Trip link copied to clipboard!');
    } catch {
      window.open(url, '_blank');
    }
    setShowMenu(false);
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigate(`/create?editTripId=${trip.id}&returnTo=/trips`);
    setShowMenu(false);
  };

  const handleOpenInNewTab = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    window.open(`/trips/${trip.id}/results-v1`, '_blank');
    setShowMenu(false);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowDeleteConfirm(true);
    setShowMenu(false);
  };

  const handleConfirmDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDelete?.(trip.id);
    setShowDeleteConfirm(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="relative"
    >
      {/* Menu Dropdown */}
      <AnimatePresence>
        {showMenu && (
          <motion.div
            ref={menuRef}
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            className="absolute top-12 right-4 bg-white rounded-xl shadow-xl py-2 min-w-[160px] z-20 border border-slate-100"
          >
            <button
              onClick={handleOpenInNewTab}
              className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
            >
              <ExternalLink className="w-4 h-4" /> Open in new tab
            </button>
            <button
              onClick={handleEdit}
              className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
            >
              <Pencil className="w-4 h-4" /> Edit trip
            </button>
            <button
              onClick={handleShare}
              className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
            >
              <Share2 className="w-4 h-4" /> Copy link
            </button>
            <div className="h-px bg-slate-100 my-1" />
            <button
              onClick={handleDeleteClick}
              className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" /> Delete trip
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowDeleteConfirm(false);
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl p-5 max-w-[320px] shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <h4 className="font-semibold text-slate-900">Delete trip?</h4>
              </div>
              <p className="text-sm text-slate-600 mb-4">
                This will permanently delete your trip to <strong>{trip.destination}</strong>. This action cannot be undone.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowDeleteConfirm(false);
                  }}
                  className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDelete}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Link href={`/trips/${trip.id}/results-v1`}>
        <div className="group flex items-center gap-5 p-4 bg-white rounded-2xl shadow-sm hover:shadow-lg transition-all cursor-pointer border border-slate-100 hover:border-amber-200">
          {/* Image */}
          <div
            className="w-24 h-24 rounded-xl bg-cover bg-center flex-shrink-0 shadow-md"
            style={imageUrl
              ? { backgroundImage: `url(${imageUrl})` }
              : { background: gradientFallback }
            }
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
                {duration > 0 ? `${duration} days` : 'TBD'}
              </span>
              <span className="flex items-center gap-1.5">
                <Users className="w-4 h-4 text-slate-400" />
                {trip.travelers}
              </span>
              {trip.estimatedCost && (
                <span className="flex items-center gap-1.5">
                  {formatCurrency(trip.estimatedCost, trip.currency)}
                </span>
              )}
            </div>
          </div>

          {/* Menu Button */}
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>
      </Link>
    </motion.div>
  );
}
