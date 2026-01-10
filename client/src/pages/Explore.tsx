import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Sidebar } from "@/components/Sidebar";
import { WeatherWidget, WeatherBadge } from "@/components/WeatherWidget";
import {
  Search,
  MapPin,
  Star,
  TrendingUp,
  Sun,
  Mountain,
  Waves,
  Building,
  Utensils,
  Camera,
  Cloud,
  X
} from "lucide-react";
import { useState } from "react";

// Destination categories
const CATEGORIES = [
  { id: 'trending', label: 'Trending', icon: TrendingUp },
  { id: 'beach', label: 'Beach', icon: Waves },
  { id: 'city', label: 'City', icon: Building },
  { id: 'nature', label: 'Nature', icon: Mountain },
  { id: 'adventure', label: 'Adventure', icon: Sun },
  { id: 'food', label: 'Food & Wine', icon: Utensils },
  { id: 'culture', label: 'Culture', icon: Camera },
];

// Featured destinations
const DESTINATIONS = [
  {
    id: 1,
    name: 'Tokyo',
    country: 'Japan',
    image: 'https://images.pexels.com/photos/2506923/pexels-photo-2506923.jpeg?auto=compress&cs=tinysrgb&w=800',
    rating: 4.9,
    category: 'city',
    description: 'Where tradition meets innovation',
    avgBudget: '$150/day'
  },
  {
    id: 2,
    name: 'Bali',
    country: 'Indonesia',
    image: 'https://images.pexels.com/photos/2166559/pexels-photo-2166559.jpeg?auto=compress&cs=tinysrgb&w=800',
    rating: 4.9,
    category: 'beach',
    description: 'Tropical paradise with spiritual vibes',
    avgBudget: '$80/day'
  },
  {
    id: 3,
    name: 'Paris',
    country: 'France',
    image: 'https://images.pexels.com/photos/338515/pexels-photo-338515.jpeg?auto=compress&cs=tinysrgb&w=800',
    rating: 4.8,
    category: 'city',
    description: 'The city of love and lights',
    avgBudget: '$200/day'
  },
  {
    id: 4,
    name: 'Santorini',
    country: 'Greece',
    image: 'https://images.pexels.com/photos/1010657/pexels-photo-1010657.jpeg?auto=compress&cs=tinysrgb&w=800',
    rating: 4.9,
    category: 'beach',
    description: 'Stunning sunsets and white architecture',
    avgBudget: '$180/day'
  },
  {
    id: 5,
    name: 'Rome',
    country: 'Italy',
    image: 'https://images.pexels.com/photos/532263/pexels-photo-532263.jpeg?auto=compress&cs=tinysrgb&w=800',
    rating: 4.7,
    category: 'culture',
    description: 'Ancient history at every corner',
    avgBudget: '$160/day'
  },
  {
    id: 6,
    name: 'Dubai',
    country: 'UAE',
    image: 'https://images.pexels.com/photos/1707310/pexels-photo-1707310.jpeg?auto=compress&cs=tinysrgb&w=800',
    rating: 4.6,
    category: 'city',
    description: 'Luxury and modern marvels',
    avgBudget: '$250/day'
  },
  {
    id: 7,
    name: 'Swiss Alps',
    country: 'Switzerland',
    image: 'https://images.pexels.com/photos/2779863/pexels-photo-2779863.jpeg?auto=compress&cs=tinysrgb&w=800',
    rating: 4.9,
    category: 'nature',
    description: 'Majestic mountains and pristine lakes',
    avgBudget: '$300/day'
  },
  {
    id: 8,
    name: 'Barcelona',
    country: 'Spain',
    image: 'https://images.pexels.com/photos/1386444/pexels-photo-1386444.jpeg?auto=compress&cs=tinysrgb&w=800',
    rating: 4.8,
    category: 'city',
    description: 'Art, architecture and beaches',
    avgBudget: '$140/day'
  },
  {
    id: 9,
    name: 'Maldives',
    country: 'Maldives',
    image: 'https://images.pexels.com/photos/1287460/pexels-photo-1287460.jpeg?auto=compress&cs=tinysrgb&w=800',
    rating: 4.9,
    category: 'beach',
    description: 'Ultimate luxury beach escape',
    avgBudget: '$400/day'
  },
];

export default function Explore() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('trending');
  const [selectedDestination, setSelectedDestination] = useState<typeof DESTINATIONS[0] | null>(null);

  const filteredDestinations = DESTINATIONS.filter(dest => {
    const matchesSearch = dest.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dest.country.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === 'trending' || dest.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const handleDestinationClick = (destination: string) => {
    setLocation(`/create?destination=${encodeURIComponent(destination)}`);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <Sidebar />

      <main className="flex-1 md:ml-[240px]">
        {/* Header */}
        <header className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-slate-200 z-30">
          <div className="px-8 py-6">
            <h1 className="text-3xl font-display font-bold text-slate-900 mb-2">
              Explore the World
            </h1>
            <p className="text-slate-500">
              Discover amazing destinations and start planning your next adventure
            </p>
          </div>

          {/* Search */}
          <div className="px-8 pb-4">
            <div className="relative max-w-xl">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search destinations, countries..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3.5 bg-slate-100 border-0 rounded-2xl text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-amber-500 text-lg"
              />
            </div>
          </div>

          {/* Category Pills */}
          <div className="px-8 pb-4 flex gap-2 overflow-x-auto scrollbar-hide">
            {CATEGORIES.map((category) => (
              <button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium whitespace-nowrap transition-all ${
                  activeCategory === category.id
                    ? 'bg-slate-900 text-white'
                    : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                <category.icon className="w-4 h-4" />
                {category.label}
              </button>
            ))}
          </div>
        </header>

        {/* Content */}
        <div className="p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredDestinations.map((destination, index) => (
              <motion.button
                key={destination.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => handleDestinationClick(`${destination.name}, ${destination.country}`)}
                className="group relative h-80 rounded-3xl overflow-hidden cursor-pointer text-left bg-white shadow-lg shadow-slate-200/50"
              >
                <div
                  className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
                  style={{ backgroundImage: `url(${destination.image})` }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                {/* Weather Badge */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedDestination(destination);
                  }}
                  className="absolute top-4 right-4 hover:scale-105 transition-transform"
                >
                  <WeatherBadge destination={destination.name} />
                </button>

                {/* Content */}
                <div className="absolute inset-0 p-6 flex flex-col justify-end">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex items-center gap-1 bg-white/20 backdrop-blur-sm rounded-full px-2 py-1">
                      <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                      <span className="text-white text-sm font-medium">{destination.rating}</span>
                    </div>
                    <span className="text-white/70 text-sm">{destination.avgBudget}</span>
                  </div>
                  <h3 className="text-2xl font-display font-bold text-white mb-1">
                    {destination.name}
                  </h3>
                  <div className="flex items-center gap-1 text-white/70 text-sm mb-2">
                    <MapPin className="w-3.5 h-3.5" />
                    {destination.country}
                  </div>
                  <p className="text-white/60 text-sm">{destination.description}</p>

                  <div className="mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="inline-flex items-center gap-2 bg-white text-slate-900 px-4 py-2 rounded-full text-sm font-semibold">
                      Plan trip to {destination.name}
                    </span>
                  </div>
                </div>
              </motion.button>
            ))}
          </div>

          {filteredDestinations.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-20"
            >
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-slate-100 flex items-center justify-center">
                <Search className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-xl font-display font-bold text-slate-900 mb-2">
                No destinations found
              </h3>
              <p className="text-slate-500">
                Try searching for a different destination or category
              </p>
            </motion.div>
          )}
        </div>
      </main>

      {/* Weather Panel Modal */}
      <AnimatePresence>
        {selectedDestination && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedDestination(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md"
            >
              <div className="relative">
                <button
                  onClick={() => setSelectedDestination(null)}
                  className="absolute -top-3 -right-3 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center text-slate-500 hover:text-slate-700 z-10"
                >
                  <X className="w-4 h-4" />
                </button>
                <WeatherWidget destination={selectedDestination.name} />
                <div className="mt-4 flex gap-3">
                  <Button
                    onClick={() => {
                      handleDestinationClick(`${selectedDestination.name}, ${selectedDestination.country}`);
                    }}
                    className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl"
                  >
                    Plan trip to {selectedDestination.name}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setSelectedDestination(null)}
                    className="rounded-xl"
                  >
                    Close
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
