import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, MapPin, Clock, TrendingUp, X, Loader2 } from "lucide-react";
import { useLocation } from "wouter";

interface Destination {
  id: string;
  name: string;
  country: string;
  type: 'city' | 'country' | 'region';
  popularity: number;
  image?: string;
  coordinates?: { lat: number; lng: number };
}

// Comprehensive destination database
const DESTINATIONS: Destination[] = [
  // Top Cities
  { id: '1', name: 'Tokyo', country: 'Japan', type: 'city', popularity: 95 },
  { id: '2', name: 'Paris', country: 'France', type: 'city', popularity: 98 },
  { id: '3', name: 'London', country: 'United Kingdom', type: 'city', popularity: 97 },
  { id: '4', name: 'New York', country: 'USA', type: 'city', popularity: 99 },
  { id: '5', name: 'Dubai', country: 'UAE', type: 'city', popularity: 92 },
  { id: '6', name: 'Singapore', country: 'Singapore', type: 'city', popularity: 88 },
  { id: '7', name: 'Barcelona', country: 'Spain', type: 'city', popularity: 90 },
  { id: '8', name: 'Rome', country: 'Italy', type: 'city', popularity: 94 },
  { id: '9', name: 'Bangkok', country: 'Thailand', type: 'city', popularity: 87 },
  { id: '10', name: 'Amsterdam', country: 'Netherlands', type: 'city', popularity: 85 },
  { id: '11', name: 'Sydney', country: 'Australia', type: 'city', popularity: 86 },
  { id: '12', name: 'Hong Kong', country: 'China', type: 'city', popularity: 84 },
  { id: '13', name: 'Istanbul', country: 'Turkey', type: 'city', popularity: 82 },
  { id: '14', name: 'Seoul', country: 'South Korea', type: 'city', popularity: 83 },
  { id: '15', name: 'Los Angeles', country: 'USA', type: 'city', popularity: 88 },

  // Beach Destinations
  { id: '16', name: 'Bali', country: 'Indonesia', type: 'region', popularity: 93 },
  { id: '17', name: 'Maldives', country: 'Maldives', type: 'country', popularity: 89 },
  { id: '18', name: 'Santorini', country: 'Greece', type: 'city', popularity: 91 },
  { id: '19', name: 'Phuket', country: 'Thailand', type: 'city', popularity: 85 },
  { id: '20', name: 'Cancun', country: 'Mexico', type: 'city', popularity: 80 },
  { id: '21', name: 'Miami', country: 'USA', type: 'city', popularity: 82 },
  { id: '22', name: 'Mykonos', country: 'Greece', type: 'city', popularity: 78 },

  // European Cities
  { id: '23', name: 'Vienna', country: 'Austria', type: 'city', popularity: 79 },
  { id: '24', name: 'Prague', country: 'Czech Republic', type: 'city', popularity: 81 },
  { id: '25', name: 'Budapest', country: 'Hungary', type: 'city', popularity: 77 },
  { id: '26', name: 'Lisbon', country: 'Portugal', type: 'city', popularity: 84 },
  { id: '27', name: 'Florence', country: 'Italy', type: 'city', popularity: 83 },
  { id: '28', name: 'Venice', country: 'Italy', type: 'city', popularity: 86 },
  { id: '29', name: 'Berlin', country: 'Germany', type: 'city', popularity: 80 },
  { id: '30', name: 'Munich', country: 'Germany', type: 'city', popularity: 76 },
  { id: '31', name: 'Madrid', country: 'Spain', type: 'city', popularity: 82 },
  { id: '32', name: 'Athens', country: 'Greece', type: 'city', popularity: 78 },

  // Asian Destinations
  { id: '33', name: 'Kyoto', country: 'Japan', type: 'city', popularity: 88 },
  { id: '34', name: 'Osaka', country: 'Japan', type: 'city', popularity: 82 },
  { id: '35', name: 'Ho Chi Minh City', country: 'Vietnam', type: 'city', popularity: 75 },
  { id: '36', name: 'Hanoi', country: 'Vietnam', type: 'city', popularity: 74 },
  { id: '37', name: 'Kuala Lumpur', country: 'Malaysia', type: 'city', popularity: 76 },
  { id: '38', name: 'Taipei', country: 'Taiwan', type: 'city', popularity: 72 },
  { id: '39', name: 'Delhi', country: 'India', type: 'city', popularity: 73 },
  { id: '40', name: 'Mumbai', country: 'India', type: 'city', popularity: 71 },

  // Americas
  { id: '41', name: 'San Francisco', country: 'USA', type: 'city', popularity: 84 },
  { id: '42', name: 'Las Vegas', country: 'USA', type: 'city', popularity: 81 },
  { id: '43', name: 'Chicago', country: 'USA', type: 'city', popularity: 78 },
  { id: '44', name: 'Toronto', country: 'Canada', type: 'city', popularity: 77 },
  { id: '45', name: 'Vancouver', country: 'Canada', type: 'city', popularity: 76 },
  { id: '46', name: 'Buenos Aires', country: 'Argentina', type: 'city', popularity: 74 },
  { id: '47', name: 'Rio de Janeiro', country: 'Brazil', type: 'city', popularity: 79 },
  { id: '48', name: 'Mexico City', country: 'Mexico', type: 'city', popularity: 75 },

  // Middle East & Africa
  { id: '49', name: 'Abu Dhabi', country: 'UAE', type: 'city', popularity: 78 },
  { id: '50', name: 'Marrakech', country: 'Morocco', type: 'city', popularity: 80 },
  { id: '51', name: 'Cairo', country: 'Egypt', type: 'city', popularity: 72 },
  { id: '52', name: 'Cape Town', country: 'South Africa', type: 'city', popularity: 77 },

  // Nordic Countries
  { id: '53', name: 'Reykjavik', country: 'Iceland', type: 'city', popularity: 75 },
  { id: '54', name: 'Copenhagen', country: 'Denmark', type: 'city', popularity: 76 },
  { id: '55', name: 'Stockholm', country: 'Sweden', type: 'city', popularity: 74 },
  { id: '56', name: 'Oslo', country: 'Norway', type: 'city', popularity: 71 },
  { id: '57', name: 'Helsinki', country: 'Finland', type: 'city', popularity: 69 },

  // Oceania
  { id: '58', name: 'Melbourne', country: 'Australia', type: 'city', popularity: 82 },
  { id: '59', name: 'Auckland', country: 'New Zealand', type: 'city', popularity: 74 },
  { id: '60', name: 'Queenstown', country: 'New Zealand', type: 'city', popularity: 78 },
];

// Recent searches (would typically come from localStorage or user data)
const RECENT_SEARCHES = ['Tokyo, Japan', 'Paris, France', 'Bali, Indonesia'];

// Trending destinations
const TRENDING = DESTINATIONS.filter(d => d.popularity >= 90).slice(0, 5);

interface SearchAutocompleteProps {
  placeholder?: string;
  onSelect?: (destination: string) => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showTrending?: boolean;
  navigateOnSelect?: boolean;
}

export function SearchAutocomplete({
  placeholder = "Where do you want to go?",
  onSelect,
  className = '',
  size = 'md',
  showTrending = true,
  navigateOnSelect = true,
}: SearchAutocompleteProps) {
  const [, setLocation] = useLocation();
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState<Destination[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Search destinations - tries Mapbox first, falls back to static list
  const searchDestinations = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    if (searchQuery.length < 2) {
      setResults([]);
      return;
    }

    setIsLoading(true);

    try {
      // Try Mapbox geocoding first
      const response = await fetch(
        `/api/mapbox/geocode?q=${encodeURIComponent(searchQuery)}&types=place,locality,region&limit=8`
      );

      if (response.ok) {
        const data = await response.json();

        if (data.features && data.features.length > 0) {
          // Transform Mapbox results to match our Destination interface
          const mapboxResults: Destination[] = data.features.map((feature: any, index: number) => ({
            id: feature.id || `mapbox-${index}`,
            name: feature.name,
            country: feature.country || feature.fullAddress?.split(', ').pop() || '',
            type: feature.placeType === 'locality' ? 'city' : feature.placeType === 'region' ? 'region' : 'city',
            popularity: 80 - index * 5, // Mapbox already returns results by relevance
            coordinates: feature.coordinates, // Keep coordinates for potential future use
          }));

          setResults(mapboxResults);
          setIsLoading(false);
          setHighlightedIndex(-1);
          return;
        }
      }
    } catch (error) {
      console.log('[Search] Mapbox geocoding failed, using fallback');
    }

    // Fallback to static list
    const query = searchQuery.toLowerCase();
    const filtered = DESTINATIONS.filter(dest =>
      dest.name.toLowerCase().includes(query) ||
      dest.country.toLowerCase().includes(query)
    ).sort((a, b) => {
      // Prioritize exact matches
      const aExact = a.name.toLowerCase().startsWith(query) ? 1 : 0;
      const bExact = b.name.toLowerCase().startsWith(query) ? 1 : 0;
      if (aExact !== bExact) return bExact - aExact;
      // Then sort by popularity
      return b.popularity - a.popularity;
    }).slice(0, 8);

    setResults(filtered);
    setIsLoading(false);
    setHighlightedIndex(-1);
  }, []);

  // Handle input change
  useEffect(() => {
    const timer = setTimeout(() => {
      searchDestinations(query);
    }, 100);
    return () => clearTimeout(timer);
  }, [query, searchDestinations]);

  // Handle click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;

    const items = results.length > 0 ? results : (showTrending ? TRENDING : []);

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev < items.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev > 0 ? prev - 1 : items.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < items.length) {
          handleSelect(items[highlightedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        inputRef.current?.blur();
        break;
    }
  };

  // Handle selection
  const handleSelect = (destination: Destination) => {
    const fullDestination = `${destination.name}, ${destination.country}`;
    setQuery(fullDestination);
    setIsOpen(false);

    if (onSelect) {
      onSelect(fullDestination);
    }

    if (navigateOnSelect) {
      setLocation(`/create?destination=${encodeURIComponent(fullDestination)}`);
    }
  };

  // Size classes
  const sizeClasses = {
    sm: 'h-10 text-sm',
    md: 'h-12 text-base',
    lg: 'h-14 text-lg',
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Search Input */}
      <div className="relative">
        <Search className={`absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 ${iconSizes[size]}`} />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={`w-full pl-12 pr-10 ${sizeClasses[size]} bg-white border border-slate-200 rounded-2xl text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 focus:outline-none transition-all`}
        />
        {query && (
          <button
            onClick={() => {
              setQuery('');
              inputRef.current?.focus();
            }}
            className={`absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 ${iconSizes[size]}`}
          >
            <X className="w-4 h-4" />
          </button>
        )}
        {isLoading && (
          <Loader2 className={`absolute right-4 top-1/2 -translate-y-1/2 text-amber-500 animate-spin ${iconSizes[size]}`} />
        )}
      </div>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden z-50"
          >
            {/* Search Results */}
            {results.length > 0 ? (
              <div className="py-2">
                <div className="px-4 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Destinations
                </div>
                {results.map((dest, index) => (
                  <button
                    key={dest.id}
                    onClick={() => handleSelect(dest)}
                    className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left ${
                      highlightedIndex === index ? 'bg-amber-50' : ''
                    }`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                      <MapPin className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-slate-900">{dest.name}</p>
                      <p className="text-sm text-slate-500">{dest.country}</p>
                    </div>
                    <span className="text-xs text-slate-400 px-2 py-1 bg-slate-100 rounded-full">
                      {dest.type}
                    </span>
                  </button>
                ))}
              </div>
            ) : query ? (
              <div className="py-8 text-center">
                <MapPin className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-slate-500">No destinations found</p>
                <p className="text-sm text-slate-400">Try a different search term</p>
              </div>
            ) : (
              <div className="py-2">
                {/* Recent Searches */}
                {RECENT_SEARCHES.length > 0 && (
                  <>
                    <div className="px-4 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Recent
                    </div>
                    {RECENT_SEARCHES.map((recent, index) => (
                      <button
                        key={index}
                        onClick={() => {
                          setQuery(recent);
                          if (onSelect) onSelect(recent);
                          if (navigateOnSelect) {
                            setLocation(`/create?destination=${encodeURIComponent(recent)}`);
                          }
                          setIsOpen(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors text-left"
                      >
                        <Clock className="w-4 h-4 text-slate-400" />
                        <span className="text-slate-700">{recent}</span>
                      </button>
                    ))}
                  </>
                )}

                {/* Trending */}
                {showTrending && (
                  <>
                    <div className="px-4 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" />
                      Trending
                    </div>
                    {TRENDING.map((dest, index) => (
                      <button
                        key={dest.id}
                        onClick={() => handleSelect(dest)}
                        className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left ${
                          highlightedIndex === index ? 'bg-amber-50' : ''
                        }`}
                      >
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-400 to-pink-500 flex items-center justify-center">
                          <TrendingUp className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-slate-900">{dest.name}</p>
                          <p className="text-sm text-slate-500">{dest.country}</p>
                        </div>
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
