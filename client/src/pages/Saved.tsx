import { Link } from "wouter";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Sidebar } from "@/components/Sidebar";
import {
  Bookmark,
  MapPin,
  Plus,
  Heart,
  Star,
  Filter,
  Grid,
  List,
  ExternalLink
} from "lucide-react";
import { useState } from "react";

// Mock saved places data
const SAVED_PLACES = [
  {
    id: 1,
    name: "Shibuya Crossing",
    location: "Tokyo, Japan",
    category: "Landmark",
    image: "https://images.pexels.com/photos/2506923/pexels-photo-2506923.jpeg?auto=compress&cs=tinysrgb&w=600",
    notes: "Must see at night for the full experience",
    savedAt: new Date("2024-01-15"),
  },
  {
    id: 2,
    name: "Eiffel Tower",
    location: "Paris, France",
    category: "Landmark",
    image: "https://images.pexels.com/photos/338515/pexels-photo-338515.jpeg?auto=compress&cs=tinysrgb&w=600",
    notes: "Book sunset tickets in advance",
    savedAt: new Date("2024-01-10"),
  },
  {
    id: 3,
    name: "Tanah Lot Temple",
    location: "Bali, Indonesia",
    category: "Temple",
    image: "https://images.pexels.com/photos/2166559/pexels-photo-2166559.jpeg?auto=compress&cs=tinysrgb&w=600",
    notes: "Best at sunset, arrive early",
    savedAt: new Date("2024-01-05"),
  },
  {
    id: 4,
    name: "Colosseum",
    location: "Rome, Italy",
    category: "Historical",
    image: "https://images.pexels.com/photos/532263/pexels-photo-532263.jpeg?auto=compress&cs=tinysrgb&w=600",
    notes: "Get skip-the-line tickets",
    savedAt: new Date("2024-01-01"),
  },
];

const SAVED_TRIPS = [
  {
    id: 1,
    title: "Japan Cherry Blossom Tour",
    destinations: ["Tokyo", "Kyoto", "Osaka"],
    duration: "10 days",
    image: "https://images.pexels.com/photos/1440476/pexels-photo-1440476.jpeg?auto=compress&cs=tinysrgb&w=600",
    savedAt: new Date("2024-01-20"),
  },
  {
    id: 2,
    title: "European Adventure",
    destinations: ["Paris", "Rome", "Barcelona"],
    duration: "14 days",
    image: "https://images.pexels.com/photos/338515/pexels-photo-338515.jpeg?auto=compress&cs=tinysrgb&w=600",
    savedAt: new Date("2024-01-18"),
  },
];

export default function Saved() {
  const [activeTab, setActiveTab] = useState<'places' | 'trips'>('places');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <Sidebar />

      <main className="flex-1 md:ml-[240px]">
        {/* Header */}
        <header className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-slate-200 z-30">
          <div className="px-8 py-6">
            <h1 className="text-3xl font-display font-bold text-slate-900 mb-2">
              Saved
            </h1>
            <p className="text-slate-500">
              Your collection of places and trip ideas
            </p>
          </div>

          {/* Tabs */}
          <div className="px-8 pb-4 flex items-center justify-between">
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab('places')}
                className={`px-4 py-2 rounded-full font-medium transition-colors ${
                  activeTab === 'places'
                    ? 'bg-slate-900 text-white'
                    : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                <MapPin className="w-4 h-4 inline mr-2" />
                Places ({SAVED_PLACES.length})
              </button>
              <button
                onClick={() => setActiveTab('trips')}
                className={`px-4 py-2 rounded-full font-medium transition-colors ${
                  activeTab === 'trips'
                    ? 'bg-slate-900 text-white'
                    : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                <Bookmark className="w-4 h-4 inline mr-2" />
                Trip Ideas ({SAVED_TRIPS.length})
              </button>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" className="rounded-xl border-slate-200">
                <Filter className="w-4 h-4 mr-2" />
                Filter
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
          </div>
        </header>

        {/* Content */}
        <div className="p-8">
          {activeTab === 'places' ? (
            SAVED_PLACES.length === 0 ? (
              <EmptyState type="places" />
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {SAVED_PLACES.map((place, index) => (
                  <PlaceCard key={place.id} place={place} index={index} />
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {SAVED_PLACES.map((place, index) => (
                  <PlaceListItem key={place.id} place={place} index={index} />
                ))}
              </div>
            )
          ) : (
            SAVED_TRIPS.length === 0 ? (
              <EmptyState type="trips" />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {SAVED_TRIPS.map((trip, index) => (
                  <TripIdeaCard key={trip.id} trip={trip} index={index} />
                ))}
              </div>
            )
          )}
        </div>
      </main>
    </div>
  );
}

function PlaceCard({ place, index }: { place: typeof SAVED_PLACES[0]; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-shadow"
    >
      <div className="relative h-48">
        <img
          src={place.image}
          alt={place.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <button className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 flex items-center justify-center text-rose-500 hover:bg-white transition-colors">
          <Heart className="w-4 h-4 fill-current" />
        </button>
        <span className="absolute bottom-3 left-3 px-2 py-1 bg-white/90 rounded-full text-xs font-medium text-slate-700">
          {place.category}
        </span>
      </div>
      <div className="p-4">
        <h3 className="font-display font-semibold text-slate-900 mb-1">{place.name}</h3>
        <p className="text-sm text-slate-500 flex items-center gap-1">
          <MapPin className="w-3 h-3" />
          {place.location}
        </p>
        {place.notes && (
          <p className="text-xs text-slate-400 mt-2 line-clamp-2">{place.notes}</p>
        )}
      </div>
    </motion.div>
  );
}

function PlaceListItem({ place, index }: { place: typeof SAVED_PLACES[0]; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="group flex items-center gap-4 p-4 bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow"
    >
      <img
        src={place.image}
        alt={place.name}
        className="w-20 h-20 rounded-xl object-cover flex-shrink-0"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-display font-semibold text-slate-900">{place.name}</h3>
          <span className="px-2 py-0.5 bg-slate-100 rounded-full text-xs text-slate-600">
            {place.category}
          </span>
        </div>
        <p className="text-sm text-slate-500 flex items-center gap-1">
          <MapPin className="w-3 h-3" />
          {place.location}
        </p>
        {place.notes && (
          <p className="text-xs text-slate-400 mt-1">{place.notes}</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors">
          <Heart className="w-4 h-4 fill-current" />
        </button>
        <button className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors">
          <ExternalLink className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
}

function TripIdeaCard({ trip, index }: { trip: typeof SAVED_TRIPS[0]; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-shadow"
    >
      <div className="relative h-48">
        <img
          src={trip.image}
          alt={trip.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <button className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 flex items-center justify-center text-amber-500 hover:bg-white transition-colors">
          <Bookmark className="w-4 h-4 fill-current" />
        </button>
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-4">
          <h3 className="font-display font-bold text-white text-lg">{trip.title}</h3>
        </div>
      </div>
      <div className="p-4">
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-3">
          <MapPin className="w-4 h-4" />
          <span>{trip.destinations.join(' → ')}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-600">{trip.duration}</span>
          <Link href={`/chat?trip=${trip.id}`}>
            <Button size="sm" className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl">
              Plan This Trip
            </Button>
          </Link>
        </div>
      </div>
    </motion.div>
  );
}

function EmptyState({ type }: { type: 'places' | 'trips' }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center py-20"
    >
      <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-amber-100 flex items-center justify-center">
        {type === 'places' ? (
          <Heart className="w-10 h-10 text-amber-600" />
        ) : (
          <Bookmark className="w-10 h-10 text-amber-600" />
        )}
      </div>
      <h2 className="text-2xl font-display font-bold text-slate-900 mb-3">
        {type === 'places' ? 'No saved places yet' : 'No saved trip ideas yet'}
      </h2>
      <p className="text-slate-500 mb-8 max-w-md mx-auto">
        {type === 'places'
          ? 'Start exploring and save places you want to visit on your trips.'
          : 'Save trip ideas from Explore or create your own to plan later.'}
      </p>
      <Link href="/explore">
        <Button className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl px-8">
          <Plus className="w-4 h-4 mr-2" />
          Explore Destinations
        </Button>
      </Link>
    </motion.div>
  );
}
